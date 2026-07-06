import type { SyncTable } from '@armory/shared';
import { getDb } from './client';
import { allColumns, q, TABLE_DEFS } from './tables';

export type Row = Record<string, string | number | null>;

/** RFC-4122 v4 UUID without a native dependency (Math.random is fine for row ids). */
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const nowIso = (): string => new Date().toISOString();

function columnNames(table: SyncTable): string[] {
  return allColumns(TABLE_DEFS[table]).map((c) => c.name);
}

/**
 * Write a row from a local edit: fills createdAt on first insert, bumps updatedAt,
 * and marks it dirty so the next sync pushes it. `partial` must include `id`.
 */
export async function upsertLocal(table: SyncTable, partial: Row): Promise<Row> {
  const id = String(partial.id);
  const existing = await getById(table, id, true);
  const merged: Row = {
    ...(existing ?? {}),
    ...partial,
    id,
    createdAt: existing?.createdAt ?? partial.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    deletedAt: partial.deletedAt ?? existing?.deletedAt ?? null,
  };
  await writeRow(table, merged, 1);
  return merged;
}

export async function softDeleteLocal(table: SyncTable, id: string): Promise<void> {
  const existing = await getById(table, id, true);
  if (!existing) return;
  await upsertLocal(table, { ...existing, id, deletedAt: nowIso() });
}

/**
 * Apply a server row (from pull or a push response). Last-write-wins: only
 * overwrite when the local row isn't newer. Server-applied rows are clean (dirty=0).
 */
export async function applyServer(table: SyncTable, wire: Row): Promise<void> {
  const id = String(wire.id);
  const existing = await getById(table, id, true);
  if (existing && existing.dirty === 1) {
    const localTs = Date.parse(String(existing.updatedAt));
    const serverTs = Date.parse(String(wire.updatedAt));
    if (localTs > serverTs) return; // local edit is newer — keep it, push later
  }
  await writeRow(table, wire, 0);
}

async function writeRow(table: SyncTable, row: Row, dirty: 0 | 1): Promise<void> {
  const db = await getDb();
  const cols = columnNames(table);
  const values = cols.map((c) => normalize(row[c]));
  const placeholders = cols.map(() => '?').join(', ');
  const assignments = cols.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ');
  const sql =
    `INSERT INTO ${q(table)} (${cols.map(q).join(', ')}, "dirty") ` +
    `VALUES (${placeholders}, ?) ` +
    `ON CONFLICT("id") DO UPDATE SET ${assignments}, "dirty" = excluded."dirty"`;
  await db.runAsync(sql, ...values, dirty);
}

function normalize(v: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return String(v);
}

export async function getById(
  table: SyncTable,
  id: string,
  includeDeleted = false,
): Promise<(Row & { dirty?: number }) | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row & { dirty: number }>(
    `SELECT *, "dirty" FROM ${q(table)} WHERE "id" = ?`,
    id,
  );
  if (!row) return null;
  if (!includeDeleted && row.deletedAt) return null;
  return row;
}

export async function getAll(table: SyncTable, includeDeleted = false): Promise<Row[]> {
  const db = await getDb();
  const where = includeDeleted ? '' : 'WHERE "deletedAt" IS NULL';
  return db.getAllAsync<Row>(`SELECT * FROM ${q(table)} ${where} ORDER BY "createdAt" DESC`);
}

export async function getWhere(
  table: SyncTable,
  column: string,
  value: string,
): Promise<Row[]> {
  const db = await getDb();
  return db.getAllAsync<Row>(
    `SELECT * FROM ${q(table)} WHERE ${q(column)} = ? AND "deletedAt" IS NULL ORDER BY "createdAt" ASC`,
    value,
  );
}

/** Dirty rows for a table as clean wire objects (drops the local `dirty` flag). */
export async function getDirtyRows(table: SyncTable): Promise<Row[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row & { dirty: number }>(
    `SELECT * FROM ${q(table)} WHERE "dirty" = 1`,
  );
  return rows.map(({ dirty, ...rest }) => rest);
}

export async function deleteLocalRow(table: SyncTable, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${q(table)} WHERE "id" = ?`, id);
}

export async function countDirty(): Promise<number> {
  const db = await getDb();
  let total = 0;
  for (const table of Object.keys(TABLE_DEFS) as SyncTable[]) {
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${q(table)} WHERE "dirty" = 1`,
    );
    total += row?.n ?? 0;
  }
  return total;
}
