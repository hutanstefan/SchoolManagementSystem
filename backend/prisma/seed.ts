/**
 * Development seed: wipes the database and fills it with realistic demo data.
 * Run with `npm run db:seed`. Faker is seeded, so the data is the same on every run.
 *
 * With `--if-empty` it only seeds a database that has no users yet (used by
 * Docker on every start, so restarting the containers keeps your changes).
 */
import 'dotenv/config';
import { base, en, Faker, fakerRO as faker, ro } from '@faker-js/faker';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  GradeAction,
  LectureAccessAction,
  PrismaClient,
  Role,
  SchoolYearStatus,
  SubjectColor,
  SubjectIcon,
  Weekday,
  YearOutcome,
  type ClassSubject,
} from '../src/generated/prisma/client';
import { yearResult } from '../src/school-years/promotion';
import {
  assignmentMessage,
  gradeMessage,
  lectureMessage,
  lowGradeAlert,
  PASSING_GRADE,
} from '../src/notifications/messages';
import { compareClassNames } from '../src/classes/class-names';
import { createStorage } from '../src/storage/create-storage';
import { DEMO_LECTURES } from './demo-lectures';
import { makeLecturePdf } from './lecture-pdfs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Where the API keeps uploaded files: the demo lectures go there too. */
const storage = createStorage({
  STORAGE_DRIVER: process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local',
  STORAGE_DIR: process.env.STORAGE_DIR || 'storage',
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION || 'auto',
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === 'true',
  // Only used to sign links, which the seed doesn't make.
  FILE_LINK_SECONDS: 300,
  JWT_SECRET: 'seed',
});

/** Every seeded account uses this password (see README > Test credentials). */
const DEFAULT_PASSWORD = 'Password123!';
const BCRYPT_ROUNDS = 10;
const EMAIL_DOMAIN = 'school.test';

/** Subjects and how many hours per week every class studies them (20 hours in total). */
const SUBJECTS = [
  {
    name: 'Mathematics',
    hoursPerWeek: 4,
    room: null,
    color: SubjectColor.INDIGO,
    icon: SubjectIcon.CALCULATOR,
  },
  {
    name: 'Romanian Language',
    hoursPerWeek: 4,
    room: null,
    color: SubjectColor.ROSE,
    icon: SubjectIcon.FEATHER,
  },
  {
    name: 'English',
    hoursPerWeek: 2,
    room: null,
    color: SubjectColor.SKY,
    icon: SubjectIcon.LANGUAGES,
  },
  {
    name: 'Physics',
    hoursPerWeek: 2,
    room: 'Physics lab',
    color: SubjectColor.VIOLET,
    icon: SubjectIcon.ATOM,
  },
  {
    name: 'Chemistry',
    hoursPerWeek: 2,
    room: 'Chemistry lab',
    color: SubjectColor.TEAL,
    icon: SubjectIcon.FLASK,
  },
  {
    name: 'Biology',
    hoursPerWeek: 2,
    room: 'Biology lab',
    color: SubjectColor.EMERALD,
    icon: SubjectIcon.DNA,
  },
  {
    name: 'History',
    hoursPerWeek: 2,
    room: null,
    color: SubjectColor.AMBER,
    icon: SubjectIcon.LANDMARK,
  },
  {
    name: 'Geography',
    hoursPerWeek: 2,
    room: null,
    color: SubjectColor.LIME,
    icon: SubjectIcon.GLOBE,
  },
] as const;

type SubjectName = (typeof SUBJECTS)[number]['name'];

const CLASS_NAMES = ['9A', '9B', '10A', '10B', '11A', '12A'];
const ALL_CLASSES = CLASS_NAMES.map((_, index) => index);

/**
 * Teaching staff: which subject each teacher teaches and in which classes
 * (indexes into CLASS_NAMES). The first one is the main test account.
 */
const TEACHERS: { subject: SubjectName; classes: number[] }[] = [
  { subject: 'Mathematics', classes: [0, 1, 2] },
  { subject: 'Mathematics', classes: [3, 4, 5] },
  { subject: 'Romanian Language', classes: [0, 1, 2] },
  { subject: 'Romanian Language', classes: [3, 4, 5] },
  { subject: 'English', classes: ALL_CLASSES },
  { subject: 'Physics', classes: ALL_CLASSES },
  { subject: 'Chemistry', classes: ALL_CLASSES },
  { subject: 'Biology', classes: ALL_CLASSES },
  { subject: 'History', classes: ALL_CLASSES },
  { subject: 'Geography', classes: ALL_CLASSES },
];

/** Homeroom teacher (diriginte) of each class, as an index into TEACHERS. */
const HOMEROOM_TEACHERS = [0, 2, 4, 1, 5, 3];

const STUDENTS_PER_CLASS = 10;
const UNASSIGNED_STUDENTS = 2;

const WEEKDAYS = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
];
/** 20 lessons per week = 4 lessons per day. */
const PERIODS_PER_DAY = 4;
const MAX_SAME_SUBJECT_PER_DAY = 2;

/** "Ștefan" -> "stefan", so generated emails are plain ASCII. */
function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function makeEmail(
  firstName: string,
  lastName: string,
  used: Set<string>,
): string {
  const base = `${slug(firstName)}.${slug(lastName)}`;
  let email = `${base}@${EMAIL_DOMAIN}`;
  let suffix = 2;
  while (used.has(email)) {
    email = `${base}${suffix++}@${EMAIL_DOMAIN}`;
  }
  used.add(email);
  return email;
}

/**
 * A second generator for how well students do. `faker` keeps making exactly
 * the draws it always made, so the seeded names, emails and birth dates stay
 * the same on every run (the photos in docs/sample-tests show some of them).
 */
const levels = new Faker({ locale: base });

/** Everything about last school year (names included) has its own generator too. */
const past = new Faker({ locale: [ro, en, base] });

