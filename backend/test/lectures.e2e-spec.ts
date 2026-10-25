import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { makeLecturePdf } from '../prisma/lecture-pdfs';
import { PrismaService } from '../src/prisma/prisma.service';
import { storageRoot } from '../src/storage/create-storage';
import { LocalFileStorage } from '../src/storage/local-storage';
import { createTestApp, loginAs, studentsOf, TestApp } from './utils';

const PDF = makeLecturePdf({
  title: 'E2E lecture',
  subtitle: 'Mathematics',
  color: [79, 70, 229],
  sections: [{ heading: 'Hello', paragraphs: ['A test PDF.'] }],
});

describe('Lectures (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let storageDir: string;
  let teacherToken: string;
  let otherTeacherToken: string;
  let adminToken: string;
  let studentToken: string;
  let outsiderToken: string;
  let maths: string;
  let physics: string;
  let andrei: string;
  let from11A: string;
  let from12A: string;
  let lectureId: string;
  const startedAt = new Date();
  const created: string[] = [];

  const api = () => request(app.getHttpServer());
  const as = (token: string) => (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`);
  const tokenFor = async (userId: string) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true, tokenVersion: true },
    });
    return app
      .get(JwtService)
      .signAsync({ sub: user.id, role: user.role, ver: user.tokenVersion });
  };
  const upload = (
    token: string,
    fields: Record<string, string>,
    file: Buffer | null = PDF,
    name = 'Lecție de test.pdf',
  ) => {
    let req = as(token)(api().post('/api/lectures'));
    for (const [key, value] of Object.entries(fields)) {
      req = req.field(key, value);
    }
    return file ? req.attach('file', file, name) : req;
  };
  const lectureNotifications = (studentId: string) =>
    prisma.notification.findMany({
      where: {
        type: 'LECTURE_SHARED',
        createdAt: { gte: startedAt },
        user: { student: { id: studentId } },
      },
    });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storageDir = storageRoot(
      app.get(ConfigService).get<string>('STORAGE_DIR') ?? 'storage',
    );
    [teacherToken, adminToken, studentToken] = await Promise.all([
      loginAs(app, 'teacher'),
      loginAs(app, 'admin'),
      loginAs(app, 'student'),
    ]);
    const subjects = await prisma.subject.findMany({
      where: { name: { in: ['Mathematics', 'Physics'] } },
    });
    maths = subjects.find((s) => s.name === 'Mathematics')!.id;
    physics = subjects.find((s) => s.name === 'Physics')!.id;
    andrei = (
      await prisma.student.findFirstOrThrow({
        where: { user: { email: 'student@school.test' } },
      })
    ).id;
    // Students of classes the teacher doesn't teach: any student can be chosen.
    from11A = (
      await prisma.student.findFirstOrThrow({ where: studentsOf('11A') })
    ).id;
    from12A = (
      await prisma.student.findFirstOrThrow({ where: studentsOf('12A') })
    ).id;
    const romanianTeacher = await prisma.teacher.findFirstOrThrow({
      where: {
        classSubjects: { some: { subject: { name: 'Romanian Language' } } },
      },
      select: { userId: true },
    });
    otherTeacherToken = await tokenFor(romanianTeacher.userId);
    const outsider = await prisma.student.findFirstOrThrow({
      where: { ...studentsOf('10B'), lectureAccess: { none: {} } },
      select: { userId: true },
    });
    outsiderToken = await tokenFor(outsider.userId);
  });

  afterAll(async () => {
    const rows = await prisma.lecture.findMany({
      where: { id: { in: created } },
      select: { fileKey: true },
    });
    await prisma.lecture.deleteMany({ where: { id: { in: created } } });
    for (const { fileKey } of rows) {
      await rm(join(storageDir, fileKey), { force: true });
    }
    await prisma.notification.deleteMany({
      where: { type: 'LECTURE_SHARED', createdAt: { gte: startedAt } },
    });
    await app.close();
  });

  describe('sharing', () => {
    it('offers every student of the school, from any class', async () => {
      const { body } = await as(teacherToken)(
        api().get('/api/lectures/recipients'),
      ).expect(200);
      const classes = new Set(
        body.map((s: { class: { name: string } | null }) => s.class?.name),
      );
      expect([...classes]).toEqual(
        expect.arrayContaining(['9A', '9B', '10A', '10B', '11A', '12A']),
      );
      await as(studentToken)(api().get('/api/lectures/recipients')).expect(403);
    });

    it('lets a teacher share a PDF with students of any class', async () => {
      const { body } = await upload(teacherToken, {
        title: 'Olympiad problems',
        description: 'For Friday',
        subjectId: maths,
        studentIds: JSON.stringify([andrei, from11A]),
      }).expect(201);
      lectureId = body.id as string;
      created.push(lectureId);

      expect(body).toMatchObject({
        title: 'Olympiad problems',
        description: 'For Friday',
        subject: { id: maths, name: 'Mathematics' },
        fileName: 'Lecție de test.pdf',
        fileSize: PDF.length,
        studentCount: 2,
        canManage: true,
      });
      expect(body.students.map((s: { id: string }) => s.id).sort()).toEqual(
        [andrei, from11A].sort(),
      );
      const row = await prisma.lecture.findUniqueOrThrow({
        where: { id: lectureId },
      });
      expect(existsSync(join(storageDir, row.fileKey))).toBe(true);
    });

    it('tells the students it was shared with', async () => {
      const [notification] = await lectureNotifications(from11A);
      expect(notification).toMatchObject({
        title: 'New lecture in Mathematics: Olympiad problems',
        link: '/student/lectures',
      });
    });

    it('accepts only PDFs, in a subject the teacher teaches, for real students', async () => {
      const fields = { title: 'Bad', subjectId: maths };
      const fake = await upload(
        teacherToken,
        fields,
        Buffer.from('MZ not a pdf'),
        'virus.pdf',
      ).expect(400);
      expect(fake.body.message).toBe('virus.pdf is not a PDF file');
      await upload(teacherToken, fields, null).expect(400);
      const notTaught = await upload(teacherToken, {
        title: 'Bad',
        subjectId: physics,
      }).expect(403);
      expect(notTaught.body.message).toBe(
        "You don't teach Physics this school year",
      );
      await upload(teacherToken, {
        ...fields,
        studentIds: '0b39a733-7b2b-45e6-9d19-7938ad3af0b6',
      }).expect(400);
      // Admins manage lectures but don't share them; students can't at all.
      await upload(adminToken, fields).expect(403);
      await upload(studentToken, fields).expect(403);
    });

    it('refuses files over 20 MB', async () => {
      const big = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.alloc(21 * 1024 * 1024),
      ]);
      await upload(
        teacherToken,
        { title: 'Big', subjectId: maths },
        big,
      ).expect(413);
    });
  });

  describe('reading', () => {
    it('lists the lecture for the students who may read it, and nobody else', async () => {
      const mine = await as(studentToken)(api().get('/api/lectures')).expect(
        200,
      );
      expect(mine.body.data).toContainEqual(
        expect.objectContaining({
          id: lectureId,
          canManage: false,
          studentCount: 0,
        }),
      );
      const theirs = await as(outsiderToken)(api().get('/api/lectures')).expect(
        200,
      );
      expect(theirs.body.data.map((l: { id: string }) => l.id)).not.toContain(
        lectureId,
      );
      // Unknown, as far as they are concerned.
      await as(outsiderToken)(api().get(`/api/lectures/${lectureId}`)).expect(
        404,
      );
      await as(outsiderToken)(
        api().get(`/api/lectures/${lectureId}/link`),
      ).expect(404);
      await as(otherTeacherToken)(
        api().get(`/api/lectures/${lectureId}`),
      ).expect(404);
      // A reader doesn't see who else can read it.
      const detail = await as(studentToken)(
        api().get(`/api/lectures/${lectureId}`),
      ).expect(200);
      expect(detail.body.students).toEqual([]);
    });

    it('lists them a page at a time, newest first, with the subjects to filter by', async () => {
      const { body: all } = await as(adminToken)(
        api().get('/api/lectures').query({ pageSize: 100 }),
      ).expect(200);
      const total = all.meta.total as number;
      expect(total).toBeGreaterThanOrEqual(6);
      const dates = all.data.map((l: { createdAt: string }) => l.createdAt);
      expect([...dates].sort().reverse()).toEqual(dates);
      expect(all.subjects.map((s: { name: string }) => s.name)).toEqual(
        expect.arrayContaining(['Mathematics', 'Romanian Language']),
      );

      const { body: page2 } = await as(adminToken)(
        api().get('/api/lectures').query({ pageSize: 2, page: 2 }),
      ).expect(200);
      expect(page2.meta).toMatchObject({
        page: 2,
        pageSize: 2,
        total,
        totalPages: Math.ceil(total / 2),
      });
      expect(page2.data.map((l: { id: string }) => l.id)).toEqual(
        all.data.slice(2, 4).map((l: { id: string }) => l.id),
      );

      const { body: filtered } = await as(adminToken)(
        api()
          .get('/api/lectures')
          .query({ subjectId: maths, search: 'olympiad' }),
      ).expect(200);
      expect(filtered.data.length).toBeGreaterThan(0);
      expect(
        filtered.data.every(
          (l: { subject: { id: string }; title: string }) =>
            l.subject.id === maths && /olympiad/i.test(l.title),
        ),
      ).toBe(true);
      // Every word, in any field, without diacritics; the teacher's name too.
      const { body: found } = await as(adminToken)(
        api().get('/api/lectures').query({ search: 'creanga ROMANIAN radu' }),
      ).expect(200);
      expect(found.data.map((l: { title: string }) => l.title)).toEqual([
        'Ion Creangă, Amintiri din copilărie: reading guide',
      ]);
      const { body: nothing } = await as(adminToken)(
        api().get('/api/lectures').query({ search: '100%_' }),
      ).expect(200);
      expect(nothing.meta.total).toBe(0);
      // The subjects stay the same whatever the filter: they are for picking one.
      expect(filtered.subjects).toEqual(all.subjects);
      await as(adminToken)(
        api().get('/api/lectures').query({ pageSize: 101 }),
      ).expect(400);
    });

    it('gives readers short-lived links to preview or download the PDF', async () => {
      const preview = await as(studentToken)(
        api().get(`/api/lectures/${lectureId}/link`),
      ).expect(200);
      expect(new Date(preview.body.expiresAt).getTime()).toBeGreaterThan(
        Date.now(),
      );
      const shown = await api()
        .get(preview.body.url as string)
        .buffer(true)
        .expect(200);
      expect(shown.headers['content-type']).toBe('application/pdf');
      expect(shown.headers['content-disposition']).toMatch(/^inline;/);
      expect(shown.headers['content-disposition']).toContain(
        "filename*=UTF-8''Lec%C8%9Bie%20de%20test.pdf",
      );
      expect(shown.headers['x-frame-options']).toBe('SAMEORIGIN');

      const download = await as(studentToken)(
        api().get(`/api/lectures/${lectureId}/link?download=true`),
      ).expect(200);
      const saved = await api()
        .get(download.body.url as string)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(saved.headers['content-disposition']).toMatch(/^attachment;/);
      expect(Buffer.compare(saved.body as Buffer, PDF)).toBe(0);
    });

    it('refuses forged and expired links', async () => {
      const { body } = await as(studentToken)(
        api().get(`/api/lectures/${lectureId}/link`),
      ).expect(200);
      const url = body.url as string;
      await api()
        .get(`${url.slice(0, -2)}xx`)
        .expect(404);

      const config = app.get(ConfigService);
      const expired = new LocalFileStorage(
        storageDir,
        config.get<string>('JWT_SECRET')!,
        -10,
      );
      const row = await prisma.lecture.findUniqueOrThrow({
        where: { id: lectureId },
      });
      const old = await expired.link(row.fileKey, {
        disposition: 'inline',
        fileName: 'a.pdf',
        contentType: 'application/pdf',
      });
      const res = await api().get(old.url).expect(404);
      expect(res.body.message).toBe(
        'This link has expired: open the file again from the app',
      );
      // Browsers (a new tab, the preview frame) get a page, not JSON.
      const page = await api()
        .get(old.url)
        .set('Accept', 'text/html,application/xhtml+xml')
        .expect(404);
      expect(page.headers['content-type']).toContain('text/html');
      expect(page.text).toContain('This link has expired');
    });
  });

  describe('managing', () => {
    it('changes who can read it, telling only the new readers', async () => {
      const { body } = await as(teacherToken)(
        api()
          .put(`/api/lectures/${lectureId}/students`)
          .send({ studentIds: [from11A, from12A] }),
      ).expect(200);
      expect(body.studentCount).toBe(2);

      expect(await lectureNotifications(from12A)).toHaveLength(1);
      expect(await lectureNotifications(from11A)).toHaveLength(1);
      await as(studentToken)(api().get(`/api/lectures/${lectureId}`)).expect(
        404,
      );
    });

    it('edits the details; only its teacher or an admin can', async () => {
      const { body } = await as(teacherToken)(
        api()
          .patch(`/api/lectures/${lectureId}`)
          .send({ title: 'Olympiad problems, set 1', description: null }),
      ).expect(200);
      expect(body).toMatchObject({
        title: 'Olympiad problems, set 1',
        description: null,
      });
      await as(otherTeacherToken)(
        api().patch(`/api/lectures/${lectureId}`).send({ title: 'Mine now' }),
      ).expect(404);
      await as(teacherToken)(
        api().patch(`/api/lectures/${lectureId}`).send({ subjectId: physics }),
      ).expect(403);
    });

    it('keeps who got and lost access, and who changed it', async () => {
      const { body } = await as(teacherToken)(
        api().get(`/api/lectures/${lectureId}/history`),
      ).expect(200);
      const ids = (change: { students: { id: string }[] }) =>
        change.students.map((s) => s.id).sort();

      // Newest first: the last change (andrei out, 12A in), then the upload.
      expect(body.meta).toMatchObject({ page: 1, total: 3 });
      const [granted, revoked, first] = body.data;
      expect(granted).toMatchObject({ action: 'GRANTED' });
      expect(ids(granted)).toEqual([from12A]);
      expect(revoked).toMatchObject({ action: 'REVOKED', at: granted.at });
      expect(ids(revoked)).toEqual([andrei]);
      expect(first).toMatchObject({
        action: 'GRANTED',
        actor: { firstName: 'Mihai', lastName: 'Ionescu' },
      });
      expect(ids(first)).toEqual([andrei, from11A].sort());

      const { body: page2 } = await as(teacherToken)(
        api()
          .get(`/api/lectures/${lectureId}/history`)
          .query({ pageSize: 2, page: 2 }),
      ).expect(200);
      expect(page2.data).toHaveLength(1);

      await as(adminToken)(
        api().get(`/api/lectures/${lectureId}/history`),
      ).expect(200);
      await as(otherTeacherToken)(
        api().get(`/api/lectures/${lectureId}/history`),
      ).expect(404);
      await as(studentToken)(
        api().get(`/api/lectures/${lectureId}/history`),
      ).expect(403);
    });

    it("doesn't end the access with the school year", async () => {
      // The demo lecture shared last year: its readers still have it.
      const old = await prisma.lecture.findFirstOrThrow({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          access: { select: { student: { select: { userId: true } } } },
        },
      });
      expect(old.access.length).toBeGreaterThan(0);
      const reader = await tokenFor(old.access[0].student.userId);
      await as(reader)(api().get(`/api/lectures/${old.id}/link`)).expect(200);
      const { body } = await as(reader)(api().get('/api/lectures'));
      expect(body.data.map((l: { id: string }) => l.id)).toContain(old.id);
    });

    it('deletes the lecture, its history and its file', async () => {
      const row = await prisma.lecture.findUniqueOrThrow({
        where: { id: lectureId },
      });
      await as(adminToken)(api().delete(`/api/lectures/${lectureId}`)).expect(
        204,
      );
      expect(existsSync(join(storageDir, row.fileKey))).toBe(false);
      expect(
        await prisma.lectureAccessEvent.count({ where: { lectureId } }),
      ).toBe(0);
      await as(teacherToken)(api().get(`/api/lectures/${lectureId}`)).expect(
        404,
      );
    });
  });
});
