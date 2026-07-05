import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  API_PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(2592000),
  // 32-byte key as 64 hex chars — used for AES-256-GCM encryption of SMTP passwords.
  APP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'APP_ENCRYPTION_KEY must be 32 bytes hex (64 chars)'),
  IMAGES_DIR: z.string().default('/data/images'),
  SCORER_URL: z.string().default('http://scorer:8000'),
});

export type Env = z.infer<typeof envSchema>;

@Injectable()
export class EnvService {
  readonly values: Env = envSchema.parse(process.env);
}
