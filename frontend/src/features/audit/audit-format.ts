import type { AuditCategory, AuditChange, AuditKind } from './api'

export const AUDIT_CATEGORIES: AuditCategory[] = [
  'Auth',
  'School years',
  'Students',
  'Teachers',
  'Classes',
  'Subjects',
  'Teaching assignments',
  'Timetable',
  'Grades',
  'Grade scans (AI)',
  'Grade imports (Excel)',
  'Chat',
  'Lectures',
  'System',
]

export const KIND_LABELS: Record<AuditKind, string> = {
  CHANGE: 'Changes',
  LOGIN: 'Logins',
  LOGOUT: 'Logouts',
  LOGIN_FAILED: 'Failed logins',
}

const MODEL_LABELS: Record<string, string> = {
  User: 'Account',
  ClassSubject: 'Teaching assignment',
  TimetableEntry: 'Lesson',
  SchoolYear: 'School year',
  Reexam: 'Re-exam',
  LectureAccess: 'Lecture access',
  ConversationMember: 'Chat group member',
  Conversation: 'Chat group',
}

/** "TimetableEntry" -> "Lesson" */
export function modelLabel(model: string): string {
  return MODEL_LABELS[model] ?? model
}

export const OP_LABELS: Record<AuditChange['op'], string> = {
  create: 'Created',
  update: 'Changed',
  delete: 'Deleted',
}

const FIELD_LABELS: Record<string, string> = {
  passwordHash: 'password',
  homeroomTeacherId: 'homeroom teacher',
  previousClassId: 'previous class',
  hoursPerWeek: 'hours per week',
  registrationNumber: 'registration number',
  dateOfBirth: 'date of birth',
  fileKey: 'file',
  fileName: 'file name',
  fileSize: 'file size',
  currentSemester: 'current semester',
  semester1EndedAt: 'semester 1 ended',
}

/**
 * "user.firstName" -> "first name", "subjectId" -> "subject",
 * "hoursPerWeek" -> "hours per week".
 */
export function fieldLabel(field: string): string {
  const name = field.split('.').pop() ?? field
  if (FIELD_LABELS[name]) return FIELD_LABELS[name]
  return name
    .replace(/Id$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/**
 * A logged value as people read it: names instead of ids, dates in full,
 * "—" for nothing.
 */
export function formatValue(
  value: unknown,
  names: Record<string, string>,
): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'string') {
    if (names[value]) return names[value]
    if (ISO_DATE.test(value)) {
      const date = new Date(value)
      // Date-only fields are stored at midnight UTC.
      return value.endsWith('T00:00:00.000Z')
        ? date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          })
        : date.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
    }
    return value
  }
  return typeof value === 'number' ? String(value) : JSON.stringify(value)
}

/** "Mozilla/5.0 (Windows NT 10.0...) Chrome/131..." -> "Chrome on Windows" */
export function browserOf(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : null
  const system = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null
  if (browser && system) return `${browser} on ${system}`
  return browser ?? system ?? userAgent.slice(0, 60)
}
