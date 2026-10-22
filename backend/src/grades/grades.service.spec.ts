import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { ClassesService } from '../classes/classes.service';
import { PrismaService } from '../prisma/prisma.service';
import { GradesService } from './grades.service';

describe('GradesService permissions', () => {
  const prisma = {
    student: { findUnique: jest.fn() },
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
  );

  const mihai = { id: 'user-mihai', role: 'TEACHER' as const };
  const otherTeacher = { id: 'user-other', role: 'TEACHER' as const };
  const admin = { id: 'user-admin', role: 'ADMIN' as const };
  const dto = { studentId: 'st-1', subjectId: 'sub-math', value: 9 };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.student.findUnique.mockResolvedValue({
      classId: 'class-9a',
      class: { name: '9A' },
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

    it('rejects a student without a class', async () => {
      prisma.student.findUnique.mockResolvedValue({
        classId: null,
        class: null,
      });

      await expect(service.create(admin, dto)).rejects.toThrow(
        BadRequestException,
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
      teacher: { userId: 'user-mihai' },
    };

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
