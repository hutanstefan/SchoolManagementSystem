import { subjectSummarySelect } from '../common/mappers';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { AuthUser } from '../auth/auth.types';
import { compareClassNames } from '../classes/class-names';
import type {
  ClassSummaryDto,
  SubjectSummaryDto,
} from '../common/dto/summaries.dto';
import { todayInSchool } from '../common/dates';
import { Prisma, Role, SchoolYearStatus } from '../generated/prisma/client';
import { GradesService } from '../grades/grades.service';
import { nameMatches, studentsNamed, toWholeGrade } from '../grades/matching';
import { PrismaService } from '../prisma/prisma.service';
import {
  GradeImportOptionDto,
  GradeImportResultDto,
  ImportedGradeRowDto,
  ImportStudentDto,
} from './dto/grade-import.dto';
import {
  type Cell,
  classKey,
  type Columns,
  findColumns,
  isXlsx,
  parseDateCell,
  parseGradeCell,
  parseRegistrationNumberCell,
  readCsv,
  readXlsx,
} from './spreadsheet';
import { assertSafeZip, UnsafeZipError } from './zip-guard';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 500;

/** The classes and students one import covers, for one subject. */
interface Scope {
  subject: SubjectSummaryDto;
  classes: ClassSummaryDto[];
  students: ImportStudentDto[];
}

/** Classes of the open school year: grades are only added there. */
const OPEN_YEAR = {
  schoolYear: { status: SchoolYearStatus.ACTIVE },
} as const satisfies Prisma.ClassWhereInput;