/** Grades skew towards 7-10, like in a real class. */
function randomGradeValue(generator: Faker = faker): number {
  return generator.helpers.weightedArrayElement([
    { value: 4, weight: 1 },
    { value: 5, weight: 3 },
    { value: 6, weight: 5 },
    { value: 7, weight: 8 },
    { value: 8, weight: 10 },
    { value: 9, weight: 9 },
    { value: 10, weight: 7 },
  ]);
}

/**
 * How far a student's grades sit from the typical ones: some students are
 * strong, most are average and a few struggle (their averages can fall
 * under 5, which the dashboards flag).
 */
function studentShift(): number {
  return levels.helpers.weightedArrayElement([
    { value: levels.number.float({ min: 0.3, max: 0.9 }), weight: 3 },
    { value: levels.number.float({ min: -0.6, max: 0.6 }), weight: 6 },
    { value: levels.number.float({ min: -3.2, max: -2.2 }), weight: 1 },
  ]);
}

function shifted(value: number, shift: number): number {
  return Math.min(10, Math.max(1, Math.round(value + shift)));
}

/**
 * Realistic birth date for a student in the given grade (9-12).
 * In Romania, 9th graders turn 15 during the school year, 12th graders turn 18.
 */
function birthDateForGrade(grade: number, yearStart: Date): Date {
  const birthYear = yearStart.getUTCFullYear() - grade - 6;
  return faker.date.between({
    from: new Date(Date.UTC(birthYear, 0, 1)),
    to: new Date(Date.UTC(birthYear, 11, 31)),
  });
}

/** Start of the current Romanian school year (mid-September). */
function schoolYearStart(today: Date): Date {
  const year =
    today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return new Date(Date.UTC(year, 8, 15));
}

type TimetableSlot = {
  classSubjectId: string;
  classId: string;
  day: Weekday;
  period: number;
  room: string;
};

/**
 * Builds a conflict-free weekly timetable: a class has one lesson per slot,
 * a teacher is never in two classes at once and a subject appears at most
 * twice a day. Randomised greedy placement, retried until it fits.
 */
function buildTimetable(
  classSubjects: (ClassSubject & { room: string })[],
  classIds: string[],
  generator: Faker = faker,
): TimetableSlot[] {
  const teacherBusy = new Set<string>(); // "teacherId|day|period"
  const entries: TimetableSlot[] = [];

  for (const classId of classIds) {
    const lessons = classSubjects
      .filter((cs) => cs.classId === classId)
      .flatMap((cs) => Array.from({ length: cs.hoursPerWeek }, () => cs));

    let placed: TimetableSlot[] | null = null;
    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      placed = tryPlace(generator.helpers.shuffle(lessons), classId);
    }
    if (!placed) {
      throw new Error(`Could not build a timetable for class ${classId}`);
    }

    for (const entry of placed) {
      const lesson = classSubjects.find((cs) => cs.id === entry.classSubjectId);
      if (lesson?.teacherId) {
        teacherBusy.add(`${lesson.teacherId}|${entry.day}|${entry.period}`);
      }
    }
    entries.push(...placed);
  }

  function tryPlace(
    lessons: (ClassSubject & { room: string })[],
    classId: string,
  ): TimetableSlot[] | null {
    const remaining = [...lessons];
    const result: TimetableSlot[] = [];

    for (const day of WEEKDAYS) {
      const perSubjectToday = new Map<string, number>();
      for (let period = 1; period <= PERIODS_PER_DAY; period++) {
        const index = remaining.findIndex(
          (lesson) =>
            (perSubjectToday.get(lesson.subjectId) ?? 0) <
              MAX_SAME_SUBJECT_PER_DAY &&
            !(
              lesson.teacherId &&
              teacherBusy.has(`${lesson.teacherId}|${day}|${period}`)
            ),
        );
        if (index === -1) return null;

        const [lesson] = remaining.splice(index, 1);
        perSubjectToday.set(
          lesson.subjectId,
          (perSubjectToday.get(lesson.subjectId) ?? 0) + 1,
        );
        result.push({
          classSubjectId: lesson.id,
          classId,
          day,
          period,
          room: lesson.room,
        });
      }
    }
    return result;
  }

  return entries;
}

/**
 * Every user gets their own hash. bcrypt generates a random salt on each call,
 * so even identical passwords end up with different hashes in the database.
 */
function hashPassword(): Promise<string> {
  return bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
}

async function clearDatabase(): Promise<void> {
  // The lectures' files first, while we still know where they are.
  const files = await prisma.lecture.findMany({ select: { fileKey: true } });
  for (const { fileKey } of files) {
    await storage.remove(fileKey).catch(() => undefined);
  }
  await prisma.lecture.deleteMany();
  await prisma.auditLog.deleteMany();
  // Order matters because of foreign keys.
  await prisma.gradeHistory.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.reexam.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.classSubject.deleteMany();
  await prisma.student.deleteMany();
  // Next year's classes point to last year's: those go first.
  await prisma.class.deleteMany({ where: { previousClassId: { not: null } } });
  await prisma.class.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.user.deleteMany();
  await prisma.registrationCounter.deleteMany();
}

