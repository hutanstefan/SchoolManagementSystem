import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { StudentsService } from './students.service';

describe('StudentsService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    class: { findUnique: jest.fn() },
    student: { create: jest.fn(), findFirst: jest.fn() },
  };
  const service = new StudentsService(
    prisma as unknown as PrismaService,
    new UsersService(prisma as unknown as PrismaService),
  );

  const dto = {
    email: 'new@school.test',
    password: 'Welcome123',
    firstName: 'Ion',
    lastName: 'Nou',
    dateOfBirth: '2011-02-03',
  };

  const createdRow = {
    id: 'student-1',
    registrationNumber: '2026-0042',
    dateOfBirth: new Date('2011-02-03T00:00:00.000Z'),
    class: null,
    user: {
      id: 'user-1',
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      createdAt: new Date(),
    },
  };

  beforeEach(() => jest.resetAllMocks());

  it('creates the user account and the student profile together', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.student.findFirst.mockResolvedValue({
      registrationNumber: '2026-0041',
    });
    prisma.student.create.mockResolvedValue(createdRow);

    const result = await service.create(dto);

    const { data } = prisma.student.create.mock.calls[0][0];
    // The next number of this year, after the highest one.
    expect(data.registrationNumber).toMatch(/^\d{4}-\d{4}$/);
    expect(data.user.create).toMatchObject({
      email: dto.email,
      role: 'STUDENT',
      firstName: 'Ion',
    });
    // The password is stored hashed, never in plain text.
    expect(data.user.create.passwordHash).not.toBe(dto.password);
    expect(
      await bcrypt.compare(dto.password, data.user.create.passwordHash),
    ).toBe(true);
    expect(result).toMatchObject({
      id: 'student-1',
      registrationNumber: '2026-0042',
      dateOfBirth: '2011-02-03',
    });
  });

  it('takes the next number when another student got that one first', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.student.findFirst
      .mockResolvedValueOnce({ registrationNumber: '2026-0041' })
      .mockResolvedValueOnce({ registrationNumber: '2026-0042' });
    prisma.student.create
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      )
      .mockResolvedValueOnce(createdRow);

    await service.create(dto);

    expect(prisma.student.create).toHaveBeenCalledTimes(2);
    const second = prisma.student.create.mock.calls[1][0].data;
    expect(second.registrationNumber.slice(5)).toBe('0043');
  });

  it('rejects an email that is already used', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'someone-else' });

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(prisma.student.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown class', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.class.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ ...dto, classId: 'missing-class' }),
    ).rejects.toThrow(new NotFoundException('Class not found'));
  });
});
