import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubjectColor } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { iconForName } from './subject-icons';
import {
  CreateSubjectDto,
  SubjectDto,
  UpdateSubjectDto,
} from './dto/subject.dto';

const subjectSelect = {
  id: true,
  name: true,
  color: true,
  icon: true,
} as const;

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<SubjectDto[]> {
    return this.prisma.subject.findMany({
      select: subjectSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<SubjectDto> {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      select: subjectSelect,
    });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async create(dto: CreateSubjectDto): Promise<SubjectDto> {
    await this.assertNameIsFree(dto.name);
    return this.prisma.subject.create({
      data: {
        name: dto.name,
        color: dto.color ?? (await this.freeColor()),
        icon: dto.icon ?? iconForName(dto.name),
      },
      select: subjectSelect,
    });
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<SubjectDto> {
    await this.findOne(id);
    if (dto.name !== undefined) await this.assertNameIsFree(dto.name, id);
    return this.prisma.subject.update({
      where: { id },
      data: { name: dto.name, color: dto.color, icon: dto.icon },
      select: subjectSelect,
    });
  }

  /** A subject that is still taught somewhere or has grades cannot be deleted. */
  async remove(id: string): Promise<void> {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      select: {
        _count: {
          select: { classSubjects: true, grades: true, lectures: true },
        },
      },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const { classSubjects, grades, lectures } = subject._count;
    if (classSubjects > 0 || grades > 0) {
      throw new ConflictException(
        `Subject is still taught in ${classSubjects} class(es) and has ${grades} grade(s). ` +
          'Remove it from those classes and delete its grades first.',
      );
    }

    if (lectures > 0) {
      throw new ConflictException(
        `Subject has ${lectures} lecture(s). Delete them first.`,
      );
    }

    await this.prisma.subject.delete({ where: { id } });
  }

  /** The colour fewest subjects have, so new subjects look different. */
  private async freeColor(): Promise<SubjectColor> {
    const used = await this.prisma.subject.groupBy({
      by: ['color'],
      _count: { _all: true },
    });
    const count = (color: SubjectColor) =>
      used.find((u) => u.color === color)?._count._all ?? 0;
    return Object.values(SubjectColor).reduce((best, color) =>
      count(color) < count(best) ? color : best,
    );
  }

  private async assertNameIsFree(name: string, exceptId?: string) {
    const existing = await this.prisma.subject.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A subject with this name already exists');
    }
  }
}
