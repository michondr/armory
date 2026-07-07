import {
  SYNC_TABLES,
  type SyncChanges,
  type SyncPushInput,
  type SyncTable,
} from '@armory/shared';
import { getSyncState, setSyncState } from '../db/client';
import { applyPushedRow, applyServer, deleteLocalRow, getDirtyRows, type Row } from '../db/repo';
import { OfflineError, syncApi } from '../lib/api';
import { drainImageQueue, isLocalUri } from './images';

const CURSOR_KEY = 'cursor';

/** Per-table counts for the sync summary (only tables with >0 are listed). */
export type SyncTableCounts = Partial<Record<SyncTable, number>>;

export interface SkippedRow {
  table: string;
  id: string;
  reason: string;
}

export type SyncPhase = 'images' | 'push' | 'pull';

/** One line in the sync log shown in the Settings diagnostics panel. */
export interface SyncLogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export type SyncResult =
  | {
      ok: true;
      pushed: SyncTableCounts;
      pulled: SyncTableCounts;
      images: number;
      skipped: SkippedRow[];
    }
  | { ok: false; reason: 'offline' | 'error'; message?: string };

let running = false;

/**
 * One full sync cycle. Order matters: **drain the image upload queue first**, so
 * any row whose `imagePath` is a local file URI is rewritten to a server path
 * *before* we push. Otherwise a freshly-photographed target is held back (its
 * row would carry a `file://` URI), its shots push without their parent and get
 * skipped by the server, and nothing lands until a later cycle. Draining first
 * makes a target + its shots + its photo land in a single sync.
 *
 * Safe to call often; no-ops if a sync is already in flight. Offline is a soft
 * failure (try again later). `onPhase` reports coarse progress to the UI;
 * `onLog` receives a fine-grained, timestamped line per step so the Settings
 * diagnostics panel can show what actually happened (which phase ran, what was
 * pushed/pulled, which rows the server skipped, or why it failed).
 */
export async function runSync(
  deviceId: string,
  deviceName: string,
  onPhase?: (phase: SyncPhase) => void,
  onLog?: (entry: SyncLogEntry) => void,
): Promise<SyncResult> {
  if (running) {
    onLog?.({ ts: new Date().toISOString(), level: 'warn', message: 'Sync already running' });
    return { ok: false, reason: 'error', message: 'already running' };
  }
  running = true;
  const skipped: SkippedRow[] = [];
  const log = (level: SyncLogEntry['level'], message: string): void => {
    onLog?.({ ts: new Date().toISOString(), level, message });
  };
  log('info', 'Sync started');
  try {
    onPhase?.('images');
    // Images first (see above). A failed upload of one image shouldn't abort
    // the whole sync — but a network failure throws OfflineError and we bail.
    const images = await drainImageQueue();
    log('info', images > 0 ? `Uploaded ${images} image${images === 1 ? '' : 's'}` : 'No images to upload');

    onPhase?.('push');
    const pushed = await pushChanges(deviceId, deviceName, skipped);
    const pushedN = sumCounts(pushed);
    log(
      'info',
      pushedN > 0
        ? `Pushed ${pushedN} change${pushedN === 1 ? '' : 's'}: ${formatCounts(pushed)}`
        : 'Nothing dirty to push',
    );
    for (const s of skipped) log('warn', `Skipped ${s.table}/${s.id}: ${s.reason}`);

    onPhase?.('pull');
    const pulled = await pullChanges();
    const pulledN = sumCounts(pulled);
    log(
      'info',
      pulledN > 0
        ? `Pulled ${pulledN} change${pulledN === 1 ? '' : 's'}: ${formatCounts(pulled)}`
        : 'Nothing new to pull',
    );

    log('info', 'Sync complete');
    return { ok: true, pushed, pulled, images, skipped };
  } catch (err) {
    if (err instanceof OfflineError) {
      log('error', 'Sync failed: device is offline');
      return { ok: false, reason: 'offline' };
    }
    const message = err instanceof Error ? err.message : String(err);
    log('error', `Sync failed: ${message}`);
    return { ok: false, reason: 'error', message };
  } finally {
    running = false;
  }
}

