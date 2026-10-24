import request from 'supertest';
import { cleanupTestData, createTestApp, loginAs, TestApp } from './utils';

interface GradeCount {
  value: number;
  count: number;
}

describe('Stats (e2e)', () => {
  let app: TestApp;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    [adminToken, teacherToken, studentToken] = await Promise.all([
      loginAs(app, 'admin'),
      loginAs(app, 'teacher'),
      loginAs(app, 'student'),
    ]);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  describe('GET /api/stats/school', () => {
    it('gives the admin the school-wide figures', async () => {
      const res = await get('/api/stats/school', adminToken).expect(200);
      const body = res.body as {
        average: number | null;
        gradeCount: number;
        studentsAtRisk: number;
        gradeDistribution: GradeCount[];
        classes: { class: { name: string }; studentCount: number }[];
        subjects: { subject: { name: string }; gradeCount: number }[];
        activity: { weekStart: string; count: number }[];
      };

      expect(body.gradeCount).toBeGreaterThan(0);
      expect(body.average).toBeGreaterThanOrEqual(1);
      expect(body.average).toBeLessThanOrEqual(10);
      expect(body.gradeDistribution.map((d) => d.value)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ]);
      expect(body.gradeDistribution.reduce((sum, d) => sum + d.count, 0)).toBe(
        body.gradeCount,
      );
      expect(body.subjects.reduce((sum, s) => sum + s.gradeCount, 0)).toBe(
        body.gradeCount,
      );
      expect(body.classes.map((c) => c.class.name)).toEqual(
        expect.arrayContaining(['9A', '9B', '10A']),
      );
      expect(body.activity.length).toBeGreaterThan(0);
    });

    it.each([
      ['teacher', () => teacherToken],
      ['student', () => studentToken],
    ])('is forbidden for a %s', async (_, token) => {
      await get('/api/stats/school', token()).expect(403);
    });

    it('needs a token', async () => {
      await request(app.getHttpServer()).get('/api/stats/school').expect(401);
    });
  });

  describe('GET /api/stats/teaching', () => {
    it("gives the teacher their classes' figures", async () => {
      const res = await get('/api/stats/teaching', teacherToken).expect(200);
      const body = res.body as {
        rows: {
          class: { name: string };
          subject: { name: string };
          average: number | null;
          studentCount: number;
          studentsAtRisk: number;
          studentsMissingGrades: number;
        }[];
        gradeDistribution: GradeCount[];
      };

      expect(body.rows.length).toBeGreaterThan(0);
      for (const row of body.rows) {
        expect(row.studentsAtRisk).toBeLessThanOrEqual(row.studentCount);
        expect(row.studentsMissingGrades).toBeLessThanOrEqual(row.studentCount);
      }
      expect(
        body.rows.some(
          (r) => r.class.name === '9A' && r.subject.name === 'Mathematics',
        ),
      ).toBe(true);
      expect(body.gradeDistribution).toHaveLength(10);
    });

    it.each([
      ['admin', () => adminToken],
      ['student', () => studentToken],
    ])('is forbidden for an %s', async (_, token) => {
      await get('/api/stats/teaching', token()).expect(403);
    });
  });
});
