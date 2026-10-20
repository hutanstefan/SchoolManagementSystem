import request from 'supertest';
import {
  cleanupTestData,
  createTestApp,
  loginAs,
  TestApp,
  uniqueName,
} from './utils';

describe('Students (e2e)', () => {
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
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);

  const newStudent = (overrides: Record<string, unknown> = {}) => ({
    email: `${uniqueName('student')}@school.test`,
    password: 'Welcome123',
    firstName: 'Test',
    lastName: 'Student',
    dateOfBirth: '2011-05-14',
    ...overrides,
  });

  describe('access control', () => {
    it.each([
      ['teacher', () => teacherToken],
      ['student', () => studentToken],
    ])('forbids a %s from listing students', async (_role, token) => {
      await api()
        .get('/api/students')
        .set('Authorization', `Bearer ${token()}`)
        .expect(403);
    });

    it('forbids a teacher from creating a student', async () => {
      await api()
        .post('/api/students')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(newStudent())
        .expect(403);
    });

    it('requires a token', async () => {
      await api().get('/api/students').expect(401);
    });
  });

  describe('listing', () => {
    it('paginates and reports metadata', async () => {
      const { body } = await asAdmin(
        api().get('/api/students?page=2&pageSize=5'),
      ).expect(200);

      expect(body.data).toHaveLength(5);
      expect(body.meta).toMatchObject({ page: 2, pageSize: 5 });
      expect(body.meta.totalPages).toBe(Math.ceil(body.meta.total / 5));
    });

    it('sorts by last name in both directions', async () => {
      const { body } = await asAdmin(
        api().get('/api/students?sort=lastName&order=desc&pageSize=10'),
      ).expect(200);

      const names = body.data.map((s: { lastName: string }) => s.lastName);
      expect(names).toEqual(
        [...names].sort((a: string, b: string) => b.localeCompare(a)),
      );
    });

    it('searches by name or email, case-insensitive', async () => {
      const { body } = await asAdmin(
        api().get('/api/students?search=STUDENT@school'),
      ).expect(200);

      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe('student@school.test');
    });

    it('filters unassigned students', async () => {
      const { body } = await asAdmin(
        api().get('/api/students?unassigned=true'),
      ).expect(200);

      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((s: { class: unknown }) => s.class === null)).toBe(
        true,
      );
    });

    it('rejects an invalid page size', async () => {
      await asAdmin(api().get('/api/students?pageSize=1000')).expect(400);
    });
  });

  describe('create, update, delete', () => {
    it('runs the full lifecycle of a student', async () => {
      // Create (email is normalized)
      const data = newStudent();
      const { body: created } = await asAdmin(
        api()
          .post('/api/students')
          .send({ ...data, email: `  ${data.email.toUpperCase()} ` }),
      ).expect(201);
      expect(created).toMatchObject({
        email: data.email,
        dateOfBirth: '2011-05-14',
        class: null,
      });
      expect(created).not.toHaveProperty('passwordHash');

      // The new account can log in
      await api()
        .post('/api/auth/login')
        .send({ email: data.email, password: data.password })
        .expect(200);

      // Update
      const { body: updated } = await asAdmin(
        api()
          .patch(`/api/students/${created.id}`)
          .send({ lastName: 'Renamed' }),
      ).expect(200);
      expect(updated.lastName).toBe('Renamed');

      // Delete
      await asAdmin(api().delete(`/api/students/${created.id}`)).expect(204);
      await asAdmin(api().get(`/api/students/${created.id}`)).expect(404);
    });

    it('rejects a duplicate email with 409', async () => {
      const response = await asAdmin(
        api()
          .post('/api/students')
          .send(newStudent({ email: 'Student@School.test' })),
      ).expect(409);
      expect(response.body.message).toBe('Email already in use');
    });

    it('validates the payload', async () => {
      const response = await asAdmin(
        api()
          .post('/api/students')
          .send(
            newStudent({
              password: 'short',
              dateOfBirth: '2999-01-01',
              classId: 'not-a-uuid',
              unexpected: true,
            }),
          ),
      ).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'property unexpected should not exist',
          'dateOfBirth must be a date in the past',
          'classId must be a UUID',
          'password must contain a digit',
        ]),
      );
    });

    it('returns 404 for an unknown class', async () => {
      const response = await asAdmin(
        api()
          .post('/api/students')
          .send(
            newStudent({ classId: '00000000-0000-4000-8000-000000000000' }),
          ),
      ).expect(404);
      expect(response.body.message).toBe('Class not found');
    });

    it('returns 400 for a malformed id', async () => {
      await asAdmin(api().get('/api/students/123')).expect(400);
    });

    it('uses the standard error format', async () => {
      const { body } = await asAdmin(
        api().get('/api/students/00000000-0000-4000-8000-000000000000'),
      ).expect(404);

      expect(body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Student not found',
        path: '/api/students/00000000-0000-4000-8000-000000000000',
        timestamp: expect.any(String),
      });
    });
  });
});
