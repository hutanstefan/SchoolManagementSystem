import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import {
  PersonSummaryDto,
  SubjectSummaryDto,
} from '../../common/dto/summaries.dto';

export class CreateClassDto {
  /**
   * Trimmed and upper-cased, so "9a" becomes "9A".
   * @example 9C
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[0-9A-Z][0-9A-Z -]*$/, {
    message: 'name may only contain letters, digits, spaces and dashes',
  })
  name!: string;

  /** Homeroom teacher (diriginte). Omit or send null for none. */
  @IsOptional()
  @IsUUID()
  homeroomTeacherId?: string | null;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}

export const CLASS_SORT_FIELDS = ['name', 'createdAt'] as const;

export class ClassQueryDto extends PaginationQueryDto {
  /** Field to sort by. */
  @ApiPropertyOptional({ enum: CLASS_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(CLASS_SORT_FIELDS)
  sort: (typeof CLASS_SORT_FIELDS)[number] = 'name';
}

export class AssignStudentsDto {
  /** Students to move into the class (they leave their current class, if any). */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  studentIds!: string[];
}

export class ClassDto {
  id!: string;
  /** @example 9A */
  name!: string;
  /** Homeroom teacher (diriginte), or null. */
  homeroomTeacher!: PersonSummaryDto | null;
  /** @example 10 */
  studentCount!: number;
  createdAt!: Date;
}

export class ClassSubjectSummaryDto {
  classSubjectId!: string;
  subject!: SubjectSummaryDto;
  /** Null while nobody is assigned to teach it. */
  teacher!: PersonSummaryDto | null;
  /** @example 4 */
  hoursPerWeek!: number;
}

export class ClassDetailDto extends ClassDto {
  /** Subjects studied by the class and who teaches each one. */
  subjects!: ClassSubjectSummaryDto[];
}

export class PaginatedClassesDto {
  data!: ClassDto[];
  meta!: PaginationMetaDto;
}
