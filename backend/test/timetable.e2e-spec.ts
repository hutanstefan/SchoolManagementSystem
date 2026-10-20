import request from 'supertest';
import {
  cleanupTestData,
  createTestApp,
  loginAs,
  TestApp,
  uniqueClassName,
  uniqueName,
} from './utils';

/**
 * Uses its own class and subject, scheduled in periods 5-8, which the seeded
 * timetable leaves free (seeded lessons use periods 1-4).
 */
describe('Teaching assignments and timetable (e2e)', () => {
  let app: TestApp;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let mihaiId: string; // teacher@school.test
  let classId: string;
  let classSubjectId: string;
  const classIds: Record<string, string> = {};

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

    const { body: classes } = await as(adminToken)(
      api().get('/api/classes?pageSize=100'),
    );
    for (const c of classes.data as { id: string; name: string }[]) {
      classIds[c.name] = c.id;
    }

    const { body: teachers } = await as(adminToken)(
      api().get('/api/teachers?search=teacher@school.test'),
    );
    mihaiId = teachers.data[0].id;

    const { body: newClass } = await as(adminToken)(
      api().post('/api/classes').send({ name: uniqueClassName() }),
    ).expect(201);
    classId = newClass.id;

    const { body: subject } = await as(adminToken)(
      api()
        .post('/api/subjects')
        .send({ name: uniqueName('subject') }),
    ).expect(201);

    const { body: assignment } = await as(adminToken)(
      api()
        .post(`/api/classes/${classId}/subjects`)
        .send({ subjectId: subject.id, teacherId: mihaiId, hoursPerWeek: 2 }),
    ).expect(201);
    classSubjectId = assignment.classSubjectId;
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const addLesson = (day: string, period: number) =>
    as(adminToken)(
      api()
        .post(`/api/classes/${classId}/timetable`)
        .send({ classSubjectId, day, period }),
    );

  describe('teaching assignments', () => {
    it('shows the new subject and its teacher in the class details', async () => {
      const { body } = await as(adminToken)(
        api().get(`/api/classes/${classId}`),
      ).expect(200);
      expect(body.subjects).toEqual([
        expect.objectContaining({
          classSubjectId,
          hoursPerWeek: 2,
          teacher: expect.objectContaining({ lastName: 'Ionescu' }),
        }),
      ]);
    });

    it('rejects adding the same subject twice', async () => {
      const { body: detail } = await as(adminToken)(
        api().get(`/api/classes/${classId}`),
      );
      await as(adminToken)(
        api().post(`/api/classes/${classId}/subjects`).send({
          subjectId: detail.subjects[0].subject.id,
          hoursPerWeek: 1,
        }),
      ).expect(409);
    });

    it('is admin only', async () => {
      await as(teacherToken)(
        api()
          .patch(`/api/class-subjects/${classSubjectId}`)
          .send({ hoursPerWeek: 3 }),
      ).expect(403);
    });
  });

  describe('scheduling lessons', () => {
    let lessonId: string;

    it('adds a lesson in a free slot', async () => {
      const { body } = await addLesson('MONDAY', 5).expect(201);
      expect(body).toMatchObject({ day: 'MONDAY', period: 5 });
      lessonId = body.id;
    });

    it('rejects a second lesson in the same slot of the class', async () => {
      const response = await addLesson('MONDAY', 5).expect(409);
      expect(response.body.message).toMatch(
        /already has .* on Monday, period 5/,
      );
    });

    it('rejects a slot where the teacher is teaching another class', async () => {
      // Find a slot where Mihai already teaches (seeded lessons, periods 1-4).
      const { body: week } = await as(adminToken)(
        api().get(`/api/teachers/${mihaiId}/timetable`),
      ).expect(200);
      const busy = week.days.find(
        (d: { lessons: unknown[] }) => d.lessons.length > 0,
      );
      const { period, class: otherClass } = busy.lessons[0];

      const response = await addLesson(busy.day, period).expect(409);
      expect(response.body.message).toContain(
        `Mihai Ionescu already teaches ${otherClass.name}`,
      );
    });

    it('stops at the weekly hours of the subject', async () => {
      await addLesson('TUESDAY', 5).expect(201);
      const response = await addLesson('WEDNESDAY', 5).expect(409);
      expect(response.body.message).toMatch(/already has 2\/2 hours/);
    });

    it("won't lower the weekly hours below the scheduled lessons", async () => {
      const response = await as(adminToken)(
        api()
          .patch(`/api/class-subjects/${classSubjectId}`)
          .send({ hoursPerWeek: 1 }),
      ).expect(409);
      expect(response.body.message).toMatch(/Remove 1 of them/);
    });

    it('moves a lesson to another free slot', async () => {
      const { body } = await as(adminToken)(
        api()
          .patch(`/api/timetable-entries/${lessonId}`)
          .send({ day: 'FRIDAY', period: 6, room: 'Lab 2' }),
      ).expect(200);
      expect(body).toMatchObject({ day: 'FRIDAY', period: 6, room: 'Lab 2' });
    });

    it('validates day and period', async () => {
      await as(adminToken)(
        api()
          .post(`/api/classes/${classId}/timetable`)
          .send({ classSubjectId, day: 'SUNDAY', period: 9 }),
      ).expect(400);
    });

    it('rejects a subject of another class', async () => {
      await as(adminToken)(
        api()
          .post(`/api/classes/${classIds['12A']}/timetable`)
          .send({ classSubjectId, day: 'MONDAY', period: 7 }),
      ).expect(400);
    });

    it('deletes a lesson', async () => {
      await as(adminToken)(
        api().delete(`/api/timetable-entries/${lessonId}`),
      ).expect(204);
      await as(adminToken)(
        api().delete(`/api/timetable-entries/${lessonId}`),
      ).expect(404);
    });
  });

  describe('reading timetables', () => {
    it("gives a student their class's full week", async () => {
      const { body } = await as(studentToken)(
        api().get('/api/timetable/me'),
      ).expect(200);

      expect(body.days.map((d: { day: string }) => d.day)).toEqual([
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
      ]);
      const lessons = body.days.flatMap(
        (d: { lessons: { class: { name: string } }[] }) => d.lessons,
      );
      expect(lessons).toHaveLength(20);
      expect(
        lessons.every(
          (l: { class: { name: string } }) => l.class.name === '9A',
        ),
      ).toBe(true);
    });

    it('gives a teacher only the lessons they teach', async () => {
      const { body } = await as(teacherToken)(
        api().get('/api/timetable/me'),
      ).expect(200);

      const subjects = new Set(
        body.days.flatMap((d: { lessons: { subject: { name: string } }[] }) =>
          d.lessons.map((l) => l.subject.name),
        ),
      );
      expect(subjects.has('Mathematics')).toBe(true);
      expect(subjects.has('Physics')).toBe(false);
    });

    it('lets a student open their own class timetable only', async () => {
      await as(studentToken)(
        api().get(`/api/classes/${classIds['9A']}/timetable`),
      ).expect(200);
      const response = await as(studentToken)(
        api().get(`/api/classes/${classIds['12A']}/timetable`),
      ).expect(403);
      expect(response.body.message).toBe('You are not enrolled in this class');
    });

    it("forbids a teacher from opening a class they don't teach", async () => {
      await as(teacherToken)(
        api().get(`/api/classes/${classIds['12A']}/timetable`),
      ).expect(403);
    });

    it("keeps teachers' timetables admin only", async () => {
      await as(teacherToken)(
        api().get(`/api/teachers/${mihaiId}/timetable`),
      ).expect(403);
    });
  });
});
