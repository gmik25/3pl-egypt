import { StorePlatform } from '@prisma/client';
import { pushFulfillment } from './store-fulfillment';

describe('pushFulfillment (credentials-deferred)', () => {
  const base = {
    shopDomain: 'acme.myshopify.com',
    externalOrderId: '99001',
    trackingNumber: 'ARMX-123',
    courierName: 'Aramex Egypt',
    event: 'DISPATCHED' as const,
  };

  it('simulates the push when the access token is a sandbox token', async () => {
    const r = await pushFulfillment({ ...base, platform: StorePlatform.SHOPIFY, accessToken: 'sim_shopify_abc' });
    expect(r.simulated).toBe(true);
    expect(r.fulfillmentId).toBe('sim_ful_shopify_99001');
    expect(r.note).toContain('sandbox');
  });

  it('simulates platforms without a live outbound adapter even with a real token', async () => {
    const r = await pushFulfillment({ ...base, platform: StorePlatform.ZID, accessToken: 'real_token_xyz' });
    expect(r.simulated).toBe(true);
    expect(r.note).toContain('ZID');
  });

  it('reuses an existing fulfillment id when simulating a DELIVERED event', async () => {
    const r = await pushFulfillment({
      ...base,
      event: 'DELIVERED',
      platform: StorePlatform.SHOPIFY,
      accessToken: 'sim_shopify_abc',
      existingFulfillmentId: 'sim_ful_shopify_99001',
    });
    expect(r.simulated).toBe(true);
    expect(r.fulfillmentId).toBe('sim_ful_shopify_99001');
  });
});
