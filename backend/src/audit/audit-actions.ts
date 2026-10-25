/**
 * What each request that changes something is called in the activity log,
 * by route ("METHOD /path", as in the OpenAPI document). `null`: not logged
 * (private chat activity, marking things as read). A test checks that every
 * route of the API is listed here.
 */
export const AUDIT_CATEGORIES = [
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
  /** Things the app does by itself, e.g. deleting old log entries. */
  'System',
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export interface AuditAction {
  category: AuditCategory;
  action: string;
}

const a = (category: AuditCategory, action: string): AuditAction => ({
  category,
  action,
});

export const AUDIT_ACTIONS: Record<string, AuditAction | null> = {
  'POST /api/auth/login': a('Auth', 'Logged in'),
  'POST /api/auth/logout': a('Auth', 'Logged out'),

  'POST /api/school-years/current/end-semester': a(
    'School years',
    'Ended the first semester',
  ),
  'PUT /api/school-years/current/reexams': a(
    'School years',
    'Recorded a re-exam grade',
  ),
  'DELETE /api/school-years/current/reexams/{studentId}/{subjectId}': a(
    'School years',
    'Removed a re-exam grade',
  ),
  'POST /api/school-years/current/close': a(
    'School years',
    'Closed the school year',
  ),

  'POST /api/students': a('Students', 'Created a student'),
  'PATCH /api/students/{id}': a('Students', 'Updated a student'),
  'DELETE /api/students/{id}': a('Students', 'Deleted a student'),

  'POST /api/teachers': a('Teachers', 'Created a teacher'),
  'PATCH /api/teachers/{id}': a('Teachers', 'Updated a teacher'),
  'DELETE /api/teachers/{id}': a('Teachers', 'Deleted a teacher'),

  'POST /api/classes': a('Classes', 'Created a class'),
  'PATCH /api/classes/{id}': a('Classes', 'Updated a class'),
  'DELETE /api/classes/{id}': a('Classes', 'Deleted a class'),
  'POST /api/classes/{id}/students': a(
    'Classes',
    'Assigned students to a class',
  ),
  'DELETE /api/classes/{id}/students/{studentId}': a(
    'Classes',
    'Removed a student from a class',
  ),

  'POST /api/subjects': a('Subjects', 'Created a subject'),
  'PATCH /api/subjects/{id}': a('Subjects', 'Updated a subject'),
  'DELETE /api/subjects/{id}': a('Subjects', 'Deleted a subject'),

  'POST /api/classes/{id}/subjects': a(
    'Teaching assignments',
    'Added a subject to a class',
  ),
  'PATCH /api/class-subjects/{id}': a(
    'Teaching assignments',
    'Changed a teaching assignment',
  ),
  'DELETE /api/class-subjects/{id}': a(
    'Teaching assignments',
    'Removed a subject from a class',
  ),

  'POST /api/classes/{id}/timetable': a('Timetable', 'Added a lesson'),
  'PATCH /api/timetable-entries/{id}': a('Timetable', 'Moved a lesson'),
  'DELETE /api/timetable-entries/{id}': a('Timetable', 'Removed a lesson'),

  'POST /api/grades': a('Grades', 'Gave a grade'),
  'POST /api/grades/batch': a('Grades', 'Gave grades'),
  'POST /api/classes/{id}/grades': a('Grades', 'Gave grades to a class'),
  'PATCH /api/grades/{id}': a('Grades', 'Changed a grade'),
  'DELETE /api/grades/{id}': a('Grades', 'Deleted a grade'),

  'POST /api/classes/{id}/grade-scans': a(
    'Grade scans (AI)',
    'Read test photos with AI',
  ),
  'POST /api/grade-imports': a(
    'Grade imports (Excel)',
    'Read an Excel file of grades',
  ),

  'POST /api/chat/conversations/group': a('Chat', 'Created a chat group'),
  'PATCH /api/chat/conversations/{id}': a('Chat', 'Renamed a chat group'),
  'DELETE /api/chat/conversations/{id}': a('Chat', 'Deleted a chat group'),
  'POST /api/chat/conversations/{id}/members': a(
    'Chat',
    'Added people to a chat group',
  ),
  'DELETE /api/chat/conversations/{id}/members/{userId}': a(
    'Chat',
    'Removed someone from a chat group',
  ),
  // Private: what people write to each other isn't the admin's to read.
  'POST /api/chat/conversations/direct': null,
  'POST /api/chat/conversations/{id}/messages': null,
  'POST /api/chat/conversations/{id}/read': null,
  'DELETE /api/chat/messages/{id}': null,

  'PATCH /api/notifications/read-all': null,
  'PATCH /api/notifications/{id}/read': null,

  'POST /api/lectures': a('Lectures', 'Added a lecture'),
  'PATCH /api/lectures/{id}': a('Lectures', 'Edited a lecture'),
  'DELETE /api/lectures/{id}': a('Lectures', 'Deleted a lecture'),
  'PUT /api/lectures/{id}/students': a(
    'Lectures',
    'Changed who can read a lecture',
  ),
};

export const LOGIN_ROUTE = 'POST /api/auth/login';
export const LOGOUT_ROUTE = 'POST /api/auth/logout';

/** "PATCH" + "/api/grades/:id" -> "PATCH /api/grades/{id}" */
export function routeKey(method: string, routePath: string): string {
  return `${method.toUpperCase()} ${routePath.replace(/:(\w+)/g, '{$1}')}`;
}
