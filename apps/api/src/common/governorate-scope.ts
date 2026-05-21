import { ForbiddenException } from '@nestjs/common';
import type { GovernorateCode } from '@prisma/client';
import type { AuthenticatedUser } from './types/authenticated-request';

/**
 * EG: Regional managers are scoped to a subset of the 27 governorates.
 * An empty scopedGovernorates list = no restriction (head-office roles, Super Admin, Finance HQ).
 */

/** Returns the governorate filter to merge into a Prisma `where`, or undefined when unrestricted. */
export function governorateFilter(user: AuthenticatedUser): { in: GovernorateCode[] } | undefined {
  if (!user.scopedGovernorates || user.scopedGovernorates.length === 0) return undefined;
  return { in: user.scopedGovernorates };
}

/** Throws 403 if the user is scoped and the target governorate is outside their scope. */
export function assertGovernorateInScope(user: AuthenticatedUser, gov: GovernorateCode): void {
  if (!user.scopedGovernorates || user.scopedGovernorates.length === 0) return;
  if (!user.scopedGovernorates.includes(gov)) {
    throw new ForbiddenException('Resource is outside your governorate scope');
  }
}