async function main(): Promise<void> {
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.log('Database already has data, skipping the seed.');
    return;
  }

  faker.seed(2026);
  levels.seed(7);
  past.seed(2025);
  const usedEmails = new Set<string>([
    `admin@${EMAIL_DOMAIN}`,
    `teacher@${EMAIL_DOMAIN}`,
    `student@${EMAIL_DOMAIN}`,
  ]);

  console.log('Clearing database...');
  await clearDatabase();

  console.log('Creating admin...');
  await prisma.user.create({
    data: {
      email: `admin@${EMAIL_DOMAIN}`,
      passwordHash: await hashPassword(),
      role: Role.ADMIN,
      firstName: 'Ana',
      lastName: 'Popescu',
    },
  });

  console.log('Creating subjects...');
  const subjects = new Map<SubjectName, string>();
  for (const subject of SUBJECTS) {
    const created = await prisma.subject.create({
      data: {
        name: subject.name,
        color: subject.color,
        icon: subject.icon,
      },
    });
    subjects.set(subject.name, created.id);
  }

  console.log('Creating teachers...');
  const teacherIds: string[] = [];
  const userIdByTeacherId = new Map<string, string>();
  for (const [index, staff] of TEACHERS.entries()) {
    const isMainTeacher = index === 0;
    const firstName = isMainTeacher ? 'Mihai' : faker.person.firstName();
    const lastName = isMainTeacher ? 'Ionescu' : faker.person.lastName();
    const email = isMainTeacher
      ? `teacher@${EMAIL_DOMAIN}`
      : makeEmail(firstName, lastName, usedEmails);

    const teacher = await prisma.teacher.create({
      data: {
        user: {
          create: {
            email,
            passwordHash: await hashPassword(),
            role: Role.TEACHER,
            firstName,
            lastName,
          },
        },
      },
    });
    teacherIds.push(teacher.id);
    userIdByTeacherId.set(teacher.id, teacher.userId);
    console.log(`  ${email} teaches ${staff.subject}`);
  }

  console.log('Creating the school years...');
  const today = new Date();
  const yearStart = schoolYearStart(today);
  const startYear = yearStart.getUTCFullYear();
  // Last year is closed (its classes are created at the end); this one is in
  // its first semester.
  const lastYear = await prisma.schoolYear.create({
    data: {
      startYear: startYear - 1,
      status: SchoolYearStatus.CLOSED,
      currentSemester: 2,
      semester1EndedAt: new Date(Date.UTC(startYear, 0, 30, 15)),
      closedAt: new Date(Date.UTC(startYear, 7, 31, 12)),
    },
  });
  const thisYear = await prisma.schoolYear.create({
    data: { startYear, currentSemester: 1 },
  });

  console.log('Creating classes and teaching assignments...');
  const classIds: string[] = [];
  const gradeLevelByClassId = new Map<string, number>(); // "10A" -> 10
  const classSubjects: (ClassSubject & { room: string })[] = [];
  for (const [classIndex, name] of CLASS_NAMES.entries()) {
    const schoolClass = await prisma.class.create({
      data: {
        name,
        schoolYearId: thisYear.id,
        homeroomTeacherId: teacherIds[HOMEROOM_TEACHERS[classIndex]],
      },
    });
    classIds.push(schoolClass.id);
    gradeLevelByClassId.set(schoolClass.id, Number.parseInt(name, 10));

    for (const subject of SUBJECTS) {
      const teacherIndex = TEACHERS.findIndex(
        (staff) =>
          staff.subject === subject.name && staff.classes.includes(classIndex),
      );
      const classSubject = await prisma.classSubject.create({
        data: {
          classId: schoolClass.id,
          subjectId: subjects.get(subject.name)!,
          teacherId: teacherIds[teacherIndex],
          hoursPerWeek: subject.hoursPerWeek,
        },
      });
      classSubjects.push({
        ...classSubject,
        room: subject.room ?? `Room ${101 + classIndex}`,
      });
    }
  }

  console.log('Building the weekly timetable...');
  const timetable = buildTimetable(classSubjects, classIds);
  await prisma.timetableEntry.createMany({ data: timetable });

  console.log('Creating students and grades...');
  const grades: {
    studentId: string;
    subjectId: string;
    teacherId: string | null;
    schoolYearId: string;
    semester: number;
    value: number;
    date: Date;
  }[] = [];

  const studentSlots: (string | null)[] = [
    ...classIds.flatMap((classId) =>
      Array.from({ length: STUDENTS_PER_CLASS }, () => classId),
    ),
    ...Array.from({ length: UNASSIGNED_STUDENTS }, () => null),
  ];

  // Registration numbers: the year a student started high school (grade 9),
  // and their number among that year's enrollments.
  const enrolledInYear = new Map<number, number>();
  const nextRegistrationNumber = (gradeLevel: number): string => {
    const year = yearStart.getUTCFullYear() - (gradeLevel - 9);
    const number = (enrolledInYear.get(year) ?? 0) + 1;
    enrolledInYear.set(year, number);
    return `${year}-${String(number).padStart(4, '0')}`;
  };

  const classShift = new Map(
    classIds.map((id) => [id, levels.number.float({ min: -0.5, max: 0.5 })]),
  );

  const userIdByStudentId = new Map<string, string>();
  for (const [index, classId] of studentSlots.entries()) {
    const isMainStudent = index === 0;
    const firstName = isMainStudent ? 'Andrei' : faker.person.firstName();
    const lastName = isMainStudent ? 'Georgescu' : faker.person.lastName();
    const email = isMainStudent
      ? `student@${EMAIL_DOMAIN}`
      : makeEmail(firstName, lastName, usedEmails);

    const gradeLevel = classId
      ? gradeLevelByClassId.get(classId)!
      : faker.number.int({ min: 9, max: 12 });
    const student = await prisma.student.create({
      data: {
        registrationNumber: nextRegistrationNumber(gradeLevel),
        dateOfBirth: birthDateForGrade(gradeLevel, yearStart),
        enrollments: classId
          ? { create: { classId, schoolYearId: thisYear.id } }
          : undefined,
        user: {
          create: {
            email,
            passwordHash: await hashPassword(),
            role: Role.STUDENT,
            firstName,
            lastName,
          },
        },
      },
    });

    userIdByStudentId.set(student.id, student.userId);
    if (!classId) continue; // unassigned students have no grades yet

    // Classes differ a little, and every student has stronger and weaker subjects.
    const shift =
      (isMainStudent ? 0.6 : studentShift()) + classShift.get(classId)!;

    // Each grade is given by the teacher who teaches that subject in the student's class.
    for (const classSubject of classSubjects.filter(
      (cs) => cs.classId === classId,
    )) {
      const subjectShift = shift + levels.number.float({ min: -0.7, max: 0.7 });
      const count = faker.number.int({ min: 2, max: 4 });
      for (let i = 0; i < count; i++) {
        grades.push({
          studentId: student.id,
          subjectId: classSubject.subjectId,
          teacherId: classSubject.teacherId,
          schoolYearId: thisYear.id,
          semester: 1,
          value: shifted(randomGradeValue(), subjectShift),
          date: faker.date.between({ from: yearStart, to: today }),
        });
      }
      // Subjects with more hours have a higher minimum (hours + 1): mid-semester
      // some students already have it, others not yet.
      const extra = levels.number.int({
        min: 0,
        max: Math.max(0, classSubject.hoursPerWeek - 2),
      });
      for (let i = 0; i < extra; i++) {
        grades.push({
          studentId: student.id,
          subjectId: classSubject.subjectId,
          teacherId: classSubject.teacherId,
          schoolYearId: thisYear.id,
          semester: 1,
          value: shifted(randomGradeValue(levels), subjectShift),
          date: levels.date.between({ from: yearStart, to: today }),
        });
      }
    }
  }

  // New students created in the app continue from these numbers.
  await prisma.registrationCounter.createMany({
    data: [...enrolledInYear].map(([year, lastNumber]) => ({
      year,
      lastNumber,
    })),
  });

  const createdGrades = await prisma.grade.createManyAndReturn({
    data: grades,
    select: {
      id: true,
      studentId: true,
      subjectId: true,
      teacherId: true,
      value: true,
      date: true,
    },
  });
  // Every grade starts with a CREATED entry in its history, like grades given through the API.
  await prisma.gradeHistory.createMany({
    data: createdGrades.map((grade) => ({
      gradeId: grade.id,
      studentId: grade.studentId,
      subjectId: grade.subjectId,
      action: GradeAction.CREATED,
      newValue: grade.value,
      newDate: grade.date,
      changedById: grade.teacherId
        ? userIdByTeacherId.get(grade.teacherId)
        : null,
    })),
  });

  // Each student's two latest grades wait as unread notifications, so the
  // bell isn't empty on the first login. Same wording as live ones.
  const subjectNameById = new Map(
    [...subjects].map(([name, id]) => [id, name as string]),
  );
  const latestByStudent = new Map<string, typeof createdGrades>();
  for (const grade of [...createdGrades].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  )) {
    const latest = latestByStudent.get(grade.studentId) ?? [];
    if (latest.length < 2)
      latestByStudent.set(grade.studentId, [...latest, grade]);
  }
  const notifications = await prisma.notification.createMany({
    data: [...latestByStudent.values()].flat().map((grade) => ({
      userId: userIdByStudentId.get(grade.studentId)!,
      ...gradeMessage(
        {
          kind: 'created',
          gradeId: grade.id,
          studentId: grade.studentId,
          value: grade.value,
          date: grade.date.toISOString().slice(0, 10),
        },
        subjectNameById.get(grade.subjectId)!,
      ),
      link: '/student/grades',
      // In the afternoon of the day the grade was given.
      createdAt: new Date(grade.date.getTime() + 14 * 60 * 60 * 1000),
    })),
  });

  const teacherNotifications = await seedTeacherNotifications(
    yearStart,
    thisYear.id,
  );
  const conversations = await seedChat(today);

  // Last year comes last, with its own generator: everything above makes the
  // same random draws as before it existed, so the names stay the same.
  console.log('Creating last school year...');
  const archived = await seedLastYear({
    lastYearId: lastYear.id,
    lastYearStart: new Date(Date.UTC(startYear - 1, 8, 15)),
    thisYearClasses: classIds,
    teacherIds,
    userIdByTeacherId,
    usedEmails,
    rooms: new Map(classSubjects.map((cs) => [cs.id, cs.room])),
  });

  console.log(`Sharing lectures (${storage.driver} storage)...`);
  const lectures = await seedLectures({
    thisYearId: thisYear.id,
    lastYearId: lastYear.id,
    yearStart,
    lastYearStart: new Date(Date.UTC(startYear - 1, 8, 15)),
    today,
  });

  console.log(
    `Lectures: ${lectures.lectures} PDFs shared with ${lectures.readers} students.`,
  );
  console.log(
    `Done: 1 admin, ${teacherIds.length} teachers, ${classIds.length} classes, ` +
      `${subjects.size} subjects, ${classSubjects.length} teaching assignments, ` +
      `${timetable.length} timetable lessons, ${studentSlots.length} students, ${grades.length} grades, ` +
      `${notifications.count + teacherNotifications} notifications, ${conversations} conversations.`,
  );
  console.log(
    `Last year (${startYear - 1}–${startYear}, closed): ${archived.classes} classes, ` +
      `${archived.grades} grades, ${archived.graduates} graduates, ${archived.repeating} repeating, ${archived.reexams} re-exams.`,
  );
  console.log(
    `Login with admin@${EMAIL_DOMAIN}, teacher@${EMAIL_DOMAIN} or student@${EMAIL_DOMAIN} / ${DEFAULT_PASSWORD}`,
  );
}

