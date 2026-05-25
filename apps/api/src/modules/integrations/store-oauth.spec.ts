import { StorePlatform } from '@prisma/client';
import { buildAuthorizeUrl, exchangeCodeForToken, PLATFORM_INTAKE } from './store-oauth';

describe('store-oauth', () => {
  describe('buildAuthorizeUrl', () => {
    it('builds a Shopify authorize URL on the merchant host with state + redirect', () => {
      const url = buildAuthorizeUrl({
        platform: StorePlatform.SHOPIFY,
        shopDomain: 'acme.myshopify.com',
        clientId: 'app_123',
        redirectUri: 'https://api.example.com/api/integrations/stores/callback/SHOPIFY',
        state: 'nonce123',
      });
      const u = new URL(url);
      expect(u.host).toBe('acme.myshopify.com');
      expect(u.pathname).toBe('/admin/oauth/authorize');
      expect(u.searchParams.get('client_id')).toBe('app_123');
      expect(u.searchParams.get('state')).toBe('nonce123');
      expect(u.searchParams.get('redirect_uri')).toContain('/callback/SHOPIFY');
      expect(u.searchParams.get('scope')).toContain('read_orders');
    });

    it('uses a central host for Salla and a placeholder id when client_id is deferred', () => {
      const url = buildAuthorizeUrl({
        platform: StorePlatform.SALLA,
        shopDomain: 'acme.salla.sa',
        clientId: '',
        redirectUri: 'https://api.example.com/cb',
        state: 's',
      });
      const u = new URL(url);
      expect(u.host).toBe('accounts.salla.sa');
      expect(u.searchParams.get('client_id')).toBe('DEFERRED_CLIENT_ID');
    });
  });

  describe('exchangeCodeForToken (credentials-deferred)', () => {
    it('returns a simulated token when app credentials are missing', async () => {
      const r = await exchangeCodeForToken({
        platform: StorePlatform.SHOPIFY,
        shopDomain: 'acme.myshopify.com',
        code: 'authcode42',
        clientId: '',
        clientSecret: '',
        redirectUri: 'https://api.example.com/cb',
      });
      expect(r.simulated).toBe(true);
      expect(r.accessToken).toMatch(/^sim_shopify_/);
      expect(r.scopes).toContain('read_orders');
    });
  });

  it('maps every StorePlatform to an IntakeSource', () => {
    for (const p of Object.values(StorePlatform)) {
      expect(PLATFORM_INTAKE[p]).toBeDefined();
    }
  });
});
