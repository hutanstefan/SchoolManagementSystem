import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubjectColor, SubjectIcon } from '../generated/prisma/enums';
import { iconForName } from './subject-icons';
import { PrismaService } from '../prisma/prisma.service';
import { SubjectsService } from './subjects.service';

describe('SubjectsService.remove', () => {
  const prisma = {
    subject: { findUnique: jest.fn(), delete: jest.fn() },
  };
  const service = new SubjectsService(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('deletes a subject that is not used anywhere', async () => {
    prisma.subject.findUnique.mockResolvedValue({
      _count: { classSubjects: 0, grades: 0, lectures: 0 },
    });

    await service.remove('s1');

    expect(prisma.subject.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('refuses to delete a subject that is still taught or graded', async () => {
    prisma.subject.findUnique.mockResolvedValue({
      _count: { classSubjects: 2, grades: 15, lectures: 0 },
    });

    await expect(service.remove('s1')).rejects.toThrow(ConflictException);
    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown subject', async () => {
    prisma.subject.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('SubjectsService.create', () => {
  const prisma = {
    subject: { findFirst: jest.fn(), groupBy: jest.fn(), create: jest.fn() },
  };
  const service = new SubjectsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.subject.findFirst.mockResolvedValue(null);
  });

  it('gives a new subject the colour fewest subjects have', async () => {
    prisma.subject.groupBy.mockResolvedValue(
      Object.values(SubjectColor)
        .filter((color) => color !== SubjectColor.TEAL)
        .map((color) => ({ color, _count: { _all: 1 } })),
    );

    await service.create({ name: 'Art' });

    expect(prisma.subject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Art',
          color: SubjectColor.TEAL,
          icon: SubjectIcon.PALETTE,
        },
      }),
    );
  });

  it('keeps the colour the admin picked', async () => {
    await service.create({
      name: 'Art',
      color: SubjectColor.PINK,
      icon: SubjectIcon.CAMERA,
    });

    expect(prisma.subject.groupBy).not.toHaveBeenCalled();
    expect(prisma.subject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Art',
          color: SubjectColor.PINK,
          icon: SubjectIcon.CAMERA,
        },
      }),
    );
  });
});

describe('iconForName', () => {
  it.each([
    ['Mathematics', SubjectIcon.CALCULATOR],
    ['Physical Education', SubjectIcon.DUMBBELL],
    ['Romanian Language and Literature', SubjectIcon.FEATHER],
    ['French', SubjectIcon.LANGUAGES],
    ['Computer Science', SubjectIcon.LAPTOP],
    ['Economics', SubjectIcon.TRENDING],
    ['Religion', SubjectIcon.CHURCH],
    ['Visual Arts', SubjectIcon.PALETTE],
    ['Party planning', SubjectIcon.BOOK],
  ])('%s gets %s', (name, icon) => {
    expect(iconForName(name)).toBe(icon);
  });

  it('does not mistake words that only contain "art" or "it"', () => {
    expect(iconForName('Martial studies')).toBe(SubjectIcon.BOOK);
    expect(iconForName('Writing')).toBe(SubjectIcon.FEATHER);
  });
});

describe('SubjectsService.remove with lectures', () => {
  const prisma = { subject: { findUnique: jest.fn(), delete: jest.fn() } };
  const service = new SubjectsService(prisma as unknown as PrismaService);

  it('refuses to delete a subject that still has lectures', async () => {
    prisma.subject.findUnique.mockResolvedValue({
      _count: { classSubjects: 0, grades: 0, lectures: 2 },
    });
    await expect(service.remove('s1')).rejects.toThrow(
      'Subject has 2 lecture(s). Delete them first.',
    );
    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });
});
