import { personSelect, toPerson } from '../common/mappers';
import type { Prisma } from '../generated/prisma/client';
import type { TimetableLessonDto } from './dto/timetable.dto';

/** What is loaded for a lesson, everywhere a lesson is returned. */
export const lessonSelect = {
  id: true,
  day: true,
  period: true,
  room: true,
  classSubject: {
    select: {
      id: true,
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: personSelect },
    },
  },
} as const satisfies Prisma.TimetableEntrySelect;

export type LessonRow = Prisma.TimetableEntryGetPayload<{
  select: typeof lessonSelect;
}>;

export function toLesson(row: LessonRow): TimetableLessonDto {
  return {
    id: row.id,
    day: row.day,
    period: row.period,
    room: row.room,
    classSubjectId: row.classSubject.id,
    class: row.classSubject.class,
    subject: row.classSubject.subject,
    teacher: toPerson(row.classSubject.teacher),
  };
}
