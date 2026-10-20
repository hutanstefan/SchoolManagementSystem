import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Every route requires a valid JWT by default.
 * Use @Public() to opt a route (or a whole controller) out of authentication.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
