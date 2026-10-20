import { BadRequestException, ConflictException } from '@nestjs/common';
import { ClassesService } from '../classes/classes.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializableTransaction } from '../prisma/serializable-transaction';
import { toWeek, TimetableService } from './timetable.service';

describe('TimetableService.create', () => {
  const tx = {
    classSubject: { findUnique: jest.fn() },
    timetableEntry: { findFirst: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    // Run the transaction callback directly against the mocked client.
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const classes = { assertExists: jest.fn() };
  const service = new TimetableService(
    prisma as unknown as PrismaService,
    classes as unknown as ClassesService,
  );

  const dto = { classSubjectId: 'cs-math', day: 'MONDAY' as const, period: 5 };
  const mathIn9A = {
    classId: 'class-9a',
    teacherId: 'teacher-mihai',
    hoursPerWeek: 4,
    class: { name: '9A' },
    subject: { name: 'Mathematics' },
    _count: { timetableEntries: 3 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tx.classSubject.findUnique.mockResolvedValue(mathIn9A);
    tx.timetableEntry.findFirst.mockResolvedValue(null);
    tx.timetableEntry.create.mockResolvedValue({
      id: 'lesson-1',
      day: 'MONDAY',
      period: 5,
      room: null,
      classSubject: {
        id: 'cs-math',
        class: { id: 'class-9a', name: '9A' },
        subject: { id: 's-math', name: 'Mathematics' },
        teacher: null,
      },
    });
  });

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

  it('rejects a slot where the class already has a lesson', async () => {
    tx.timetableEntry.findFirst.mockResolvedValueOnce({
      classSubject: { class: { name: '9A' }, subject: { name: 'Physics' } },
    });

    await expect(service.create('class-9a', dto)).rejects.toThrow(
      new ConflictException('9A already has Physics on Monday, period 5'),
    );
  });

  it('rejects a slot where the teacher teaches another class', async () => {
    tx.timetableEntry.findFirst
      .mockResolvedValueOnce(null) // class is free
      .mockResolvedValueOnce({
        classSubject: {
          class: { name: '10A' },
          teacher: { user: { firstName: 'Mihai', lastName: 'Ionescu' } },
        },
      });

    await expect(service.create('class-9a', dto)).rejects.toThrow(
      new ConflictException(
        'Mihai Ionescu already teaches 10A on Monday, period 5',
      ),
    );
  });

  it('rejects a lesson when the weekly hours are already scheduled', async () => {
    tx.classSubject.findUnique.mockResolvedValue({
      ...mathIn9A,
      _count: { timetableEntries: 4 },
    });

    await expect(service.create('class-9a', dto)).rejects.toThrow(
      new ConflictException(
        'Mathematics already has 4/4 hours scheduled in 9A',
      ),
    );
    expect(tx.timetableEntry.create).not.toHaveBeenCalled();
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
      subject: { id: 's', name: 'Mathematics' },
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
