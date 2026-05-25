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
  // Public origins used to build OAuth redirect_uri (API) and the post-callback return (web).
  APP_PUBLIC_URL: z.string().default('http://localhost:3001'),
  WEB_PUBLIC_URL: z.string().default('http://localhost:5173'),
  // Store-connect OAuth app credentials (credentials-deferred: empty → simulated token exchange).
  STORE_SHOPIFY_CLIENT_ID: z.string().default(''),
  STORE_SHOPIFY_CLIENT_SECRET: z.string().default(''),
  STORE_SALLA_CLIENT_ID: z.string().default(''),
  STORE_SALLA_CLIENT_SECRET: z.string().default(''),
  STORE_ZID_CLIENT_ID: z.string().default(''),
  STORE_ZID_CLIENT_SECRET: z.string().default(''),
  STORE_WOOCOMMERCE_CLIENT_ID: z.string().default(''),
  STORE_WOOCOMMERCE_CLIENT_SECRET: z.string().default(''),
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
    appPublicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3001',
    webPublicUrl: process.env.WEB_PUBLIC_URL ?? 'http://localhost:5173',
    stores: {
      shopify: { clientId: process.env.STORE_SHOPIFY_CLIENT_ID ?? '', clientSecret: process.env.STORE_SHOPIFY_CLIENT_SECRET ?? '' },
      salla: { clientId: process.env.STORE_SALLA_CLIENT_ID ?? '', clientSecret: process.env.STORE_SALLA_CLIENT_SECRET ?? '' },
      zid: { clientId: process.env.STORE_ZID_CLIENT_ID ?? '', clientSecret: process.env.STORE_ZID_CLIENT_SECRET ?? '' },
      woocommerce: { clientId: process.env.STORE_WOOCOMMERCE_CLIENT_ID ?? '', clientSecret: process.env.STORE_WOOCOMMERCE_CLIENT_SECRET ?? '' },
    },
  };
}