@Injectable()
export class GradeImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grades: GradesService,
  ) {}

  /**
   * The subjects the user can import grades for, each with its classes (of
   * the open school year: grades are only added there).
   */
  async options(user: AuthUser): Promise<GradeImportOptionDto[]> {
    const assignments = await this.prisma.classSubject.findMany({
      where: {
        class: OPEN_YEAR,
        ...(user.role === Role.TEACHER && { teacher: { userId: user.id } }),
      },
      select: {
        subject: { select: subjectSummarySelect },
        class: { select: { id: true, name: true } },
      },
    });
    const bySubject = new Map<string, GradeImportOptionDto>();
    for (const { subject, class: schoolClass } of assignments) {
      const option = bySubject.get(subject.id) ?? { subject, classes: [] };
      option.classes.push(schoolClass);
      bySubject.set(subject.id, option);
    }
    return [...bySubject.values()]
      .sort((a, b) => a.subject.name.localeCompare(b.subject.name))
      .map((option) => ({
        ...option,
        classes: option.classes.sort((a, b) =>
          compareClassNames(a.name, b.name),
        ),
      }));
  }

  /**
   * An .xlsx gradebook for one subject, for one class or for every class the
   * user can grade it in: class, registration number and name of every
   * student are filled in, the teacher types the grades (and optionally the
   * dates) and uploads it. No ids: the registration number is the key.
   */
  async template(
    user: AuthUser,
    subjectId: string,
    classId: string | undefined,
  ): Promise<{ fileName: string; data: Buffer }> {
    const { subject, classes, students } = await this.scope(
      user,
      subjectId,
      classId,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'School Management System';
    const sheet = workbook.addWorksheet('Grades', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = [
      { header: 'Class', key: 'class', width: 8 },
      { header: 'Reg. no.', key: 'registrationNumber', width: 10 },
      { header: 'Last name', key: 'lastName', width: 22 },
      { header: 'First name', key: 'firstName', width: 22 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Date', key: 'date', width: 14 },
    ];
    for (const s of students) {
      sheet.addRow({
        class: s.class.name,
        registrationNumber: s.registrationNumber,
        lastName: s.lastName,
        firstName: s.firstName,
      });
    }

    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFEFEF' },
    };
    // Lets the teacher show one class at a time in a file for all classes.
    sheet.autoFilter = { from: 'A1', to: 'F1' };
    for (let r = 2; r <= students.length + 1; r++) {
      sheet.getCell(`E${r}`).dataValidation = {
        type: 'whole',
        operator: 'between',
        formulae: [1, 10],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Grade',
        error: 'A whole number from 1 to 10',
      };
      sheet.getCell(`F${r}`).numFmt = 'yyyy-mm-dd';
    }

    const classNames = classes.map((c) => c.name).join(', ');
    const help = workbook.addWorksheet('How to fill in');
    help.getColumn(1).width = 100;
    [
      `Grades in ${subject.name} for ${classes.length === 1 ? 'class' : 'classes'} ${classNames}.`,
      '',
      '1. Type each grade (a whole number from 1 to 10) in the Grade column. Leave it empty for students without a grade.',
      '2. The Date column is optional: leave it empty to use the date chosen when uploading.',
      '3. Each row is matched to a student by the registration number (Reg. no., the number in the school register). Without one, by class and name.',
      '4. You can sort, filter or delete rows. Save the file and upload it on the "Import grades" page: you check every grade before it is saved.',
    ].forEach((line) => help.addRow([line]));

    const data = Buffer.from(await workbook.xlsx.writeBuffer());
    const what = classes.length === 1 ? classes[0].name : 'all-classes';
    return {
      fileName: safeFileName(`grades-${what}-${subject.name}.xlsx`),
      data,
    };
  }

  /**
   * Reads grades from an .xlsx or .csv file and matches every row to a
   * student: by registration number, else by class and name. Nothing is
   * saved: the teacher reviews the rows and saves them with POST /grades/batch.
   */
  async preview(
    user: AuthUser,
    subjectId: string,
    classId: string | undefined,
    file: { originalname: string; buffer: Buffer } | undefined,
  ): Promise<GradeImportResultDto> {
    const scope = await this.scope(user, subjectId, classId);
    if (!file) throw new BadRequestException('Upload an .xlsx or .csv file');

    const isCsv = /\.csv$/i.test(file.originalname);
    if (!isXlsx(file.buffer) && !isCsv) {
      throw new BadRequestException(
        'Upload the .xlsx template (or a .csv file)',
      );
    }
    if (isXlsx(file.buffer)) {
      try {
        assertSafeZip(file.buffer);
      } catch (error) {
        if (!(error instanceof UnsafeZipError)) throw error;
        throw new BadRequestException(
          `${error.message}. Upload the .xlsx template (or a .csv file).`,
        );
      }
    }
    let rows: Cell[][];
    try {
      rows = isXlsx(file.buffer)
        ? await readXlsx(file.buffer)
        : readCsv(file.buffer);
    } catch {
      throw new BadRequestException(
        'The file could not be read. Save it again as .xlsx and retry.',
      );
    }

    const found = findColumns(rows);
    if (!found) {
      throw new BadRequestException(
        'No "Grade" column found. Use the template, or add a header row with Grade and the student names.',
      );
    }
    const { headerRow, columns } = found;
    if (
      columns.registrationNumber === undefined &&
      columns.name === undefined &&
      columns.lastName === undefined
    ) {
      throw new BadRequestException(
        'No student column found: add "Reg. no." or "Last name" and "First name" columns.',
      );
    }

    const today = todayInSchool();
    const result: ImportedGradeRowDto[] = [];
    let skippedRows = 0;

    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      if (row.every((cell) => cell === null || cell === '')) continue;
      const gradeCell = row[columns.grade] ?? null;
      if (gradeCell === null || gradeCell === '') {
        skippedRows++;
        continue;
      }
      if (result.length === MAX_IMPORT_ROWS) {
        throw new BadRequestException(
          `At most ${MAX_IMPORT_ROWS} grades can be imported at once`,
        );
      }
      result.push(readRow(r + 1, row, columns, scope, today));
    }

    return {
      subject: scope.subject,
      classes: scope.classes,
      students: scope.students,
      fileName: file.originalname,
      rows: result,
      skippedRows,
    };
  }

  /**
   * One class (checked like any grade), or every class where the user can
   * grade the subject: all of them for an admin, the ones they teach it in
   * for a teacher.
   */
  private async scope(
    user: AuthUser,
    subjectId: string,
    classId: string | undefined,
  ): Promise<Scope> {
    let subject: Scope['subject'];
    let classes: ClassSummaryDto[];

    if (classId) {
      const checked = await this.grades.assertCanGrade(
        user,
        classId,
        subjectId,
      );
      subject = checked.subject;
      classes = [{ id: classId, name: checked.className }];
    } else {
      const found = await this.prisma.subject.findUnique({
        where: { id: subjectId },
        select: subjectSummarySelect,
      });
      if (!found) throw new NotFoundException('Subject not found');
      subject = found;
      const assignments = await this.prisma.classSubject.findMany({
        where: {
          subjectId,
          class: OPEN_YEAR,
          ...(user.role === Role.TEACHER && {
            teacher: { userId: user.id },
          }),
        },
        select: { class: { select: { id: true, name: true } } },
      });
      if (assignments.length === 0) {
        throw user.role === Role.TEACHER
          ? new ForbiddenException(`You don't teach ${subject.name}`)
          : new BadRequestException(
              `${subject.name} is not taught in any class`,
            );
      }
      classes = assignments
        .map((a) => a.class)
        .sort((a, b) => compareClassNames(a.name, b.name));
    }

    const rows = await this.prisma.enrollment.findMany({
      where: { classId: { in: classes.map((c) => c.id) } },
      select: {
        classId: true,
        student: {
          select: {
            id: true,
            registrationNumber: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [
        { student: { user: { lastName: 'asc' } } },
        { student: { user: { firstName: 'asc' } } },
      ],
    });
    const order = new Map(classes.map((c, i) => [c.id, i]));
    const students = rows
      .map(({ classId, student: s }) => ({
        id: s.id,
        registrationNumber: s.registrationNumber,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        class: classes[order.get(classId)!],
      }))
      // Class by class, alphabetically within a class (sort is stable).
      .sort((a, b) => order.get(a.class.id)! - order.get(b.class.id)!);
    return { subject, classes, students };
  }
}

/**
 * Matches one row to a student and checks its grade and date. The
 * registration number is unique in the school, so it wins; the class and the
 * name are a fallback, and a cross-check when both are given.
 */
function readRow(
  rowNumber: number,
  row: Cell[],
  columns: Columns,
  scope: Scope,
  today: string,
): ImportedGradeRowDto {
  const notes: string[] = [];
  const text = (index: number | undefined) => {
    const cell = index === undefined ? null : (row[index] ?? null);
    return cell === null ? '' : String(cell).trim();
  };
  const fullName = (s: ImportStudentDto) => `${s.lastName} ${s.firstName}`;

  const name =
    text(columns.name) ||
    [text(columns.lastName), text(columns.firstName)].filter(Boolean).join(' ');
  const classRead = text(columns.class);
  const registrationRead = text(columns.registrationNumber);

  // The class, if the file has one.
  let rowClass: ClassSummaryDto | null = null;
  if (classRead) {
    rowClass =
      scope.classes.find((c) => classKey(c.name) === classKey(classRead)) ??
      null;
    if (!rowClass) {
      notes.push(
        `Class "${classRead}" is not part of this import (${scope.classes.map((c) => c.name).join(', ')}).`,
      );
    }
  }

  // The student: by registration number...
  let student: ImportStudentDto | null = null;
  let checkedByNumber = false;
  const registrationNumber =
    columns.registrationNumber === undefined
      ? null
      : parseRegistrationNumberCell(row[columns.registrationNumber] ?? null);
  if (registrationNumber === undefined) {
    notes.push(`"${registrationRead}" is not a registration number.`);
  } else if (registrationNumber !== null) {
    const byNumber = scope.students.find(
      (s) => s.registrationNumber === registrationNumber,
    );
    checkedByNumber = byNumber !== undefined;
    if (!byNumber) {
      // A typo in the number: the name below may still find the student.
      notes.push(
        `No student with reg. no. ${registrationNumber} in ${scope.classes.map((c) => c.name).join(', ')}.`,
      );
    } else if (name && !nameMatches(name, byNumber)) {
      // Either the number or the name is wrong: let the teacher decide.
      notes.push(
        `Reg. no. ${registrationNumber} is ${fullName(byNumber)}, not "${name}".`,
      );
    } else {
      student = byNumber;
      if (rowClass && byNumber.class.id !== rowClass.id) {
        notes.push(
          `${fullName(byNumber)} is in ${byNumber.class.name}, not ${rowClass.name}.`,
        );
      }
    }
  }

  // ...else by name, in the row's class if it has one.
  if (!student && !checkedByNumber && name) {
    const roster = rowClass
      ? scope.students.filter((s) => s.class.id === rowClass.id)
      : scope.students;
    const matches = studentsNamed(name, roster);
    if (matches.length === 1) {
      student = matches[0];
    } else if (matches.length > 1) {
      const where = [...new Set(matches.map((s) => s.class.name))].join(', ');
      notes.push(
        `${matches.length} students are called "${name}" (${where}): add the reg. no.${rowClass ? '' : ' or the class'}.`,
      );
    } else {
      notes.push(
        `No student${rowClass ? ` of ${rowClass.name}` : ''} matched "${name}".`,
      );
    }
  } else if (!student && !checkedByNumber && registrationNumber === null) {
    notes.push('No student name or reg. no. in this row.');
  }

  // The grade: 1-10, decimals rounded like averages (7.50 -> 8).
  const value = parseGradeCell(row[columns.grade] ?? null);
  const grade = toWholeGrade(value);
  if (grade === null) {
    notes.push(`"${text(columns.grade)}" is not a grade from 1 to 10.`);
  } else if (value !== grade) {
    notes.push(`${text(columns.grade)} rounded to ${grade}.`);
  }

  // The date: optional; invalid or future dates fall back to the page date.
  let date =
    columns.date === undefined
      ? null
      : parseDateCell(row[columns.date] ?? null);
  if (date === undefined) {
    notes.push(
      `"${text(columns.date)}" is not a date; the date below is used.`,
    );
    date = null;
  } else if (date !== null && date > today) {
    notes.push(`${date} is in the future; the date below is used.`);
    date = null;
  }

  return {
    rowNumber,
    classRead: classRead || null,
    registrationNumberRead: registrationRead || null,
    studentNameRead: name || null,
    gradeRead: text(columns.grade) || null,
    grade,
    date,
    student,
    note: notes.length > 0 ? notes.join(' ') : null,
  };
}

/** "grades-9A-Limba română.xlsx" -> "grades-9A-Limba-romana.xlsx" */
function safeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w.-]+/g, '-');
}
