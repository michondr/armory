import type { SyncTable } from '@armory/shared';
import { getDb } from '../db/client';
import { newId, nowIso, upsertLocal, getById } from '../db/repo';
import { uploadImage } from '../lib/api';

// A local image (camera/gallery) queued for upload. Until it uploads, the row's
// imagePath holds the local file URI; after upload it's swapped for the server path.

export interface PendingImage {
  id: string;
  localUri: string;
  table: SyncTable;
  rowId: string;
  field: string;
  createdAt: string;
}

export async function queueImage(
  table: SyncTable,
  rowId: string,
  localUri: string,
  field = 'imagePath',
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO "pending_images" ("id","localUri","table","rowId","field","createdAt") VALUES (?,?,?,?,?,?)',
    newId(),
    localUri,
    table,
    rowId,
    field,
    nowIso(),
  );
}

async function listPending(): Promise<PendingImage[]> {
  const db = await getDb();
  return db.getAllAsync<PendingImage>('SELECT * FROM "pending_images" ORDER BY "createdAt" ASC');
}

async function removePending(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM "pending_images" WHERE "id" = ?', id);
}

/**
 * Upload every queued image, then rewrite the owning row's field with the server
 * path so the next push carries the real path. Content-addressed uploads make
 * retries safe. Returns the number uploaded.
 */
export async function drainImageQueue(): Promise<number> {
  const pending = await listPending();
  let uploaded = 0;
  for (const img of pending) {
    const serverPath = await uploadImage(img.localUri);
    const row = await getById(img.table, img.rowId, true);
    if (row) {
      await upsertLocal(img.table, { ...row, id: img.rowId, [img.field]: serverPath });
    }
    await removePending(img.id);
    uploaded++;
  }
  return uploaded;
}

/** True while a value is still a local file URI (not yet uploaded). */
export function isLocalUri(path: string | null | undefined): boolean {
  return !!path && (path.startsWith('file:') || path.startsWith('content:'));
}
