import {
  classKey,
  findColumns,
  isXlsx,
  parseRegistrationNumberCell,
  parseDateCell,
  parseGradeCell,
  readCsv,
} from './spreadsheet';

describe('reading spreadsheets', () => {
  it('reads CSV with commas or semicolons, quotes and a BOM', () => {
    expect(readCsv(Buffer.from('﻿Name,Grade\n"Popescu, Ioana",9\n'))).toEqual([
      ['Name', 'Grade'],
      ['Popescu, Ioana', '9'],
    ]);
    expect(readCsv(Buffer.from('Nume;Nota\r\nPopescu Ioana;7,50\r\n'))).toEqual(
      [
        ['Nume', 'Nota'],
        ['Popescu Ioana', '7,50'],
      ],
    );
  });

  it('finds the header row and columns in English or Romanian, in any order', () => {
    expect(
      findColumns([['Catalog 9A'], [], ['Nota', 'Prenume', 'Nume', 'Data']]),
    ).toEqual({
      headerRow: 2,
      columns: {
        grade: 0,
        firstName: 1,
        lastName: 2,
        date: 3,
        class: undefined,
        registrationNumber: undefined,
        name: undefined,
      },
    });
    expect(
      findColumns([
        ['Class', 'Reg. no.', 'Last name', 'First name', 'Grade', 'Date'],
      ])?.columns,
    ).toMatchObject({
      class: 0,
      registrationNumber: 1,
      lastName: 2,
      firstName: 3,
      grade: 4,
      date: 5,
    });
    expect(
      findColumns([['Clasa', 'Nr. matricol', 'Nume și prenume', 'Notă']])
        ?.columns,
    ).toMatchObject({ class: 0, registrationNumber: 1, name: 2, grade: 3 });
    expect(findColumns([['Name', 'Points']])).toBeNull();
  });

  it('reads registration numbers and class names as people write them', () => {
    expect(parseRegistrationNumberCell('2026-0042')).toBe('2026-0042');
    expect(parseRegistrationNumberCell(' 2026/42 ')).toBe('2026-0042');
    expect(parseRegistrationNumberCell('')).toBeNull();
    expect(parseRegistrationNumberCell('1042')).toBeUndefined();
    expect(parseRegistrationNumberCell('2026-0000')).toBeUndefined();
    expect(classKey('9 a')).toBe(classKey('9A'));
    expect(classKey('10-B')).toBe('10B');
  });

  it('reads grades written with a comma or a dot', () => {
    expect(parseGradeCell(9)).toBe(9);
    expect(parseGradeCell('7,50')).toBe(7.5);
    expect(parseGradeCell(' 10 ')).toBe(10);
    expect(parseGradeCell('')).toBeNull();
    expect(parseGradeCell('ten')).toBeNaN();
  });

  it('reads dates as Excel dates or in the usual Romanian formats', () => {
    expect(parseDateCell(new Date(Date.UTC(2026, 9, 21)))).toBe('2026-10-21');
    expect(parseDateCell('2026-10-21')).toBe('2026-10-21');
    expect(parseDateCell('21.10.2026')).toBe('2026-10-21');
    expect(parseDateCell('1/9/2026')).toBe('2026-09-01');
    expect(parseDateCell(null)).toBeNull();
    expect(parseDateCell('31.02.2026')).toBeUndefined();
    expect(parseDateCell('yesterday')).toBeUndefined();
  });

  it('recognises an .xlsx file by its first bytes', () => {
    expect(isXlsx(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true);
    expect(isXlsx(Buffer.from('Name,Grade'))).toBe(false);
  });
});
