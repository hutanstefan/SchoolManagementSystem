/**
 * Pure helpers of the activity log: which models are logged, how a Prisma
 * write becomes a list of field changes, and how a record is named.
 */

/** Models whose changes are logged. Notifications, chat messages and the histories that are logs themselves are not. */
export const AUDITED_MODELS = new Set([
  'User',
  'Student',
  'Teacher',
  'Class',
  'SchoolYear',
  'Enrollment',
  'Reexam',
  'Subject',
  'ClassSubject',
  'TimetableEntry',
  'Grade',
  'Conversation',
  'ConversationMember',
  'Lecture',
  'LectureAccess',
]);

/** Fields that change by themselves or say nothing to a reader. */
const IGNORED_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'lastReadAt',
  'lastMessageAt',
  'tokenVersion',
  'grantedAt',
  'joinedAt',
]);

/** Fields whose values are never written to the log. */
const HIDDEN_FIELDS = new Set(['passwordHash']);
export const HIDDEN = '[hidden]';

const MAX_TEXT = 200;

/** A value as it is stored in the log: JSON-safe and short. */
export function normalize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') {
    return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Buffer.isBuffer(value)) return '[binary]';
  if (typeof value === 'object') {
    // Prisma operations on a field: { set: 3 }, { increment: 1 }...
    const ops = value as Record<string, unknown>;
    if ('set' in ops) return normalize(ops.set);
    if ('increment' in ops) return `+${String(ops.increment)}`;
    if ('decrement' in ops) return `-${String(ops.decrement)}`;
    if ('toJSON' in ops && typeof ops.toJSON === 'function') {
      return normalize((ops.toJSON as () => unknown)());
    }
    const text = JSON.stringify(value);
    return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
  }
  // Symbols and functions are never stored.
  return null;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !Buffer.isBuffer(value);

/**
 * The scalar fields a Prisma `data` argument sets. A relation connected by
 * id becomes its foreign key (`class: { connect: { id } }` -> `classId`);
 * a related record created with it is flattened one level (`user.firstName`).
 */
export function flattenData(data: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isPlainObject(data)) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (isPlainObject(value)) {
      const connect = value.connect;
      if (isPlainObject(connect) && typeof connect.id === 'string') {
        out[`${key}Id`] = connect.id;
        continue;
      }
      const nested = isPlainObject(value.create)
        ? value.create
        : isPlainObject(value.update)
          ? value.update
          : null;
      if (nested) {
        for (const [field, inner] of Object.entries(nested)) {
          if (inner !== undefined && !isPlainObject(inner)) {
            out[`${key}.${field}`] = inner;
          }
        }
        continue;
      }
      if (
        'set' in value ||
        'increment' in value ||
        'decrement' in value ||
        'toJSON' in value
      ) {
        out[key] = value;
      }
      // Other nested writes (createMany, disconnect...) are logged as their own changes.
      continue;
    }
    if (Array.isArray(value)) continue;
    out[key] = value;
  }
  return out;
}

const shown = (field: string, value: unknown): unknown =>
  HIDDEN_FIELDS.has(field.split('.').pop()!) ? HIDDEN : normalize(value);

/**
 * The relations a Prisma `data` argument writes through (`user: { update:
 * {...} }`): their current values are read too, to log what changed.
 */
export function nestedWrites(data: unknown): string[] {
  if (!isPlainObject(data)) return [];
  return Object.entries(data)
    .filter(
      ([, value]) =>
        isPlainObject(value) &&
        (isPlainObject(value.update) || isPlainObject(value.create)),
    )
    .map(([key]) => key);
}

/** A record read with its related records, flattened like flattenData. */
export function flattenRecord(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (isPlainObject(value)) {
      for (const [field, inner] of Object.entries(value)) {
        if (!isPlainObject(inner) && !Array.isArray(inner)) {
          out[`${key}.${field}`] = inner;
        }
      }
    } else if (!Array.isArray(value)) {
      out[key] = value;
    }
  }
  return out;
}

/** The fields a new record was created with. */
export function createdFields(
  data: Record<string, unknown>,
): Record<string, [unknown, unknown]> {
  const fields: Record<string, [unknown, unknown]> = {};
  for (const [field, value] of Object.entries(data)) {
    if (IGNORED_FIELDS.has(field)) continue;
    fields[field] = [null, shown(field, value)];
  }
  return fields;
}

