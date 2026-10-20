import { ConflictException } from '@nestjs/common';
import { formatSlot, fullName } from '../common/mappers';
import type { Prisma, Weekday } from '../generated/prisma/client';

type Tx = Prisma.TransactionClient;

interface Slot {
  day: Weekday;
  period: number;
  /** Ignore this entry (the lesson being moved). */
  excludeEntryId?: string;
}

/** 409 if the class already has a lesson in this slot. */
export async function assertClassIsFree(
  tx: Tx,
  classId: string,
  { day, period, excludeEntryId }: Slot,
): Promise<void> {
  const clash = await tx.timetableEntry.findFirst({
    where: { classId, day, period, id: { not: excludeEntryId } },
    select: {
      classSubject: {
        select: {
          class: { select: { name: true } },
          subject: { select: { name: true } },
        },
      },
    },
  });
  if (clash) {
    const { class: schoolClass, subject } = clash.classSubject;
    throw new ConflictException(
      `${schoolClass.name} already has ${subject.name} on ${formatSlot(day, period)}`,
    );
  }
}

/** 409 if the teacher already teaches another lesson in this slot. */
export async function assertTeacherIsFree(
  tx: Tx,
  teacherId: string | null,
  { day, period, excludeEntryId }: Slot,
): Promise<void> {
  if (!teacherId) return; // a vacant subject can't clash with anything

  const clash = await tx.timetableEntry.findFirst({
    where: {
      day,
      period,
      id: { not: excludeEntryId },
      classSubject: { teacherId },
    },
    select: {
      classSubject: {
        select: {
          class: { select: { name: true } },
          teacher: {
            select: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
  if (clash?.classSubject.teacher) {
    throw new ConflictException(
      `${fullName(clash.classSubject.teacher)} already teaches ${clash.classSubject.class.name} on ${formatSlot(day, period)}`,
    );
  }
}
