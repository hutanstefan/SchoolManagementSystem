import type { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { compareClassNames } from './class-names';
import { ClassesService } from './classes.service';
import type { SchoolYearsService } from '../school-years/school-years.service';

describe('ClassesService', () => {
  const prisma = {
    class: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
    },
    student: { findMany: jest.fn() },
  };
  const service = new ClassesService(
    prisma as unknown as PrismaService,
    { emitAsync: jest.fn() } as unknown as EventEmitter2,
    {} as SchoolYearsService,
  );
  const teacher = { id: 'user-teacher', role: 'TEACHER' as const };
  const admin = { id: 'user-admin', role: 'ADMIN' as const };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.student.findMany.mockResolvedValue([]);
    prisma.class.findUniqueOrThrow.mockResolvedValue({ schoolYearId: 'y' });
  });

  describe('access to a class', () => {
    it('returns 404 for a class that does not exist', async () => {
      prisma.class.findUnique.mockResolvedValue(null);

      await expect(service.findStudents(admin, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets an admin open any class without further checks', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'c1' });

      await expect(service.findStudents(admin, 'c1')).resolves.toEqual([]);
      expect(prisma.class.count).not.toHaveBeenCalled();
    });

    it('lets a teacher open a class they are assigned to', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.class.count.mockResolvedValue(1);

      await expect(service.findStudents(teacher, 'c1')).resolves.toEqual([]);
      // The check covers both homeroom classes and classes where they teach a subject.
      expect(prisma.class.count).toHaveBeenCalledWith({
        where: {
          id: 'c1',
          OR: [
            { homeroomTeacher: { userId: 'user-teacher' } },
            { subjects: { some: { teacher: { userId: 'user-teacher' } } } },
          ],
        },
      });
    });

    it('forbids a teacher from opening another class', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'c2' });
      prisma.class.count.mockResolvedValue(0);

      await expect(service.findStudents(teacher, 'c2')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('compareClassNames', () => {
    it('sorts class names naturally', () => {
      const names = ['10A', '9B', '12A', '9A', '11A', '10B'];
      expect([...names].sort((a, b) => compareClassNames(a, b))).toEqual([
        '9A',
        '9B',
        '10A',
        '10B',
        '11A',
        '12A',
      ]);
      expect(
        [...names].sort((a, b) => compareClassNames(a, b, 'desc'))[0],
      ).toBe('12A');
    });
  });
});
