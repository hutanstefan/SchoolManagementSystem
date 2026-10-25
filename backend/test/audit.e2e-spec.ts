import request from 'supertest';
import { AuditRetentionService } from '../src/audit/audit-retention.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupTestData,
  createTestApp,
  loginAs,
  TestApp,
  uniqueName,
} from './utils';

interface Entry {
  id: string;
  kind: string;
  action: string;
  target: string | null;
  category: string;
  changeCount: number;
  path: string | null;
  actor: { id: string | null; name: string | null; role: string | null };
}

describe('Activity log (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  const startedAt = new Date();

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);
  /** The newest entries (made by this test run) matching the filters. */
  const entries = async (query: Record<string, string | number> = {}) => {
    const { body } = await as(adminToken)(
      api()
        .get('/api/audit-logs')
        .query({ pageSize: 100, ...query }),
    ).expect(200);
    return (body.data as (Entry & { createdAt: string })[]).filter(
      (e) => new Date(e.createdAt) >= startedAt,
    );
  };
  const details = async (id: string) =>
    (await as(adminToken)(api().get(`/api/audit-logs/${id}`)).expect(200))
      .body as Entry & {
      details: {
        changes: {
          model: string;
          op: string;
          label: string | null;
          fields: Record<string, [unknown, unknown]>;
        }[];
        names: Record<string, string>;
        email?: string;
      };
    };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    [adminToken, teacherToken, studentToken] = await Promise.all([
      loginAs(app, 'admin'),
      loginAs(app, 'teacher'),
      loginAs(app, 'student'),
    ]);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await prisma.auditLog.deleteMany({
      where: { createdAt: { gte: startedAt } },
    });
    await app.close();
  });

  it('is only for admins', async () => {
    await as(teacherToken)(api().get('/api/audit-logs')).expect(403);
    await as(studentToken)(api().get('/api/audit-logs')).expect(403);
    await api().get('/api/audit-logs').expect(401);
  });

  it('logs logins and failed logins, with the email that was tried', async () => {
    await api()
      .post('/api/auth/login')
      .send({ email: 'nobody@school.test', password: 'Wrong123!' })
      .expect(401);
    await api()
      .post('/api/auth/login')
      .send({ email: 'teacher@school.test', password: 'Password123!' })
      .expect(200);

    const [failed] = await entries({ kind: 'LOGIN_FAILED' });
    expect(failed).toMatchObject({
      action: 'Failed to log in',
      target: 'nobody@school.test',
      actor: { id: null, name: null },
    });
    expect((await details(failed.id)).details.email).toBe('nobody@school.test');

    const [login] = await entries({ kind: 'LOGIN' });
    expect(login).toMatchObject({
      action: 'Logged in',
      actor: { name: 'Mihai Ionescu', role: 'TEACHER' },
    });
  });

  it('logs what was created, changed (before and after) and deleted', async () => {
    const name = uniqueName('subject');
    const { body: subject } = await as(adminToken)(
      api().post('/api/subjects').send({ name, color: 'PINK', icon: 'ATOM' }),
    ).expect(201);
    await as(adminToken)(
      api()
        .patch(`/api/subjects/${subject.id}`)
        .send({ color: 'TEAL', icon: 'ATOM' }),
    ).expect(200);
    await as(adminToken)(api().delete(`/api/subjects/${subject.id}`)).expect(
      204,
    );

    const logged = await entries({ category: 'Subjects', search: name });
    expect(logged.map((e) => e.action)).toEqual([
      'Deleted a subject',
      'Updated a subject',
      'Created a subject',
    ]);
    expect(logged.every((e) => e.target === name)).toBe(true);
    expect(logged[0].actor).toMatchObject({
      name: 'Ana Popescu',
      role: 'ADMIN',
    });

    const updated = await details(logged[1].id);
    expect(updated.details.changes).toEqual([
      expect.objectContaining({
        model: 'Subject',
        op: 'update',
        label: name,
        // Only what really changed: the icon was already ATOM.
        fields: { color: ['PINK', 'TEAL'] },
      }),
    ]);
    const created = await details(logged[2].id);
    expect(created.details.changes[0].fields).toMatchObject({
      name: [null, name],
      color: [null, 'PINK'],
    });
  });

  it('logs changes made through related records, never passwords', async () => {
    const { body: student } = await as(adminToken)(
      api()
        .post('/api/students')
        .send({
          email: `${uniqueName('student')}@school.test`,
          password: 'Welcome123',
          firstName: 'Audit',
          lastName: 'Student',
          dateOfBirth: '2011-05-14',
        }),
    ).expect(201);
    await as(adminToken)(
      api()
        .patch(`/api/students/${student.id}`)
        .send({ firstName: 'Audited', password: 'Changed123' }),
    ).expect(200);

    const [update] = await entries({ category: 'Students' });
    expect(update).toMatchObject({
      action: 'Updated a student',
      target: 'Audited Student',
    });
    const { details: changes } = await details(update.id);
    const fields = changes.changes.flatMap((c) => Object.entries(c.fields));
    expect(Object.fromEntries(fields)).toMatchObject({
      'user.firstName': ['Audit', 'Audited'],
      'user.passwordHash': ['[hidden]', '[hidden]'],
    });
    const raw = JSON.stringify(
      await prisma.auditLog.findMany({
        where: { createdAt: { gte: startedAt } },
        select: { details: true },
      }),
    );
    expect(raw).not.toContain('$2'); // no bcrypt hash anywhere
    expect(raw).not.toContain('Changed123');
  });

  it('names the records a change refers to', async () => {
    const { body: grades } = await as(adminToken)(
      api().get('/api/grades').query({ pageSize: 1 }),
    ).expect(200);
    const grade = grades.data[0] as {
      id: string;
      value: number;
      student: { firstName: string; lastName: string };
      subject: { name: string };
    };
    const next = grade.value === 10 ? 9 : grade.value + 1;
    await as(adminToken)(
      api().patch(`/api/grades/${grade.id}`).send({ value: next }),
    ).expect(200);
    await as(adminToken)(
      api().patch(`/api/grades/${grade.id}`).send({ value: grade.value }),
    ).expect(200);

    const [, changed] = await entries({ category: 'Grades' });
    expect(changed).toMatchObject({
      action: 'Changed a grade',
      target: `${next} in ${grade.subject.name} for ${grade.student.firstName} ${grade.student.lastName}`,
    });
    const { details: changes } = await details(changed.id);
    expect(changes.changes[0].fields).toEqual({ value: [grade.value, next] });
  });

  it("doesn't log private or trivial actions", async () => {
    await as(studentToken)(api().patch('/api/notifications/read-all')).expect(
      200,
    );
    const logged = await entries({ search: 'notifications' });
    expect(logged).toEqual([]);
  });

  it('deletes entries older than the retention period, and says so', async () => {
    const day = 24 * 60 * 60 * 1000;
    const entry = (daysAgo: number, action: string) => ({
      kind: 'LOGIN' as const,
      category: 'Auth',
      action,
      createdAt: new Date(Date.now() - daysAgo * day),
    });
    await prisma.auditLog.createMany({
      data: [
        entry(800, 'e2e-old'),
        entry(731, 'e2e-old'),
        entry(729, 'e2e-recent'),
      ],
    });

    const { body } = await as(adminToken)(
      api().get('/api/audit-logs').query({ pageSize: 1 }),
    ).expect(200);
    expect(body.retentionDays).toBe(730);

    const deleted = await app.get(AuditRetentionService).purge();
    expect(deleted).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: 'e2e-old' } })).toBe(
      0,
    );
    expect(
      await prisma.auditLog.count({ where: { action: 'e2e-recent' } }),
    ).toBe(1);
    const [system] = await entries({ category: 'System' });
    expect(system).toMatchObject({
      action: 'Deleted old activity log entries',
      target: '2 entries older than 730 days',
      actor: { id: null },
    });
    await prisma.auditLog.deleteMany({ where: { action: 'e2e-recent' } });
  });

  it('filters by days and pages through', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { body } = await as(adminToken)(
      api()
        .get('/api/audit-logs')
        .query({ from: today, to: today, pageSize: 2, page: 1 }),
    ).expect(200);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBeGreaterThanOrEqual(6);
    const { body: none } = await as(adminToken)(
      api().get('/api/audit-logs').query({ to: '2000-01-01' }),
    ).expect(200);
    expect(none.meta.total).toBe(0);
    await as(adminToken)(
      api().get('/api/audit-logs').query({ category: 'Nope' }),
    ).expect(400);
  });
});
