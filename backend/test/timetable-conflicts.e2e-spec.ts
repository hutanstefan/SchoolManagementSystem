import request from 'supertest';
import {
  cleanupTestData,
  createTestApp,
  loginAs,
  TestApp,
  uniqueClassName,
  uniqueName,
} from './utils';

interface Lesson {
  id: string;
  day: string;
  period: number;
  classSubjectId: string;
  class: { name: string };
}

/**
 * Timetable conflicts come back as 409s that describe what is in the way, and
 * every resolution (replace, swap, add an hour, remove lessons) runs in one
 * transaction. Uses its own class in periods 5-8 (the seed uses 1-4).
 */
describe('Timetable conflicts and their resolutions (e2e)', () => {
  let app: TestApp;
  let adminToken: string;
  let mihaiId: string;
  let classId: string;
  /** Taught by Mihai (teacher@school.test), 2 hours a week. */
  let maths: string;
  /** No teacher, 1 hour a week. */
  let art: string;

  const api = () => request(app.getHttpServer());
  const admin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);
  const addLesson = (body: Record<string, unknown>) =>
    admin(api().post(`/api/classes/${classId}/timetable`).send(body));
  const lessonsOfClass = async (): Promise<Lesson[]> => {
    const { body } = await admin(
      api().get(`/api/classes/${classId}/timetable`),
    );
    return (body.days as { lessons: Lesson[] }[]).flatMap((d) => d.lessons);
  };
  const lessonAt = async (day: string, period: number) =>
    (await lessonsOfClass()).find((l) => l.day === day && l.period === period);

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAs(app, 'admin');

    const { body: teachers } = await admin(
      api().get('/api/teachers?search=teacher@school.test'),
    );
    mihaiId = teachers.data[0].id;

    const { body: newClass } = await admin(
      api().post('/api/classes').send({ name: uniqueClassName() }),
    ).expect(201);
    classId = newClass.id;

    const subject = async (teacherId: string | null, hoursPerWeek: number) => {
      const { body: s } = await admin(
        api()
          .post('/api/subjects')
          .send({ name: uniqueName('subject') }),
      ).expect(201);
      const { body: assignment } = await admin(
        api()
          .post(`/api/classes/${classId}/subjects`)
          .send({ subjectId: s.id, teacherId, hoursPerWeek }),
      ).expect(201);
      return assignment.classSubjectId as string;
    };
    maths = await subject(mihaiId, 2);
    art = await subject(null, 1);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  it('describes the lesson already in the slot (CLASS_SLOT_TAKEN)', async () => {
    const { body: mathsLesson } = await addLesson({
      classSubjectId: maths,
      day: 'MONDAY',
      period: 6,
    }).expect(201);

    const { body } = await addLesson({
      classSubjectId: art,
      day: 'MONDAY',
      period: 6,
    }).expect(409);

    expect(body.conflict).toMatchObject({
      type: 'CLASS_SLOT_TAKEN',
      day: 'MONDAY',
      period: 6,
      lessons: [{ id: mathsLesson.id }],
    });
  });

  it('replaces the lesson in the slot when asked to', async () => {
    const mathsLesson = await lessonAt('MONDAY', 6);

    await addLesson({
      classSubjectId: art,
      day: 'MONDAY',
      period: 6,
      replaceLessonId: mathsLesson!.id,
    }).expect(201);

    expect((await lessonAt('MONDAY', 6))?.classSubjectId).toBe(art);
  });

  it('swaps two lessons of the class', async () => {
    await addLesson({
      classSubjectId: maths,
      day: 'TUESDAY',
      period: 6,
    }).expect(201);
    const artLesson = await lessonAt('MONDAY', 6);

    await admin(
      api()
        .patch(`/api/timetable-entries/${artLesson!.id}`)
        .send({ day: 'TUESDAY', period: 6, swap: true }),
    ).expect(200);

    expect((await lessonAt('TUESDAY', 6))?.classSubjectId).toBe(art);
    expect((await lessonAt('MONDAY', 6))?.classSubjectId).toBe(maths);
  });

  it('lists the scheduled lessons when the weekly hours are full, and adds an hour when asked to', async () => {
    const { body } = await addLesson({
      classSubjectId: art,
      day: 'WEDNESDAY',
      period: 6,
    }).expect(409);
    expect(body.conflict).toMatchObject({
      type: 'WEEKLY_HOURS_FULL',
      classSubjectId: art,
      hoursPerWeek: 1,
    });
    expect(body.conflict.lessons).toHaveLength(1);

    await addLesson({
      classSubjectId: art,
      day: 'WEDNESDAY',
      period: 6,
      increaseHours: true,
    }).expect(201);
    const { body: detail } = await admin(api().get(`/api/classes/${classId}`));
    expect(
      detail.subjects.find(
        (s: { classSubjectId: string }) => s.classSubjectId === art,
      ).hoursPerWeek,
    ).toBe(2);
  });

  it("describes the teacher's other lesson (TEACHER_BUSY) and offers only free slots", async () => {
    const { body: week } = await admin(
      api().get(`/api/teachers/${mihaiId}/timetable`),
    );
    const busy = (week.days as { lessons: Lesson[] }[])
      .flatMap((d) => d.lessons)
      .find((l) => l.class.name !== '' && l.period <= 4)!;

    const { body } = await addLesson({
      classSubjectId: maths,
      day: busy.day,
      period: busy.period,
    }).expect(409);
    expect(body.conflict.type).toBe('TEACHER_BUSY');
    expect(body.conflict.lessons[0]).toMatchObject({ id: busy.id });

    const { body: free } = await admin(
      api().get(`/api/class-subjects/${maths}/free-slots`),
    ).expect(200);
    const has = (day: string, period: number) =>
      (free as { day: string; period: number }[]).some(
        (s) => s.day === day && s.period === period,
      );
    expect(has(busy.day, busy.period)).toBe(false); // the teacher is busy
    expect(has('TUESDAY', 6)).toBe(false); // the class is busy
    expect(has('FRIDAY', 8)).toBe(true);
  });

  it('asks which lessons to remove when lowering the hours, then removes them', async () => {
    const { body } = await admin(
      api().patch(`/api/class-subjects/${art}`).send({ hoursPerWeek: 1 }),
    ).expect(409);
    expect(body.conflict).toMatchObject({
      type: 'HOURS_BELOW_SCHEDULED',
      hoursPerWeek: 1,
    });
    const [first] = body.conflict.lessons as Lesson[];

    await admin(
      api()
        .patch(`/api/class-subjects/${art}`)
        .send({ hoursPerWeek: 1, removeLessonIds: [first.id] }),
    ).expect(200);
    const artLessons = (await lessonsOfClass()).filter(
      (l) => l.classSubjectId === art,
    );
    expect(artLessons.map((l) => l.id)).not.toContain(first.id);
    expect(artLessons).toHaveLength(1);
  });

  it("won't remove lessons of another subject", async () => {
    const mathsLesson = (await lessonsOfClass()).find(
      (l) => l.classSubjectId === maths,
    );
    await admin(
      api()
        .patch(`/api/class-subjects/${art}`)
        .send({ removeLessonIds: [mathsLesson!.id] }),
    ).expect(400);
    expect(await lessonAt(mathsLesson!.day, mathsLesson!.period)).toBeDefined();
  });
});
