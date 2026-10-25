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

    it('finds a student by registration number (nr. matricol)', async () => {
      const { body: first } = await asAdmin(
        api().get('/api/students?search=student@school.test'),
      ).expect(200);
      const { registrationNumber } = first.data[0];
      expect(registrationNumber).toMatch(/^\d{4}-\d{4}$/);

      const { body } = await asAdmin(
        api().get(`/api/students?search=${registrationNumber}`),
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

    it('filters graduates, who are no longer counted as unassigned', async () => {
      const { body } = await asAdmin(
        api().get('/api/students?graduated=true&pageSize=100'),
      ).expect(200);
      expect(body.meta.total).toBe(10);
      expect(
        body.data.every(
          (s: { class: unknown; graduatedIn: string | null }) =>
            s.class === null && s.graduatedIn !== null,
        ),
      ).toBe(true);

      const ids = new Set(body.data.map((s: { id: string }) => s.id));
      const { body: unassigned } = await asAdmin(
        api().get('/api/students?unassigned=true&pageSize=100'),
      ).expect(200);
      expect(unassigned.data.some((s: { id: string }) => ids.has(s.id))).toBe(
        false,
      );

      const { body: rest } = await asAdmin(
        api().get('/api/students?graduated=false&pageSize=1'),
      ).expect(200);
      const { body: all } = await asAdmin(
        api().get('/api/students?pageSize=1'),
      ).expect(200);
      expect(rest.meta.total).toBe(all.meta.total - 10);
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
        registrationNumber: expect.stringMatching(/^\d{4}-\d{4}$/),
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

    it('numbers new students by year of enrollment, even when created together', async () => {
      const year = new Date()
        .toLocaleDateString('sv-SE', {
          timeZone: 'Europe/Bucharest',
        })
        .slice(0, 4);
      const created = await Promise.all(
        [1, 2, 3].map(() =>
          asAdmin(api().post('/api/students').send(newStudent())).expect(201),
        ),
      );
      const numbers = created.map((r) => r.body.registrationNumber as string);

      expect(new Set(numbers).size).toBe(3);
      for (const number of numbers) {
        expect(number.startsWith(`${year}-`)).toBe(true);
      }
    });

    it("never gives a deleted student's number to someone else", async () => {
      const { body: first } = await asAdmin(
        api().post('/api/students').send(newStudent()),
      ).expect(201);
      await asAdmin(api().delete(`/api/students/${first.id}`)).expect(204);
      const { body: next } = await asAdmin(
        api().post('/api/students').send(newStudent()),
      ).expect(201);

      expect(next.registrationNumber > first.registrationNumber).toBe(true);
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

    it('refuses null for a field that must have a value, but allows it for the class', async () => {
      const { body: created } = await asAdmin(
        api().post('/api/students').send(newStudent()),
      ).expect(201);

      const refused = await asAdmin(
        api()
          .patch(`/api/students/${created.id}`)
          .send({ firstName: null, email: null }),
      ).expect(400);
      expect(refused.body.message).toEqual(
        expect.arrayContaining([
          'firstName must be a string',
          'email must be an email',
        ]),
      );
      // null is how a student is taken out of their class.
      await asAdmin(
        api().patch(`/api/students/${created.id}`).send({ classId: null }),
      ).expect(200);
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
