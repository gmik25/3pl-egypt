import type { GovernorateCode, UserRoleName } from '@prisma/client';

export interface JwtAccessPayload {
  /** subject = user id */
  sub: string;
  email: string;
  roles: UserRoleName[];
  permissions: string[];
  scopedGovernorates: GovernorateCode[];
  /** Whether the user authenticated with TOTP this session. */
  mfa: boolean;
  /** "access" — discriminator so refresh tokens cannot be used as access tokens. */
  typ: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  /** The id of the RefreshToken row — used to revoke. */
  jti: string;
  typ: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Hint to the client: if true, the next step is /auth/mfa/verify. */
  mfaRequired?: boolean;
}
