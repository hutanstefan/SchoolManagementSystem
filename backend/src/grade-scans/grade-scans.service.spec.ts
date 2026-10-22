import { BadRequestException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import type { GradesService } from '../grades/grades.service';
import type { PrismaService } from '../prisma/prisma.service';
import { GradeScansService, mapWithConcurrency } from './grade-scans.service';
import type { TestReader, TestReading } from './readers/test-reader';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const photo = (name: string, buffer = JPEG) => ({ originalname: name, buffer });

describe('GradeScansService', () => {
  const prisma = { student: { findMany: jest.fn() } };
  const grades = { assertCanGrade: jest.fn() };
  const read = jest.fn<Promise<TestReading>, unknown[]>();
  const reader: TestReader = { mode: 'ai', model: 'claude-haiku-5-5', read };
  const config = { get: () => 2 } as unknown as ConfigService<Env, true>;
  const service = new GradeScansService(
    prisma as unknown as PrismaService,
    grades as unknown as GradesService,
    reader,
    config,
  );
  const teacher = { id: 'user-1', role: 'TEACHER' as const };
  const scan = (images: ReturnType<typeof photo>[]) =>
    service.scan(teacher, 'class-9a', 'sub-math', images);

  const reading = (overrides: Partial<TestReading> = {}): TestReading => ({
    studentName: 'Popescu Ioana',
    rosterNumber: 2,
    grade: 9,
    confidence: 'high',
    note: null,
    ...overrides,
  });

  beforeAll(() => {
    // Keep the test output clean; failures are asserted on the result.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    grades.assertCanGrade.mockResolvedValue({
      className: '9A',
      subjectName: 'Mathematics',
      teacherId: 'teacher-1',
    });
    // Sorted by last name: Georgescu (1), Popescu (2).
    prisma.student.findMany.mockResolvedValue([
      { id: 'st-andrei', user: { firstName: 'Andrei', lastName: 'Georgescu' } },
      { id: 'st-ioana', user: { firstName: 'Ioana', lastName: 'Popescu' } },
    ]);
  });

  it('maps the roster number back to the student and keeps a whole grade', async () => {
    read.mockResolvedValue(reading({ grade: 8.5 }));

    const result = await scan([photo('test.jpg')]);

    expect(result.mode).toBe('ai');
    expect(result.tests[0]).toMatchObject({
      status: 'read',
      student: { id: 'st-ioana', firstName: 'Ioana', lastName: 'Popescu' },
      gradeRead: 8.5,
      grade: 9,
      confidence: 'high',
      note: null,
      readBy: 'claude-haiku-5-5',
    });
  });

  it("lowers the confidence when the name on the paper doesn't fit the student", async () => {
    read.mockResolvedValue(reading({ studentName: 'Ionescu Maria' }));

    const [test] = (await scan([photo('test.jpg')])).tests;

    expect(test.student?.id).toBe('st-ioana');
    expect(test.confidence).toBe('low');
    expect(test.note).toContain("doesn't look like Ioana Popescu");
  });

  it('falls back to the name when the reader found no roster number', async () => {
    read.mockResolvedValue(
      reading({ rosterNumber: null, studentName: 'Andrei Georgescu' }),
    );

    const [test] = (await scan([photo('test.jpg')])).tests;

    expect(test.student?.id).toBe('st-andrei');
    expect(test.confidence).toBe('medium');
  });

  it('ignores a roster number that does not exist and an invalid grade', async () => {
    read.mockResolvedValue(
      reading({ rosterNumber: 7, studentName: null, grade: 15 }),
    );

    const [test] = (await scan([photo('test.jpg')])).tests;

    expect(test.student).toBeNull();
    expect(test.grade).toBeNull();
    expect(test.note).toContain('No student of the class matched.');
    expect(test.note).toContain('15 is not a valid grade.');
  });

  it('reports a photo that could not be read without failing the others', async () => {
    read
      .mockResolvedValueOnce(reading())
      .mockRejectedValueOnce(new Error('timeout'));

    const result = await scan([photo('a.jpg'), photo('b.jpg')]);

    expect(result.tests.map((t) => t.status)).toEqual(['read', 'failed']);
    expect(result.tests[1].error).toMatch(/could not be read/);
  });

  it('rejects files that are not images before calling the AI', async () => {
    await expect(
      scan([photo('a.jpg'), photo('notes.pdf', Buffer.from('%PDF-1.7'))]),
    ).rejects.toThrow(
      new BadRequestException('Not a JPEG, PNG, WebP or GIF image: notes.pdf'),
    );
    expect(read).not.toHaveBeenCalled();
  });

  it('requires at least one photo', async () => {
    await expect(scan([])).rejects.toThrow(BadRequestException);
  });

  it('checks the permission to grade before anything else', async () => {
    grades.assertCanGrade.mockRejectedValue(new Error('forbidden'));

    await expect(scan([photo('a.jpg')])).rejects.toThrow('forbidden');
    expect(read).not.toHaveBeenCalled();
  });
});

describe('mapWithConcurrency', () => {
  it('keeps the order and never runs more than the limit at once', async () => {
    let running = 0;
    let maxRunning = 0;
    const result = await mapWithConcurrency([5, 1, 3, 2, 4], 2, async (n) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, n));
      running--;
      return n * 10;
    });

    expect(result).toEqual([50, 10, 30, 20, 40]);
    expect(maxRunning).toBe(2);
  });
});
