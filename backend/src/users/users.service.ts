import { ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { hashPassword } from '../common/password';
import { DomainEvents, type SessionEndedEvent } from '../events/domain-events';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Account-level helpers shared by the students and teachers modules. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Throws 409 if another user already has this email. */
  async assertEmailAvailable(
    email: string,
    exceptUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException('Email already in use');
    }
  }

  /**
   * Builds the user fields to update from a partial DTO: checks the new email
   * and hashes a new password, so a plain-text password never reaches the database.
   * A new password also logs the user out everywhere.
   */
  async buildAccountUpdate(
    userId: string,
    dto: {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
    },
  ): Promise<Prisma.UserUpdateInput> {
    if (dto.email) await this.assertEmailAvailable(dto.email, userId);

    return {
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash: dto.password ? await hashPassword(dto.password) : undefined,
      // A password reset also ends every existing session of that user.
      tokenVersion: dto.password ? { increment: 1 } : undefined,
    };
  }

  /**
   * Closes the user's live connections after a password reset or when the
   * account is deleted. Their tokens are already refused by the API (the
   * token version changed, or the user is gone); this stops the WebSocket
   * pushes too, which were authenticated once, when the tab connected.
   */
  async endSessions(userId: string): Promise<void> {
    await this.events.emitAsync(DomainEvents.SessionEnded, {
      userId,
    } satisfies SessionEndedEvent);
  }
}
