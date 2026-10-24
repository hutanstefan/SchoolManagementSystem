import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { compareClassNames } from '../classes/class-names';
import { Prisma, Role, SchoolYearStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ChatContactDto } from './dto/chat.dto';

/** Classes of the open school year. */
const OPEN_YEAR = {
  schoolYear: { status: SchoolYearStatus.ACTIVE },
} as const satisfies Prisma.ClassWhereInput;

/** Contacts shown at most (the search narrows them). */
const MAX_CONTACTS = 300;

/**
 * Who may write to whom (the chat is for teachers and students; admins
 * manage the school and have no chat):
 *
 * - Teachers: each other, and the students of the classes they teach or are
 *   the homeroom teacher of.
 * - Students: the teachers of their class (subject and homeroom teachers).
 *   Not each other: students only talk together in groups a teacher made.
 *
 * Groups are created by teachers, with people they may write to. Classes
 * are those of the open school year.
 */
@Injectable()
export class ChatPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /** The users `user` may start a direct conversation with, or add to a group. */
  async reachableWhere(user: AuthUser): Promise<Prisma.UserWhereInput> {
    const notMe = { id: { not: user.id } };

    if (user.role === Role.TEACHER) {
      const myClass: Prisma.ClassWhereInput = {
        ...OPEN_YEAR,
        OR: [
          { homeroomTeacher: { userId: user.id } },
          { subjects: { some: { teacher: { userId: user.id } } } },
        ],
      };
      return {
        ...notMe,
        OR: [
          { role: Role.TEACHER },
          { student: { enrollments: { some: { class: myClass } } } },
        ],
      };
    }

    const classId = await this.classIdOf(user);
    // A student without a class has no teachers to write to yet.
    if (!classId) return { id: { in: [] } };
    return {
      ...notMe,
      teacher: {
        OR: [
          { homeroomClasses: { some: { id: classId } } },
          { classSubjects: { some: { classId } } },
        ],
      },
    };
  }

  /** A student's class in the open school year. */
  private async classIdOf(user: AuthUser): Promise<string | null> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { student: { userId: user.id }, schoolYear: OPEN_YEAR.schoolYear },
      select: { classId: true },
    });
    return enrollment?.classId ?? null;
  }

  /** Throws 403, naming the people `user` may not write to. */
  async assertCanReach(user: AuthUser, userIds: string[]): Promise<void> {
    const ids = [...new Set(userIds)];
    const reachable = await this.prisma.user.findMany({
      where: { AND: [await this.reachableWhere(user), { id: { in: ids } }] },
      select: { id: true },
    });
    if (reachable.length === ids.length) return;

    const allowed = new Set(reachable.map((u) => u.id));
    const others = await this.prisma.user.findMany({
      where: { id: { in: ids.filter((id) => !allowed.has(id)) } },
      select: { firstName: true, lastName: true },
    });
    if (others.length === 0) {
      throw new ForbiddenException("You can't write to this person");
    }
    const names = others.map((u) => `${u.firstName} ${u.lastName}`);
    throw new ForbiddenException(
      user.role === Role.STUDENT
        ? `You can only write to your teachers, not to ${names.join(', ')}`
        : `You can't write to ${names.join(', ')}`,
    );
  }

  /** People the user may write to, with who they are ("9A", "Mathematics"). */
  async contacts(user: AuthUser, search?: string): Promise<ChatContactDto[]> {
    const words = (search ?? '').split(/\s+/).filter(Boolean);
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          await this.reachableWhere(user),
          ...words.map((word) => ({
            OR: [
              { firstName: { contains: word, mode: 'insensitive' as const } },
              { lastName: { contains: word, mode: 'insensitive' as const } },
            ],
          })),
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        student: {
          select: {
            enrollments: {
              where: { schoolYear: OPEN_YEAR.schoolYear },
              select: { class: { select: { id: true, name: true } } },
            },
          },
        },
        teacher: {
          select: {
            homeroomClasses: {
              where: OPEN_YEAR,
              select: { id: true, name: true },
            },
            classSubjects: {
              where: { class: OPEN_YEAR },
              select: { classId: true, subject: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: MAX_CONTACTS,
    });

    const myClassId =
      user.role === Role.STUDENT ? await this.classIdOf(user) : null;

    const contacts = users.map((u): ChatContactDto => {
      const schoolClass = u.student?.enrollments[0]?.class ?? null;
      let detail: string | null = null;
      if (u.role === Role.STUDENT) detail = schoolClass?.name ?? 'No class';
      if (u.role === Role.TEACHER && u.teacher) {
        // A student sees what the teacher teaches them; others, everything.
        const subjects = u.teacher.classSubjects
          .filter((cs) => !myClassId || cs.classId === myClassId)
          .map((cs) => cs.subject.name);
        const homeroom = u.teacher.homeroomClasses.find(
          (c) => !myClassId || c.id === myClassId,
        );
        detail =
          [
            ...new Set(subjects),
            homeroom &&
              (myClassId
                ? 'your homeroom teacher'
                : `homeroom teacher of ${homeroom.name}`),
          ]
            .filter(Boolean)
            .join(' · ') || 'Teacher';
      }
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        class: schoolClass,
        detail,
      };
    });

    // Teachers first, then students class by class.
    const rank = { ADMIN: 0, TEACHER: 1, STUDENT: 2 } as const;
    return contacts.sort(
      (a, b) =>
        rank[a.role] - rank[b.role] ||
        compareClassNames(a.class?.name ?? '', b.class?.name ?? ''),
    );
  }
}
