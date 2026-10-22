import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, loginAs, TestApp } from './utils';

/** The smallest valid PNG (1x1 pixel): enough for the demo reader. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('Batch grades and test scanning (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let class9A: string;
  let class10B: string;
  let maths: string;
  let physics: string;
  let students9A: { id: string }[];
  let student10B: string;
  const createdGradeIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    [adminToken, teacherToken, studentToken] = await Promise.all([
      loginAs(app, 'admin'),
      loginAs(app, 'teacher'),
      loginAs(app, 'student'),
    ]);
    const classes = await prisma.class.findMany({
      where: { name: { in: ['9A', '10B'] } },
    });
    class9A = classes.find((c) => c.name === '9A')!.id;
    class10B = classes.find((c) => c.name === '10B')!.id;
    const subjects = await prisma.subject.findMany({
      where: { name: { in: ['Mathematics', 'Physics'] } },
    });
    maths = subjects.find((s) => s.name === 'Mathematics')!.id;
    physics = subjects.find((s) => s.name === 'Physics')!.id;
    students9A = await prisma.student.findMany({
      where: { classId: class9A },
      select: { id: true },
      take: 3,
    });
    student10B = (
      await prisma.student.findFirstOrThrow({
        where: { classId: class10B },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.gradeHistory.deleteMany({
      where: { gradeId: { in: createdGradeIds } },
    });
    await prisma.grade.deleteMany({ where: { id: { in: createdGradeIds } } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);
  const gradeCount = () => prisma.grade.count();

  describe('POST /classes/:id/grades (batch)', () => {
    it('saves one grade per student, with the history, in one go', async () => {
      const before = await gradeCount();
      const { body } = await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grades`)
          .send({
            subjectId: maths,
            date: '2026-10-01',
            grades: students9A.map((s, i) => ({
              studentId: s.id,
              value: 7 + i,
            })),
          }),
      ).expect(201);

      expect(body.count).toBe(3);
      expect(body.gradeIds).toHaveLength(3);
      const saved = await prisma.grade.findMany({
        where: { id: { in: body.gradeIds } },
        include: { teacher: { include: { user: true } } },
      });
      createdGradeIds.push(...saved.map((g) => g.id));
      expect(saved.map((g) => g.value).sort()).toEqual([7, 8, 9]);
      expect(
        saved.every((g) => g.teacher?.user.email === 'teacher@school.test'),
      ).toBe(true);
      expect(await gradeCount()).toBe(before + 3);
      expect(
        await prisma.gradeHistory.count({
          where: { gradeId: { in: saved.map((g) => g.id) } },
        }),
      ).toBe(3);
    });

    it('saves nothing when one student is not in the class', async () => {
      const before = await gradeCount();
      const { body } = await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grades`)
          .send({
            subjectId: maths,
            grades: [
              { studentId: students9A[0].id, value: 9 },
              { studentId: student10B, value: 9 },
            ],
          }),
      ).expect(400);

      expect(body.message).toBe('1 of the students are not in 9A');
      expect(await gradeCount()).toBe(before);
    });

    it('rejects the same student twice and invalid values', async () => {
      const id = students9A[0].id;
      await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grades`)
          .send({
            subjectId: maths,
            grades: [
              { studentId: id, value: 9 },
              { studentId: id, value: 8 },
            ],
          }),
      ).expect(400);
      await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grades`)
          .send({ subjectId: maths, grades: [{ studentId: id, value: 11 }] }),
      ).expect(400);
      await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grades`)
          .send({ subjectId: maths, grades: [] }),
      ).expect(400);
    });

    it("forbids a teacher from grading a subject they don't teach", async () => {
      const { body } = await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grades`)
          .send({
            subjectId: physics,
            grades: [{ studentId: students9A[0].id, value: 9 }],
          }),
      ).expect(403);
      expect(body.message).toBe("You don't teach Physics in 9A");
    });

    it('is closed to students', async () => {
      await as(studentToken)(
        api()
          .post(`/api/classes/${class9A}/grades`)
          .send({
            subjectId: maths,
            grades: [{ studentId: students9A[0].id, value: 9 }],
          }),
      ).expect(403);
    });
  });

  describe('POST /classes/:id/grade-scans', () => {
    it('reads each photo and matches it to a student of the class (demo reader)', async () => {
      const before = await gradeCount();
      const { body } = await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grade-scans`)
          .field('subjectId', maths)
          .attach('images', PNG, 'test-1.png')
          .attach('images', PNG, 'test-2.png'),
      ).expect(200);

      expect(body.mode).toBe('demo');
      expect(body.class.name).toBe('9A');
      expect(body.subject.name).toBe('Mathematics');
      expect(body.tests).toHaveLength(2);
      const enrolled = await prisma.student.findMany({
        where: { classId: class9A },
        select: { id: true },
      });
      for (const test of body.tests) {
        expect(test.status).toBe('read');
        expect(enrolled.map((s) => s.id)).toContain(test.student.id);
        expect(test.grade).toBeGreaterThanOrEqual(1);
        expect(test.grade).toBeLessThanOrEqual(10);
      }
      // Scanning only reads; saving is a separate step.
      expect(await gradeCount()).toBe(before);
    });

    it('rejects files that are not images', async () => {
      const { body } = await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grade-scans`)
          .field('subjectId', maths)
          .attach('images', Buffer.from('%PDF-1.7 not a photo'), 'notes.pdf'),
      ).expect(400);
      expect(body.message).toBe(
        'Not a JPEG, PNG, WebP or GIF image: notes.pdf',
      );
    });

    it('requires a photo and a valid subject', async () => {
      await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grade-scans`)
          .field('subjectId', maths),
      ).expect(400);
      await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grade-scans`)
          .field('subjectId', 'not-a-uuid')
          .attach('images', PNG, 'test.png'),
      ).expect(400);
    });

    it("forbids scanning tests of a subject the teacher doesn't teach", async () => {
      await as(teacherToken)(
        api()
          .post(`/api/classes/${class9A}/grade-scans`)
          .field('subjectId', physics)
          .attach('images', PNG, 'test.png'),
      ).expect(403);
    });

    it('lets the admin scan any class', async () => {
      await as(adminToken)(
        api()
          .post(`/api/classes/${class10B}/grade-scans`)
          .field('subjectId', physics)
          .attach('images', PNG, 'test.png'),
      ).expect(200);
    });
  });
});
