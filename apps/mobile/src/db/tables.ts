import { SYNC_TABLES, type SyncTable } from '@armory/shared';

// Metadata describing each synced table's columns. Drives local schema creation
// and the generic sync engine, so the ten tables aren't hand-written ten times.
// Column names match the sync wire format exactly (camelCase), so rows round-trip
// to/from the server without remapping.

export type ColKind = 'text' | 'real' | 'int';

export interface TableDef {
  name: SyncTable;
  /** Data columns beyond the shared base (createdAt/updatedAt/deletedAt). */
  columns: { name: string; kind: ColKind }[];
}

const base: { name: string; kind: ColKind }[] = [
  { name: 'createdAt', kind: 'text' },
  { name: 'updatedAt', kind: 'text' },
  { name: 'deletedAt', kind: 'text' },
];

export const TABLE_DEFS: Record<SyncTable, TableDef> = {
  cartridges: { name: 'cartridges', columns: [{ name: 'name', kind: 'text' }] },
  guns: {
    name: 'guns',
    columns: [
      { name: 'name', kind: 'text' },
      { name: 'caliber', kind: 'text' },
      { name: 'purchasePrice', kind: 'real' },
      { name: 'purchaseDate', kind: 'text' },
      { name: 'initialRoundCount', kind: 'int' },
      { name: 'cleaningIntervalRounds', kind: 'int' },
      { name: 'lastCleanedAtRound', kind: 'int' },
      { name: 'imagePath', kind: 'text' },
      { name: 'notes', kind: 'text' },
    ],
  },
  ammo: {
    name: 'ammo',
    columns: [
      { name: 'name', kind: 'text' },
      { name: 'caliber', kind: 'text' },
      { name: 'bulletWeightG', kind: 'real' },
      { name: 'muzzleVelocityMps', kind: 'real' },
      { name: 'ballisticCoefficient', kind: 'real' },
      { name: 'bcModel', kind: 'text' },
      { name: 'notes', kind: 'text' },
    ],
  },
  ammoImages: {
    name: 'ammoImages',
    columns: [
      { name: 'ammoId', kind: 'text' },
      { name: 'imagePath', kind: 'text' },
    ],
  },
  ammoPriceEntries: {
    name: 'ammoPriceEntries',
    columns: [
      { name: 'ammoId', kind: 'text' },
      { name: 'date', kind: 'text' },
      { name: 'pricePerRound', kind: 'real' },
      { name: 'currency', kind: 'text' },
      { name: 'quantity', kind: 'int' },
      { name: 'vendor', kind: 'text' },
      { name: 'note', kind: 'text' },
    ],
  },
  scopeProfiles: {
    name: 'scopeProfiles',
    columns: [
      { name: 'gunId', kind: 'text' },
      { name: 'name', kind: 'text' },
      { name: 'clickValue', kind: 'real' },
      { name: 'angularUnit', kind: 'text' },
      { name: 'zeroRangeM', kind: 'real' },
      { name: 'sightHeightMm', kind: 'real' },
      { name: 'notes', kind: 'text' },
    ],
  },
  sessions: {
    name: 'sessions',
    columns: [
      { name: 'gunId', kind: 'text' },
      { name: 'ammoId', kind: 'text' },
      { name: 'startedAt', kind: 'text' },
      { name: 'locationName', kind: 'text' },
      { name: 'latitude', kind: 'real' },
      { name: 'longitude', kind: 'real' },
      { name: 'discipline', kind: 'text' },
      { name: 'notes', kind: 'text' },
    ],
  },
  sets: {
    name: 'sets',
    columns: [
      { name: 'sessionId', kind: 'text' },
      { name: 'order', kind: 'int' },
      { name: 'distanceM', kind: 'real' },
      { name: 'ipscTimeSeconds', kind: 'real' },
      { name: 'notes', kind: 'text' },
    ],
  },
  targets: {
    name: 'targets',
    columns: [
      { name: 'setId', kind: 'text' },
      { name: 'imagePath', kind: 'text' },
      { name: 'shotCount', kind: 'int' },
      { name: 'scoringSystem', kind: 'text' },
      { name: 'maxScorePerShot', kind: 'int' },
      { name: 'status', kind: 'text' },
      { name: 'totalScore', kind: 'real' },
      { name: 'notes', kind: 'text' },
    ],
  },
  shots: {
    name: 'shots',
    columns: [
      { name: 'targetId', kind: 'text' },
      { name: 'index', kind: 'int' },
      { name: 'ringValue', kind: 'real' },
      { name: 'x', kind: 'real' },
      { name: 'y', kind: 'real' },
      { name: 'zone', kind: 'text' },
      { name: 'source', kind: 'text' },
    ],
  },
};

/** SQLite reserves some column names we use; quote every identifier to be safe. */
export const q = (id: string): string => `"${id}"`;

/** All columns (including base) for a table, in a stable order. id first. */
export function allColumns(def: TableDef): { name: string; kind: ColKind }[] {
  return [{ name: 'id', kind: 'text' }, ...def.columns, ...base];
}

/** CREATE TABLE statements for every synced table plus the local-only tables. */
export function schemaStatements(): string[] {
  const stmts: string[] = [];
  for (const table of SYNC_TABLES) {
    const def = TABLE_DEFS[table];
    const cols = allColumns(def)
      .map((c) => `${q(c.name)} ${sqlType(c.kind)}`)
      .join(', ');
    stmts.push(
      `CREATE TABLE IF NOT EXISTS ${q(table)} (${cols}, "dirty" INTEGER NOT NULL DEFAULT 0, PRIMARY KEY ("id"));`,
    );
    stmts.push(
      `CREATE INDEX IF NOT EXISTS ${q(`${table}_updatedAt`)} ON ${q(table)} ("updatedAt");`,
    );
  }
  // Local-only bookkeeping.
  stmts.push(
    `CREATE TABLE IF NOT EXISTS "sync_state" ("key" TEXT PRIMARY KEY, "value" TEXT);`,
  );
  stmts.push(
    `CREATE TABLE IF NOT EXISTS "pending_images" (` +
      `"id" TEXT PRIMARY KEY, "localUri" TEXT NOT NULL, "table" TEXT NOT NULL, ` +
      `"rowId" TEXT NOT NULL, "field" TEXT NOT NULL DEFAULT 'imagePath', ` +
      `"createdAt" TEXT NOT NULL);`,
  );
  return stmts;
}

function sqlType(kind: ColKind): string {
  return kind === 'text' ? 'TEXT' : kind === 'int' ? 'INTEGER' : 'REAL';
}
