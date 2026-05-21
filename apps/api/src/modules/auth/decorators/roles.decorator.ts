import { SetMetadata } from '@nestjs/common';
import type { UserRoleName } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restrict an endpoint to one or more roles.
 * The RolesGuard reads this and rejects callers whose roles do not intersect.
 */
export const Roles = (...roles: UserRoleName[]) => SetMetadata(ROLES_KEY, roles);
