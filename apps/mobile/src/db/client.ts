import * as SQLite from 'expo-sqlite';
import { schemaStatements } from './tables';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Open the local database once and ensure the schema exists (idempotent). */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('armory.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;');
      for (const stmt of schemaStatements()) {
        await db.execAsync(stmt);
      }
      return db;
    })();
  }
  return dbPromise;
}

export async function getSyncState(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT "value" FROM "sync_state" WHERE "key" = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSyncState(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO "sync_state" ("key", "value") VALUES (?, ?) ' +
      'ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"',
    key,
    value,
  );
}
