import type { Request } from 'express';
import type { Role } from '../generated/prisma/client';

/** What we put inside the JWT. Kept minimal on purpose. */
export interface JwtPayload {
  /** User id (standard JWT "subject" claim). */
  sub: string;
  role: Role;
}

/** The authenticated user, attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
