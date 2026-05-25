import { StorePlatform } from '@prisma/client';

/**
 * Inbound (store → us) platform calls used at connect time: register order webhooks and
 * backfill recent orders. Mirrors the outbound adapter's stance — Shopify is wired live, the
 * others are stubbed; a sandbox token (sim_*) short-circuits to a simulated result so the
 * onboarding flow is demoable end-to-end.
 */

/** Order topics we subscribe to per platform (names follow each platform's own scheme). */
export const WEBHOOK_TOPICS: Record<StorePlatform, string[]> = {
  SHOPIFY: ['orders/create', 'orders/updated', 'orders/cancelled'],
  SALLA: ['order.created', 'order.updated', 'order.cancelled'],
  ZID: ['order.create', 'order.update'],
  WOOCOMMERCE: ['order.created', 'order.updated'],
};

const SHOPIFY_API_VERSION = '2024-01';
const REAL_INBOUND: Record<StorePlatform, boolean> = { SHOPIFY: true, SALLA: false, ZID: false, WOOCOMMERCE: false };

function isLive(platform: StorePlatform, accessToken: string): boolean {
  return !accessToken.startsWith('sim_') && REAL_INBOUND[platform];
}

export interface RegisterWebhooksResult {
  topics: string[];
  simulated: boolean;
  note?: string;
}

/** Register order webhooks on the platform pointing back at our public webhook endpoint. */
export async function registerWebhooks(opts: {
  platform: StorePlatform;
  shopDomain: string;
  accessToken: string;
  callbackUrl: string;
}): Promise<RegisterWebhooksResult> {
  const topics = WEBHOOK_TOPICS[opts.platform];

  if (!isLive(opts.platform, opts.accessToken)) {
    const reason = opts.accessToken.startsWith('sim_') ? 'sandbox token' : `${opts.platform} inbound not wired`;
    return { topics, simulated: true, note: `simulated (${reason})` };
  }

  if (opts.platform === StorePlatform.SHOPIFY) {
    const base = `https://${opts.shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;
    const headers = { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': opts.accessToken };
    const registered: string[] = [];
    for (const topic of topics) {
      const res = await fetch(`${base}/webhooks.json`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ webhook: { topic, address: opts.callbackUrl, format: 'json' } }),
      });
      // 422 = already subscribed to this topic+address; treat as success (idempotent).
      if (res.ok || res.status === 422) registered.push(topic);
      else throw new Error(`shopify webhook register failed for ${topic} (${res.status})`);
    }
    return { topics: registered, simulated: false };
  }

  return { topics, simulated: true, note: 'no adapter' };
}

/**
 * Pull recent orders from the platform for a one-time backfill. Returns raw payloads compatible
 * with the inbound webhook adapters (normalizeWebhook). Sandbox/stub → empty (nothing to pull).
 */
export async function pullRecentOrders(opts: {
  platform: StorePlatform;
  shopDomain: string;
  accessToken: string;
  limit: number;
}): Promise<Record<string, unknown>[]> {
  if (!isLive(opts.platform, opts.accessToken)) return [];

  if (opts.platform === StorePlatform.SHOPIFY) {
    const base = `https://${opts.shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;
    const res = await fetch(`${base}/orders.json?status=any&limit=${opts.limit}`, {
      headers: { 'X-Shopify-Access-Token': opts.accessToken },
    });
    if (!res.ok) throw new Error(`shopify order backfill failed (${res.status})`);
    const json = (await res.json()) as { orders?: Record<string, unknown>[] };
    return json.orders ?? [];
  }

  return [];
}