/** The fields of a deleted record. */
export function deletedFields(
  record: Record<string, unknown>,
): Record<string, [unknown, unknown]> {
  const fields: Record<string, [unknown, unknown]> = {};
  for (const [field, value] of Object.entries(record)) {
    if (IGNORED_FIELDS.has(field) || value === null) continue;
    fields[field] = [shown(field, value), null];
  }
  return fields;
}

/** The fields an update really changes (before -> after); empty if none. */
export function changedFields(
  before: Record<string, unknown>,
  data: Record<string, unknown>,
): Record<string, [unknown, unknown]> {
  const fields: Record<string, [unknown, unknown]> = {};
  for (const [field, value] of Object.entries(data)) {
    if (IGNORED_FIELDS.has(field.split('.').pop()!)) continue;
    const old = normalize(before[field]);
    const next = normalize(value);
    if (JSON.stringify(old) === JSON.stringify(next)) continue;
    fields[field] = HIDDEN_FIELDS.has(field.split('.').pop()!)
      ? [HIDDEN, HIDDEN]
      : [old, next];
  }
  return fields;
}

/** Foreign keys whose records are named in the log, and what they point to. */
export const REF_FIELDS = {
  studentId: 'student',
  teacherId: 'teacher',
  homeroomTeacherId: 'teacher',
  subjectId: 'subject',
  classId: 'class',
  previousClassId: 'class',
  userId: 'user',
  lectureId: 'lecture',
  schoolYearId: 'schoolYear',
} as const;

export type RefKind = (typeof REF_FIELDS)[keyof typeof REF_FIELDS];

/** The ids a record refers to, by kind. */
export function refsOf(
  record: Record<string, unknown>,
): { kind: RefKind; id: string }[] {
  const refs: { kind: RefKind; id: string }[] = [];
  for (const [field, kind] of Object.entries(REF_FIELDS)) {
    const id = record[field];
    if (typeof id === 'string') refs.push({ kind, id });
  }
  return refs;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined;

const fullName = (record: Record<string, unknown>, prefix = '') => {
  const first = text(record[`${prefix}firstName`]);
  const last = text(record[`${prefix}lastName`]);
  return first && last ? `${first} ${last}` : undefined;
};

/**
 * A readable name for a record, e.g. "9 in Mathematics for Andrei
 * Georgescu". `names` maps ids to the names of the records they refer to.
 */
export function describe(
  model: string,
  record: Record<string, unknown>,
  names: Record<string, string>,
): string | null {
  const ref = (field: string) => {
    const id = record[field];
    return typeof id === 'string' ? names[id] : undefined;
  };
  const join = (...parts: (string | undefined)[]) =>
    parts.every((part) => part === undefined)
      ? null
      : parts.filter(Boolean).join(' ');
  switch (model) {
    case 'User':
      return fullName(record) ?? text(record.email) ?? null;
    case 'Student':
    case 'Teacher':
      return (
        fullName(record, 'user.') ??
        ref('userId') ??
        text(record.registrationNumber) ??
        null
      );
    case 'Class':
    case 'Subject':
    case 'Conversation':
      return text(record.name) ?? null;
    case 'Lecture':
      return text(record.title) ?? null;
    case 'SchoolYear': {
      const start = Number(record.startYear);
      return Number.isFinite(start) ? `${start}–${start + 1}` : null;
    }
    case 'Grade':
      return join(
        text(record.value),
        ref('subjectId') && `in ${ref('subjectId')}`,
        ref('studentId') && `for ${ref('studentId')}`,
      );
    case 'Reexam':
      return join(
        text(record.grade),
        ref('subjectId') && `in ${ref('subjectId')}`,
        ref('studentId') && `for ${ref('studentId')}`,
      );
    case 'Enrollment':
      return join(ref('studentId'), ref('classId') && `in ${ref('classId')}`);
    case 'ClassSubject':
      return join(ref('subjectId'), ref('classId') && `in ${ref('classId')}`);
    case 'TimetableEntry':
      return join(
        text(record.day)?.toLowerCase(),
        text(record.period) && `period ${text(record.period)}`,
      );
    case 'LectureAccess':
      return join(
        ref('studentId'),
        ref('lectureId') && `· ${ref('lectureId')}`,
      );
    case 'ConversationMember':
      return ref('userId') ?? null;
    default:
      return null;
  }
}
