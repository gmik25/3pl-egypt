import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as not requiring authentication.
 * The global JwtAuthGuard checks for this metadata.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
