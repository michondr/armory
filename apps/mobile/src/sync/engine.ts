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

export type SyncResult =
  | { ok: true; pulled: number; pushed: number; images: number }
  | { ok: false; reason: 'offline' | 'error'; message?: string };

let running = false;

/**
 * One full sync cycle: push local changes, pull server changes (LWW applied
 * locally), then drain the image upload queue. Safe to call often; it no-ops if
 * a sync is already in flight. Offline is a soft failure (we just try again later).
 */
export async function runSync(deviceId: string, deviceName: string): Promise<SyncResult> {
  if (running) return { ok: false, reason: 'error', message: 'already running' };
  running = true;
  try {
    const pushed = await pushChanges(deviceId, deviceName);
    const pulled = await pullChanges();
    // Images last: rows referencing them are already synced, so uploading and
    // rewriting the path will be picked up on the next push.
    const images = await drainImageQueue();
    return { ok: true, pushed, pulled, images };
  } catch (err) {
    if (err instanceof OfflineError) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) };
  } finally {
    running = false;
  }
}

async function pushChanges(deviceId: string, deviceName: string): Promise<number> {
  const changes: SyncChanges = {};
  let count = 0;
  for (const table of SYNC_TABLES) {
    const dirty = await getDirtyRows(table);
    // Don't push rows whose image hasn't uploaded yet — send them once the path
    // is a server path, so the server never stores a local file:// URI.
    const ready = dirty.filter((r) => !isLocalUri(r.imagePath as string | null));
    if (ready.length) {
      (changes as Record<string, Row[]>)[table] = ready;
      count += ready.length;
    }
  }
  if (count === 0) return 0;

  const input: SyncPushInput = {
    device: { id: deviceId, name: deviceName, platform: 'android' },
    changes,
  };
  const res = await syncApi.push(input);

  // Apply authoritative rows (clears dirty), drop remapped local ids.
  await applyChanges(res.applied);
  for (const r of res.remapped) {
    await deleteLocalRow(r.table, r.fromId);
  }
  return count;
}

async function pullChanges(): Promise<number> {
  const since = (await getSyncState(CURSOR_KEY)) ?? undefined;
  const res = await syncApi.pull(since);
  const applied = await applyChanges(res.changes);
  await setSyncState(CURSOR_KEY, res.cursor);
  return applied;
}

async function applyChanges(changes: SyncChanges): Promise<number> {
  let n = 0;
  // Parent tables first so child rows never reference a not-yet-written parent.
  for (const table of SYNC_TABLES) {
    const rows = (changes as Record<string, Row[] | undefined>)[table];
    if (!rows?.length) continue;
    for (const row of rows) {
      await applyServer(table as SyncTable, row);
      n++;
    }
  }
  return n;
}
