import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupTestData,
  createTestApp,
  currentClass,
  loginAs,
  TestApp,
} from './utils';

interface ClosingStudent {
  id: string;
  suggestedOutcome: string;
  failedSubjects: { subject: { id: string }; reexamGrade: number | null }[];
}
interface ClosingClass {
  class: { id: string; name: string };
  nextClassName: string | null;
  students: ClosingStudent[];
}

/**
 * The life of a school year: the archive of last year, ending the first
 * semester, re-exams, and closing the year into the next one. Closing changes
 * the whole database, so everything is put back afterwards.
 */
describe('School years (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let openYear: { id: string; startYear: number };
  let lastYear: { id: string; startYear: number };
  let class9A: { id: string; homeroomTeacherId: string | null };
  let maths: string;
  const gradeIds: string[] = [];

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    [adminToken, teacherToken, studentToken] = await Promise.all([
      loginAs(app, 'admin'),
      loginAs(app, 'teacher'),
      loginAs(app, 'student'),
    ]);
    openYear = await prisma.schoolYear.findFirstOrThrow({
      where: { status: 'ACTIVE' },
    });
    lastYear = await prisma.schoolYear.findFirstOrThrow({
      where: { startYear: openYear.startYear - 1 },
    });
    class9A = await currentClass(app, '9A');
    maths = (
      await prisma.subject.findFirstOrThrow({ where: { name: 'Mathematics' } })
    ).id;
  });

  afterAll(async () => {
    // Back to the seeded state: no next year, this year open in semester 1.
    const later = await prisma.schoolYear.findMany({
      where: { startYear: { gt: openYear.startYear } },
      select: { id: true },
    });
    const laterIds = later.map((y) => y.id);
    await prisma.enrollment.deleteMany({
      where: { schoolYearId: { in: laterIds } },
    });
    await prisma.class.deleteMany({
      where: { schoolYearId: { in: laterIds } },
    });
    await prisma.schoolYear.deleteMany({ where: { id: { in: laterIds } } });
    await prisma.schoolYear.update({
      where: { id: openYear.id },
      data: {
        status: 'ACTIVE',
        currentSemester: 1,
        semester1EndedAt: null,
        closedAt: null,
      },
    });
    await prisma.enrollment.updateMany({
      where: { schoolYearId: openYear.id },
      data: { outcome: null },
    });
    await prisma.reexam.deleteMany({ where: { schoolYearId: openYear.id } });
    await prisma.gradeHistory.deleteMany({
      where: { gradeId: { in: gradeIds } },
    });
    await prisma.grade.deleteMany({ where: { id: { in: gradeIds } } });
    await cleanupTestData(app);
    await app.close();
  });

  describe('the archive', () => {
    it('lists the open year and last year, with how last year ended', async () => {
      const { body } = await as(adminToken)(
        api().get('/api/school-years'),
      ).expect(200);
      expect(body).toEqual([
        expect.objectContaining({
          id: openYear.id,
          status: 'ACTIVE',
          currentSemester: 1,
          outcomes: null,
        }),
        expect.objectContaining({
          id: lastYear.id,
          name: `${lastYear.startYear}–${lastYear.startYear + 1}`,
          status: 'CLOSED',
          outcomes: { promoted: 40, repeating: 1, graduated: 10 },
        }),
      ]);
    });

    it('shows teachers and students only their own years', async () => {
      const teacher = await as(teacherToken)(
        api().get('/api/school-years'),
      ).expect(200);
      expect(teacher.body).toHaveLength(2); // taught last year too
      // The demo student started high school this year.
      const student = await as(studentToken)(
        api().get('/api/school-years'),
      ).expect(200);
      expect(student.body.map((y: { id: string }) => y.id)).toEqual([
        openYear.id,
      ]);
    });

    it("shows last year's classes and a student's whole year", async () => {
      const { body: classes } = await as(adminToken)(
        api().get(`/api/classes?schoolYearId=${lastYear.id}`),
      ).expect(200);
      expect(classes.data.map((c: { name: string }) => c.name)).toEqual([
        '9A',
        '9B',
        '10A',
        '11A',
        '12A',
      ]);
      expect(classes.data[0].schoolYear).toMatchObject({ status: 'CLOSED' });

      // Last year's 9A is this year's 10A.
      const nowIn10A = await prisma.class.findFirstOrThrow({
        where: { name: '10A', schoolYearId: openYear.id },
        select: { previousClassId: true },
      });
      expect(nowIn10A.previousClassId).toBe(classes.data[0].id);

      const student = await prisma.enrollment.findFirstOrThrow({
        where: { classId: classes.data[0].id },
      });
      const { body: year } = await as(adminToken)(
        api().get(
          `/api/students/${student.studentId}/grades/year?schoolYearId=${lastYear.id}`,
        ),
      ).expect(200);
      expect(year.outcome).toBe('PROMOTED');
      expect(year.generalAverage).toBeGreaterThanOrEqual(5);
      for (const subject of year.subjects) {
        expect(subject.semester1).not.toBeNull();
        expect(subject.semester2).not.toBeNull();
        expect(subject.passed).toBe(true);
      }
    });

    it('refuses any change to a closed year', async () => {
      const oldClass = await prisma.class.findFirstOrThrow({
        where: { schoolYearId: lastYear.id },
      });
      const refused = await as(adminToken)(
        api().patch(`/api/classes/${oldClass.id}`).send({ name: '9Z' }),
      ).expect(409);
      expect(refused.body.message).toContain('is closed');

      const oldGrade = await prisma.grade.findFirstOrThrow({
        where: { schoolYearId: lastYear.id },
      });
      await as(adminToken)(
        api().patch(`/api/grades/${oldGrade.id}`).send({ value: 10 }),
      ).expect(409);
    });
  });

  describe('the semesters', () => {
    it('lets only an admin end the first semester, once', async () => {
      await as(teacherToken)(
        api().post('/api/school-years/current/end-semester'),
      ).expect(403);
      const { body } = await as(adminToken)(
        api().post('/api/school-years/current/end-semester'),
      ).expect(200);
      expect(body).toMatchObject({ currentSemester: 2 });
      await as(adminToken)(
        api().post('/api/school-years/current/end-semester'),
      ).expect(409);
    });

    it('locks the ended semester for teachers, not for admins', async () => {
      const mine = await prisma.grade.findFirstOrThrow({
        where: {
          schoolYearId: openYear.id,
          semester: 1,
          teacher: { user: { email: 'teacher@school.test' } },
        },
      });
      const locked = await as(teacherToken)(
        api().patch(`/api/grades/${mine.id}`).send({ value: mine.value }),
      ).expect(403);
      expect(locked.body.message).toContain('Semester 1 has ended');

      // New grades go to the second semester.
      const student = await prisma.enrollment.findFirstOrThrow({
        where: { classId: class9A.id },
      });
      const { body: grade } = await as(teacherToken)(
        api().post('/api/grades').send({
          studentId: student.studentId,
          subjectId: maths,
          value: 9,
        }),
      ).expect(201);
      gradeIds.push(grade.id);
      expect(grade.semester).toBe(2);

      // An admin can still correct the first one.
      const { body: corrected } = await as(adminToken)(
        api().post('/api/grades').send({
          studentId: student.studentId,
          subjectId: maths,
          value: 8,
          semester: 1,
        }),
      ).expect(201);
      gradeIds.push(corrected.id);
      expect(corrected.semester).toBe(1);
    });
  });

  describe('closing the year', () => {
    let preview: { classes: ClosingClass[] };
    let star: string; // a 9A student who passes everything but Mathematics

    it('needs the second semester', async () => {
      // (The semester was ended above.)
      const { body } = await as(adminToken)(
        api().get('/api/school-years/current/closing'),
      ).expect(200);
      preview = body;
      expect(preview.classes.map((c) => c.class.name)).toEqual([
        '9A',
        '9B',
        '10A',
        '10B',
        '11A',
        '12A',
      ]);
      expect(preview.classes.at(-1)!.nextClassName).toBeNull();
    });

    it('suggests re-exams for one or two failed subjects', async () => {
      // The 9A student with the lowest first-semester Maths grades: a 1 in
      // the second semester takes their year under 5.
      const firstSemester = await prisma.grade.groupBy({
        by: ['studentId'],
        where: {
          subjectId: maths,
          schoolYearId: openYear.id,
          semester: 1,
          student: { enrollments: { some: { classId: class9A.id } } },
        },
        _avg: { value: true },
        orderBy: { _avg: { value: 'asc' } },
      });
      star = firstSemester[0].studentId;
      const subjects = await prisma.classSubject.findMany({
        where: { classId: class9A.id },
        select: { subjectId: true },
      });
      // A whole second semester for one student: 8 everywhere, 1 in Maths.
      for (const { subjectId } of subjects) {
        const { body } = await as(adminToken)(
          api()
            .post(`/api/classes/${class9A.id}/grades`)
            .send({
              subjectId,
              grades: [{ studentId: star, value: subjectId === maths ? 2 : 8 }],
            }),
        ).expect(201);
        gradeIds.push(...(body.gradeIds as string[]));
      }

      const { body } = await as(adminToken)(
        api().get('/api/school-years/current/closing'),
      ).expect(200);
      preview = body;
      const result = preview.classes[0].students.find((s) => s.id === star)!;
      // Maths: (first semester + 1) / 2 is under 5.
      expect(result.suggestedOutcome).toBe('REEXAM');
      expect(result.failedSubjects.map((f) => f.subject.id)).toEqual([maths]);
    });

    it('refuses to close while re-exam results are missing', async () => {
      const { body } = await as(adminToken)(
        api().post('/api/school-years/current/close').send({}),
      ).expect(400);
      expect(body.message).toContain('Enter the re-exam results');
    });

    it('records a re-exam, only for a failed subject', async () => {
      const physics = await prisma.subject.findFirstOrThrow({
        where: { name: 'Physics' },
      });
      await as(adminToken)(
        api()
          .put('/api/school-years/current/reexams')
          .send({ studentId: star, subjectId: physics.id, grade: 7 }),
      ).expect(400);
      await as(adminToken)(
        api()
          .put('/api/school-years/current/reexams')
          .send({ studentId: star, subjectId: maths, grade: 6 }),
      ).expect(204);

      const { body } = await as(adminToken)(
        api().get('/api/school-years/current/closing'),
      ).expect(200);
      const result = (
        body as { classes: ClosingClass[] }
      ).classes[0].students.find((s) => s.id === star)!;
      expect(result.suggestedOutcome).toBe('PROMOTED');
    });

    it('opens next year: classes a grade higher, promoted students, graduates gone', async () => {
      // Everyone else has no second-semester grades, so the rules hold them
      // back: the admin decides for the 9A and the 12A.
      const [first, , , , , last] = preview.classes;
      const decisions = [
        ...first.students
          .filter((s) => s.id !== star)
          .map((s) => ({ studentId: s.id, outcome: 'PROMOTED' })),
        ...last.students.map((s) => ({
          studentId: s.id,
          outcome: 'GRADUATED',
        })),
      ];
      const { body } = await as(adminToken)(
        api()
          .post('/api/school-years/current/close')
          .send({ decisions, createEntryClasses: true }),
      ).expect(200);
      expect(body.closedYear).toMatchObject({ status: 'CLOSED' });
      expect(body.newYear).toMatchObject({
        startYear: openYear.startYear + 1,
        status: 'ACTIVE',
        currentSemester: 1,
      });
      expect(body.outcomes.graduated).toBe(last.students.length);

      const next = await prisma.class.findMany({
        where: { schoolYear: { startYear: openYear.startYear + 1 } },
        select: {
          name: true,
          previousClassId: true,
          homeroomTeacherId: true,
          subjects: { select: { teacherId: true } },
          enrollments: { select: { studentId: true } },
        },
      });
      const byName = new Map(next.map((c) => [c.name, c]));
      // 9A moved up with its homeroom teacher, teachers and students.
      const tenA = byName.get('10A')!;
      expect(tenA.previousClassId).toBe(class9A.id);
      expect(tenA.homeroomTeacherId).toBe(class9A.homeroomTeacherId);
      expect(tenA.subjects.every((s) => s.teacherId !== null)).toBe(true);
      expect(tenA.enrollments.map((e) => e.studentId)).toEqual(
        expect.arrayContaining(first.students.map((s) => s.id)),
      );
      // A new, empty 9A for new students, teachers to be assigned.
      const nineA = byName.get('9A')!;
      expect(nineA.previousClassId).toBeNull();
      expect(nineA.subjects.every((s) => s.teacherId === null)).toBe(true);
      // The 12th graders left: no class next year.
      const graduates = await prisma.enrollment.count({
        where: {
          studentId: { in: last.students.map((s) => s.id) },
          schoolYear: { startYear: openYear.startYear + 1 },
        },
      });
      expect(graduates).toBe(0);

      // The year just closed is read-only now.
      await as(adminToken)(
        api().patch(`/api/classes/${class9A.id}`).send({ name: '9Z' }),
      ).expect(409);
    });
  });
});
