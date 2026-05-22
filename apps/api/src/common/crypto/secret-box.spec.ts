process.env.INTEGRATIONS_ENC_KEY = require('crypto').randomBytes(32).toString('base64');

import { decryptSecret, encryptSecret, hmacSha256Base64, safeEqual } from './secret-box';

describe('secret-box', () => {
  it('round-trips a secret through AES-256-GCM', () => {
    const plain = 'shopify_token_شكرا_123!';
    const enc = encryptSecret(plain);
    expect(enc).toMatch(/^v1:/);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('produces distinct ciphertexts for the same plaintext (random IV)', () => {
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
  });

  it('rejects tampered ciphertext (auth tag)', () => {
    const enc = encryptSecret('secret');
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'BB' : 'AA');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('computes + compares HMAC signatures', () => {
    const sig = hmacSha256Base64('whsec', '{"a":1}');
    expect(safeEqual(sig, hmacSha256Base64('whsec', '{"a":1}'))).toBe(true);
    expect(safeEqual(sig, hmacSha256Base64('other', '{"a":1}'))).toBe(false);
  });
});
