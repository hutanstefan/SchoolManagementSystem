import ExcelJS from 'exceljs';
import { nameTokens } from '../grades/matching';
import { parseRegistrationNumber } from '../students/registration-number';

/** A cell as read from a spreadsheet, normalised. */
export type Cell = string | number | Date | null;

/** Reads the first sheet (or the one called "Grades") as rows of cells. */
export async function readXlsx(data: Buffer): Promise<Cell[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet('Grades') ?? workbook.worksheets[0];
  if (!sheet) return [];

  const rows: Cell[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: Cell[] = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cells[column - 1] = normaliseCell(cell.value);
    });
    rows[rowNumber - 1] = Array.from(cells, (cell) => cell ?? null);
  });
  return Array.from(rows, (row) => row ?? []);
}

function normaliseCell(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value instanceof Date) return value;
  if (typeof value === 'boolean') return String(value);
  if ('result' in value) return normaliseCell(value.result);
  if ('richText' in value) return value.richText.map((r) => r.text).join('');
  if ('text' in value) return String(value.text);
  return null;
}

/** Reads a CSV file (comma or semicolon separated, as Excel saves it in Romania). */
export function readCsv(data: Buffer): Cell[][] {
  const text = data.toString('utf8').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field.trim() || null);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim() || null);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field.trim() || null);
    rows.push(row);
  }
  return rows;
}

export interface Columns {
  grade: number;
  class?: number;
  /** Registration number (nr. matricol). */
  registrationNumber?: number;
  lastName?: number;
  firstName?: number;
  /** "Name" / "Student": first and last name in one cell. */
  name?: number;
  date?: number;
}

const HEADERS: Record<keyof Columns, string[]> = {
  grade: ['grade', 'nota', 'mark'],
  class: ['class', 'clasa'],
  registrationNumber: [
    'reg no',
    'registration number',
    'registration no',
    'nr matricol',
    'numar matricol',
    'matricol',
  ],
  lastName: ['last name', 'surname', 'nume de familie', 'nume'],
  firstName: ['first name', 'prenume'],
  name: ['name', 'student', 'elev', 'nume si prenume', 'full name'],
  date: ['date', 'data'],
};

/** "Nume și prenume" -> "nume si prenume" */
function headerKey(cell: Cell): string {
  return typeof cell === 'string' ? nameTokens(cell).join(' ') : '';
}

/**
 * Finds the header row (one of the first 10 rows with a "Grade" column) and
 * where each column is. Works with the template and with most sheets a
 * teacher would make (English or Romanian headers, any column order).
 */
export function findColumns(
  rows: Cell[][],
): { headerRow: number; columns: Columns } | null {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const keys = (rows[r] ?? []).map(headerKey);
    const find = (field: keyof Columns) => {
      const index = keys.findIndex((key) => HEADERS[field].includes(key));
      return index === -1 ? undefined : index;
    };
    const grade = find('grade');
    if (grade === undefined) continue;
    return {
      headerRow: r,
      columns: {
        grade,
        class: find('class'),
        registrationNumber: find('registrationNumber'),
        lastName: find('lastName'),
        firstName: find('firstName'),
        name: find('name'),
        date: find('date'),
      },
    };
  }
  return null;
}

/** "2026-0042", "2026/42" -> "2026-0042"; "" -> null; "A12" -> undefined */
export function parseRegistrationNumberCell(
  cell: Cell,
): string | null | undefined {
  if (cell === null || cell === '') return null;
  if (cell instanceof Date) return undefined;
  const text = String(cell).trim();
  if (text === '') return null;
  return parseRegistrationNumber(text) ?? undefined;
}

/** "9 a", "9-A" and "9A" are the same class. */
export function classKey(name: string): string {
  return name.replace(/[\s.-]+/g, '').toUpperCase();
}

/** 9 -> 9, "7,50" -> 7.5, "" -> null, "ten" -> NaN */
export function parseGradeCell(cell: Cell): number | null {
  if (cell === null || cell === '') return null;
  if (typeof cell === 'number') return cell;
  if (cell instanceof Date) return Number.NaN;
  const text = cell.trim().replace(',', '.');
  return text === '' ? null : Number(text);
}

/**
 * A date cell as YYYY-MM-DD: a real date, "2026-10-21", "21.10.2026",
 * "21/10/2026" or "21-10-2026". Undefined when it can't be read.
 */
export function parseDateCell(cell: Cell): string | null | undefined {
  if (cell === null || cell === '') return null;
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime())
      ? undefined
      : cell.toISOString().slice(0, 10);
  }
  const text = String(cell).trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const roMatch = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  const [year, month, day] = isoMatch
    ? [isoMatch[1], isoMatch[2], isoMatch[3]]
    : roMatch
      ? [roMatch[3], roMatch[2], roMatch[1]]
      : [];
  if (!year || !month || !day) return undefined;

  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso
    ? undefined
    : iso;
}

/** True for an .xlsx file (a ZIP archive), from its first bytes. */
export function isXlsx(data: Buffer): boolean {
  return (
    data.length > 4 &&
    data[0] === 0x50 &&
    data[1] === 0x4b &&
    data[2] === 0x03 &&
    data[3] === 0x04
  );
}
