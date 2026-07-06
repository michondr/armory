import { z } from 'zod';
import { ANGULAR_UNITS, type AngularUnit } from '../enums.js';

export const createScopeProfileSchema = z.object({
  gunId: z.string().uuid(),
  name: z.string().min(1).max(120),
  clickValue: z.number().positive().max(10),
  angularUnit: z.enum(ANGULAR_UNITS as [AngularUnit, ...AngularUnit[]]).default('MRAD'),
  zeroRangeM: z.number().positive().max(3000),
  sightHeightMm: z.number().min(0).max(300),
  notes: z.string().max(2000).nullable().optional(),
});
export type CreateScopeProfileInput = z.infer<typeof createScopeProfileSchema>;

export const updateScopeProfileSchema = createScopeProfileSchema.partial();
export type UpdateScopeProfileInput = z.infer<typeof updateScopeProfileSchema>;

export interface ScopeProfile {
  id: string;
  gunId: string;
  name: string;
  clickValue: number;
  angularUnit: AngularUnit;
  zeroRangeM: number;
  sightHeightMm: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
