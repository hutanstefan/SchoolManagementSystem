import request from 'supertest';
import {
  cleanupTestData,
  createTestApp,
  loginAs,
  TestApp,
  uniqueName,
} from './utils';

describe('Teachers and subjects (e2e)', () => {
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

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);

  describe('teachers', () => {
    it('shows what a teacher teaches and where they are homeroom teacher', async () => {
      const { body: list } = await as(adminToken)(
        api().get('/api/teachers?search=teacher@school.test'),
      ).expect(200);
      const { body } = await as(adminToken)(
        api().get(`/api/teachers/${list.data[0].id}`),
      ).expect(200);

      expect(body.homeroomClasses.map((c: { name: string }) => c.name)).toEqual(
        ['9A'],
      );
      expect(
        body.teaching.map(
          (t: { class: { name: string }; subject: { name: string } }) =>
            `${t.class.name} ${t.subject.name}`,
        ),
      ).toEqual(
        expect.arrayContaining([
          '9A Mathematics',
          '9B Mathematics',
          '10A Mathematics',
        ]),
      );
    });

    it('creates, updates (with password reset) and deletes a teacher', async () => {
      const email = `${uniqueName('teacher')}@school.test`;
      const { body: created } = await as(adminToken)(
        api().post('/api/teachers').send({
          email,
          password: 'Welcome123',
          firstName: 'Ana',
          lastName: 'Test',
        }),
      ).expect(201);

      const { body: session } = await api()
        .post('/api/auth/login')
        .send({ email, password: 'Welcome123' })
        .expect(200);

      await as(adminToken)(
        api()
          .patch(`/api/teachers/${created.id}`)
          .send({ password: 'Changed456' }),
      ).expect(200);

      // The reset ends the sessions opened with the old password...
      await as(session.accessToken)(api().get('/api/auth/me')).expect(401);
      await api()
        .post('/api/auth/login')
        .send({ email, password: 'Welcome123' })
        .expect(401);
      // ...and the new password works.
      await api()
        .post('/api/auth/login')
        .send({ email, password: 'Changed456' })
        .expect(200);

      await as(adminToken)(api().delete(`/api/teachers/${created.id}`)).expect(
        204,
      );
    });

    it('is admin only', async () => {
      await as(teacherToken)(api().get('/api/teachers')).expect(403);
    });
  });

  describe('subjects', () => {
    it('can be listed by any logged-in user', async () => {
      const { body } = await as(studentToken)(
        api().get('/api/subjects'),
      ).expect(200);
      expect(body.map((s: { name: string }) => s.name)).toContain(
        'Mathematics',
      );
    });

    it('can only be created by an admin', async () => {
      await as(teacherToken)(
        api()
          .post('/api/subjects')
          .send({ name: uniqueName('subject') }),
      ).expect(403);

      const { body } = await as(adminToken)(
        api()
          .post('/api/subjects')
          .send({ name: uniqueName('subject') }),
      ).expect(201);
      await as(adminToken)(api().delete(`/api/subjects/${body.id}`)).expect(
        204,
      );
    });

    it('cannot be deleted while it is taught or graded', async () => {
      const { body: subjects } = await as(adminToken)(
        api().get('/api/subjects'),
      );
      const math = subjects.find(
        (s: { name: string }) => s.name === 'Mathematics',
      );

      const response = await as(adminToken)(
        api().delete(`/api/subjects/${math.id}`),
      ).expect(409);
      expect(response.body.message).toMatch(/still taught/);
    });

    it('rejects a duplicate name regardless of case', async () => {
      await as(adminToken)(
        api().post('/api/subjects').send({ name: 'mathematics' }),
      ).expect(409);
    });
  });
});
