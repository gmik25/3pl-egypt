import type { GovernorateCode, UserRole } from '@3pl/shared';

export interface AccessClaims {
  sub: string;
  email: string;
  roles: UserRole[];
  permissions: string[];
  scopedGovernorates: GovernorateCode[];
  mfa: boolean;
  exp: number;
}

/** Decode (NOT verify) a JWT payload. Verification is the server's job; the client only reads claims for UI gating. */
export function decodeAccessToken(token: string | null): AccessClaims | null {
  if (!token) return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as AccessClaims;
  } catch {
    return null;
  }
}
