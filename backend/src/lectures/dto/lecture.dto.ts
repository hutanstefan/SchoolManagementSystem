import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import {
  ClassSummaryDto,
  PersonSummaryDto,
  SubjectSummaryDto,
} from '../../common/dto/summaries.dto';
import { LectureAccessAction } from '../../generated/prisma/enums';
import { ToBoolean, Trim } from '../../common/transformers';
import { OptionalNotNull } from '../../common/validators/optional-not-null';

export const MAX_LECTURE_STUDENTS = 2000;

/**
 * A list of ids sent in a multipart form: a JSON array ('["a","b"]') or
 * comma-separated ("a,b"). In a JSON body it is already an array.
 */
const IdList = () =>
  Transform(({ value }: { value: unknown }) => {
    if (Array.isArray(value) || typeof value !== 'string') return value;
    const text = value.trim();
    if (text.startsWith('[')) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return value;
      }
    }
    return text ? text.split(',').map((id) => id.trim()) : [];
  });

// ------------------------------------------------------------------- input

export class LectureQueryDto extends PickType(PaginationQueryDto, [
  'page',
  'pageSize',
]) {
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  /** Part of the title or the description. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateLectureDto {
  /** @example Quadratic equations: summary */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  /** @example Read it before Thursday's test. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** A subject the teacher teaches this year. */
  @IsUUID()
  subjectId!: string;

  /**
   * The students who may read it, from any class. In the multipart form: a
   * JSON array or a comma-separated list. Can be changed later.
   */
  @IdList()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LECTURE_STUDENTS)
  @IsUUID('all', { each: true })
  studentIds: string[] = [];
}

export class UpdateLectureDto {
  @OptionalNotNull()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  /** Send null or "" to remove it. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @OptionalNotNull()
  @IsUUID()
  subjectId?: string;
}

export class SetLectureStudentsDto {
  /**
   * Everyone who may read the lecture; replaces the list. The change is
   * kept in the lecture's access history.
   */
  @IsArray()
  @ArrayMaxSize(MAX_LECTURE_STUDENTS)
  @IsUUID('all', { each: true })
  studentIds!: string[];
}

export class LectureLinkQueryDto {
  /** true: the browser saves the file; false (default): it shows it. */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @ToBoolean()
  @IsIn([true, false])
  download?: boolean;
}

// ------------------------------------------------------------------ output

export class LectureStudentDto extends PersonSummaryDto {
  /** @example 2026-0042 */
  registrationNumber!: string;
  /** The student's class: this year's, or their last one (null if none). */
  class!: ClassSummaryDto | null;
}

export class LectureDto {
  id!: string;
  /** @example Quadratic equations: summary */
  title!: string;
  description!: string | null;
  subject!: SubjectSummaryDto;
  /** Whose library it is in; null if that teacher was deleted. */
  teacher!: PersonSummaryDto | null;
  /** @example quadratic-equations.pdf */
  fileName!: string;
  /** Bytes. @example 482113 */
  fileSize!: number;
  /** How many students can read it now (0 for students themselves). */
  studentCount!: number;
  /** The user can edit it, change who reads it and delete it. */
  canManage!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedLecturesDto {
  /** Newest first. */
  data!: LectureDto[];
  meta!: PaginationMetaDto;
  /** Every subject the user has lectures in (all pages), for filters. */
  subjects!: SubjectSummaryDto[];
}

export class LectureDetailDto extends LectureDto {
  /** Who can read it now; only for the teacher whose lecture it is and admins. */
  students!: LectureStudentDto[];
}

export class LectureHistoryQueryDto extends PickType(PaginationQueryDto, [
  'page',
  'pageSize',
]) {}

/** The person who changed who can read a lecture. */
export class LectureActorDto {
  /** The user id. */
  id!: string;
  firstName!: string;
  lastName!: string;
}

/** One change of who can read a lecture: several students at once. */
export class LectureAccessChangeDto {
  /** When it happened. */
  at!: Date;
  @ApiProperty({ enum: LectureAccessAction, enumName: 'LectureAccessAction' })
  action!: LectureAccessAction;
  /** Who did it; null if that user was deleted or for changes made by the system. */
  actor!: LectureActorDto | null;
  students!: LectureStudentDto[];
}

export class LectureHistoryDto {
  /** Newest first. */
  data!: LectureAccessChangeDto[];
  meta!: PaginationMetaDto;
}

export class FileLinkDto {
  /** Open it right away: it stops working after `expiresAt`. */
  url!: string;
  expiresAt!: Date;
}

export class LectureFileDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: unknown;
}
