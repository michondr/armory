import { z } from 'zod';

/** Accepts any string parseable as a date (ISO datetime or YYYY-MM-DD). */
export const isoDateString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' });
