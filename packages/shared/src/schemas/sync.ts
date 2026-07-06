import { z } from 'zod';
import {
  ANGULAR_UNITS,
  BC_MODELS,
  DISCIPLINES,
  SCORING_SYSTEMS,
  SHOT_SOURCES,
  TARGET_STATUSES,
  type AngularUnit,
  type BcModel,
  type Discipline,
  type ScoringSystem,
  type ShotSource,
  type TargetStatus,
} from '../enums.js';
import { isoDateString } from './common.js';

/**
 * Sync wire format (mobile ⇄ api).
 *
 * Every synced row is a full snapshot carrying id (client-generated UUID),
 * createdAt/updatedAt/deletedAt. Conflict resolution is last-write-wins by
 * updatedAt; rows with deletedAt set are tombstones. The pull cursor is the
 * server clock; the server re-sends a small overlap window before the cursor,
 * so clients must apply pulls idempotently.
 */

const syncRowBase = {
  id: z.string().uuid(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
  deletedAt: isoDateString.nullable(),
};

export const syncCartridgeSchema = z.object({
  ...syncRowBase,
  name: z.string().min(1).max(120),
});

export const syncGunSchema = z.object({
  ...syncRowBase,
  name: z.string().min(1).max(200),
  caliber: z.string().max(120).nullable(),
  purchasePrice: z.number().nullable(),
  purchaseDate: isoDateString.nullable(),
  initialRoundCount: z.number().int().min(0),
  cleaningIntervalRounds: z.number().int().positive().nullable(),
  lastCleanedAtRound: z.number().int().min(0),
  imagePath: z.string().nullable(),
  notes: z.string().max(5000).nullable(),
});

export const syncAmmoSchema = z.object({
  ...syncRowBase,
  name: z.string().min(1).max(200),
  caliber: z.string().max(120).nullable(),
  bulletWeightG: z.number().positive().nullable(),
  muzzleVelocityMps: z.number().positive().nullable(),
  ballisticCoefficient: z.number().positive().nullable(),
  bcModel: z.enum(BC_MODELS as [BcModel, ...BcModel[]]).nullable(),
  notes: z.string().max(5000).nullable(),
});

export const syncAmmoImageSchema = z.object({
  ...syncRowBase,
  ammoId: z.string().uuid(),
  imagePath: z.string(),
});

export const syncAmmoPriceEntrySchema = z.object({
  ...syncRowBase,
  ammoId: z.string().uuid(),
  date: isoDateString,
  pricePerRound: z.number().min(0),
  currency: z.string().min(1).max(10),
  quantity: z.number().int().positive(),
  vendor: z.string().max(200).nullable(),
  note: z.string().max(2000).nullable(),
});

export const syncScopeProfileSchema = z.object({
  ...syncRowBase,
  gunId: z.string().uuid(),
  name: z.string().min(1).max(120),
  clickValue: z.number().positive().max(10),
  angularUnit: z.enum(ANGULAR_UNITS as [AngularUnit, ...AngularUnit[]]),
  zeroRangeM: z.number().positive().max(3000),
  sightHeightMm: z.number().min(0).max(300),
  notes: z.string().max(2000).nullable(),
});

export const syncSessionSchema = z.object({
  ...syncRowBase,
  gunId: z.string().uuid(),
  ammoId: z.string().uuid().nullable(),
  startedAt: isoDateString,
  locationName: z.string().max(160).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  discipline: z.enum(DISCIPLINES as [Discipline, ...Discipline[]]),
  notes: z.string().max(5000).nullable(),
});

export const syncSetSchema = z.object({
  ...syncRowBase,
  sessionId: z.string().uuid(),
  order: z.number().int().min(0),
  distanceM: z.number().positive().nullable(),
  ipscTimeSeconds: z.number().positive().nullable(),
  notes: z.string().max(2000).nullable(),
});

export const syncTargetSchema = z.object({
  ...syncRowBase,
  setId: z.string().uuid(),
  imagePath: z.string().nullable(),
  shotCount: z.number().int().min(0),
  scoringSystem: z.enum(SCORING_SYSTEMS as [ScoringSystem, ...ScoringSystem[]]),
  maxScorePerShot: z.number().int().positive().nullable(),
  status: z.enum(TARGET_STATUSES as [TargetStatus, ...TargetStatus[]]),
  totalScore: z.number().nullable(),
  notes: z.string().max(2000).nullable(),
});

export const syncShotSchema = z.object({
  ...syncRowBase,
  targetId: z.string().uuid(),
  index: z.number().int().min(0),
  ringValue: z.number().min(0).nullable(),
  x: z.number().min(0).max(1).nullable(),
  y: z.number().min(0).max(1).nullable(),
  zone: z.string().max(4).nullable(),
  source: z.enum(SHOT_SOURCES as [ShotSource, ...ShotSource[]]),
});

export type SyncCartridge = z.infer<typeof syncCartridgeSchema>;
export type SyncGun = z.infer<typeof syncGunSchema>;
export type SyncAmmo = z.infer<typeof syncAmmoSchema>;
export type SyncAmmoImage = z.infer<typeof syncAmmoImageSchema>;
export type SyncAmmoPriceEntry = z.infer<typeof syncAmmoPriceEntrySchema>;
export type SyncScopeProfile = z.infer<typeof syncScopeProfileSchema>;
export type SyncSession = z.infer<typeof syncSessionSchema>;
export type SyncSet = z.infer<typeof syncSetSchema>;
export type SyncTarget = z.infer<typeof syncTargetSchema>;
export type SyncShot = z.infer<typeof syncShotSchema>;

/** Tables in dependency order: parents before children, so one push applies cleanly. */
export const SYNC_TABLES = [
  'cartridges',
  'guns',
  'ammo',
  'ammoImages',
  'ammoPriceEntries',
  'scopeProfiles',
  'sessions',
  'sets',
  'targets',
  'shots',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export const syncChangesSchema = z.object({
  cartridges: z.array(syncCartridgeSchema).optional(),
  guns: z.array(syncGunSchema).optional(),
  ammo: z.array(syncAmmoSchema).optional(),
  ammoImages: z.array(syncAmmoImageSchema).optional(),
  ammoPriceEntries: z.array(syncAmmoPriceEntrySchema).optional(),
  scopeProfiles: z.array(syncScopeProfileSchema).optional(),
  sessions: z.array(syncSessionSchema).optional(),
  sets: z.array(syncSetSchema).optional(),
  targets: z.array(syncTargetSchema).optional(),
  shots: z.array(syncShotSchema).optional(),
});
export type SyncChanges = z.infer<typeof syncChangesSchema>;

export const syncPushSchema = z.object({
  device: z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120),
      platform: z.string().max(40).nullable().optional(),
    })
    .optional(),
  changes: syncChangesSchema,
});
export type SyncPushInput = z.infer<typeof syncPushSchema>;

export interface SyncPullResponse {
  /** Pass back as `since` on the next pull. Server clock, ISO. */
  cursor: string;
  changes: SyncChanges;
}

/** A pushed row the server could not apply (kept server-side state instead). */
export interface SyncSkippedRow {
  table: SyncTable;
  id: string;
  reason: string;
}

/**
 * A pushed row that already existed server-side under a different id (e.g. a
 * cartridge with the same name). The client should drop `fromId` locally; the
 * authoritative row arrives via pull.
 */
export interface SyncRemappedRow {
  table: SyncTable;
  fromId: string;
  toId: string;
}

export interface SyncPushResponse {
  cursor: string;
  /** Authoritative server rows for every pushed id (post-LWW). */
  applied: SyncChanges;
  skipped: SyncSkippedRow[];
  remapped: SyncRemappedRow[];
}
