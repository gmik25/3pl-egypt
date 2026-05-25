import { StorePlatform } from '@prisma/client';
import { registerWebhooks, pullRecentOrders, WEBHOOK_TOPICS } from './store-ingest';

describe('store-ingest (credentials-deferred)', () => {
  describe('registerWebhooks', () => {
    it('returns the platform topics as simulated for a sandbox token', async () => {
      const r = await registerWebhooks({
        platform: StorePlatform.SHOPIFY,
        shopDomain: 'acme.myshopify.com',
        accessToken: 'sim_shopify_abc',
        callbackUrl: 'https://api.example.com/api/integrations/stores/webhook/SHOPIFY',
      });
      expect(r.simulated).toBe(true);
      expect(r.topics).toEqual(WEBHOOK_TOPICS.SHOPIFY);
      expect(r.note).toContain('sandbox');
    });

    it('simulates platforms without a live adapter even with a real token', async () => {
      const r = await registerWebhooks({
        platform: StorePlatform.SALLA,
        shopDomain: 'acme.salla.sa',
        accessToken: 'real_token',
        callbackUrl: 'https://api.example.com/cb',
      });
      expect(r.simulated).toBe(true);
      expect(r.topics).toEqual(WEBHOOK_TOPICS.SALLA);
    });
  });

  describe('pullRecentOrders', () => {
    it('returns nothing to pull for a sandbox token', async () => {
      const orders = await pullRecentOrders({
        platform: StorePlatform.SHOPIFY,
        shopDomain: 'acme.myshopify.com',
        accessToken: 'sim_shopify_abc',
        limit: 50,
      });
      expect(orders).toEqual([]);
    });
  });
});
