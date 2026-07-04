import { z } from 'zod';
import { isoDateString } from './common.js';

export const createGunSchema = z.object({
  name: z.string().min(1).max(120),
  caliber: z.string().max(60).nullable().optional(),
  purchasePrice: z.number().nonnegative().nullable().optional(),
  purchaseDate: isoDateString.nullable().optional(),
  initialRoundCount: z.number().int().min(0).default(0),
  cleaningIntervalRounds: z.number().int().positive().nullable().optional(),
  lastCleanedAtRound: z.number().int().min(0).optional(),
  imagePath: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type CreateGunInput = z.infer<typeof createGunSchema>;

export const updateGunSchema = createGunSchema.partial();
export type UpdateGunInput = z.infer<typeof updateGunSchema>;

export interface Gun {
  id: string;
  name: string;
  caliber: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  initialRoundCount: number;
  cleaningIntervalRounds: number | null;
  lastCleanedAtRound: number;
  imagePath: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // computed server-side
  roundsFired: number;
  roundsSinceCleaning: number;
  cleaningDue: boolean;
  lastShotAt: string | null;
}
