/**
 * Query keys in one place. Mutations invalidate whole groups (e.g. every
 * "students" query) so lists, details and counters never show stale data.
 */
export const queryKeys = {
  students: {
    all: ['students'] as const,
    list: (params: object) => ['students', 'list', params] as const,
    detail: (id: string) => ['students', 'detail', id] as const,
  },
  teachers: {
    all: ['teachers'] as const,
    list: (params: object) => ['teachers', 'list', params] as const,
    detail: (id: string) => ['teachers', 'detail', id] as const,
    me: ['teachers', 'me'] as const,
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
    teacher: (id: string) => ['timetable', 'teacher', id] as const,
    me: ['timetable', 'me'] as const,
  },
  grades: {
    all: ['grades'] as const,
    list: (params: object) => ['grades', 'list', params] as const,
    history: (id: string) => ['grades', 'history', id] as const,
    gradebook: (classId: string, subjectId: string) =>
      ['grades', 'gradebook', classId, subjectId] as const,
    studentReport: (id: string) => ['grades', 'report', id] as const,
    myReport: ['grades', 'report', 'me'] as const,
  },
}
