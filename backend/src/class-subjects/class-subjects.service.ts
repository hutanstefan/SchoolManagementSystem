import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { personSelect, toPerson } from '../common/mappers';
import { ClassSubjectSummaryDto } from '../classes/dto/class.dto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializableTransaction } from '../prisma/serializable-transaction';
import { assertTeacherIsFree } from '../timetable/timetable-conflicts';
import {
  CreateClassSubjectDto,
  UpdateClassSubjectDto,
} from './dto/class-subject.dto';

const classSubjectSelect = {
  id: true,
  hoursPerWeek: true,
  subject: { select: { id: true, name: true } },
  teacher: { select: personSelect },
} as const satisfies Prisma.ClassSubjectSelect;

type ClassSubjectRow = Prisma.ClassSubjectGetPayload<{
  select: typeof classSubjectSelect;
}>;

/** Teaching assignments: which subjects a class studies, who teaches them, how many hours. */
@Injectable()
export class ClassSubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    classId: string,
    dto: CreateClassSubjectDto,
  ): Promise<ClassSubjectSummaryDto> {
    const [schoolClass, subject] = await Promise.all([
      this.prisma.class.findUnique({
        where: { id: classId },
        select: { name: true },
      }),
      this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
        select: { name: true },
      }),
    ]);
    if (!schoolClass) throw new NotFoundException('Class not found');
    if (!subject) throw new NotFoundException('Subject not found');
    if (dto.teacherId) await this.assertTeacherExists(dto.teacherId);

    const existing = await this.prisma.classSubject.findUnique({
      where: {
        classId_subjectId: { classId, subjectId: dto.subjectId },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `${subject.name} is already taught in ${schoolClass.name}`,
      );
    }

    const created = await this.prisma.classSubject.create({
      data: {
        classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        hoursPerWeek: dto.hoursPerWeek,
      },
      select: classSubjectSelect,
    });
    return toSummary(created);
  }

  /**
   * Changes the teacher or the weekly hours. Both changes are checked against
   * the timetable, inside one serializable transaction.
   */
  async update(
    id: string,
    dto: UpdateClassSubjectDto,
  ): Promise<ClassSubjectSummaryDto> {
    if (dto.teacherId) await this.assertTeacherExists(dto.teacherId);

    return serializableTransaction(this.prisma, async (tx) => {
      const current = await tx.classSubject.findUnique({
        where: { id },
        select: {
          teacherId: true,
          class: { select: { name: true } },
          subject: { select: { name: true } },
          timetableEntries: { select: { id: true, day: true, period: true } },
        },
      });
      if (!current) throw new NotFoundException('Class subject not found');

      const scheduled = current.timetableEntries.length;
      if (dto.hoursPerWeek !== undefined && dto.hoursPerWeek < scheduled) {
        throw new ConflictException(
          `${current.subject.name} has ${scheduled} lessons in the ${current.class.name} timetable. ` +
            `Remove ${scheduled - dto.hoursPerWeek} of them before lowering the hours to ${dto.hoursPerWeek}.`,
        );
      }

      // The new teacher must be free at every time this subject is scheduled.
      if (dto.teacherId && dto.teacherId !== current.teacherId) {
        for (const entry of current.timetableEntries) {
          await assertTeacherIsFree(tx, dto.teacherId, {
            day: entry.day,
            period: entry.period,
            excludeEntryId: entry.id,
          });
        }
      }

      const updated = await tx.classSubject.update({
        where: { id },
        data: { teacherId: dto.teacherId, hoursPerWeek: dto.hoursPerWeek },
        select: classSubjectSelect,
      });
      return toSummary(updated);
    });
  }

  /** Removes the subject from the class with its lessons. Grades are kept. */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.classSubject.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Class subject not found');
    await this.prisma.classSubject.delete({ where: { id } });
  }

  private async assertTeacherExists(teacherId: string): Promise<void> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
  }
}

function toSummary(row: ClassSubjectRow): ClassSubjectSummaryDto {
  return {
    classSubjectId: row.id,
    subject: row.subject,
    teacher: toPerson(row.teacher),
    hoursPerWeek: row.hoursPerWeek,
  };
}
