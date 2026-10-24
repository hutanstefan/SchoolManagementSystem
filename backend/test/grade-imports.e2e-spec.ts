import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  currentClass,
  loginAs,
  studentsOf,
  TestApp,
} from './utils';

/** Reads a binary response body into a Buffer. */
const binary = (
  res: request.Response,
  done: (error: Error | null, body: Buffer) => void,
) => {
  // In Node, superagent hands the parser the raw response stream.
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => done(null, Buffer.concat(chunks)));
};

describe('Excel import and replacing grades (e2e)', () => {
  let app: TestApp;
  let prisma: PrismaService;
  let teacherToken: string;
  let class9A: string;
  let openYearId: string;
  let maths: string;
  let physics: string;
  const createdGradeIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    teacherToken = await loginAs(app, 'teacher');
    const current = await currentClass(app, '9A');
    class9A = current.id;
    openYearId = current.schoolYearId;
    maths = (
      await prisma.subject.findFirstOrThrow({ where: { name: 'Mathematics' } })
    ).id;
    physics = (
      await prisma.subject.findFirstOrThrow({ where: { name: 'Physics' } })
    ).id;
  });

  afterAll(async () => {
    await prisma.gradeHistory.deleteMany({
      where: { gradeId: { in: createdGradeIds } },
    });
    await prisma.grade.deleteMany({ where: { id: { in: createdGradeIds } } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const teacher = (req: request.Test) =>
    req.set('Authorization', `Bearer ${teacherToken}`);

  const downloadTemplate = async (query: string) =>
    teacher(api().get(`/api/grade-imports/template?${query}`))
      .buffer(true)
      .parse(binary)
      .expect(200);

  const readSheet = async (body: unknown) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(body as ArrayBuffer);
    return { workbook, sheet: workbook.getWorksheet('Grades')! };
  };

  const upload = (file: Buffer, name: string, classId?: string) => {
    const req = api()
      .post('/api/grade-imports')
      .field('subjectId', maths)
      .attach('file', file, name);
    return teacher(classId ? req.field('classId', classId) : req);
  };

  it('lists the subjects and classes a teacher can import grades for', async () => {
    const { body } = await teacher(
      api().get('/api/grade-imports/options'),
    ).expect(200);
    expect(body).toEqual([
      {
        subject: expect.objectContaining({ id: maths, name: 'Mathematics' }),
        classes: [
          expect.objectContaining({ name: '9A' }),
          expect.objectContaining({ name: '9B' }),
          expect.objectContaining({ name: '10A' }),
        ],
      },
    ]);
  });

  it('gives a template for one class: class, reg. no. and names, no ids', async () => {
    const res = await downloadTemplate(`subjectId=${maths}&classId=${class9A}`);

    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain(
      'grades-9A-Mathematics.xlsx',
    );
    const { sheet } = await readSheet(res.body);
    const students = await prisma.student.findMany({
      where: { enrollments: { some: { classId: class9A } } },
      select: { registrationNumber: true },
    });
    expect(sheet.rowCount).toBe(students.length + 1);
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual([
      'Class',
      'Reg. no.',
      'Last name',
      'First name',
      'Grade',
      'Date',
    ]);
    expect(sheet.getCell('A2').value).toBe('9A');
    expect(students.map((s) => s.registrationNumber)).toContain(
      sheet.getCell('B2').value,
    );
  });

  it('gives a template for all the classes the teacher teaches the subject in', async () => {
    const res = await downloadTemplate(`subjectId=${maths}`);

    expect(res.headers['content-disposition']).toContain(
      'grades-all-classes-Mathematics.xlsx',
    );
    const { sheet } = await readSheet(res.body);
    const classes = new Set<unknown>();
    sheet.eachRow((row, n) => n > 1 && classes.add(row.getCell(1).value));
    expect([...classes]).toEqual(['9A', '9B', '10A']);
  });

  it('reads the filled-in template: matched students, rounded grades, dates', async () => {
    const { workbook, sheet } = await readSheet(
      (await downloadTemplate(`subjectId=${maths}`)).body,
    );
    let row10A = 0;
    sheet.eachRow((row, n) => {
      if (!row10A && row.getCell(1).value === '10A') row10A = n;
    });
    sheet.getCell('E2').value = 9;
    sheet.getCell('E3').value = '7,50';
    sheet.getCell('F3').value = new Date(Date.UTC(2026, 9, 1));
    sheet.getCell('E4').value = 'ten';
    sheet.getCell(`E${row10A}`).value = 10;
    const file = Buffer.from(await workbook.xlsx.writeBuffer());

    const { body } = await upload(file, 'grades.xlsx').expect(200);

    expect(body.classes.map((c: { name: string }) => c.name)).toEqual([
      '9A',
      '9B',
      '10A',
    ]);
    expect(body.students).toHaveLength(30);
    expect(body.rows).toHaveLength(4);
    expect(body.skippedRows).toBe(30 - 4);
    const [first, second, third, fourth] = body.rows;
    expect(first).toMatchObject({ rowNumber: 2, grade: 9, date: null });
    expect(first.student).toMatchObject({
      registrationNumber: sheet.getCell('B2').value,
      lastName: sheet.getCell('C2').value,
      class: { name: '9A' },
    });
    expect(second).toMatchObject({ grade: 8, date: '2026-10-01' });
    expect(second.note).toContain('rounded to 8');
    expect(third).toMatchObject({ grade: null });
    expect(third.note).toContain('not a grade');
    expect(fourth.student.class.name).toBe('10A');
  });

  it('reads a CSV made by hand: by reg. no., else by class and name', async () => {
    const [a, b, c] = await prisma.student.findMany({
      where: { enrollments: { some: { classId: class9A } } },
      include: { user: true },
      orderBy: { registrationNumber: 'asc' },
      take: 3,
    });
    const csv = [
      'Clasa;Nr. matricol;Nume;Prenume;Nota',
      `9A;${a.registrationNumber};${a.user.lastName};${a.user.firstName};10`,
      `9 a;;${b.user.lastName};${b.user.firstName};9`,
      `9A;${c.registrationNumber};Nimeni;Altcineva;8`,
      `11A;;${a.user.lastName};${a.user.firstName};7`,
      ';;Nimeni;Altcineva;5',
    ].join('\n');

    const { body } = await upload(Buffer.from(csv), 'catalog.csv').expect(200);
    const [byNumber, byName, mismatch, otherClass, unknown] = body.rows;

    expect(byNumber).toMatchObject({ grade: 10, student: { id: a.id } });
    expect(byName).toMatchObject({ grade: 9, student: { id: b.id } });
    expect(mismatch.student).toBeNull();
    expect(mismatch.note).toContain(`Reg. no. ${c.registrationNumber} is`);
    expect(otherClass.note).toContain('Class "11A" is not part of this import');
    expect(unknown.student).toBeNull();
    expect(unknown.note).toContain('No student matched "Nimeni Altcineva"');
  });

  it('rejects other files and subjects the teacher does not teach', async () => {
    await upload(Buffer.from('%PDF-1.7'), 'grades.pdf', class9A).expect(400);
    // A "zip bomb": a small .xlsx that would unpack to 100 MB in memory.
    const bomb = new JSZip();
    bomb.file('xl/worksheets/sheet1.xml', Buffer.alloc(100 * 1024 * 1024));
    const bombed = await upload(
      await bomb.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
      'grades.xlsx',
      class9A,
    ).expect(400);
    expect(bombed.body.message).toContain('too large once unpacked');
    await teacher(
      api().get(
        `/api/grade-imports/template?subjectId=${physics}&classId=${class9A}`,
      ),
    ).expect(403);
    await teacher(
      api().get(`/api/grade-imports/template?subjectId=${physics}`),
    ).expect(403);
  });

  it('saves grades of several classes at once, all or none', async () => {
    const [in9A, in10A, in12A] = await Promise.all(
      ['9A', '10A', '12A'].map((name) =>
        prisma.student.findFirstOrThrow({ where: studentsOf(name) }),
      ),
    );
    const save = (studentIds: string[]) =>
      teacher(
        api()
          .post('/api/grades/batch')
          .send({
            subjectId: maths,
            date: '2026-10-05',
            grades: studentIds.map((studentId) => ({ studentId, value: 7 })),
          }),
      );

    // The teacher doesn't teach Mathematics in 12A: nothing is saved.
    const before = await prisma.grade.count();
    await save([in9A.id, in12A.id]).expect(403);
    expect(await prisma.grade.count()).toBe(before);

    const { body } = await save([in9A.id, in10A.id]).expect(201);
    createdGradeIds.push(...(body.gradeIds as string[]));
    expect(body).toMatchObject({ count: 2, replaced: 0 });
    const saved = await prisma.grade.findMany({
      where: { id: { in: body.gradeIds } },
      select: { teacher: { select: { user: { select: { email: true } } } } },
    });
    expect(saved.map((g) => g.teacher?.user.email)).toEqual([
      'teacher@school.test',
      'teacher@school.test',
    ]);
  });

  it('replaces an existing grade instead of adding one, keeping the history', async () => {
    const student = await prisma.student.findFirstOrThrow({
      where: { enrollments: { some: { classId: class9A } } },
    });
    const { body: added } = await teacher(
      api()
        .post(`/api/classes/${class9A}/grades`)
        .send({
          subjectId: maths,
          grades: [{ studentId: student.id, value: 5, date: '2026-10-02' }],
        }),
    ).expect(201);
    const gradeId = added.gradeIds[0] as string;
    createdGradeIds.push(gradeId);

    const { body } = await teacher(
      api()
        .post(`/api/classes/${class9A}/grades`)
        .send({
          subjectId: maths,
          grades: [
            { studentId: student.id, value: 8, replaceGradeId: gradeId },
          ],
        }),
    ).expect(201);

    expect(body).toMatchObject({ count: 1, replaced: 1, gradeIds: [gradeId] });
    const grade = await prisma.grade.findUniqueOrThrow({
      where: { id: gradeId },
    });
    expect(grade.value).toBe(8);
    const history = await prisma.gradeHistory.findMany({
      where: { gradeId },
      orderBy: { changedAt: 'asc' },
    });
    expect(history.map((h) => h.action)).toEqual(['CREATED', 'UPDATED']);
    expect(history[1]).toMatchObject({ oldValue: 5, newValue: 8 });
  });

  it("won't replace a grade of another student or given by another teacher", async () => {
    const [a, b] = await prisma.student.findMany({
      where: { enrollments: { some: { classId: class9A } } },
      take: 2,
    });
    const otherTeacher = await prisma.teacher.findFirstOrThrow({
      where: { user: { email: { not: 'teacher@school.test' } } },
    });
    const othersGrade = await prisma.grade.create({
      data: {
        studentId: a.id,
        subjectId: maths,
        teacherId: otherTeacher.id,
        schoolYearId: openYearId,
        semester: 1,
        value: 6,
        date: new Date('2026-10-03'),
      },
    });
    createdGradeIds.push(othersGrade.id);

    const replace = (studentId: string) =>
      teacher(
        api()
          .post(`/api/classes/${class9A}/grades`)
          .send({
            subjectId: maths,
            grades: [{ studentId, value: 9, replaceGradeId: othersGrade.id }],
          }),
      );
    await replace(b.id).expect(400); // the grade is not b's
    await replace(a.id).expect(403); // another teacher gave it
    expect(
      (await prisma.grade.findUniqueOrThrow({ where: { id: othersGrade.id } }))
        .value,
    ).toBe(6);
  });
});
