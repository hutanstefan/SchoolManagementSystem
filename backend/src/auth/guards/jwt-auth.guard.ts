import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest, JwtPayload } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global guard: every route needs a valid "Authorization: Bearer <token>" header,
 * unless it is marked with @Public().
 *
 * The user is re-loaded from the database on every request, so a deleted user,
 * a changed role, a logout or a password reset take effect immediately instead
 * of when the token expires.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

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

    request.user = { id: user.id, role: user.role };
    return true;
  }

  private extractBearerToken(request: AuthenticatedRequest): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : null;
  }
}
