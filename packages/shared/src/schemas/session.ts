import { z } from 'zod';
import {
  DISCIPLINES,
  SCORING_SYSTEMS,
  type Discipline,
  type ScoringSystem,
  type ShotSource,
  type TargetStatus,
} from '../enums.js';
import { isoDateString } from './common.js';
import type { ShotStats } from './stats.js';

export const createSessionSchema = z.object({
  gunId: z.string().uuid(),
  ammoId: z.string().uuid().nullable().optional(),
  startedAt: isoDateString.optional(),
  locationName: z.string().max(160).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  discipline: z.enum(DISCIPLINES as [Discipline, ...Discipline[]]).default('SHORT'),
  notes: z.string().max(5000).nullable().optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = createSessionSchema.partial();
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const createSetSchema = z.object({
  order: z.number().int().min(0).optional(),
  distanceM: z.number().positive().nullable().optional(),
  ipscTimeSeconds: z.number().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type CreateSetInput = z.infer<typeof createSetSchema>;

export const createTargetSchema = z.object({
  shotCount: z.number().int().min(0).default(0),
  scoringSystem: z
    .enum(SCORING_SYSTEMS as [ScoringSystem, ...ScoringSystem[]])
    .default('RINGS'),
  maxScorePerShot: z.number().int().positive().nullable().optional(),
  imagePath: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type CreateTargetInput = z.infer<typeof createTargetSchema>;

export const updateTargetSchema = createTargetSchema.partial();
export type UpdateTargetInput = z.infer<typeof updateTargetSchema>;

/** Manual scoring: replace a target's shots with ring values (RINGS) or zones (IPSC). */
export const setShotsSchema = z
  .object({
    ringValues: z.array(z.number().min(0)).optional(),
    zones: z.array(z.string().min(1).max(4)).optional(),
  })
  .refine((v) => v.ringValues !== undefined || v.zones !== undefined, {
    message: 'Provide ringValues or zones',
  });
export type SetShotsInput = z.infer<typeof setShotsSchema>;

// ---- read models ----

export interface Shot {
  id: string;
  index: number;
  ringValue: number | null;
  x: number | null;
  y: number | null;
  zone: string | null;
  source: ShotSource;
}

export interface TargetDto {
  id: string;
  imagePath: string | null;
  shotCount: number;
  scoringSystem: ScoringSystem;
  maxScorePerShot: number | null;
  status: TargetStatus;
  totalScore: number | null;
  notes: string | null;
  shots: Shot[];
  stats: ShotStats;
  /** True while a scoring job is queued/running for this target. */
  scoring: boolean;
}

export interface SetDto {
  id: string;
  order: number;
  distanceM: number | null;
  ipscTimeSeconds: number | null;
  notes: string | null;
  targets: TargetDto[];
  stats: ShotStats;
}

export interface SessionGun {
  id: string;
  name: string;
  caliber: string | null;
  imagePath: string | null;
}

export interface SessionDetail {
  id: string;
  startedAt: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  discipline: Discipline;
  notes: string | null;
  gun: SessionGun;
  ammo: { id: string; name: string } | null;
  sets: SetDto[];
  stats: ShotStats;
  createdAt: string;
}

export interface SessionListItem {
  id: string;
  startedAt: string;
  locationName: string | null;
  discipline: Discipline;
  gun: SessionGun;
  ammoName: string | null;
  targetCount: number;
  stats: ShotStats;
}
