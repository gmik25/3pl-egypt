import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Restrict an endpoint to callers holding at least one of the listed permission keys.
 * Permission keys are dot-namespaced strings, e.g. "users.write", "orders.transition".
 */
export const RequirePermissions = (...keys: string[]) => SetMetadata(PERMISSIONS_KEY, keys);
