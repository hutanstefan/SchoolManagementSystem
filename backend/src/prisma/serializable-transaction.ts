import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Runs check-then-write logic in a SERIALIZABLE transaction. If two admins edit
 * the timetable at the same moment, PostgreSQL aborts one of them instead of
 * letting both pass their checks and create a conflict.
 */
export async function serializableTransaction<T>(
  prisma: PrismaService,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(fn, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new ConflictException(
        'The data was changed by another request at the same time, please try again',
      );
    }
    throw error;
  }
}
