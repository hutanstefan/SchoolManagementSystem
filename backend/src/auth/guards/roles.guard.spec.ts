import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/client';
import type { AuthUser } from '../auth.types';
import { RolesGuard } from './roles.guard';

function contextFor(user: AuthUser | undefined): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  const requireRoles = (roles: Role[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  afterEach(() => jest.restoreAllMocks());

  it('allows any authenticated user when the route has no @Roles()', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextFor({ id: '1', role: 'STUDENT' }))).toBe(
      true,
    );
  });

  it('allows a user whose role is listed', () => {
    requireRoles(['ADMIN', 'TEACHER']);
    expect(guard.canActivate(contextFor({ id: '1', role: 'TEACHER' }))).toBe(
      true,
    );
  });

  it('rejects a user whose role is not listed', () => {
    requireRoles(['ADMIN']);
    expect(() =>
      guard.canActivate(contextFor({ id: '1', role: 'STUDENT' })),
    ).toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user', () => {
    requireRoles(['ADMIN']);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
