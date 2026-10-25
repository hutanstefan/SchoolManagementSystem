import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { todayInSchool } from '../src/common/dates';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, currentClass, loginAs, TestApp } from './utils';

interface Absence {
  id: string;
  date: string;
  excused: boolean;
  excuseNote: string | null;
  canChange: boolean;
  student: { id: string };
  subject: { name: string };
  recordedBy: { lastName: string } | null;
}

/** The most recent weekend days (the seed only records absences on school days). */
function weekendDays(count: number): string[] {
  const days: string[] = [];
  const day = new Date(`${todayInSchool()}T12:00:00Z`);
  while (days.length < count) {
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) {
      days.push(day.toISOString().slice(0, 10));
    }
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return days;
}

/**
 * teacher@school.test (Mihai Ionescu) teaches Mathematics in 9A, 9B and 10A
 * and is the homeroom teacher of 9A. student@school.test is in 9A.
 */
describe('Absences (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let otherTeacherToken: string; // teaches English in 9A, not homeroom
  let class9A: string;
  let class9B: string;
  let math: string;
  let english: string;
  let physics: string;
  let studentId: string; // student@school.test
  let classmateId: string; // another 9A student, no Mathematics absences
  let student9BId: string;
  let mathLimit: number | null = null; // restored at the end
  const startedAt = new Date();
  const [day1, day2, day3, day4] = weekendDays(4);

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);
  const attend = (token: string, body: Record<string, unknown>) =>
    as(token)(api().post('/api/absences/attendance').send(body));
  const list = async (token: string, query: Record<string, string | number>) =>
    (
      await as(token)(
        api()
          .get('/api/absences')
          .query({ pageSize: 100, ...query }),
      ).expect(200)
    ).body as { data: Absence[]; meta: { total: number } };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    [adminToken, teacherToken, studentToken] = await Promise.all([
      loginAs(app, 'admin'),
      loginAs(app, 'teacher'),
      loginAs(app, 'student'),
    ]);
    class9A = (await currentClass(app, '9A')).id;
    class9B = (await currentClass(app, '9B')).id;
    const subjects = await prisma.subject.findMany();
    const id = (name: string) => subjects.find((s) => s.name === name)!.id;
    [math, english, physics] = [
      id('Mathematics'),
      id('English'),
      id('Physics'),
    ];

    studentId = (
      await prisma.student.findFirstOrThrow({
        where: { user: { email: 'student@school.test' } },
      })
    ).id;
    classmateId = (
      await prisma.student.findFirstOrThrow({
        where: {
          id: { not: studentId },
          enrollments: { some: { classId: class9A } },
          absences: { none: { subjectId: math } },
        },
      })
    ).id;
    student9BId = (
      await prisma.student.findFirstOrThrow({
        where: { enrollments: { some: { classId: class9B } } },
      })
    ).id;

    const englishTeacher = await prisma.classSubject.findUniqueOrThrow({
      where: { classId_subjectId: { classId: class9A, subjectId: english } },
      select: { teacher: { select: { user: { select: { email: true } } } } },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: englishTeacher.teacher!.user.email },
    });
    otherTeacherToken = await app
      .get(JwtService)
      .signAsync({ sub: user.id, role: user.role, ver: user.tokenVersion });
  });

  afterAll(async () => {
    await prisma.absence.deleteMany({
      where: { date: { in: [day1, day2, day3, day4].map((d) => new Date(d)) } },
    });
    await prisma.notification.deleteMany({
      where: {
        createdAt: { gte: startedAt },
        type: { in: ['ABSENCE_WARNING', 'ABSENCE_LIMIT'] },
      },
    });
    await prisma.auditLog.deleteMany({
      where: { category: 'Absences', createdAt: { gte: startedAt } },
    });
    await prisma.classSubject.update({
      where: { classId_subjectId: { classId: class9A, subjectId: math } },
      data: { maxAbsences: mathLimit },
    });
    await app.close();
  });

  describe('taking attendance', () => {
    it('records the absent students, once per day', async () => {
      const { body } = await attend(teacherToken, {
        classId: class9A,
        subjectId: math,
        date: day1,
        studentIds: [studentId, classmateId],
      }).expect(201);
      expect(body).toEqual({ recorded: 2, alreadyAbsent: 0 });

      const { body: again } = await attend(teacherToken, {
        classId: class9A,
        subjectId: math,
        date: day1,
        studentIds: [studentId],
      }).expect(201);
      expect(again).toEqual({ recorded: 0, alreadyAbsent: 1 });

      const { data } = await list(teacherToken, {
        studentId,
        subjectId: math,
      });
      expect(data.find((a) => a.date === day1)).toMatchObject({
        excused: false,
        canChange: true,
        recordedBy: { lastName: 'Ionescu' },
      });
    });

    it('only in a subject the teacher teaches in the class', async () => {
      const { body } = await attend(teacherToken, {
        classId: class9A,
        subjectId: physics,
        date: day1,
        studentIds: [studentId],
      }).expect(403);
      expect(body.message).toBe("You don't teach Physics in 9A");
      await attend(studentToken, {
        classId: class9A,
        subjectId: math,
        studentIds: [studentId],
      }).expect(403);
    });

    it('rejects students of another class, future days and odd semesters', async () => {
      await attend(teacherToken, {
        classId: class9A,
        subjectId: math,
        studentIds: [student9BId],
      }).expect(400);
      const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      await attend(teacherToken, {
        classId: class9A,
        subjectId: math,
        date: tomorrow,
        studentIds: [studentId],
      }).expect(400);
      const { body } = await attend(teacherToken, {
        classId: class9A,
        subjectId: math,
        date: '2020-01-10',
        studentIds: [studentId],
      }).expect(400);
      expect(body.message).toMatch(/is not in semester/);
      // Only admins choose the semester.
      await attend(teacherToken, {
        classId: class9A,
        subjectId: math,
        semester: 1,
        studentIds: [studentId],
      }).expect(403);
    });
  });

  describe('the limit', () => {
    it('warns the student and the homeroom teacher, once, and again when over', async () => {
      // A limit of 2: the warning comes at 2 (80%), "over" at 3.
      const cs = await prisma.classSubject.findUniqueOrThrow({
        where: { classId_subjectId: { classId: class9A, subjectId: math } },
      });
      mathLimit = cs.maxAbsences;
      const { body: updated } = await as(adminToken)(
        api().patch(`/api/class-subjects/${cs.id}`).send({ maxAbsences: 2 }),
      ).expect(200);
      expect(updated.maxAbsences).toBe(2);

      const notes = async (email: string) =>
        prisma.notification.findMany({
          where: {
            user: { email: email },
            createdAt: { gte: startedAt },
            type: { in: ['ABSENCE_WARNING', 'ABSENCE_LIMIT'] },
          },
          orderBy: { createdAt: 'asc' },
          select: { type: true, title: true, link: true },
        });
      const classmate = await prisma.student.findUniqueOrThrow({
        where: { id: classmateId },
        select: { user: { select: { email: true, firstName: true } } },
      });

      // Recorded by an admin, so the homeroom teacher is told as well.
      for (const date of [day2, day3]) {
        await attend(adminToken, {
          classId: class9A,
          subjectId: math,
          date,
          studentIds: [classmateId],
        }).expect(201);
      }
      expect(await notes(classmate.user.email)).toEqual([
        expect.objectContaining({
          type: 'ABSENCE_WARNING',
          title: '2 of 2 absences in Mathematics',
        }),
        expect.objectContaining({
          type: 'ABSENCE_LIMIT',
          title: 'Over the absence limit in Mathematics',
          link: '/student/grades',
        }),
      ]);
      const alerts = await notes('teacher@school.test');
      expect(alerts.map((n) => n.type)).toEqual([
        'ABSENCE_WARNING',
        'ABSENCE_LIMIT',
      ]);
      expect(alerts[1].link).toBe(`/teacher/classes/${class9A}?tab=absences`);

      // Already over: nothing new.
      await attend(adminToken, {
        classId: class9A,
        subjectId: math,
        date: day4,
        studentIds: [classmateId],
      }).expect(201);
      expect(await notes(classmate.user.email)).toHaveLength(2);
    });

    it('shows the counts in the gradebook and the class summary', async () => {
      const { body: book } = await as(teacherToken)(
        api()
          .get(`/api/classes/${class9A}/gradebook`)
          .query({ subjectId: math }),
      ).expect(200);
      expect(book).toMatchObject({ maxAbsences: 2, canTakeAttendance: true });
      const row = (
        book.students as {
          student: { id: string };
          absences: { unexcused: number; excused: number };
        }[]
      ).find((s) => s.student.id === classmateId)!;
      expect(row.absences).toEqual({ unexcused: 4, excused: 0 });

      const { body: summary } = await as(teacherToken)(
        api().get(`/api/classes/${class9A}/absences`),
      ).expect(200);
      const mine = (
        summary.students as {
          student: { id: string };
          overLimit: number;
          subjects: { subject: { name: string }; unexcused: number }[];
        }[]
      ).find((s) => s.student.id === classmateId)!;
      expect(mine.overLimit).toBeGreaterThanOrEqual(1);
      expect(
        mine.subjects.find((s) => s.subject.name === 'Mathematics'),
      ).toMatchObject({ unexcused: 4, maxAbsences: 2 });
    });

    it('the class summary is for the homeroom teacher and admins', async () => {
      await as(teacherToken)(
        api().get(`/api/classes/${class9B}/absences`),
      ).expect(403);
      await as(studentToken)(
        api().get(`/api/classes/${class9A}/absences`),
      ).expect(403);
      await as(adminToken)(
        api().get(`/api/classes/${class9B}/absences`),
      ).expect(200);
    });
  });

  describe('excusing and deleting', () => {
    const absenceOf = async (student: string, date: string) =>
      (
        await list(adminToken, { studentId: student, subjectId: math })
      ).data.find((a) => a.date === date)!;

    it('a teacher who neither recorded it nor is the homeroom teacher cannot', async () => {
      const absence = await absenceOf(studentId, day1);
      const { data } = await list(otherTeacherToken, { studentId });
      // They see only their own subject.
      expect(data.every((a) => a.subject.name === 'English')).toBe(true);
      await as(otherTeacherToken)(
        api().patch(`/api/absences/${absence.id}`).send({ excused: true }),
      ).expect(403);
      await as(otherTeacherToken)(
        api().delete(`/api/absences/${absence.id}`),
      ).expect(403);
      await as(studentToken)(
        api().patch(`/api/absences/${absence.id}`).send({ excused: true }),
      ).expect(403);
    });

    it('the teacher who recorded it excuses it, and takes the excuse back', async () => {
      const absence = await absenceOf(studentId, day1);
      const { body } = await as(teacherToken)(
        api()
          .patch(`/api/absences/${absence.id}`)
          .send({ excused: true, note: '  Medical note  ' }),
      ).expect(200);
      expect(body).toMatchObject({
        excused: true,
        excuseNote: 'Medical note',
        excusedBy: { lastName: 'Ionescu' },
      });
      const { body: back } = await as(teacherToken)(
        api().patch(`/api/absences/${absence.id}`).send({ excused: false }),
      ).expect(200);
      expect(back).toMatchObject({ excused: false, excuseNote: null });
    });

    it('the homeroom teacher excuses a whole period, in every subject', async () => {
      // An English absence recorded by the English teacher, same weekend.
      await attend(otherTeacherToken, {
        classId: class9A,
        subjectId: english,
        date: day2,
        studentIds: [classmateId],
      }).expect(201);
      const { body } = await as(teacherToken)(
        api().post('/api/absences/excuse').send({
          studentId: classmateId,
          from: day2,
          to: day2,
          note: 'Hospital',
        }),
      ).expect(200);
      expect(body).toEqual({ excused: 2 }); // Mathematics and English
      const excused = await list(teacherToken, {
        studentId: classmateId,
        excused: 'true',
      });
      expect(excused.data.filter((a) => a.date === day2)).toHaveLength(2);

      await as(otherTeacherToken)(
        api()
          .post('/api/absences/excuse')
          .send({ studentId: classmateId, from: day4, to: day4 }),
      ).expect(403);
      await as(teacherToken)(
        api()
          .post('/api/absences/excuse')
          .send({ studentId: classmateId, from: day2, to: day3 }),
      ).expect(400);
    });

    it('excused absences no longer count against the limit', async () => {
      const { body: book } = await as(adminToken)(
        api()
          .get(`/api/classes/${class9A}/gradebook`)
          .query({ subjectId: math }),
      ).expect(200);
      const row = (
        book.students as {
          student: { id: string };
          absences: { unexcused: number; excused: number };
        }[]
      ).find((s) => s.student.id === classmateId)!;
      expect(row.absences).toEqual({ unexcused: 3, excused: 1 });
    });

    it('the homeroom teacher and admins delete absences', async () => {
      const english9A = await list(adminToken, {
        studentId: classmateId,
        subjectId: english,
      });
      const recordedByOther = english9A.data.find((a) => a.date === day2)!;
      // Homeroom teacher, though recorded by the English teacher.
      await as(teacherToken)(
        api().delete(`/api/absences/${recordedByOther.id}`),
      ).expect(204);
      const mathDay4 = await absenceOf(classmateId, day4);
      await as(adminToken)(api().delete(`/api/absences/${mathDay4.id}`)).expect(
        204,
      );
      await as(adminToken)(api().delete(`/api/absences/${mathDay4.id}`)).expect(
        404,
      );
    });
  });

  describe('who sees what', () => {
    it('students see only their own absences, with their report card counts', async () => {
      const { data, meta } = await list(studentToken, {});
      expect(meta.total).toBeGreaterThan(0);
      expect(data.every((a) => a.student.id === studentId)).toBe(true);
      expect(data.every((a) => !a.canChange)).toBe(true);

      const { body: report } = await as(studentToken)(
        api().get('/api/grades/me'),
      ).expect(200);
      const mathRow = (
        report.subjects as {
          subject: { name: string };
          absences: { unexcused: number };
          maxAbsences: number | null;
        }[]
      ).find((s) => s.subject.name === 'Mathematics')!;
      const unexcused = await prisma.absence.count({
        where: {
          studentId,
          subjectId: math,
          excused: false,
          semester: report.period.semester,
          schoolYear: { status: 'ACTIVE' },
        },
      });
      expect(mathRow.absences.unexcused).toBe(unexcused);
      expect(mathRow.maxAbsences).toBe(2);
    });

    it('teachers see their homeroom class and the subjects they teach', async () => {
      const in9A = new Set(
        (
          await prisma.enrollment.findMany({
            where: { classId: class9A },
            select: { studentId: true },
          })
        ).map((e) => e.studentId),
      );
      const { data } = await list(teacherToken, {});
      expect(data.length).toBeGreaterThan(0);
      expect(
        data.every(
          (a) => a.subject.name === 'Mathematics' || in9A.has(a.student.id),
        ),
      ).toBe(true);
      const { meta } = await list(teacherToken, {
        classId: class9B,
        subjectId: english,
      });
      expect(meta.total).toBe(0);
      await as(teacherToken)(
        api().get('/api/absences').query({ excused: 'maybe' }),
      ).expect(400);
    });
  });

  it('every change is in the activity log', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { category: 'Absences', createdAt: { gte: startedAt } },
      select: { action: true },
    });
    const actions = new Set(logs.map((l) => l.action));
    expect([...actions].sort()).toEqual([
      'Changed an absence',
      'Deleted an absence',
      'Excused absences',
      'Took attendance',
    ]);
  });
});
