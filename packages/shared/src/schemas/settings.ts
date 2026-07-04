import { z } from 'zod';
import { ANGULAR_UNITS, UNIT_SYSTEMS, type AngularUnit, type UnitSystem } from '../enums.js';

/**
 * SMTP config lives in user settings (per-user sending). The password is write-only
 * over the API: clients send it to set it, but it is never returned (only `smtpPassSet`).
 */
export const smtpSettingsSchema = z.object({
  smtpHost: z.string().min(1).nullable(),
  smtpPort: z.number().int().min(1).max(65535).nullable(),
  smtpUser: z.string().nullable(),
  smtpPass: z.string().nullable(),
  smtpFrom: z.string().email().nullable(),
});

export const updateSettingsSchema = z
  .object({
    unitSystem: z.enum(UNIT_SYSTEMS as [UnitSystem, ...UnitSystem[]]),
    angularUnit: z.enum(ANGULAR_UNITS as [AngularUnit, ...AngularUnit[]]),
  })
  .partial()
  .merge(smtpSettingsSchema.partial());
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** Shape returned to clients — note the SMTP password is replaced by a boolean flag. */
export interface UserSettings {
  id: string;
  email: string;
  displayName: string | null;
  unitSystem: UnitSystem;
  angularUnit: AngularUnit;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpFrom: string | null;
  smtpPassSet: boolean;
}
