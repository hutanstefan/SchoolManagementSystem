import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import {
  ClassSummaryDto,
  PersonSummaryDto,
  SubjectSummaryDto,
} from '../../common/dto/summaries.dto';

/** The text fields of the upload; the photos arrive through multer. */
export class ScanTestsDto {
  /** The subject the tests are for. */
  @IsUUID()
  subjectId!: string;
}

export class ScannedTestDto {
  /** Position of the photo in the upload, from 0. */
  index!: number;
  /** @example IMG_2041.jpg */
  fileName!: string;

  /** "read" when the photo was read, "failed" when it could not be. */
  @ApiProperty({ enum: ['read', 'failed'] })
  status!: 'read' | 'failed';
  /** Why the photo could not be read. */
  error!: string | null;

  /** The student the test belongs to, if found in the class. */
  student!: PersonSummaryDto | null;
  /** The name as written on the test. @example Popescu Ioana */
  studentNameRead!: string | null;
  /** The grade as written on the test, possibly with decimals. @example 9.5 */
  gradeRead!: number | null;
  /** The grade to give: a whole number from 1 to 10. @example 10 */
  grade!: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low'] })
  confidence!: 'high' | 'medium' | 'low';
  /** Anything the teacher should check. */
  note!: string | null;
  /** The model that read this photo (a fallback model if the main one was busy). */
  readBy!: string | null;
}

export class GradeScanResultDto {
  /** "ai" when an AI model read the photos, "demo" when the results are simulated. */
  @ApiProperty({ enum: ['ai', 'demo'] })
  mode!: 'ai' | 'demo';
  /** The AI model that read the photos. @example gemini-3.8-flash */
  model!: string | null;
  class!: ClassSummaryDto;
  subject!: SubjectSummaryDto;
  /** One entry per photo, in upload order. Nothing is saved yet. */
  tests!: ScannedTestDto[];
}
