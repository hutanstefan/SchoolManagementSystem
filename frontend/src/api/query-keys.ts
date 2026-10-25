/**
 * Query keys in one place. Mutations invalidate whole groups (e.g. every
 * "students" query) so lists, details and counters never show stale data.
 */
export const queryKeys = {
  students: {
    all: ['students'] as const,
    list: (params: object) => ['students', 'list', params] as const,
    detail: (id: string, schoolYearId?: string) =>
      ['students', 'detail', id, schoolYearId ?? null] as const,
  },
  teachers: {
    all: ['teachers'] as const,
    list: (params: object) => ['teachers', 'list', params] as const,
    detail: (id: string, schoolYearId?: string) =>
      ['teachers', 'detail', id, schoolYearId ?? null] as const,
    me: ['teachers', 'me'] as const,
    meIn: (schoolYearId?: string) =>
      ['teachers', 'me', schoolYearId ?? null] as const,
  },
  classes: {
    all: ['classes'] as const,
    list: (params: object) => ['classes', 'list', params] as const,
    detail: (id: string) => ['classes', 'detail', id] as const,
    students: (id: string) => ['classes', 'students', id] as const,
    /** Subjects and classes the user can import grades for. */
    gradeImportOptions: ['classes', 'grade-import-options'] as const,
  },
  subjects: {
    all: ['subjects'] as const,
  },
  timetable: {
    all: ['timetable'] as const,
    class: (id: string) => ['timetable', 'class', id] as const,
    teacher: (id: string, schoolYearId?: string) =>
      ['timetable', 'teacher', id, schoolYearId ?? null] as const,
    me: (schoolYearId?: string) =>
      ['timetable', 'me', schoolYearId ?? null] as const,
  },
  chat: {
    all: ['chat'] as const,
    contacts: (search: string) => ['chat', 'contacts', search] as const,
    conversations: ['chat', 'conversations'] as const,
    conversation: (id: string) => ['chat', 'conversation', id] as const,
    messages: (id: string) => ['chat', 'messages', id] as const,
    unreadCount: ['chat', 'unread-count'] as const,
  },
  schoolYears: {
    all: ['school-years'] as const,
    list: ['school-years', 'list'] as const,
    closing: ['school-years', 'closing'] as const,
  },
  lectures: {
    all: ['lectures'] as const,
    list: (params: object) => ['lectures', 'list', params] as const,
    detail: (id: string) => ['lectures', 'detail', id] as const,
    history: (id: string, page: number) =>
      ['lectures', 'history', id, page] as const,
    recipients: ['lectures', 'recipients'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (params: object) => ['notifications', 'list', params] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  grades: {
    all: ['grades'] as const,
    list: (params: object) => ['grades', 'list', params] as const,
    history: (id: string) => ['grades', 'history', id] as const,
    gradebook: (classId: string, subjectId: string, semester?: number) =>
      ['grades', 'gradebook', classId, subjectId, semester ?? null] as const,
    studentReport: (id: string, period: object) =>
      ['grades', 'report', id, period] as const,
    myReport: (period: object) => ['grades', 'report', 'me', period] as const,
    /** A student's whole year: both semesters, annual averages, re-exams. */
    studentYear: (id: string, schoolYearId?: string) =>
      ['grades', 'year', id, schoolYearId ?? null] as const,
    myYear: (schoolYearId?: string) =>
      ['grades', 'year', 'me', schoolYearId ?? null] as const,
    /** Dashboard figures: under "grades" so they refresh with every grade change. */
    schoolStats: (period: object) =>
      ['grades', 'stats', 'school', period] as const,
    teachingStats: (period: object) =>
      ['grades', 'stats', 'teaching', period] as const,
  },
}
