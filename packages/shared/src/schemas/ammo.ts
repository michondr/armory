import { z } from 'zod';
import { BC_MODELS, type BcModel } from '../enums.js';
import { isoDateString } from './common.js';

export const createAmmoSchema = z.object({
  name: z.string().min(1).max(120),
  caliber: z.string().max(60).nullable().optional(),
  bulletWeightG: z.number().positive().nullable().optional(),
  muzzleVelocityMps: z.number().positive().nullable().optional(),
  ballisticCoefficient: z.number().positive().nullable().optional(),
  bcModel: z.enum(BC_MODELS as [BcModel, ...BcModel[]]).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type CreateAmmoInput = z.infer<typeof createAmmoSchema>;

export const updateAmmoSchema = createAmmoSchema.partial();
export type UpdateAmmoInput = z.infer<typeof updateAmmoSchema>;

export const createPriceEntrySchema = z.object({
  date: isoDateString,
  pricePerRound: z.number().positive(),
  currency: z.string().min(1).max(8).default('CZK'),
  quantity: z.number().int().positive().default(1),
  vendor: z.string().max(120).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});
export type CreatePriceEntryInput = z.infer<typeof createPriceEntrySchema>;

export interface AmmoImage {
  id: string;
  imagePath: string;
  createdAt: string;
}

export interface AmmoPriceEntry {
  id: string;
  date: string;
  pricePerRound: number;
  currency: string;
  quantity: number;
  vendor: string | null;
  note: string | null;
  createdAt: string;
}

export interface Ammo {
  id: string;
  name: string;
  caliber: string | null;
  bulletWeightG: number | null;
  muzzleVelocityMps: number | null;
  ballisticCoefficient: number | null;
  bcModel: BcModel | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  images: AmmoImage[];
  priceEntries: AmmoPriceEntry[];
  // convenience aggregates
  lastPricePerRound: number | null;
  roundsPurchased: number;
}

/** A suggestion from the bundled seed dataset (autosuggest). */
export interface AmmoSuggestion {
  name: string;
  caliber: string;
  bulletWeightG: number | null;
  muzzleVelocityMps: number | null;
  ballisticCoefficient: number | null;
  bcModel: BcModel | null;
}
