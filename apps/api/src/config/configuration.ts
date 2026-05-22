import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  TOTP_ISSUER: z.string().default('3PL-Egypt'),
  DEFAULT_TZ: z.string().default('Africa/Cairo'),
  DEFAULT_LOCALE: z.string().default('ar-EG'),
  VAT_RATE_BPS: z.coerce.number().int().nonnegative().default(1400),
  // Credential encryption key (32 bytes, base64/hex). Dev default below; use a secret manager in prod.
  INTEGRATIONS_ENC_KEY: z.string().min(32).default('ZGV2LW9ubHktMzJieXRlLWtleS1jaGFuZ2UtbWUtcGxz'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function configuration() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    apiPort: Number(process.env.API_PORT ?? 3001),
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
    },
    totp: { issuer: process.env.TOTP_ISSUER ?? '3PL-Egypt' },
    defaultTz: process.env.DEFAULT_TZ ?? 'Africa/Cairo',
    defaultLocale: process.env.DEFAULT_LOCALE ?? 'ar-EG',
    vatRateBps: Number(process.env.VAT_RATE_BPS ?? 1400),
  };
}
