import request from 'supertest';
import {
  cleanupTestData,
  createTestApp,
  loginAs,
  TestApp,
  uniqueClassName,
} from './utils';

describe('Classes (e2e)', () => {
  let app: TestApp;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  /** Class ids by name, as seen by the admin. */
  const classIds: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp();
    [adminToken, teacherToken, studentToken] = await Promise.all([
      loginAs(app, 'admin'),
      loginAs(app, 'teacher'),
      loginAs(app, 'student'),
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/api/classes?pageSize=100')
      .set('Authorization', `Bearer ${adminToken}`);
    for (const c of body.data as { id: string; name: string }[]) {
      classIds[c.name] = c.id;
    }
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);

  describe('admin', () => {
    it('lists every class in natural order (9A before 10A)', async () => {
      const { body } = await as(adminToken)(api().get('/api/classes')).expect(
        200,
      );
      const names = body.data.map((c: { name: string }) => c.name);
      expect(names.slice(0, 6)).toEqual([
        '9A',
        '9B',
        '10A',
        '10B',
        '11A',
        '12A',
      ]);
    });

    it("knows the same class in other years (last year's 9A is this year's 10A)", async () => {
      const { body } = await as(adminToken)(
        api().get(`/api/classes/${classIds['10A']}`),
      ).expect(200);
      expect(
        body.lineage.map(
          (c: { name: string; schoolYear: { status: string } }) =>
            `${c.name} ${c.schoolYear.status}`,
        ),
      ).toEqual(['9A CLOSED', '10A ACTIVE']);
      expect(body.lineage[1].id).toBe(classIds['10A']);

      // And forward, from last year's class.
      const { body: older } = await as(adminToken)(
        api().get(`/api/classes/${body.lineage[0].id}`),
      ).expect(200);
      expect(older.lineage).toEqual(body.lineage);
    });

    it('creates, renames and deletes a class', async () => {
      const name = uniqueClassName();
      const { body: created } = await as(adminToken)(
        api().post('/api/classes').send({ name: name.toLowerCase() }),
      ).expect(201);
      expect(created).toMatchObject({
        name,
        homeroomTeacher: null,
        studentCount: 0,
      });

      const renamed = uniqueClassName();
      const { body: updated } = await as(adminToken)(
        api().patch(`/api/classes/${created.id}`).send({ name: renamed }),
      ).expect(200);
      expect(updated.name).toBe(renamed);

      await as(adminToken)(api().delete(`/api/classes/${created.id}`)).expect(
        204,
      );
    });

    it('rejects a duplicate name regardless of case', async () => {
      await as(adminToken)(
        api().post('/api/classes').send({ name: ' 9a ' }),
      ).expect(409);
    });

    it('assigns and removes students', async () => {
      const { body: klass } = await as(adminToken)(
        api().post('/api/classes').send({ name: uniqueClassName() }),
      ).expect(201);
      const { body: unassigned } = await as(adminToken)(
        api().get('/api/students?unassigned=true'),
      ).expect(200);
      const studentId = unassigned.data[0].id as string;

      const { body: enrolled } = await as(adminToken)(
        api()
          .post(`/api/classes/${klass.id}/students`)
          .send({ studentIds: [studentId] }),
      ).expect(200);
      expect(enrolled.map((s: { id: string }) => s.id)).toEqual([studentId]);

      await as(adminToken)(
        api().delete(`/api/classes/${klass.id}/students/${studentId}`),
      ).expect(204);
      // Removing again: the student is no longer in the class
      await as(adminToken)(
        api().delete(`/api/classes/${klass.id}/students/${studentId}`),
      ).expect(404);
    });

    it('reports unknown students when assigning', async () => {
      const missing = '00000000-0000-4000-8000-000000000000';
      const response = await as(adminToken)(
        api()
          .post(`/api/classes/${classIds['9A']}/students`)
          .send({ studentIds: [missing] }),
      ).expect(404);
      expect(response.body.message).toContain(missing);
    });
  });

  describe('teacher (Mathematics in 9A, 9B, 10A; homeroom of 9A)', () => {
    it('only sees the classes they are assigned to', async () => {
      const { body } = await as(teacherToken)(api().get('/api/classes')).expect(
        200,
      );
      expect(body.data.map((c: { name: string }) => c.name)).toEqual([
        '9A',
        '9B',
        '10A',
      ]);
    });

    it('follows a class only into years they could see it', async () => {
      // Today's 9A is a new entry class: it has no past.
      const { body } = await as(teacherToken)(
        api().get(`/api/classes/${classIds['9A']}`),
      ).expect(200);
      expect(body.lineage.map((c: { id: string }) => c.id)).toEqual([
        classIds['9A'],
      ]);
      const { body: admins } = await as(adminToken)(
        api().get(`/api/classes/${classIds['12A']}`),
      ).expect(200);
      expect(admins.lineage.length).toBeGreaterThan(1);
    });

    it('can list the students of an assigned class', async () => {
      const { body } = await as(teacherToken)(
        api().get(`/api/classes/${classIds['9B']}/students`),
      ).expect(200);
      expect(body.length).toBeGreaterThan(0);
    });

    it('gets 403 for a class they are not assigned to', async () => {
      const response = await as(teacherToken)(
        api().get(`/api/classes/${classIds['12A']}/students`),
      ).expect(403);
      expect(response.body.message).toBe('You are not assigned to this class');
    });

    it('cannot create or modify classes', async () => {
      await as(teacherToken)(
        api().post('/api/classes').send({ name: uniqueClassName() }),
      ).expect(403);
      await as(teacherToken)(
        api().delete(`/api/classes/${classIds['9A']}`),
      ).expect(403);
    });
  });

  describe('student', () => {
    it('sees only their own class, and not its student list', async () => {
      const { body } = await as(studentToken)(api().get('/api/classes')).expect(
        200,
      );
      expect(body.data.map((c: { name: string }) => c.name)).toEqual(['9A']);
      await as(studentToken)(
        api().get(`/api/classes/${classIds['9A']}/students`),
      ).expect(403);
    });

    it('can open their own class with its subjects and teachers', async () => {
      const { body } = await as(studentToken)(
        api().get(`/api/classes/${classIds['9A']}`),
      ).expect(200);
      expect(body.name).toBe('9A');
      expect(body.homeroomTeacher).not.toBeNull();
      expect(body.subjects.length).toBeGreaterThan(0);
    });

    it("gets 403 for another class's details", async () => {
      const response = await as(studentToken)(
        api().get(`/api/classes/${classIds['10A']}`),
      ).expect(403);
      expect(response.body.message).toBe('You are not enrolled in this class');
    });
  });
});
