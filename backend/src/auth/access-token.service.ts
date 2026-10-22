import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser, JwtPayload } from './auth.types';

/**
 * Checks an access token: its signature and expiry, and that the user still
 * exists and hasn't logged out since it was issued. Used for HTTP requests
 * (JwtAuthGuard) and WebSocket connections alike.
 */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async verify(token: string | null | undefined): Promise<AuthUser> {
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // The user is re-loaded every time, so a deleted user, a changed role, a
    // logout or a password reset take effect immediately instead of when the
    // token expires.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, tokenVersion: true },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (payload.ver !== user.tokenVersion) {
      // The user logged out or their password was reset after this token was issued.
      throw new UnauthorizedException('Session has ended, please log in again');
    }
    return { id: user.id, role: user.role };
  }
}
