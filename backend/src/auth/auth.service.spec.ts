import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.types';

// Wrap the real bcrypt.compare in a mock so tests can check that it was called.
jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return {
    ...actual,
    compare: jest.fn((data: string, hash: string) =>
      actual.compare(data, hash),
    ),
  };
});

const PASSWORD = 'Password123!';
const JWT_SECRET = 'test-secret-that-is-long-enough-1234567890';

describe('AuthService', () => {
  let service: AuthService;
  let jwt: JwtService;
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };

  const studentUser = {
    id: 'user-1',
    email: 'student@school.test',
    firstName: 'Andrei',
    lastName: 'Georgescu',
    role: 'STUDENT' as const,
    passwordHash: bcrypt.hashSync(PASSWORD, 4),
    tokenVersion: 3,
    student: {
      id: 'student-1',
      registrationNumber: '2026-0001',
      dateOfBirth: new Date('2011-07-25T00:00:00.000Z'),
      class: { id: 'class-1', name: '9A' },
    },
    teacher: null,
  };

  beforeEach(async () => {
    prisma.user.findUnique.mockReset();
    prisma.user.update.mockReset();
    jwt = new JwtService({ secret: JWT_SECRET });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: () => 3600 } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('returns a signed token and the user profile for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(studentUser);

      const result = await service.login({
        email: 'student@school.test',
        password: PASSWORD,
      });

      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
      const payload = await jwt.verifyAsync<JwtPayload>(result.accessToken);
      // The token carries the current tokenVersion, so logout can revoke it.
      expect(payload).toMatchObject({ sub: 'user-1', role: 'STUDENT', ver: 3 });
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'student@school.test',
        firstName: 'Andrei',
        lastName: 'Georgescu',
        role: 'STUDENT',
        student: {
          id: 'student-1',
          registrationNumber: '2026-0001',
          dateOfBirth: '2011-07-25',
          class: { id: 'class-1', name: '9A' },
        },
        teacher: null,
      });
    });

    it('never exposes the password hash', async () => {
      prisma.user.findUnique.mockResolvedValue(studentUser);

      const result = await service.login({
        email: 'student@school.test',
        password: PASSWORD,
      });

      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(result.user).not.toHaveProperty('tokenVersion');
      expect(JSON.stringify(result)).not.toContain(studentUser.passwordHash);
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(studentUser);

      await expect(
        service.login({ email: 'student@school.test', password: 'wrong' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('rejects an unknown email with the same message as a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      jest.mocked(bcrypt.compare).mockClear();

      await expect(
        service.login({ email: 'nobody@school.test', password: PASSWORD }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
      // A hash comparison still happens, so timing doesn't reveal unknown emails.
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout', () => {
    it('bumps the token version, which invalidates every issued token', async () => {
      await service.logout('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tokenVersion: { increment: 1 } },
      });
    });
  });

  describe('getProfile', () => {
    it('returns the profile of an existing user', async () => {
      const {
        passwordHash: _passwordHash,
        tokenVersion: _tokenVersion,
        ...profile
      } = studentUser;
      prisma.user.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile('user-1');

      expect(result.student?.class?.name).toBe('9A');
    });

    it('rejects a user that no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('deleted-user')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
