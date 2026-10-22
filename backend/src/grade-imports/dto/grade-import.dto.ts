import { IsOptional, IsUUID } from 'class-validator';
import {
  ClassSummaryDto,
  SubjectSummaryDto,
} from '../../common/dto/summaries.dto';

export class GradeTemplateQueryDto {
  /** The subject the grades are for. */
  @IsUUID()
  subjectId!: string;

  /** One class; leave it out for every class where the user can grade the subject. */
  @IsOptional()
  @IsUUID()
  classId?: string;
}

/** The text fields of the upload; the file arrives through multer. */
export class ImportGradesDto {
  /** The subject the grades are for. */
  @IsUUID()
  subjectId!: string;

  /** One class; leave it out to import for every class where the user can grade the subject. */
  @IsOptional()
  @IsUUID()
  classId?: string;
}

/** A subject the user can import grades for, and in which classes. */
export class GradeImportOptionDto {
  subject!: SubjectSummaryDto;
  /** In natural order (9A before 10A). */
  classes!: ClassSummaryDto[];
}

export class ImportStudentDto {
  id!: string;
  /** Number in the school register (nr. matricol). @example 2026-0042 */
  registrationNumber!: string;
  /** @example Ioana */
  firstName!: string;
  /** @example Popescu */
  lastName!: string;
  class!: ClassSummaryDto;
}

export class ImportedGradeRowDto {
  /** Row number in the spreadsheet, as Excel shows it. @example 5 */
  rowNumber!: number;
  /** The class as written in the file. @example 9A */
  classRead!: string | null;
  /** The registration number as written in the file. @example 2026-42 */
  registrationNumberRead!: string | null;
  /** The student as written in the file. @example Popescu Ioana */
  studentNameRead!: string | null;
  /** The grade as written in the file. @example 7,50 */
  gradeRead!: string | null;
  /** The grade to give: a whole number from 1 to 10. @example 8 */
  grade!: number | null;
  /** The date from the file (YYYY-MM-DD), or null to use the date chosen on the page. */
  date!: string | null;
  /** The student the row belongs to, if found. */
  student!: ImportStudentDto | null;
  /** Anything the teacher should check. */
  note!: string | null;
}

export class GradeImportResultDto {
  subject!: SubjectSummaryDto;
  /** The classes of the import: the one asked for, or every class where the user can grade the subject. */
  classes!: ClassSummaryDto[];
  /** Every student of those classes, to fix a row matched to the wrong student. */
  students!: ImportStudentDto[];
  /** @example grades-9A-Mathematics.xlsx */
  fileName!: string;
  /** Rows with a grade, in file order. Nothing is saved yet. */
  rows!: ImportedGradeRowDto[];
  /** Rows without a grade (students who weren't graded), left out. */
  skippedRows!: number;
}
