import { ConflictException, NotFoundException } from '@nestjs/common';
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
      _count: { classSubjects: 0, grades: 0 },
    });

    await service.remove('s1');

    expect(prisma.subject.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('refuses to delete a subject that is still taught or graded', async () => {
    prisma.subject.findUnique.mockResolvedValue({
      _count: { classSubjects: 2, grades: 15 },
    });

    await expect(service.remove('s1')).rejects.toThrow(ConflictException);
    expect(prisma.subject.delete).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown subject', async () => {
    prisma.subject.findUnique.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});
