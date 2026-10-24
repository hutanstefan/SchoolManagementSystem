import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/transformers';
import { SubjectColor } from '../../generated/prisma/enums';

export class CreateSubjectDto {
  /** @example Computer Science */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  /**
   * Colour of the subject everywhere it is shown (lists, timetables, charts).
   * When omitted, the colour used by the fewest subjects is picked.
   */
  @ApiPropertyOptional({ enum: SubjectColor, enumName: 'SubjectColor' })
  @IsOptional()
  @IsEnum(SubjectColor)
  color?: SubjectColor;
}

/** Rename a subject, change its colour, or both. */
export class UpdateSubjectDto extends PartialType(CreateSubjectDto, {
  skipNullProperties: false,
}) {}

export class SubjectDto {
  id!: string;
  /** @example Mathematics */
  name!: string;
  @ApiProperty({ enum: SubjectColor, enumName: 'SubjectColor' })
  color!: SubjectColor;
}
