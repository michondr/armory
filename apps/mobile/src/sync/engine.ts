import {
  SYNC_TABLES,
  type SyncChanges,
  type SyncPushInput,
  type SyncTable,
} from '@armory/shared';
import { getSyncState, setSyncState } from '../db/client';
import { applyServer, deleteLocalRow, getDirtyRows, type Row } from '../db/repo';
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
 * failure (try again later). `onPhase` reports coarse progress to the UI.
 */
export async function runSync(
  deviceId: string,
  deviceName: string,
  onPhase?: (phase: SyncPhase) => void,
): Promise<SyncResult> {
  if (running) return { ok: false, reason: 'error', message: 'already running' };
  running = true;
  const skipped: SkippedRow[] = [];
  try {
    onPhase?.('images');
    // Images first (see above). A failed upload of one image shouldn't abort
    // the whole sync — but a network failure throws OfflineError and we bail.
    const images = await drainImageQueue();

    onPhase?.('push');
    const pushed = await pushChanges(deviceId, deviceName, skipped);

    onPhase?.('pull');
    const pulled = await pullChanges();

    return { ok: true, pushed, pulled, images, skipped };
  } catch (err) {
    if (err instanceof OfflineError) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) };
  } finally {
    running = false;
  }
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
  // locally so the next sync retries.
  await applyChanges(res.applied);
  for (const r of res.remapped) {
    await deleteLocalRow(r.table, r.fromId);
  }
  for (const s of res.skipped ?? []) {
    skipped.push({ table: s.table, id: s.id, reason: s.reason });
  }
  return counts;
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