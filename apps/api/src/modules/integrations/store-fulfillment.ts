import { StorePlatform } from '@prisma/client';

/**
 * Outbound (us → store) fulfillment push. Mirrors the inbound adapters' "pragmatic best-effort"
 * stance: Shopify has a real implementation; the others are stubbed until their APIs are wired.
 *
 * Credentials-deferred: a simulated access token (sim_*) — or a platform without a live impl —
 * short-circuits to a simulated push so the whole flow is demoable end-to-end.
 */

export type FulfillmentEvent = 'DISPATCHED' | 'DELIVERED';

export interface PushFulfillmentInput {
  platform: StorePlatform;
  shopDomain: string;
  accessToken: string;
  externalOrderId: string;
  trackingNumber: string | null;
  courierName: string | null;
  event: FulfillmentEvent;
  /** fulfillment id from a prior DISPATCHED push, used to post a delivered event */
  existingFulfillmentId?: string | null;
}

export interface PushFulfillmentResult {
  fulfillmentId: string;
  simulated: boolean;
  note?: string;
}

/** Platforms with a real outbound implementation. EG: extend as each platform's API is wired. */
const REAL_OUTBOUND: Record<StorePlatform, boolean> = {
  SHOPIFY: true,
  SALLA: false,
  ZID: false,
  WOOCOMMERCE: false,
};

const SHOPIFY_API_VERSION = '2024-01';

export async function pushFulfillment(input: PushFulfillmentInput): Promise<PushFulfillmentResult> {
  const live = !input.accessToken.startsWith('sim_') && REAL_OUTBOUND[input.platform];

  if (!live) {
    const reason = input.accessToken.startsWith('sim_') ? 'sandbox token' : `${input.platform} outbound not wired`;
    return {
      fulfillmentId: input.existingFulfillmentId ?? `sim_ful_${input.platform.toLowerCase()}_${input.externalOrderId}`,
      simulated: true,
      note: `simulated (${reason})`,
    };
  }

  if (input.platform === StorePlatform.SHOPIFY) {
    return pushShopify(input);
  }
  // Unreachable given REAL_OUTBOUND, but keeps the type total.
  return { fulfillmentId: `sim_ful_${input.externalOrderId}`, simulated: true, note: 'no adapter' };
}

async function pushShopify(input: PushFulfillmentInput): Promise<PushFulfillmentResult> {
  const base = `https://${input.shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;
  const headers = { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': input.accessToken };

  // DELIVERED with a known fulfillment → post a delivered event; otherwise fall through to create.
  if (input.event === 'DELIVERED' && input.existingFulfillmentId) {
    const res = await fetch(`${base}/fulfillments/${input.existingFulfillmentId}/events.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event: { status: 'delivered' } }),
    });
    if (!res.ok) throw new Error(`shopify fulfillment event failed (${res.status})`);
    return { fulfillmentId: input.existingFulfillmentId, simulated: false };
  }

  // DISPATCHED (or DELIVERED without a prior fulfillment) → create the fulfillment with tracking.
  const res = await fetch(`${base}/orders/${input.externalOrderId}/fulfillments.json`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fulfillment: {
        notify_customer: true,
        tracking_info: { number: input.trackingNumber ?? undefined, company: input.courierName ?? undefined },
      },
    }),
  });
  if (!res.ok) throw new Error(`shopify create fulfillment failed (${res.status})`);
  const json = (await res.json()) as { fulfillment?: { id?: number | string } };
  const id = json.fulfillment?.id;
  if (!id) throw new Error('shopify fulfillment returned no id');
  return { fulfillmentId: String(id), simulated: false };
}
