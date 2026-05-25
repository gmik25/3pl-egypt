import { StorePlatform } from '@prisma/client';
import { IntakeSource } from '@prisma/client';

/**
 * Per-platform OAuth endpoint templates. `{shop}` is replaced with the store host
 * (Shopify/Woo authorize on the merchant's own domain; Salla/Zid use a central host).
 * EG: these are the public production endpoints — only the app client_id/secret are deferred to env.
 */
export interface PlatformOAuth {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  /** Woo hands back API keys to a callback instead of an OAuth code exchange. */
  keyHandshake: boolean;
}

export const PLATFORM_OAUTH: Record<StorePlatform, PlatformOAuth> = {
  SHOPIFY: {
    authorizeUrl: 'https://{shop}/admin/oauth/authorize',
    tokenUrl: 'https://{shop}/admin/oauth/access_token',
    scopes: 'read_orders,read_products,read_fulfillments',
    keyHandshake: false,
  },
  SALLA: {
    authorizeUrl: 'https://accounts.salla.sa/oauth2/auth',
    tokenUrl: 'https://accounts.salla.sa/oauth2/token',
    scopes: 'offline_access',
    keyHandshake: false,
  },
  ZID: {
    authorizeUrl: 'https://oauth.zid.sa/oauth/authorize',
    tokenUrl: 'https://oauth.zid.sa/oauth/token',
    scopes: 'orders.read products.read',
    keyHandshake: false,
  },
  WOOCOMMERCE: {
    authorizeUrl: 'https://{shop}/wc-auth/v1/authorize',
    tokenUrl: '', // key handshake — keys POSTed to the return URL, no token exchange
    scopes: 'read',
    keyHandshake: true,
  },
};

/** StorePlatform and IntakeSource share member names — narrow the intake source for a platform. */
export const PLATFORM_INTAKE: Record<StorePlatform, IntakeSource> = {
  SHOPIFY: IntakeSource.SHOPIFY,
  WOOCOMMERCE: IntakeSource.WOOCOMMERCE,
  SALLA: IntakeSource.SALLA,
  ZID: IntakeSource.ZID,
};

export function buildAuthorizeUrl(opts: {
  platform: StorePlatform;
  shopDomain: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const cfg = PLATFORM_OAUTH[opts.platform];
  const base = cfg.authorizeUrl.replace('{shop}', opts.shopDomain);
  const params = new URLSearchParams({
    client_id: opts.clientId || 'DEFERRED_CLIENT_ID',
    scope: cfg.scopes,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    response_type: 'code',
  });
  return `${base}?${params.toString()}`;
}

export interface TokenExchangeResult {
  accessToken: string;
  scopes: string;
  simulated: boolean;
}

/**
 * Exchange an OAuth authorization code for an access token.
 * Credentials-deferred: when the app client_id/secret are not configured (or for Woo's key
 * handshake), we simulate a token so the full onboarding flow is demonstrable end-to-end.
 */
export async function exchangeCodeForToken(opts: {
  platform: StorePlatform;
  shopDomain: string;
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenExchangeResult> {
  const cfg = PLATFORM_OAUTH[opts.platform];
  const configured = !!opts.clientId && !!opts.clientSecret && !!cfg.tokenUrl;

  if (!configured) {
    // EG: simulated handshake — wire real credentials per platform to go live.
    return { accessToken: `sim_${opts.platform.toLowerCase()}_${opts.code.slice(0, 8)}`, scopes: cfg.scopes, simulated: true };
  }

  const tokenUrl = cfg.tokenUrl.replace('{shop}', opts.shopDomain);
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      code: opts.code,
      grant_type: 'authorization_code',
      redirect_uri: opts.redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status})`);
  }
  const json = (await res.json()) as { access_token?: string; scope?: string };
  if (!json.access_token) throw new Error('token exchange returned no access_token');
  return { accessToken: json.access_token, scopes: json.scope ?? cfg.scopes, simulated: false };
}
