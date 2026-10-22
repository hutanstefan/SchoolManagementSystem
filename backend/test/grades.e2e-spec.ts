import request from 'supertest';
import { overallAverage } from '../src/grades/averages';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, loginAs, TestApp } from './utils';

/**
 * teacher@school.test (Mihai Ionescu) teaches Mathematics in 9A, 9B and 10A
 * and is the homeroom teacher of 9A. student@school.test is in 9A.
 */
describe('Grades (e2e)', () => {
  let app: TestApp;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let studentId: string; // student@school.test, 9A
  let student12AId: string;
  const subjectIds: Record<string, string> = {};
  const classIds: Record<string, string> = {};
  const createdGradeIds: string[] = [];

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createTestApp();
    [adminToken, teacherToken, studentToken] = await Promise.all([
      loginAs(app, 'admin'),
      loginAs(app, 'teacher'),
      loginAs(app, 'student'),
    ]);

    const { body: subjects } = await as(adminToken)(api().get('/api/subjects'));
    for (const s of subjects as { id: string; name: string }[]) {
      subjectIds[s.name] = s.id;
    }
    const { body: classes } = await as(adminToken)(
      api().get('/api/classes?pageSize=100'),
    );
    for (const c of classes.data as { id: string; name: string }[]) {
      classIds[c.name] = c.id;
    }
    const { body: me } = await as(adminToken)(
      api().get('/api/students?search=student@school.test'),
    );
    studentId = me.data[0].id;
    const { body: in12A } = await as(adminToken)(
      api().get(`/api/students?classId=${classIds['12A']}&pageSize=1`),
    );
    student12AId = in12A.data[0].id;
  });

  afterAll(async () => {
    // Remove the grades and history entries created by these tests.
    const prisma = app.get(PrismaService);
    await prisma.grade.deleteMany({ where: { id: { in: createdGradeIds } } });
    await prisma.gradeHistory.deleteMany({
      where: { gradeId: { in: createdGradeIds } },
    });
    await app.close();
  });

  const give = (token: string, body: Record<string, unknown>): request.Test =>
    as(token)(api().post('/api/grades').send(body));

  describe('teacher', () => {
    let gradeId: string;

    it('grades a student in a subject they teach in that class', async () => {
      const { body } = await give(teacherToken, {
        studentId,
        subjectId: subjectIds.Mathematics,
        value: 10,
      }).expect(201);
      gradeId = body.id;
      createdGradeIds.push(gradeId);

      expect(body).toMatchObject({
        value: 10,
        subject: { name: 'Mathematics' },
        class: { name: '9A' },
        teacher: { lastName: 'Ionescu' },
      });
      expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("can't grade a subject they don't teach", async () => {
      const response = await give(teacherToken, {
        studentId,
        subjectId: subjectIds.Physics,
        value: 9,
      }).expect(403);
      expect(response.body.message).toBe("You don't teach Physics in 9A");
    });

    it("can't grade a student from a class they don't teach", async () => {
      const response = await give(teacherToken, {
        studentId: student12AId,
        subjectId: subjectIds.Mathematics,
        value: 9,
      }).expect(403);
      expect(response.body.message).toBe("You don't teach Mathematics in 12A");
    });

    it('validates the value and the date', async () => {
      const response = await give(teacherToken, {
        studentId,
        subjectId: subjectIds.Mathematics,
        value: 11,
        date: '2999-01-01',
      }).expect(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'value must not be greater than 10',
          "date can't be in the future",
        ]),
      );
    });

    it('changes their own grade', async () => {
      const { body } = await as(teacherToken)(
        api().patch(`/api/grades/${gradeId}`).send({ value: 9 }),
      ).expect(200);
      expect(body.value).toBe(9);
    });

    it("can't change or delete another teacher's grade", async () => {
      const { body } = await as(adminToken)(
        api().get(
          `/api/grades?studentId=${studentId}&subjectId=${subjectIds.Physics}&pageSize=1`,
        ),
      );
      const physicsGrade = body.data[0].id as string;

      await as(teacherToken)(
        api().patch(`/api/grades/${physicsGrade}`).send({ value: 4 }),
      ).expect(403);
      await as(teacherToken)(
        api().delete(`/api/grades/${physicsGrade}`),
      ).expect(403);
    });

    it('deletes their own grade, and the history keeps every step', async () => {
      await as(teacherToken)(api().delete(`/api/grades/${gradeId}`)).expect(
        204,
      );

      const { body: history } = await as(adminToken)(
        api().get(`/api/grades/${gradeId}/history`),
      ).expect(200);
      expect(
        history.map(
          (h: {
            action: string;
            oldValue: number | null;
            newValue: number | null;
          }) => [h.action, h.oldValue, h.newValue],
        ),
      ).toEqual([
        ['CREATED', null, 10],
        ['UPDATED', 10, 9],
        ['DELETED', 9, null],
      ]);
      expect(history[0].changedBy).toMatchObject({
        lastName: 'Ionescu',
        role: 'TEACHER',
      });
    });

    it('only sees grades of their own classes and subjects', async () => {
      await as(teacherToken)(
        api().get(`/api/grades?classId=${classIds['12A']}`),
      ).then((res) => expect(res.body.meta.total).toBe(0));

      const { body } = await as(teacherToken)(
        api().get(`/api/grades?classId=${classIds['9B']}&pageSize=100`),
      ).expect(200);
      expect(body.meta.total).toBeGreaterThan(0);
      // In 9B Mihai only teaches Mathematics (he's not the homeroom teacher there).
      expect(
        body.data.every(
          (g: { subject: { name: string } }) =>
            g.subject.name === 'Mathematics',
        ),
      ).toBe(true);
    });
  });

  describe('gradebook', () => {
    it('shows the subject teacher every student with grades and averages', async () => {
      const { body } = await as(teacherToken)(
        api().get(
          `/api/classes/${classIds['9B']}/gradebook?subjectId=${subjectIds.Mathematics}`,
        ),
      ).expect(200);

      expect(body.minimumGrades).toBe(5); // 4 hours per week + 1
      expect(body.students).toHaveLength(10);
      for (const row of body.students) {
        expect(row.registrationNumber).toMatch(/^\d{4}-\d{4}$/);
        if (row.grades.length > 0) {
          expect(row.roundedAverage).toBe(Math.floor(row.average + 0.5));
        }
      }
    });

    it('lets the homeroom teacher see every subject of their class', async () => {
      await as(teacherToken)(
        api().get(
          `/api/classes/${classIds['9A']}/gradebook?subjectId=${subjectIds.Physics}`,
        ),
      ).expect(200);
    });

    it('forbids other subjects in classes where they are not homeroom teacher', async () => {
      await as(teacherToken)(
        api().get(
          `/api/classes/${classIds['9B']}/gradebook?subjectId=${subjectIds.Physics}`,
        ),
      ).expect(403);
    });
  });

  describe('student', () => {
    it('sees their report with Romanian-style averages', async () => {
      const { body } = await as(studentToken)(
        api().get('/api/grades/me'),
      ).expect(200);

      expect(body.class.name).toBe('9A');
      expect(body.subjects).toHaveLength(8);
      for (const subject of body.subjects) {
        const values = subject.grades.map((g: { value: number }) => g.value);
        const mean =
          values.reduce((a: number, b: number) => a + b, 0) / values.length;
        expect(subject.average).toBe(Math.floor(mean * 100) / 100);
        expect(subject.minimumGrades).toBeGreaterThanOrEqual(3);
      }
      expect(body.overallAverage).toBe(
        overallAverage(
          body.subjects.map(
            (s: { roundedAverage: number }) => s.roundedAverage,
          ),
        ),
      );
    });

    it("can't give grades or see other students' grades", async () => {
      await give(studentToken, {
        studentId,
        subjectId: subjectIds.Mathematics,
        value: 10,
      }).expect(403);
      await as(studentToken)(
        api().get(`/api/students/${student12AId}/grades`),
      ).expect(403);
      await as(studentToken)(api().get('/api/grades')).expect(403);
    });
  });

  describe('admin', () => {
    it("grades on the subject teacher's behalf and the history shows the admin", async () => {
      const { body } = await give(adminToken, {
        studentId: student12AId,
        subjectId: subjectIds.Mathematics,
        value: 8,
        date: '2026-10-01',
      }).expect(201);
      createdGradeIds.push(body.id);
      expect(body.teacher).not.toBeNull();

      const { body: history } = await as(adminToken)(
        api().get(`/api/grades/${body.id}/history`),
      );
      expect(history[0].changedBy.role).toBe('ADMIN');
    });

    it('keeps the grade history admin only', async () => {
      await as(teacherToken)(
        api().get(`/api/grades/${createdGradeIds[0]}/history`),
      ).expect(403);
    });
  });
});
