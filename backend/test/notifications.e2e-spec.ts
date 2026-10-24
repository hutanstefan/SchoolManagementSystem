import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { JwtService } from '@nestjs/jwt';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupTestData,
  createTestApp,
  currentClass,
  loginAs,
  TestApp,
  uniqueClassName,
  uniqueName,
} from './utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** The next `event` on a socket, or an error after 5 s. */
function next<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No "${event}" within 5 s`)),
      5000,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('Notifications (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let url: string;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let studentId: string;
  let class9A: string;
  let maths: string;
  const startedAt = new Date();
  const sockets: Socket[] = [];
  const gradeIds: string[] = [];

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);

  /** A connected Socket.IO client, like the browser's. */
  const connect = (token?: string) => {
    const socket = io(url, {
      path: '/api/socket.io',
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  };

  /** The user's notifications sent during this test run (not the seeded ones). */
  const notificationsOf = async (token: string, query = '') =>
    (
      await as(token)(api().get(`/api/notifications?pageSize=100${query}`))
        .expect(200)
        .then((res) => res.body as { data: Notification[] })
    ).data.filter((n) => new Date(n.createdAt) >= startedAt);

  const giveGrade = async (token: string, value: number) => {
    const { body } = await as(token)(
      api()
        .post('/api/grades')
        .send({ studentId, subjectId: maths, value, date: '2026-10-05' }),
    ).expect(201);
    gradeIds.push(body.id as string);
    return body.id as string;
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    url = `http://127.0.0.1:${((app.getHttpServer() as unknown as Server).address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    [adminToken, teacherToken, studentToken] = await Promise.all([
      loginAs(app, 'admin'),
      loginAs(app, 'teacher'),
      loginAs(app, 'student'),
    ]);
    const student = await prisma.student.findFirstOrThrow({
      where: { user: { email: 'student@school.test' } },
      select: { id: true },
    });
    studentId = student.id;
    class9A = (await currentClass(app, '9A')).id;
    maths = (
      await prisma.subject.findFirstOrThrow({ where: { name: 'Mathematics' } })
    ).id;
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    await prisma.gradeHistory.deleteMany({
      where: { gradeId: { in: gradeIds } },
    });
    await prisma.grade.deleteMany({ where: { id: { in: gradeIds } } });
    await prisma.notification.deleteMany({
      where: { createdAt: { gte: startedAt } },
    });
    await cleanupTestData(app);
    await app.close();
  });

  describe('grades', () => {
    it('pushes a new grade to the student live, and keeps it in their list', async () => {
      const socket = connect(studentToken);
      await next(socket, 'connect');

      const pushed = next<Notification>(socket, 'notification');
      await giveGrade(adminToken, 4);

      expect(await pushed).toMatchObject({
        type: 'GRADE_ADDED',
        title: 'New grade in Mathematics: 4',
        body: 'Given on 5 Oct 2026.',
        link: '/student/grades',
        readAt: null,
      });
      const [latest] = await notificationsOf(studentToken);
      expect(latest.title).toBe('New grade in Mathematics: 4');
    });

    it('alerts the homeroom teacher about a failing grade', async () => {
      // teacher@school.test is the homeroom teacher of 9A.
      const alerts = await notificationsOf(teacherToken, '&unread=true');
      expect(alerts[0]).toMatchObject({
        type: 'HOMEROOM_ALERT',
        title: 'Andrei Georgescu got a 4 in Mathematics',
        link: `/teacher/students/${studentId}`,
      });
    });

    it("doesn't alert the homeroom teacher about a grade they gave", async () => {
      await giveGrade(teacherToken, 3);
      const alerts = await notificationsOf(teacherToken);
      expect(alerts.some((n) => n.title.includes('got a 3'))).toBe(false);
    });

    it('tells the student when a grade is changed or removed', async () => {
      const id = gradeIds[0];
      await as(adminToken)(
        api().patch(`/api/grades/${id}`).send({ value: 8 }),
      ).expect(200);
      await as(adminToken)(api().delete(`/api/grades/${id}`)).expect(204);

      const list = await notificationsOf(studentToken);
      expect(list.map((n) => n.title)).toContain(
        'Grade changed in Mathematics: 4 → 8',
      );
      expect(list).toContainEqual(
        expect.objectContaining({
          type: 'GRADE_REMOVED',
          body: 'The 8 from 5 Oct 2026 was removed.',
        }),
      );
    });
  });

  describe('timetable and assignments', () => {
    it('tells the class and the teacher when a lesson moves', async () => {
      const lesson = await prisma.timetableEntry.findFirstOrThrow({
        where: {
          classId: class9A,
          classSubject: { subject: { name: 'Mathematics' } },
        },
        select: { id: true, day: true, period: true, classSubjectId: true },
      });
      const { body: free } = await as(adminToken)(
        api().get(
          `/api/class-subjects/${lesson.classSubjectId}/free-slots?excludeLessonId=${lesson.id}`,
        ),
      ).expect(200);
      const target = free[0] as { day: string; period: number };

      const move = (slot: { day: string; period: number }) =>
        as(adminToken)(
          api().patch(`/api/timetable-entries/${lesson.id}`).send(slot),
        ).expect(200);
      await move(target);

      const [forStudent] = await notificationsOf(studentToken);
      expect(forStudent).toMatchObject({
        type: 'TIMETABLE_CHANGED',
        title: 'Mathematics moved',
        link: '/student/timetable',
      });
      const [forTeacher] = await notificationsOf(teacherToken);
      expect(forTeacher.title).toBe('Mathematics in 9A moved');

      await move({ day: lesson.day, period: lesson.period });
    });

    it('tells a teacher they became the homeroom teacher of a class', async () => {
      const mihai = await prisma.teacher.findFirstOrThrow({
        where: { user: { email: 'teacher@school.test' } },
      });
      const name = uniqueClassName();
      await as(adminToken)(
        api().post('/api/classes').send({ name, homeroomTeacherId: mihai.id }),
      ).expect(201);

      const [latest] = await notificationsOf(teacherToken);
      expect(latest).toMatchObject({
        type: 'ASSIGNMENT_CHANGED',
        title: `You are the homeroom teacher of ${name}`,
      });
    });
  });

  describe('reading', () => {
    it('counts unread notifications and marks them as read', async () => {
      const count = async () =>
        (
          await as(studentToken)(
            api().get('/api/notifications/unread-count'),
          ).expect(200)
        ).body.count as number;

      const before = await count();
      expect(before).toBeGreaterThan(1);
      const [first] = await notificationsOf(studentToken, '&unread=true');

      await as(studentToken)(
        api().patch(`/api/notifications/${first.id}/read`),
      ).expect(204);
      expect(await count()).toBe(before - 1);

      const { body } = await as(studentToken)(
        api().patch('/api/notifications/read-all'),
      ).expect(200);
      expect(body.count).toBe(before - 1);
      expect(await count()).toBe(0);
    });

    it("hides other users' notifications", async () => {
      const [studentsOwn] = await notificationsOf(studentToken);
      await as(teacherToken)(
        api().patch(`/api/notifications/${studentsOwn.id}/read`),
      ).expect(404);
    });
  });

  describe('connections', () => {
    it('refuses a connection without a valid token', async () => {
      const error = await next<Error>(connect(), 'connect_error');
      expect(error.message).toBe('Missing access token');
      const forged = await next<Error>(connect('not-a-jwt'), 'connect_error');
      expect(forged.message).toBe('Invalid or expired access token');
    });

    it('closes the connections of a user who logs out', async () => {
      const { body: created } = await as(adminToken)(
        api()
          .post('/api/students')
          .send({
            email: `${uniqueName('student')}@school.test`,
            password: 'Welcome123',
            firstName: 'Test',
            lastName: 'Student',
            dateOfBirth: '2011-05-14',
          }),
      ).expect(201);
      const token = await app
        .get(JwtService)
        .signAsync({ sub: created.userId, role: 'STUDENT', ver: 0 });

      const socket = connect(token);
      await next(socket, 'connect');
      const closed = next<string>(socket, 'disconnect');
      await as(token)(api().post('/api/auth/logout')).expect(204);
      expect(await closed).toBe('io server disconnect');
    });

    it('closes them when an admin resets the password or deletes the account', async () => {
      const { body: created } = await as(adminToken)(
        api()
          .post('/api/students')
          .send({
            email: `${uniqueName('student')}@school.test`,
            password: 'Welcome123',
            firstName: 'Test',
            lastName: 'Student',
            dateOfBirth: '2011-05-14',
          }),
      ).expect(201);
      const tokenOf = (ver: number) =>
        app
          .get(JwtService)
          .signAsync({ sub: created.userId, role: 'STUDENT', ver });

      const first = connect(await tokenOf(0));
      await next(first, 'connect');
      const reset = next<string>(first, 'disconnect');
      await as(adminToken)(
        api()
          .patch(`/api/students/${created.id}`)
          .send({ password: 'NewPass123' }),
      ).expect(200);
      expect(await reset).toBe('io server disconnect');

      const second = connect(await tokenOf(1));
      await next(second, 'connect');
      const deleted = next<string>(second, 'disconnect');
      await as(adminToken)(api().delete(`/api/students/${created.id}`)).expect(
        204,
      );
      expect(await deleted).toBe('io server disconnect');
    });

    it('closes a connection when its token expires', async () => {
      const jwt = app.get(JwtService);
      const { sub, role, ver } = jwt.decode<{
        sub: string;
        role: string;
        ver: number;
      }>(studentToken);
      const shortLived = await jwt.signAsync(
        { sub, role, ver },
        { expiresIn: 2 },
      );
      const socket = connect(shortLived);
      await next(socket, 'connect');
      expect(await next<string>(socket, 'disconnect')).toBe(
        'io server disconnect',
      );
    });
  });
});