function sumCounts(counts: SyncTableCounts): number {
  return Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0);
}

function formatCounts(counts: SyncTableCounts): string {
  const entries = Object.entries(counts).filter(([, n]) => (n ?? 0) > 0);
  if (entries.length === 0) return '';
  return entries.map(([table, n]) => `${n} ${table}`).join(', ');
}

async function pushChanges(deviceId: string, deviceName: string, skipped: SkippedRow[]): Promise<SyncTableCounts> {
  const changes: SyncChanges = {};
  const counts: SyncTableCounts = {};
  let total = 0;
  for (const table of SYNC_TABLES) {
    const dirty = await getDirtyRows(table);
    // Don't push rows whose image hasn't uploaded yet — send them once the path
    // is a server path, so the server never stores a local file:// URI. (Draining
    // first means this is rare, but a just-queued capture mid-sync can still hit it.)
    const ready = dirty.filter((r) => !isLocalUri(r.imagePath as string | null));
    if (ready.length) {
      (changes as Record<string, Row[]>)[table] = ready;
      counts[table] = ready.length;
      total += ready.length;
    }
  }
  if (total === 0) return counts;

  const input: SyncPushInput = {
    device: { id: deviceId, name: deviceName, platform: 'android' },
    changes,
  };
  const res = await syncApi.push(input);

  // Apply authoritative rows (clears dirty), drop remapped local ids. The server
  // returns `skipped` for rows it rejected (e.g. a child whose parent isn't on
  // the server yet) — collect them so the UI can show why, and leave them dirty
  // locally so the next sync retries. Use the push-aware applier (not the LWW
  // pull applier) so clock skew can't strand an accepted row as dirty forever.
  await applyPushResponse(res.applied, changes);
  for (const r of res.remapped) {
    await deleteLocalRow(r.table, r.fromId);
  }
  for (const s of res.skipped ?? []) {
    skipped.push({ table: s.table, id: s.id, reason: s.reason });
  }
  return counts;
}

/**
 * Apply the server's authoritative rows from a push response. Distinct from
 * `applyChanges` (used for pulls): each row is reconciled against the snapshot
 * we pushed via `applyPushedRow`, so a row the server accepted is marked clean
 * even when the device clock is ahead of the server clock. See the doc on
 * `applyPushedRow` for why comparing the pushed snapshot beats comparing clocks.
 */
async function applyPushResponse(applied: SyncChanges, pushed: SyncChanges): Promise<void> {
  for (const table of SYNC_TABLES) {
    const serverRows = (applied as Record<string, Row[] | undefined>)[table];
    if (!serverRows?.length) continue;
    const pushedRows = (pushed as Record<string, Row[] | undefined>)[table] ?? [];
    const pushedAt = new Map(pushedRows.map((r) => [String(r.id), String(r.updatedAt)]));
    for (const wire of serverRows) {
      await applyPushedRow(table as SyncTable, wire, pushedAt.get(String(wire.id)));
    }
  }
}

async function pullChanges(): Promise<SyncTableCounts> {
  const since = (await getSyncState(CURSOR_KEY)) ?? undefined;
  const res = await syncApi.pull(since);
  const applied = await applyChanges(res.changes);
  await setSyncState(CURSOR_KEY, res.cursor);
  return applied;
}

async function applyChanges(changes: SyncChanges): Promise<SyncTableCounts> {
  const counts: SyncTableCounts = {};
  let n = 0;
  // Parent tables first so child rows never reference a not-yet-written parent.
  for (const table of SYNC_TABLES) {
    const rows = (changes as Record<string, Row[] | undefined>)[table];
    if (!rows?.length) continue;
    for (const row of rows) {
      await applyServer(table as SyncTable, row);
    }
    counts[table as SyncTable] = rows.length;
    n += rows.length;
  }
  return n === 0 ? {} : counts;
}