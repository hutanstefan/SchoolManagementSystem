import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { JwtService } from '@nestjs/jwt';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupTestData,
  createTestApp,
  loginAs,
  TestApp,
  uniqueName,
  currentClass,
  OPEN_YEAR,
  studentsOf,
} from './utils';

interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name: string;
  unreadCount: number;
  lastMessage: { body: string; kind: string } | null;
  members: { user: { id: string }; role: string; lastReadAt: string | null }[];
}
interface Message {
  id: string;
  kind: string;
  body: string;
  sender: { id: string } | null;
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

/**
 * Teacher Mihai (teacher@school.test) teaches Mathematics in 9A and is its
 * homeroom teacher. A new 9A student is created for the direct-conversation
 * tests, so they never depend on conversations from the seed.
 */
describe('Chat (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let url: string;
  let adminToken: string;
  let teacherToken: string;
  let mihai: string; // user ids
  let andrei: string; // student@school.test, 9A
  let classmate: string; // another 9A student
  let classmateEmail: string;
  let otherClassStudent: string; // 12A, not taught by Mihai
  let notMyTeacher: string; // teaches no lesson in 9A
  let notMyTeacherEmail: string;
  let newStudent: { id: string; token: string };
  const startedAt = new Date();
  const sockets: Socket[] = [];

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);

