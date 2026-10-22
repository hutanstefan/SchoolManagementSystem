/**
 * Development seed: wipes the database and fills it with realistic demo data.
 * Run with `npm run db:seed`. Faker is seeded, so the data is the same on every run.
 *
 * With `--if-empty` it only seeds a database that has no users yet (used by
 * Docker on every start, so restarting the containers keeps your changes).
 */
import 'dotenv/config';
import { fakerRO as faker } from '@faker-js/faker';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  GradeAction,
  PrismaClient,
  Role,
  Weekday,
  type ClassSubject,
} from '../src/generated/prisma/client';
import { gradeMessage } from '../src/notifications/messages';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Every seeded account uses this password (see README > Test credentials). */
const DEFAULT_PASSWORD = 'Password123!';
const BCRYPT_ROUNDS = 10;
const EMAIL_DOMAIN = 'school.test';

/** Subjects and how many hours per week every class studies them (20 hours in total). */
const SUBJECTS = [
  { name: 'Mathematics', hoursPerWeek: 4, room: null },
  { name: 'Romanian Language', hoursPerWeek: 4, room: null },
  { name: 'English', hoursPerWeek: 2, room: null },
  { name: 'Physics', hoursPerWeek: 2, room: 'Physics lab' },
  { name: 'Chemistry', hoursPerWeek: 2, room: 'Chemistry lab' },
  { name: 'Biology', hoursPerWeek: 2, room: 'Biology lab' },
  { name: 'History', hoursPerWeek: 2, room: null },
  { name: 'Geography', hoursPerWeek: 2, room: null },
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

/** Grades skew towards 7-10, like in a real class. */
function randomGradeValue(): number {
  return faker.helpers.weightedArrayElement([
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
): TimetableSlot[] {
  const teacherBusy = new Set<string>(); // "teacherId|day|period"
  const entries: TimetableSlot[] = [];

  for (const classId of classIds) {
    const lessons = classSubjects
      .filter((cs) => cs.classId === classId)
      .flatMap((cs) => Array.from({ length: cs.hoursPerWeek }, () => cs));

    let placed: TimetableSlot[] | null = null;
    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      placed = tryPlace(faker.helpers.shuffle(lessons), classId);
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
  // Order matters because of foreign keys.
  await prisma.gradeHistory.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.classSubject.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.log('Database already has data, skipping the seed.');
    return;
  }

  faker.seed(2026);
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
      data: { name: subject.name },
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

  console.log('Creating classes and teaching assignments...');
  const classIds: string[] = [];
  const gradeLevelByClassId = new Map<string, number>(); // "10A" -> 10
  const classSubjects: (ClassSubject & { room: string })[] = [];
  for (const [classIndex, name] of CLASS_NAMES.entries()) {
    const schoolClass = await prisma.class.create({
      data: {
        name,
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
  const today = new Date();
  const yearStart = schoolYearStart(today);
  const grades: {
    studentId: string;
    subjectId: string;
    teacherId: string | null;
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
        class: classId ? { connect: { id: classId } } : undefined,
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

    // Each grade is given by the teacher who teaches that subject in the student's class.
    for (const classSubject of classSubjects.filter(
      (cs) => cs.classId === classId,
    )) {
      const count = faker.number.int({ min: 2, max: 4 });
      for (let i = 0; i < count; i++) {
        grades.push({
          studentId: student.id,
          subjectId: classSubject.subjectId,
          teacherId: classSubject.teacherId,
          value: randomGradeValue(),
          date: faker.date.between({ from: yearStart, to: today }),
        });
      }
    }
  }

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

  const conversations = await seedChat(today);

  console.log(
    `Done: 1 admin, ${teacherIds.length} teachers, ${classIds.length} classes, ` +
      `${subjects.size} subjects, ${classSubjects.length} teaching assignments, ` +
      `${timetable.length} timetable lessons, ${studentSlots.length} students, ${grades.length} grades, ` +
      `${notifications.count} notifications, ${conversations} conversations.`,
  );
  console.log(
    `Login with admin@${EMAIL_DOMAIN}, teacher@${EMAIL_DOMAIN} or student@${EMAIL_DOMAIN} / ${DEFAULT_PASSWORD}`,
  );
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
    where: { class: { name: '9A' } },
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
    const last = options.lines[options.lines.length - 1]!;
    const first = options.lines[0]!;
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
      [first!.userId, 'Will we have the formulas sheet during the test?', 240],
      [
        mihai.id,
        'No formulas sheet this time, but the test only covers what we did in class.',
        230,
      ],
      [second!.userId, 'Thank you!', 228],
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
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
