import type { Request } from 'express';
import type { GovernorateCode, UserRoleName } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  clientId: string | null;
  roles: UserRoleName[];
  /** Permission keys ("orders.read", etc.) flattened from the user's roles. */
  permissions: string[];
  /** Empty array = no governorate restriction. */
  scopedGovernorates: GovernorateCode[];
  /** True if MFA was verified for this session. */
  mfaVerified: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
