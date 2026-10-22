import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './auth.types';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

const INVALID_CREDENTIALS = 'Invalid email or password';

/** Fields needed to build an AuthUserDto, loaded in a single query. */
const authUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  student: {
    select: {
      id: true,
      registrationNumber: true,
      dateOfBirth: true,
      class: { select: { id: true, name: true } },
    },
  },
  teacher: { select: { id: true } },
} as const;

@Injectable()
export class AuthService {
  /**
   * Hash of a random value, compared against when the email does not exist.
   * This makes "unknown email" take as long as "wrong password", so response
   * times can't be used to find out which emails are registered.
   */
  private readonly dummyPasswordHash = bcrypt.hashSync(randomUUID(), 10);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login({ email, password }: LoginDto): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...authUserSelect, passwordHash: true, tokenVersion: true },
    });

    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? this.dummyPasswordHash,
    );
    if (!user || !passwordMatches) {
      // Same message for both cases, so the API doesn't reveal which emails exist.
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      ver: user.tokenVersion,
    };
    const {
      passwordHash: _passwordHash,
      tokenVersion: _tokenVersion,
      ...profile
    } = user;

    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_EXPIRES_IN_SECONDS', { infer: true }),
      user: this.toAuthUser(profile),
    };
  }

  /**
   * Ends every session of the user: bumping tokenVersion makes all tokens
   * issued so far invalid (see JwtAuthGuard).
   */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async getProfile(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: authUserSelect,
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.toAuthUser(user);
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: AuthUserDto['role'];
    student: {
      id: string;
      registrationNumber: string;
      dateOfBirth: Date;
      class: { id: string; name: string } | null;
    } | null;
    teacher: { id: string } | null;
  }): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      student: user.student
        ? {
            id: user.student.id,
            registrationNumber: user.student.registrationNumber,
            dateOfBirth: user.student.dateOfBirth.toISOString().slice(0, 10),
            class: user.student.class,
          }
        : null,
      teacher: user.teacher,
    };
  }
}
