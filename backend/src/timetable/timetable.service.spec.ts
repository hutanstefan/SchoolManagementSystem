import type { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TimetableConflictException } from './timetable-conflict.exception';
import { ClassesService } from '../classes/classes.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializableTransaction } from '../prisma/serializable-transaction';
import type { SchoolYearsService } from '../school-years/school-years.service';
import { toWeek, TimetableService } from './timetable.service';

const lessonRow = (
  id: string,
  subject: string,
  className = '9A',
  slot: { day?: 'MONDAY' | 'TUESDAY'; period?: number } = {},
) => ({
  id,
  day: slot.day ?? 'MONDAY',
  period: slot.period ?? 5,
  room: null,
  classSubject: {
    id: `cs-${subject}`,
    class: { id: `class-${className}`, name: className },
    subject: { id: `s-${subject}`, name: subject },
    teacher: {
      id: 'teacher-mihai',
      user: { firstName: 'Mihai', lastName: 'Ionescu' },
    },
  },
});

describe('TimetableService.create', () => {
  const tx = {
    classSubject: { findUnique: jest.fn(), update: jest.fn() },
    timetableEntry: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  const prisma = {
    // Run the transaction callback directly against the mocked client.
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const classes = { assertExists: jest.fn() };
  const events = { emitAsync: jest.fn() };
  const years = {
    assertClassOpen: () => Promise.resolve({ id: 'year-2026' }),
  };
  const service = new TimetableService(
    prisma as unknown as PrismaService,
    classes as unknown as ClassesService,
    years as unknown as SchoolYearsService,
    events as unknown as EventEmitter2,
  );

  const dto = { classSubjectId: 'cs-math', day: 'MONDAY' as const, period: 5 };
  const mathIn9A = {
    classId: 'class-9a',
    teacherId: 'teacher-mihai',
    hoursPerWeek: 4,
    class: { name: '9A' },
    subject: { name: 'Mathematics' },
  };
  /**
   * findMany is called for the teacher's clashes, then the subject's lessons.
   * The snapshots of the class timetable (before and after, for the
   * notifications) are told apart by their `classId: { in }` filter.
   */
  const mockFindMany = (teacherClashes: unknown[], scheduled: unknown[]) => {
    const answers = [teacherClashes, scheduled];
    tx.timetableEntry.findMany.mockImplementation(
      (args: { where?: { classId?: { in?: string[] } } }) =>
        Promise.resolve(args.where?.classId?.in ? [] : answers.shift()),
    );
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (client: typeof tx) => unknown) => fn(tx),
    );
    tx.classSubject.findUnique.mockResolvedValue(mathIn9A);
    tx.timetableEntry.findFirst.mockResolvedValue(null);
    mockFindMany(
      [],
      [lessonRow('l-a', 'Mathematics'), lessonRow('l-b', 'Mathematics')],
    );
    tx.timetableEntry.create.mockResolvedValue(
      lessonRow('lesson-1', 'Mathematics'),
    );
  });

  const conflictOf = async (promise: Promise<unknown>) => {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(TimetableConflictException);
    return error as TimetableConflictException;
  };

  it('creates the lesson when the slot is free and hours are left', async () => {
    const lesson = await service.create('class-9a', dto);

    expect(lesson).toMatchObject({ id: 'lesson-1', day: 'MONDAY', period: 5 });
    expect(tx.timetableEntry.create).toHaveBeenCalled();
    // Checks and write share one serializable transaction.
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('rejects a subject that belongs to another class', async () => {
    await expect(service.create('class-12a', dto)).rejects.toThrow(
      new BadRequestException('This subject is not taught in this class'),
    );
  });

  it('describes the lesson in the way when the class slot is taken', async () => {
    tx.timetableEntry.findFirst.mockResolvedValueOnce(
      lessonRow('l-physics', 'Physics'),
    );

    const error = await conflictOf(service.create('class-9a', dto));

    expect(error.message).toBe('9A already has Physics on Monday, period 5');
    expect(error.conflict).toMatchObject({
      type: 'CLASS_SLOT_TAKEN',
      day: 'MONDAY',
      period: 5,
      lessons: [{ id: 'l-physics', subject: { name: 'Physics' } }],
    });
  });

  it("describes the teacher's other lesson when the teacher is busy", async () => {
    tx.timetableEntry.findMany.mockReset();
    mockFindMany([lessonRow('l-10a', 'Mathematics', '10A')], []);

    const error = await conflictOf(service.create('class-9a', dto));

    expect(error.message).toBe(
      'Mihai Ionescu already teaches 10A on Monday, period 5',
    );
    expect(error.conflict.type).toBe('TEACHER_BUSY');
    expect(error.conflict.lessons[0]).toMatchObject({ class: { name: '10A' } });
  });

  it('lists the scheduled lessons when the weekly hours are full', async () => {
    tx.timetableEntry.findMany.mockReset();
    const four = ['l1', 'l2', 'l3', 'l4'].map((id) =>
      lessonRow(id, 'Mathematics'),
    );
    mockFindMany([], four);

    const error = await conflictOf(service.create('class-9a', dto));

    expect(error.message).toBe(
      'Mathematics already has 4/4 hours scheduled in 9A',
    );
    expect(error.conflict).toMatchObject({
      type: 'WEEKLY_HOURS_FULL',
      classSubjectId: 'cs-math',
      hoursPerWeek: 4,
    });
    expect(error.conflict.lessons).toHaveLength(4);
    expect(tx.timetableEntry.create).not.toHaveBeenCalled();
  });

  it('adds an hour when asked to, in the same transaction', async () => {
    tx.timetableEntry.findMany.mockReset();
    const four = ['l1', 'l2', 'l3', 'l4'].map((id) =>
      lessonRow(id, 'Mathematics'),
    );
    mockFindMany([], four);

    await service.create('class-9a', { ...dto, increaseHours: true });

    expect(tx.classSubject.update).toHaveBeenCalledWith({
      where: { id: 'cs-math' },
      data: { hoursPerWeek: 5 },
    });
    expect(tx.timetableEntry.create).toHaveBeenCalled();
  });

  it('replaces the lesson in the slot only if it really is there', async () => {
    tx.timetableEntry.findUnique.mockResolvedValueOnce({
      classId: 'class-9a',
      day: 'MONDAY',
      period: 5,
    });
    await service.create('class-9a', { ...dto, replaceLessonId: 'l-physics' });
    expect(tx.timetableEntry.delete).toHaveBeenCalledWith({
      where: { id: 'l-physics' },
    });

    tx.timetableEntry.findUnique.mockResolvedValueOnce({
      classId: 'class-9a',
      day: 'TUESDAY',
      period: 1,
    });
    await expect(
      service.create('class-9a', { ...dto, replaceLessonId: 'l-moved' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('toWeek', () => {
  const lesson = (
    day: 'MONDAY' | 'FRIDAY',
    period: number,
    className: string,
  ) => ({
    id: `${day}-${period}-${className}`,
    day,
    period,
    room: null,
    classSubject: {
      id: 'cs',
      class: { id: className, name: className },
      subject: {
        id: 's',
        name: 'Mathematics',
        color: 'INDIGO' as const,
        icon: 'CALCULATOR' as const,
      },
      teacher: null,
    },
  });

  it('always returns Monday to Friday, with lessons sorted by period', () => {
    const week = toWeek([
      lesson('FRIDAY', 2, '9A'),
      lesson('MONDAY', 3, '9A'),
      lesson('MONDAY', 1, '9B'),
    ]);

    expect(week.days.map((d) => d.day)).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
    ]);
    expect(week.days[0].lessons.map((l) => l.period)).toEqual([1, 3]);
    expect(week.days[1].lessons).toEqual([]);
    expect(week.days[4].lessons).toHaveLength(1);
  });
});

describe('serializableTransaction', () => {
  it('turns a serialization failure (P2034) into a 409', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('write conflict', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      ),
    };

    await expect(
      serializableTransaction(prisma as unknown as PrismaService, () =>
        Promise.resolve(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