  const connect = (token: string) => {
    const socket = io(url, {
      path: '/api/socket.io',
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  };

  const tokenOf = async (email: string) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true, role: true, tokenVersion: true },
    });
    return app
      .get(JwtService)
      .signAsync({ sub: user.id, role: user.role, ver: user.tokenVersion });
  };
  const userId = async (email: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    const server = app.getHttpServer() as unknown as Server;
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    [adminToken, teacherToken] = await Promise.all([
      loginAs(app, 'admin'),
      loginAs(app, 'teacher'),
    ]);
    [mihai, andrei] = await Promise.all([
      userId('teacher@school.test'),
      userId('student@school.test'),
    ]);
    // Looked up rather than named, so the test doesn't depend on seeded names.
    const seededStudent = (className: string) =>
      prisma.user.findFirstOrThrow({
        where: {
          email: { not: 'student@school.test' },
          NOT: { email: { startsWith: 'e2e-' } },
          student: studentsOf(className),
        },
        orderBy: { email: 'asc' },
        select: { id: true, email: true },
      });
    const mate = await seededStudent('9A');
    classmate = mate.id;
    classmateEmail = mate.email;
    otherClassStudent = (await seededStudent('12A')).id;
    const outsider = await prisma.teacher.findFirstOrThrow({
      where: {
        user: { email: { not: 'teacher@school.test' } },
        classSubjects: { none: { class: { name: '9A', ...OPEN_YEAR } } },
        homeroomClasses: { none: { name: '9A', ...OPEN_YEAR } },
      },
      select: { user: { select: { id: true, email: true } } },
    });
    notMyTeacher = outsider.user.id;
    notMyTeacherEmail = outsider.user.email;

    const class9A = await currentClass(app, '9A');
    const { body } = await as(adminToken)(
      api()
        .post('/api/students')
        .send({
          email: `${uniqueName('chat')}@school.test`,
          password: 'Welcome123',
          firstName: 'Chat',
          lastName: 'Tester',
          dateOfBirth: '2011-05-14',
          classId: class9A.id,
        }),
    ).expect(201);
    newStudent = {
      id: body.userId as string,
      token: await app
        .get(JwtService)
        .signAsync({ sub: body.userId, role: 'STUDENT', ver: 0 }),
    };
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    await prisma.conversation.deleteMany({
      where: { createdAt: { gte: startedAt } },
    });
    await cleanupTestData(app);
    await app.close();
  });

  describe('who can write to whom', () => {
    it('shows a student their teachers only: no classmates, no admins', async () => {
      const { body } = await as(newStudent.token)(
        api().get('/api/chat/contacts'),
      ).expect(200);
      const ids = (body as { id: string }[]).map((c) => c.id);

      expect(ids).toContain(mihai);
      expect(ids).not.toContain(classmate);
      expect(ids).not.toContain(notMyTeacher);
      expect(body).toContainEqual(
        expect.objectContaining({
          id: mihai,
          detail: 'Mathematics · your homeroom teacher',
        }),
      );
      expect(
        (body as { role: string }[]).every((c) => c.role === 'TEACHER'),
      ).toBe(true);
    });

    it('shows a teacher the students of their classes only', async () => {
      const { body } = await as(teacherToken)(
        api().get('/api/chat/contacts'),
      ).expect(200);
      const ids = (body as { id: string }[]).map((c) => c.id);
      expect(ids).toContain(andrei);
      expect(ids).toContain(notMyTeacher); // teachers talk to each other
      expect(ids).not.toContain(otherClassStudent);
      expect((body as { role: string }[]).some((c) => c.role === 'ADMIN')).toBe(
        false,
      );
    });

    it('has no chat for admins', async () => {
      await as(adminToken)(api().get('/api/chat/conversations')).expect(403);
      await as(adminToken)(
        api().post('/api/chat/conversations/direct').send({ userId: mihai }),
      ).expect(403);
      const admin = await userId('admin@school.test');
      await as(teacherToken)(
        api().post('/api/chat/conversations/direct').send({ userId: admin }),
      ).expect(403);
    });

    it('refuses direct messages between students, or to other teachers', async () => {
      const toClassmate = await as(newStudent.token)(
        api()
          .post('/api/chat/conversations/direct')
          .send({ userId: classmate }),
      ).expect(403);
      expect(toClassmate.body.message).toMatch(
        /^You can only write to your teachers, not to/,
      );
      await as(newStudent.token)(
        api()
          .post('/api/chat/conversations/direct')
          .send({ userId: notMyTeacher }),
      ).expect(403);
      await as(teacherToken)(
        api()
          .post('/api/chat/conversations/direct')
          .send({ userId: otherClassStudent }),
      ).expect(403);
    });
  });

  describe('direct conversation', () => {
    let conversationId: string;

    it('opens one conversation per pair, shown to the other side once written in', async () => {
      const open = () =>
        as(newStudent.token)(
          api().post('/api/chat/conversations/direct').send({ userId: mihai }),
        ).expect(201);
      const { body: first } = await open();
      const { body: again } = await open();
      expect(again.id).toBe(first.id);
      expect(first).toMatchObject({ type: 'DIRECT', name: 'Mihai Ionescu' });
      conversationId = first.id;

      const { body: teachersList } = await as(teacherToken)(
        api().get('/api/chat/conversations'),
      ).expect(200);
      expect(
        (teachersList as Conversation[]).some((c) => c.id === conversationId),
      ).toBe(false);
    });

    it('pushes a message to the other person live, unread until they read it', async () => {
      const teacherSocket = connect(teacherToken);
      await next(teacherSocket, 'connect');
      const pushed = next<{ conversationId: string; message: Message }>(
        teacherSocket,
        'chat:message',
      );

      const { body: sent } = await as(newStudent.token)(
        api()
          .post(`/api/chat/conversations/${conversationId}/messages`)
          .send({ body: '  Can I retake the test on Friday?  ' }),
      ).expect(201);
      expect(sent).toMatchObject({
        kind: 'TEXT',
        body: 'Can I retake the test on Friday?',
        sender: { id: newStudent.id },
      });
      expect((await pushed).message.id).toBe(sent.id);

      const { body: list } = await as(teacherToken)(
        api().get('/api/chat/conversations'),
      ).expect(200);
      const conversation = (list as Conversation[]).find(
        (c) => c.id === conversationId,
      )!;
      expect(conversation).toMatchObject({
        name: 'Chat Tester',
        unreadCount: 1,
        lastMessage: { body: 'Can I retake the test on Friday?' },
      });

      const unreadTotal = async () =>
        (
          await as(teacherToken)(api().get('/api/chat/unread-count')).expect(
            200,
          )
        ).body.count as number;
      const before = await unreadTotal();

      const studentSocket = connect(newStudent.token);
      await next(studentSocket, 'connect');
      const seen = next<{ userId: string }>(studentSocket, 'chat:read');
      await as(teacherToken)(
        api().post(`/api/chat/conversations/${conversationId}/read`),
      ).expect(204);
      expect((await seen).userId).toBe(mihai);
      expect(await unreadTotal()).toBe(before - 1);
      const { body: read } = await as(teacherToken)(
        api().get(`/api/chat/conversations/${conversationId}`),
      ).expect(200);
      expect(read.unreadCount).toBe(0);
    });

    it('relays "typing" to the other person', async () => {
      const teacherSocket = connect(teacherToken);
      const studentSocket = connect(newStudent.token);
      await Promise.all([
        next(teacherSocket, 'connect'),
        next(studentSocket, 'connect'),
      ]);
      const typing = next<{
        conversationId: string;
        user: { firstName: string };
      }>(teacherSocket, 'chat:typing');
      studentSocket.emit('chat:typing', { conversationId });
      expect(await typing).toEqual({
        conversationId,
        user: { id: newStudent.id, firstName: 'Chat' },
      });
    });

    it('pages through older messages', async () => {
      for (let i = 1; i <= 4; i++) {
        await as(teacherToken)(
          api()
            .post(`/api/chat/conversations/${conversationId}/messages`)
            .send({ body: `Reply ${i}` }),
        ).expect(201);
      }
      const page = (before?: string) =>
        as(newStudent.token)(
          api().get(
            `/api/chat/conversations/${conversationId}/messages?limit=2${before ? `&before=${before}` : ''}`,
          ),
        ).expect(200);

      const { body: newest } = await page();
      expect(newest.data.map((m: Message) => m.body)).toEqual([
        'Reply 3',
        'Reply 4',
      ]);
      expect(newest.hasMore).toBe(true);
      const { body: older } = await page(newest.data[0].id);
      expect(older.data.map((m: Message) => m.body)).toEqual([
        'Reply 1',
        'Reply 2',
      ]);
      const { body: oldest } = await page(older.data[0].id);
      expect(oldest.data.map((m: Message) => m.body)).toEqual([
        'Can I retake the test on Friday?',
      ]);
      expect(oldest.hasMore).toBe(false);
    });

    it('lets senders delete only their own messages', async () => {
      const { body } = await as(newStudent.token)(
        api().get(`/api/chat/conversations/${conversationId}/messages`),
      ).expect(200);
      const mine = (body.data as Message[]).find(
        (m) => m.sender?.id === newStudent.id,
      )!;
      const theirs = (body.data as Message[]).find(
        (m) => m.sender?.id === mihai,
      )!;

      await as(newStudent.token)(
        api().delete(`/api/chat/messages/${theirs.id}`),
      ).expect(403);
      await as(newStudent.token)(
        api().delete(`/api/chat/messages/${mine.id}`),
      ).expect(204);
      const { body: after } = await as(teacherToken)(
        api().get(`/api/chat/conversations/${conversationId}/messages`),
      ).expect(200);
      expect(
        (after.data as Message[]).find((m) => m.id === mine.id),
      ).toMatchObject({ body: '', deletedAt: expect.any(String) });
    });

    it("hides other people's conversations", async () => {
      const otherTeacher = await tokenOf(notMyTeacherEmail);
      await as(otherTeacher)(
        api().get(`/api/chat/conversations/${conversationId}/messages`),
      ).expect(404);
      await as(otherTeacher)(
        api()
          .post(`/api/chat/conversations/${conversationId}/messages`)
          .send({ body: 'Hi' }),
      ).expect(404);
    });
  });

  describe('groups', () => {
    let groupId: string;

    it('can only be created by teachers', async () => {
      await as(newStudent.token)(
        api()
          .post('/api/chat/conversations/group')
          .send({ name: 'Study group', memberIds: [mihai] }),
      ).expect(403);
    });

    it("refuses students of a class the teacher doesn't teach", async () => {
      await as(teacherToken)(
        api()
          .post('/api/chat/conversations/group')
          .send({ name: '9A · Maths', memberIds: [andrei, otherClassStudent] }),
      ).expect(403);
    });

    it('lets students of the group write to each other', async () => {
      const { body: group } = await as(teacherToken)(
        api()
          .post('/api/chat/conversations/group')
          .send({ name: '9A · Maths', memberIds: [newStudent.id, classmate] }),
      ).expect(201);
      groupId = group.id;
      expect(group).toMatchObject({
        type: 'GROUP',
        name: '9A · Maths',
        myRole: 'OWNER',
        lastMessage: {
          kind: 'SYSTEM',
          body: 'Mihai Ionescu created the group “9A · Maths”',
        },
      });
      expect(group.members).toHaveLength(3);

      const classmateToken = await tokenOf(classmateEmail);
      const classmateSocket = connect(classmateToken);
      await next(classmateSocket, 'connect');
      const pushed = next<{ message: Message }>(
        classmateSocket,
        'chat:message',
      );
      await as(newStudent.token)(
        api()
          .post(`/api/chat/conversations/${groupId}/messages`)
          .send({ body: 'Who has the homework?' }),
      ).expect(201);
      expect((await pushed).message.body).toBe('Who has the homework?');
    });

    it('shows new members only what was written after they joined', async () => {
      await as(teacherToken)(
        api()
          .post(`/api/chat/conversations/${groupId}/members`)
          .send({ userIds: [andrei] }),
      ).expect(201);
      const andreiToken = await tokenOf('student@school.test');
      const { body } = await as(andreiToken)(
        api().get(`/api/chat/conversations/${groupId}/messages`),
      ).expect(200);
      expect((body.data as Message[]).map((m) => m.body)).toEqual([
        'Mihai Ionescu added Andrei Georgescu',
      ]);
    });

    it('is managed by its creator only', async () => {
      await as(newStudent.token)(
        api()
          .patch(`/api/chat/conversations/${groupId}`)
          .send({ name: 'Hacked' }),
      ).expect(403);
      await as(newStudent.token)(
        api().delete(`/api/chat/conversations/${groupId}/members/${classmate}`),
      ).expect(403);

      const { body } = await as(teacherToken)(
        api()
          .patch(`/api/chat/conversations/${groupId}`)
          .send({ name: '9A · Mathematics' }),
      ).expect(200);
      expect(body.lastMessage.body).toBe(
        'Mihai Ionescu renamed the group to “9A · Mathematics”',
      );
    });

    it('lets members leave, but not the creator', async () => {
      await as(newStudent.token)(
        api().delete(
          `/api/chat/conversations/${groupId}/members/${newStudent.id}`,
        ),
      ).expect(204);
      await as(newStudent.token)(
        api().get(`/api/chat/conversations/${groupId}`),
      ).expect(404);

      const ownerLeaves = await as(teacherToken)(
        api().delete(`/api/chat/conversations/${groupId}/members/${mihai}`),
      ).expect(400);
      expect(ownerLeaves.body.message).toMatch(/Delete it instead/);
    });

    it('is deleted by its creator, for everyone', async () => {
      await as(teacherToken)(
        api().delete(`/api/chat/conversations/${groupId}`),
      ).expect(204);
      await as(teacherToken)(
        api().get(`/api/chat/conversations/${groupId}`),
      ).expect(404);
    });
  });
});