/**
 * Teachers' notifications, as the app would have sent them: their teaching
 * assignments at the start of the year (already read) and an alert to the
 * homeroom teacher for each failing grade in their class.
 */
async function seedTeacherNotifications(
  yearStart: Date,
  schoolYearId: string,
): Promise<number> {
  const [assignments, homerooms, failingGrades] = await Promise.all([
    prisma.classSubject.findMany({
      where: { teacherId: { not: null }, class: { schoolYearId } },
      select: {
        hoursPerWeek: true,
        class: { select: { id: true, name: true } },
        subject: { select: { name: true } },
        teacher: { select: { userId: true } },
      },
    }),
    prisma.class.findMany({
      where: { homeroomTeacherId: { not: null }, schoolYearId },
      select: {
        id: true,
        name: true,
        homeroomTeacher: { select: { userId: true } },
      },
    }),
    prisma.grade.findMany({
      where: { value: { lt: PASSING_GRADE }, schoolYearId },
      select: {
        value: true,
        date: true,
        subject: { select: { name: true } },
        student: {
          select: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
              where: { schoolYearId },
              select: {
                class: {
                  select: { homeroomTeacher: { select: { userId: true } } },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  const settledIn = new Date(yearStart.getTime() + 9 * 60 * 60 * 1000);

  const { count } = await prisma.notification.createMany({
    data: [
      ...assignments.map((a) => ({
        userId: a.teacher!.userId,
        ...assignmentMessage({
          kind: 'assigned',
          teacherUserId: a.teacher!.userId,
          classId: a.class.id,
          className: a.class.name,
          subjectName: a.subject.name,
          hoursPerWeek: a.hoursPerWeek,
        }),
        link: '/teacher/classes',
        createdAt: settledIn,
        readAt: settledIn,
      })),
      ...homerooms.map((c) => ({
        userId: c.homeroomTeacher!.userId,
        ...assignmentMessage({
          kind: 'homeroom-assigned',
          teacherUserId: c.homeroomTeacher!.userId,
          classId: c.id,
          className: c.name,
        }),
        link: '/teacher/classes',
        createdAt: settledIn,
        readAt: settledIn,
      })),
      ...failingGrades
        .filter((g) => g.student.enrollments[0]?.class.homeroomTeacher)
        .map((g) => ({
          userId: g.student.enrollments[0].class.homeroomTeacher!.userId,
          ...lowGradeAlert(
            `${g.student.user.firstName} ${g.student.user.lastName}`,
            g.subject.name,
            g.value,
            null,
          ),
          link: '/teacher/classes',
          createdAt: new Date(g.date.getTime() + 15 * 60 * 60 * 1000),
        })),
    ],
  });
  return count;
}

/**
 * Last school year, closed: the classes this year's students were in a grade
 * lower (10A was 9A), plus last year's 12A, who graduated. Grades in both
 * semesters, each student's outcome, a student who passed after a re-exam
 * and one who repeats the year. Uses its own random generator (`past`).
 */
async function seedLastYear(options: {
  lastYearId: string;
  lastYearStart: Date;
  thisYearClasses: string[];
  teacherIds: string[];
  userIdByTeacherId: Map<string, string>;
  usedEmails: Set<string>;
  rooms: Map<string, string>;
}): Promise<{
  classes: number;
  grades: number;
  graduates: number;
  repeating: number;
  reexams: number;
}> {
  const { lastYearId, lastYearStart } = options;
  const y = lastYearStart.getUTCFullYear();
  const semesters = [
    { semester: 1, from: lastYearStart, to: new Date(Date.UTC(y + 1, 0, 30)) },
    {
      semester: 2,
      from: new Date(Date.UTC(y + 1, 1, 9)),
      to: new Date(Date.UTC(y + 1, 5, 19)),
    },
  ];
  const thisYear = await prisma.class.findMany({
    where: { id: { in: options.thisYearClasses } },
    select: {
      id: true,
      name: true,
      homeroomTeacherId: true,
      subjects: {
        select: {
          id: true,
          subjectId: true,
          teacherId: true,
          hoursPerWeek: true,
        },
      },
      enrollments: { select: { studentId: true } },
    },
  });
  const level = (name: string) => Number.parseInt(name, 10);
  const entryLevel = Math.min(...thisYear.map((c) => level(c.name)));

  type LastYearClass = {
    id: string;
    name: string;
    subjects: (ClassSubject & { room: string })[];
    students: { studentId: string; outcome: YearOutcome }[];
  };
  const lastYearClasses: LastYearClass[] = [];
  const copyClass = async (
    name: string,
    source: (typeof thisYear)[number],
    homeroomTeacherId: string | null,
  ) => {
    const created = await prisma.class.create({
      data: { name, schoolYearId: lastYearId, homeroomTeacherId },
    });
    const subjects: (ClassSubject & { room: string })[] = [];
    for (const cs of source.subjects) {
      const row = await prisma.classSubject.create({
        data: {
          classId: created.id,
          subjectId: cs.subjectId,
          teacherId: cs.teacherId,
          hoursPerWeek: cs.hoursPerWeek,
        },
      });
      subjects.push({ ...row, room: options.rooms.get(cs.id) ?? 'Room 101' });
    }
    const entry: LastYearClass = {
      id: created.id,
      name,
      subjects,
      students: [],
    };
    lastYearClasses.push(entry);
    return entry;
  };

  // This year's classes, a grade lower: same homeroom teacher and teachers.
  for (const current of thisYear) {
    if (level(current.name) === entryLevel) continue; // new this year
    const previous = await copyClass(
      `${level(current.name) - 1}${current.name.replace(/^\d+/, '')}`,
      current,
      current.homeroomTeacherId,
    );
    previous.students = current.enrollments.map((e) => ({
      studentId: e.studentId,
      outcome: YearOutcome.PROMOTED,
    }));
    await prisma.class.update({
      where: { id: current.id },
      data: { previousClassId: previous.id },
    });
  }

  // Last year's final grade: they graduated (new students, not in this year).
  const finalSource = thisYear.reduce((a, b) =>
    level(a.name) >= level(b.name) ? a : b,
  );
  const graduating = await copyClass(
    finalSource.name,
    finalSource,
    options.teacherIds[6] ?? null,
  );
  const studentAccount = async (
    registrationNumber: string,
    birthYear: number,
  ) => {
    const firstName = past.person.firstName();
    const lastName = past.person.lastName();
    return prisma.student.create({
      data: {
        registrationNumber,
        dateOfBirth: past.date.between({
          from: new Date(Date.UTC(birthYear, 0, 1)),
          to: new Date(Date.UTC(birthYear, 11, 31)),
        }),
        user: {
          create: {
            email: makeEmail(firstName, lastName, options.usedEmails),
            passwordHash: await hashPassword(),
            role: Role.STUDENT,
            firstName,
            lastName,
          },
        },
      },
      select: { id: true },
    });
  };
  const finalLevel = level(graduating.name);
  const graduatesStarted = y - (finalLevel - 9); // year they entered grade 9
  for (let n = 1; n <= STUDENTS_PER_CLASS; n++) {
    const student = await studentAccount(
      `${graduatesStarted}-${String(n).padStart(4, '0')}`,
      y - finalLevel - 6,
    );
    graduating.students.push({
      studentId: student.id,
      outcome: YearOutcome.GRADUATED,
    });
  }

  // A student of last year's 11th grade who failed three subjects and repeats
  // the year: they are in this year's 11th grade again.
  const repeatClass = lastYearClasses.find((c) => level(c.name) === 11);
  const repeatTarget = thisYear.find((c) => level(c.name) === 11);
  let repeaterId: string | null = null;
  if (repeatClass && repeatTarget) {
    const started = y - 2;
    const counter = await prisma.registrationCounter.findUnique({
      where: { year: started },
    });
    const number = (counter?.lastNumber ?? 0) + 1;
    const repeater = await studentAccount(
      `${started}-${String(number).padStart(4, '0')}`,
      y - 11 - 6,
    );
    repeaterId = repeater.id;
    repeatClass.students.push({
      studentId: repeater.id,
      outcome: YearOutcome.REPEATING,
    });
    const { schoolYearId: thisYearId } = await prisma.class.findUniqueOrThrow({
      where: { id: repeatTarget.id },
      select: { schoolYearId: true },
    });
    await prisma.enrollment.create({
      data: {
        studentId: repeater.id,
        classId: repeatTarget.id,
        schoolYearId: thisYearId,
      },
    });
    // Second time around they do better: this semester's grades so far.
    const thisYearStart = new Date(Date.UTC(y + 1, 8, 15));
    const today = new Date();
    await prisma.grade.createMany({
      data: repeatTarget.subjects.flatMap((cs) =>
        Array.from(
          { length: cs.hoursPerWeek + 1 + past.number.int({ min: 0, max: 1 }) },
          () => ({
            studentId: repeater.id,
            subjectId: cs.subjectId,
            teacherId: cs.teacherId,
            schoolYearId: thisYearId,
            semester: 1,
            value: shifted(randomGradeValue(past), 0.4),
            date: past.date.between({ from: thisYearStart, to: today }),
          }),
        ),
      ),
    });
  }
  // Registration numbers continue after the graduates and the repeater.
  await prisma.registrationCounter.upsert({
    where: { year: graduatesStarted },
    create: { year: graduatesStarted, lastNumber: STUDENTS_PER_CLASS },
    update: { lastNumber: STUDENTS_PER_CLASS },
  });
  if (repeaterId) {
    await prisma.registrationCounter.update({
      where: { year: y - 2 },
      data: { lastNumber: { increment: 1 } },
    });
  }

  // The student who passed Chemistry only at the re-exam: the first of last
  // year's entry-level class.
  const firstClass = lastYearClasses.find((c) => level(c.name) === entryLevel);
  const reexamStudentId = firstClass?.students[0]?.studentId ?? null;
  const chemistry = await prisma.subject.findUnique({
    where: { name: 'Chemistry' },
    select: { id: true },
  });
  const weakSubjects = await prisma.subject.findMany({
    where: { name: { in: ['Mathematics', 'Physics', 'Chemistry'] } },
    select: { id: true },
  });

  console.log('  timetable, enrollments and grades...');
  const timetable = buildTimetable(
    lastYearClasses.flatMap((c) => c.subjects),
    lastYearClasses.map((c) => c.id),
    past,
  );
  await prisma.timetableEntry.createMany({ data: timetable });

  const grades: {
    studentId: string;
    subjectId: string;
    teacherId: string | null;
    schoolYearId: string;
    semester: number;
    value: number;
    date: Date;
  }[] = [];
  const reexams: { studentId: string; subjectId: string; grade: number }[] = [];

  for (const schoolClass of lastYearClasses) {
    await prisma.enrollment.createMany({
      data: schoolClass.students.map((s) => ({
        studentId: s.studentId,
        classId: schoolClass.id,
        schoolYearId: lastYearId,
        outcome: s.outcome,
      })),
    });

    for (const { studentId, outcome } of schoolClass.students) {
      let shift = past.number.float({ min: -0.8, max: 1 });
      // Draw the year, then check it ends as recorded; raise the grades of a
      // student who should have passed but drew too many failures.
      for (let attempt = 0; attempt < 6; attempt++) {
        const own: typeof grades = [];
        for (const cs of schoolClass.subjects) {
          const weak =
            (studentId === repeaterId &&
              weakSubjects.some((w) => w.id === cs.subjectId)) ||
            (studentId === reexamStudentId && cs.subjectId === chemistry?.id);
          const subjectShift = weak
            ? -4
            : shift + past.number.float({ min: -0.6, max: 0.6 });
          for (const { semester, from, to } of semesters) {
            const count =
              cs.hoursPerWeek + 1 + past.number.int({ min: 0, max: 2 });
            for (let i = 0; i < count; i++) {
              own.push({
                studentId,
                subjectId: cs.subjectId,
                teacherId: cs.teacherId,
                schoolYearId: lastYearId,
                semester,
                value: shifted(randomGradeValue(past), subjectShift),
                date: past.date.between({ from, to }),
              });
            }
          }
        }
        const result = yearResult(
          schoolClass.subjects.map((cs) => ({
            subjectId: cs.subjectId,
            semester1: own
              .filter((g) => g.subjectId === cs.subjectId && g.semester === 1)
              .map((g) => g.value),
            semester2: own
              .filter((g) => g.subjectId === cs.subjectId && g.semester === 2)
              .map((g) => g.value),
            reexamGrade: null,
          })),
          false,
        );
        const failed = result.failedSubjects;
        const fits =
          outcome === YearOutcome.REPEATING
            ? failed.length >= 3
            : studentId === reexamStudentId
              ? failed.length === 1
              : failed.length === 0;
        if (fits || attempt === 5) {
          grades.push(...own);
          if (outcome !== YearOutcome.REPEATING) {
            // Passed the re-exam(s), as their promotion says.
            for (const f of failed) {
              reexams.push({
                studentId,
                subjectId: f.subjectId,
                grade: past.number.int({ min: 5, max: 7 }),
              });
            }
          }
          break;
        }
        shift += 1;
      }
    }
  }

  const created = await prisma.grade.createManyAndReturn({
    data: grades,
    select: {
      id: true,
      studentId: true,
      subjectId: true,
      teacherId: true,
      value: true,
      date: true,
    },
  });
  await prisma.gradeHistory.createMany({
    data: created.map((grade) => ({
      gradeId: grade.id,
      studentId: grade.studentId,
      subjectId: grade.subjectId,
      action: GradeAction.CREATED,
      newValue: grade.value,
      newDate: grade.date,
      changedById: grade.teacherId
        ? options.userIdByTeacherId.get(grade.teacherId)
        : null,
      changedAt: new Date(grade.date.getTime() + 13 * 60 * 60 * 1000),
    })),
  });
  await prisma.reexam.createMany({
    data: reexams.map((r) => ({ ...r, schoolYearId: lastYearId })),
  });

  return {
    classes: lastYearClasses.length,
    grades: created.length,
    graduates: graduating.students.length,
    repeating: repeaterId ? 1 : 0,
    reexams: reexams.length,
  };
}

/**
 * A few conversations, so the chat isn't empty on the first login: the demo
 * teacher with the demo student (one unread message for the student), a
 * group for 9A and a chat between two teachers.
 */
async function seedChat(today: Date): Promise<number> {
  const byEmail = async (email: string) =>
    prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true, firstName: true, lastName: true },
    });
  const mihai = await byEmail(`teacher@${EMAIL_DOMAIN}`);
  const andrei = await byEmail(`student@${EMAIL_DOMAIN}`);
  const colleague = await prisma.user.findFirstOrThrow({
    where: { role: Role.TEACHER, id: { not: mihai.id } },
    orderBy: { lastName: 'asc' },
    select: { id: true, firstName: true, lastName: true },
  });
  const class9A = await prisma.student.findMany({
    where: {
      enrollments: {
        some: {
          class: {
            name: '9A',
            schoolYear: { status: SchoolYearStatus.ACTIVE },
          },
        },
      },
    },
    select: { userId: true, user: { select: { firstName: true } } },
    orderBy: { user: { lastName: 'asc' } },
  });

  // Earlier today, minute by minute (never in the future).
  const at = (minutesAgo: number) =>
    new Date(today.getTime() - minutesAgo * 60_000);
  type Line = [from: string, body: string, minutesAgo: number];

  const conversation = async (options: {
    type: 'DIRECT' | 'GROUP';
    name?: string;
    owner: string;
    members: string[];
    lines: Line[];
    /** Members who read everything (the others have unread messages). */
    readBy: string[];
    system?: string;
  }) => {
    const all = [options.owner, ...options.members];
    const last = options.lines[options.lines.length - 1];
    const first = options.lines[0];
    await prisma.conversation.create({
      data: {
        type: options.type,
        name: options.name,
        directKey:
          options.type === 'DIRECT' ? [...all].sort().join(':') : undefined,
        createdById: options.owner,
        createdAt: at(first[2] + 1),
        lastMessageAt: at(last[2]),
        members: {
          create: all.map((userId) => ({
            userId,
            role:
              options.type === 'GROUP' && userId === options.owner
                ? 'OWNER'
                : 'MEMBER',
            joinedAt: at(first[2] + 1),
            lastReadAt: options.readBy.includes(userId) ? at(last[2]) : null,
          })),
        },
        messages: {
          create: [
            ...(options.system
              ? [
                  {
                    senderId: options.owner,
                    kind: 'SYSTEM' as const,
                    body: options.system,
                    createdAt: at(first[2] + 1),
                  },
                ]
              : []),
            ...options.lines.map(([from, body, minutesAgo]) => ({
              senderId: from,
              body,
              createdAt: at(minutesAgo),
            })),
          ],
        },
      },
    });
  };

  await conversation({
    type: 'DIRECT',
    owner: andrei.id,
    members: [mihai.id],
    readBy: [mihai.id],
    lines: [
      [
        andrei.id,
        'Good morning! Could I take the Maths test next week? I was ill on Friday.',
        180,
      ],
      [
        mihai.id,
        "Hi Andrei, of course. Come on Tuesday after the 4th period, we'll do it in room 101.",
        150,
      ],
      [mihai.id, 'Please bring the medical note on Tuesday.', 149],
    ],
  });

  const [first, second] = class9A.filter((s) => s.userId !== andrei.id);
  const groupName = '9A · Mathematics';
  await conversation({
    type: 'GROUP',
    name: groupName,
    owner: mihai.id,
    members: class9A.map((s) => s.userId),
    readBy: [mihai.id, andrei.id],
    system: `${mihai.firstName} ${mihai.lastName} created the group “${groupName}”`,
    lines: [
      [
        mihai.id,
        'Hello everyone! I will post homework and test dates here.',
        300,
      ],
      [
        mihai.id,
        'Test on Friday: chapter 3, linear equations. Exercises 1-12 on page 54 for practice.',
        299,
      ],
      [first.userId, 'Will we have the formulas sheet during the test?', 240],
      [
        mihai.id,
        'No formulas sheet this time, but the test only covers what we did in class.',
        230,
      ],
      [second.userId, 'Thank you!', 228],
    ],
  });

  await conversation({
    type: 'DIRECT',
    owner: colleague.id,
    members: [mihai.id],
    readBy: [colleague.id, mihai.id],
    lines: [
      [
        colleague.id,
        'Hi Mihai, can we swap rooms on Thursday? I need the projector in 101.',
        400,
      ],
      [mihai.id, 'Sure, no problem. I will take 103.', 390],
    ],
  });

  return 3;
}

main()
  .catch((error: unknown) => {
    // P2021: a table is missing, i.e. the migrations haven't been applied.
    if ((error as { code?: string }).code === 'P2021') {
      console.error(
        'The database is missing tables: apply the migrations first with `npm run db:deploy`.',
      );
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

/**
 * Demo lectures (PDFs made on the fly), shared the way teachers would: with
 * a whole class, or with a few students from different classes. The
 * students got a notification for each, as in the app.
 */
async function seedLectures(options: {
  thisYearId: string;
  lastYearId: string;
  yearStart: Date;
  lastYearStart: Date;
  today: Date;
}): Promise<{ lectures: number; readers: number }> {
  const readers = new Set<string>();
  const day = 24 * 60 * 60 * 1000;
  for (const demo of DEMO_LECTURES) {
    const schoolYearId =
      demo.year === 'this' ? options.thisYearId : options.lastYearId;
    const start =
      demo.year === 'this' ? options.yearStart : options.lastYearStart;
    // Never in the future: a few hours ago at the latest.
    const createdAt = new Date(
      Math.min(
        start.getTime() + demo.day * day + 11 * 60 * 60 * 1000,
        options.today.getTime() - 3 * 60 * 60 * 1000,
      ),
    );

    const classes = await prisma.class.findMany({
      where: { schoolYearId },
      select: {
        id: true,
        name: true,
        subjects: {
          select: {
            teacherId: true,
            subject: { select: { id: true, name: true, color: true } },
          },
        },
        enrollments: {
          select: {
            studentId: true,
            student: { select: { registrationNumber: true } },
          },
          orderBy: { student: { registrationNumber: 'asc' } },
        },
      },
    });
    classes.sort((a, b) => compareClassNames(a.name, b.name));
    const byName = new Map(classes.map((c) => [c.name, c]));
    const taught = byName
      .get(demo.teacherOfClass)
      ?.subjects.find((cs) => cs.subject.name === demo.subject);
    if (!taught?.teacherId) continue;
    const teacher = await prisma.teacher.findUniqueOrThrow({
      where: { id: taught.teacherId },
      select: {
        id: true,
        userId: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const studentIds = new Set<string>();
    // Someone the teacher shared it with by mistake and removed later: the
    // access history shows both changes.
    let removedLater: string | undefined;
    if ('classes' in demo.audience) {
      for (const name of demo.audience.classes) {
        byName
          .get(name)
          ?.enrollments.forEach((e) => studentIds.add(e.studentId));
      }
    } else {
      for (const [name, count] of Object.entries(demo.audience.picks)) {
        const enrolled = byName.get(name)?.enrollments ?? [];
        enrolled.slice(0, count).forEach((e) => studentIds.add(e.studentId));
        removedLater ??= enrolled[count]?.studentId;
      }
      if (demo.audience.includeDemoStudent) {
        const demoStudent = await prisma.student.findFirst({
          where: { user: { email: `student@${EMAIL_DOMAIN}` } },
          select: { id: true },
        });
        if (demoStudent) studentIds.add(demoStudent.id);
      }
    }

    const teacherName = `${teacher.user.firstName} ${teacher.user.lastName}`;
    const startYear = start.getUTCFullYear();
    const rgb = SUBJECT_RGB[taught.subject.color];
    const pdf = makeLecturePdf({
      title: demo.title,
      subtitle: `${demo.subject} · ${teacherName} · ${startYear}–${startYear + 1}`,
      color: rgb,
      sections: demo.sections,
    });
    const fileKey = `lectures/${crypto.randomUUID()}.pdf`;
    await storage.put(fileKey, pdf, 'application/pdf');
    await prisma.lecture.create({
      data: {
        teacherId: teacher.id,
        subjectId: taught.subject.id,
        title: demo.title,
        description: demo.description,
        fileKey,
        fileName: demo.fileName,
        fileSize: pdf.length,
        createdAt,
        updatedAt: createdAt,
        access: {
          createMany: {
            data: [...studentIds].map((studentId) => ({
              studentId,
              grantedAt: createdAt,
            })),
          },
        },
        accessEvents: {
          createMany: {
            data: [
              ...[...studentIds, ...(removedLater ? [removedLater] : [])].map(
                (studentId) => ({
                  studentId,
                  action: LectureAccessAction.GRANTED,
                  actorId: teacher.userId,
                  createdAt,
                }),
              ),
              ...(removedLater
                ? [
                    {
                      studentId: removedLater,
                      action: LectureAccessAction.REVOKED,
                      actorId: teacher.userId,
                      createdAt: new Date(
                        Math.min(
                          createdAt.getTime() + 2 * 60 * 60 * 1000,
                          options.today.getTime() - 60 * 60 * 1000,
                        ),
                      ),
                    },
                  ]
                : []),
            ],
          },
        },
      },
    });
    studentIds.forEach((id) => readers.add(id));

    if (demo.year === 'this') {
      const users = await prisma.student.findMany({
        where: { id: { in: [...studentIds] } },
        select: { userId: true },
      });
      const message = lectureMessage(demo.title, demo.subject, teacherName);
      await prisma.notification.createMany({
        data: users.map(({ userId }) => ({
          userId,
          ...message,
          link: '/student/lectures',
          createdAt: new Date(createdAt.getTime() + 60_000),
        })),
      });
    }
  }
  return { lectures: DEMO_LECTURES.length, readers: readers.size };
}

/** The subjects' colours in the PDFs' headers (Tailwind's 600 shades). */
const SUBJECT_RGB: Record<SubjectColor, [number, number, number]> = {
  INDIGO: [79, 70, 229],
  VIOLET: [124, 58, 237],
  PINK: [219, 39, 119],
  ROSE: [225, 29, 72],
  ORANGE: [234, 88, 12],
  AMBER: [217, 119, 6],
  LIME: [101, 163, 13],
  EMERALD: [5, 150, 105],
  TEAL: [13, 148, 136],
  SKY: [2, 132, 199],
};
