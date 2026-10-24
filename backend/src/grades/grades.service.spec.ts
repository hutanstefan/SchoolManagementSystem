import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException } from '@nestjs/common';
import { ClassesService } from '../classes/classes.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolYearsService } from '../school-years/school-years.service';
import { GradesService } from './grades.service';

describe('GradesService permissions', () => {
  const prisma = {
    student: { findUnique: jest.fn() },
    schoolYear: { findFirst: jest.fn() },
    enrollment: { findUnique: jest.fn() },
    subject: { findUnique: jest.fn() },
    classSubject: { findUnique: jest.fn() },
    grade: { findUnique: jest.fn(), delete: jest.fn() },
    gradeHistory: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const events = { emitAsync: jest.fn() };
  const service = new GradesService(
    prisma as unknown as PrismaService,
    {} as ClassesService,
    events as unknown as EventEmitter2,
    new SchoolYearsService(prisma as unknown as PrismaService),
  );
  const openYear = {
    id: 'year-2026',
    startYear: 2026,
    status: 'ACTIVE' as const,
    currentSemester: 1,
    semester1EndedAt: null,
    closedAt: null,
  };

  const mihai = { id: 'user-mihai', role: 'TEACHER' as const };
  const otherTeacher = { id: 'user-other', role: 'TEACHER' as const };
  const admin = { id: 'user-admin', role: 'ADMIN' as const };
  const dto = { studentId: 'st-1', subjectId: 'sub-math', value: 9 };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.schoolYear.findFirst.mockResolvedValue(openYear);
    prisma.student.findUnique.mockResolvedValue({ id: 'st-1' });
    prisma.enrollment.findUnique.mockResolvedValue({
      class: { id: 'class-9a', name: '9A' },
    });
    prisma.subject.findUnique.mockResolvedValue({ name: 'Mathematics' });
    prisma.classSubject.findUnique.mockResolvedValue({
      teacher: { id: 'teacher-mihai', userId: 'user-mihai' },
    });
  });

  describe('giving a grade', () => {
    it('forbids a teacher who does not teach the subject in that class', async () => {
      await expect(service.create(otherTeacher, dto)).rejects.toThrow(
        new ForbiddenException("You don't teach Mathematics in 9A"),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a subject the class does not study', async () => {
      prisma.classSubject.findUnique.mockResolvedValue(null);

      await expect(service.create(mihai, dto)).rejects.toThrow(
        new BadRequestException('Mathematics is not taught in 9A'),
      );
    });

    it('rejects a student without a class this school year', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(service.create(admin, dto)).rejects.toThrow(
        new BadRequestException(
          'The student is not enrolled in a class this school year',
        ),
      );
    });

    it("refuses a semester that hasn't started", async () => {
      await expect(
        service.create(admin, { ...dto, semester: 2 }),
      ).rejects.toThrow(
        new BadRequestException("Semester 2 hasn't started yet"),
      );
    });

    it('returns 404 for an unknown student', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      await expect(service.create(mihai, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('changing or deleting a grade', () => {
    const gradeByMihai = {
      value: 7,
      date: new Date('2026-10-01'),
      studentId: 'st-1',
      subjectId: 'sub-math',
      schoolYearId: 'year-2026',
      semester: 1,
      schoolYear: openYear,
      teacher: { userId: 'user-mihai' },
    };

    it('locks an ended semester for teachers, not for admins', async () => {
      prisma.grade.findUnique.mockResolvedValue({
        ...gradeByMihai,
        schoolYear: { ...openYear, currentSemester: 2 },
      });

      await expect(service.remove(mihai, 'g-1')).rejects.toThrow(
        new ForbiddenException(
          'Semester 1 has ended: only an administrator can change its grades',
        ),
      );
      await expect(service.remove(admin, 'g-1')).resolves.toBeUndefined();
    });

    it('keeps a closed school year read-only, for everyone', async () => {
      prisma.grade.findUnique.mockResolvedValue({
        ...gradeByMihai,
        schoolYear: { ...openYear, status: 'CLOSED', currentSemester: 2 },
      });

      await expect(service.remove(admin, 'g-1')).rejects.toThrow(
        new ConflictException(
          '2026–2027 is closed: its data can only be viewed',
        ),
      );
    });

    it("forbids a teacher from changing another teacher's grade", async () => {
      prisma.grade.findUnique.mockResolvedValue(gradeByMihai);

      await expect(
        service.update(otherTeacher, 'g-1', { value: 10 }),
      ).rejects.toThrow(
        new ForbiddenException('You can only change grades you gave'),
      );
    });

    it("forbids a teacher from deleting another teacher's grade", async () => {
      prisma.grade.findUnique.mockResolvedValue(gradeByMihai);

      await expect(service.remove(otherTeacher, 'g-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.grade.delete).not.toHaveBeenCalled();
    });

    it('records the deletion in the history, in the same transaction', async () => {
      prisma.grade.findUnique.mockResolvedValue(gradeByMihai);
      prisma.gradeHistory.create.mockReturnValue('history-op');
      prisma.grade.delete.mockReturnValue('delete-op');

      await service.remove(mihai, 'g-1');

      expect(prisma.gradeHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gradeId: 'g-1',
          action: 'DELETED',
          oldValue: 7,
          changedById: 'user-mihai',
        }),
      });
      expect(prisma.$transaction).toHaveBeenCalledWith([
        'history-op',
        'delete-op',
      ]);
    });

    it('lets an admin delete any grade', async () => {
      prisma.grade.findUnique.mockResolvedValue({
        ...gradeByMihai,
        teacher: null,
      });

      await expect(service.remove(admin, 'g-1')).resolves.toBeUndefined();
    });
  });
});
