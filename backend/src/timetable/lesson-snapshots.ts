import { subjectSummarySelect } from '../common/mappers';
import type { LessonSnapshot } from '../events/domain-events';
import type { Prisma } from '../generated/prisma/client';

type Db = Pick<Prisma.TransactionClient, 'timetableEntry'>;

/**
 * The lessons of some classes as they are now, to compare before and after a
 * change (see TimetableChangedEvent). Read inside the change's transaction.
 */
export async function snapshotLessons(
  db: Db,
  classIds: string[],
): Promise<LessonSnapshot[]> {
  const rows = await db.timetableEntry.findMany({
    where: { classId: { in: classIds } },
    select: {
      id: true,
      classId: true,
      day: true,
      period: true,
      room: true,
      classSubject: {
        select: {
          class: { select: { name: true } },
          subject: { select: subjectSummarySelect },
          teacher: {
            select: {
              userId: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
  return rows.map((row) => {
    const teacher = row.classSubject.teacher;
    return {
      id: row.id,
      classId: row.classId,
      className: row.classSubject.class.name,
      subjectId: row.classSubject.subject.id,
      subjectName: row.classSubject.subject.name,
      teacherUserId: teacher?.userId ?? null,
      teacherName: teacher
        ? `${teacher.user.firstName} ${teacher.user.lastName}`
        : null,
      day: row.day,
      period: row.period,
      room: row.room,
    };
  });
}
