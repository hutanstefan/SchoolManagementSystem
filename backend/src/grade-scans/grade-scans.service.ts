import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/auth.types';
import type { Env } from '../config/env.validation';
import { GradesService } from '../grades/grades.service';
import { PrismaService } from '../prisma/prisma.service';
import { GradeScanResultDto, ScannedTestDto } from './dto/grade-scan.dto';
import { detectImageType } from './image-type';
import { statusOf } from './readers/ai-errors';
import {
  findStudentByName,
  lowerConfidence,
  nameMatches,
  toWholeGrade,
} from './matching';
import {
  TEST_READER,
  type ReadContext,
  type RosterEntry,
  type TestReader,
  type TestReading,
} from './readers/test-reader';

/** Upload limits (also enforced by multer in the controller). */
export const MAX_SCAN_IMAGES = 20;
export const MAX_SCAN_IMAGE_BYTES = 8 * 1024 * 1024;

export interface UploadedImage {
  originalname: string;
  buffer: Buffer;
}

@Injectable()
export class GradeScansService {
  private readonly logger = new Logger(GradeScansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly grades: GradesService,
    @Inject(TEST_READER) private readonly reader: TestReader,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Reads the student and the grade from photos of graded tests. Nothing is
   * saved and the photos are not stored: the teacher reviews the results and
   * saves them with POST /classes/:id/grades.
   */
  async scan(
    user: AuthUser,
    classId: string,
    subjectId: string,
    images: UploadedImage[],
  ): Promise<GradeScanResultDto> {
    const { className, subjectName } = await this.grades.assertCanGrade(
      user,
      classId,
      subjectId,
    );

    if (images.length === 0) {
      throw new BadRequestException('Upload at least one photo of a test');
    }
    if (images.length > MAX_SCAN_IMAGES) {
      throw new BadRequestException(
        `Upload at most ${MAX_SCAN_IMAGES} photos at a time`,
      );
    }
    const typed = images.map((image) => ({
      ...image,
      mediaType: detectImageType(image.buffer),
    }));
    const unsupported = typed.filter((image) => image.mediaType === null);
    if (unsupported.length > 0) {
      throw new BadRequestException(
        `Not a JPEG, PNG, WebP or GIF image: ${unsupported
          .map((image) => image.originalname)
          .join(', ')}`,
      );
    }

    const students = await this.prisma.student.findMany({
      where: { classId },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    const roster: RosterEntry[] = students.map((s, index) => ({
      number: index + 1,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
    }));
    const context: ReadContext = { className, subjectName, roster };

    // Photos read in parallel: fast, without flooding the AI API.
    const concurrency = this.config.get('AI_CONCURRENCY', { infer: true });
    const tests = await mapWithConcurrency(
      typed,
      concurrency,
      async (image, index) => {
        const base = { index, fileName: image.originalname };
        try {
          const reading = await this.reader.read(
            {
              data: image.buffer,
              mediaType: image.mediaType!,
              fileName: image.originalname,
            },
            context,
          );
          return { ...base, ...this.interpret(reading, roster, students) };
        } catch (error) {
          this.logger.warn(
            `Could not read ${image.originalname}: ${error instanceof Error ? error.message : String(error)}`,
          );
          return failed(base, readErrorMessage(error));
        }
      },
    );

    return {
      mode: this.reader.mode,
      model: this.reader.model,
      class: { id: classId, name: className },
      subject: { id: subjectId, name: subjectName },
      tests,
    };
  }

  /**
   * Checks what the reader returned instead of trusting it: the roster number
   * must exist, the name on the paper must fit the student, and the grade must
   * be a valid grade.
   */
  private interpret(
    reading: TestReading,
    roster: RosterEntry[],
    students: { id: string }[],
  ): Omit<ScannedTestDto, 'index' | 'fileName'> {
    const notes: string[] = reading.note ? [reading.note] : [];
    let confidence = reading.confidence;

    let entry = roster.find((s) => s.number === reading.rosterNumber) ?? null;
    if (
      entry &&
      reading.studentName &&
      !nameMatches(reading.studentName, entry)
    ) {
      confidence = 'low';
      notes.push(
        `The name on the test doesn't look like ${entry.firstName} ${entry.lastName}.`,
      );
    }
    if (!entry && reading.studentName) {
      entry = findStudentByName(reading.studentName, roster);
      if (entry) confidence = lowerConfidence(confidence, 'medium');
    }
    if (!entry) notes.push('No student of the class matched.');

    const grade = toWholeGrade(reading.grade);
    if (reading.grade !== null && grade === null) {
      notes.push(`${reading.grade} is not a valid grade.`);
    } else if (reading.grade === null) {
      notes.push('No final grade found on the test.');
    }

    const student = entry ? students[entry.number - 1] : null;
    return {
      status: 'read',
      error: null,
      student:
        entry && student
          ? {
              id: student.id,
              firstName: entry.firstName,
              lastName: entry.lastName,
            }
          : null,
      studentNameRead: reading.studentName,
      gradeRead: reading.grade,
      grade,
      confidence,
      note: notes.length > 0 ? notes.join(' ') : null,
      readBy: reading.readBy ?? this.reader.model,
    };
  }
}

function failed(
  base: { index: number; fileName: string },
  error: string,
): ScannedTestDto {
  return {
    ...base,
    status: 'failed',
    error,
    student: null,
    studentNameRead: null,
    gradeRead: null,
    grade: null,
    confidence: 'low',
    note: null,
    readBy: null,
  };
}

/** A message for the teacher; details stay in the server log. */
function readErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === 401 || status === 403) {
    return 'The AI service rejected the API key.';
  }
  if (status === 429 || status === 503 || status === 529) {
    return 'The AI service is busy or its limit was reached. Retry this photo in a minute.';
  }
  if (status === 400) {
    return 'The AI service could not process this photo.';
  }
  return 'The photo could not be read. Try again or enter the grade by hand.';
}

/** Like Promise.all over items.map(fn), but runs at most `limit` at a time. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
