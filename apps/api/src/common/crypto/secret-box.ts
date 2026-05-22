import * as crypto from 'node:crypto';

// EG: AES-256-GCM envelope for credentials at rest (courier API keys, OAuth tokens,
// webhook secrets). The key comes from INTEGRATIONS_ENC_KEY (32 bytes, base64 or hex);
// in production it must live in a secret manager, never in the repo.

const ALGO = 'aes-256-gcm';

function loadKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENC_KEY ?? '';
  // accept base64 (44 chars) or hex (64 chars); fall back to utf8 bytes
  let key: Buffer;
  if (/^[A-Za-z0-9+/]+=*$/.test(raw) && raw.length >= 44) key = Buffer.from(raw, 'base64');
  else if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, 'hex');
  else key = Buffer.from(raw, 'utf8');
  if (key.length !== 32) {
    throw new Error('INTEGRATIONS_ENC_KEY must decode to 32 bytes (256-bit)');
  }
  return key;
}

/** Encrypt a UTF-8 string → "v1:base64(iv).base64(tag).base64(ct)". */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, loadKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}

/** Decrypt a value produced by encryptSecret. */
export function decryptSecret(blob: string): string {
  const [version, body] = blob.split(':');
  if (version !== 'v1' || !body) throw new Error('Unrecognised secret format');
  const [ivB64, tagB64, ctB64] = body.split('.');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Malformed secret');
  const decipher = crypto.createDecipheriv(ALGO, loadKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

/** HMAC-SHA256 of a raw payload, base64 — for verifying inbound webhooks. */
export function hmacSha256Base64(secret: string, rawBody: string | Buffer): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
}

/** Constant-time comparison of two signatures. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
