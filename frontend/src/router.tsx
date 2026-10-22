import { createBrowserRouter, type RouteObject } from 'react-router'
import { RequireAuth } from '@/auth/require-auth'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { AppLayout } from '@/components/layout/app-layout'
import { HomeRedirect } from '@/pages/home-redirect'
import { NotFoundPage } from '@/pages/not-found-page'

/**
 * Feature pages are loaded on demand, so a student never downloads the admin
 * screens and the first load stays small.
 */
const admin = {
  dashboard: () =>
    import('@/features/dashboard/admin-dashboard-page').then((m) => ({
      Component: m.AdminDashboardPage,
    })),
  students: () =>
    import('@/features/students/students-page').then((m) => ({
      Component: m.StudentsPage,
    })),
  student: () =>
    import('@/features/students/student-detail-page').then((m) => ({
      Component: m.StudentDetailPage,
    })),
  teachers: () =>
    import('@/features/teachers/teachers-page').then((m) => ({
      Component: m.TeachersPage,
    })),
  teacher: () =>
    import('@/features/teachers/teacher-detail-page').then((m) => ({
      Component: m.TeacherDetailPage,
    })),
  classes: () =>
    import('@/features/classes/classes-page').then((m) => ({
      Component: m.ClassesPage,
    })),
  class: () =>
    import('@/features/classes/class-detail-page').then((m) => ({
      Component: m.ClassDetailPage,
    })),
  subjects: () =>
    import('@/features/subjects/subjects-page').then((m) => ({
      Component: m.SubjectsPage,
    })),
  grades: () =>
    import('@/features/grades/grades-page').then((m) => ({
      Component: m.GradesPage,
    })),
}

/** Shared by admins and teachers. */
const importGrades = () =>
  import('@/features/grade-imports/import-grades-page').then((m) => ({
    Component: m.ImportGradesPage,
  }))

/** Shared by admins and teachers. */
const scanTests = () =>
  import('@/features/grade-scans/scan-tests-page').then((m) => ({
    Component: m.ScanTestsPage,
  }))

const teacher = {
  dashboard: () =>
    import('@/features/teacher-portal/teacher-dashboard-page').then((m) => ({
      Component: m.TeacherDashboardPage,
    })),
  classes: () =>
    import('@/features/teacher-portal/my-classes-page').then((m) => ({
      Component: m.MyClassesPage,
    })),
  class: () =>
    import('@/features/teacher-portal/my-class-page').then((m) => ({
      Component: m.MyClassPage,
    })),
  student: () =>
    import('@/features/teacher-portal/student-report-page').then((m) => ({
      Component: m.StudentReportPage,
    })),
}

const student = {
  dashboard: () =>
    import('@/features/student-portal/student-dashboard-page').then((m) => ({
      Component: m.StudentDashboardPage,
    })),
  grades: () =>
    import('@/features/student-portal/my-grades-page').then((m) => ({
      Component: m.MyGradesPage,
    })),
  class: () =>
    import('@/features/student-portal/my-class-page').then((m) => ({
      Component: m.StudentClassPage,
    })),
}

/** Shared by teachers and students. */
const myTimetable = () =>
  import('@/features/timetable/my-timetable-page').then((m) => ({
    Component: m.MyTimetablePage,
  }))

export const routes: RouteObject[] = [
  {
    // Shown while the first lazy page of a fresh page load is downloading.
    HydrateFallback: FullPageSpinner,
    children: [
      { path: '/', element: <HomeRedirect /> },
      {
        path: '/login',
        lazy: () =>
          import('@/pages/login-page').then((m) => ({
            Component: m.LoginPage,
          })),
      },
      {
        path: '/admin',
        element: (
          <RequireAuth roles={['ADMIN']}>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, lazy: admin.dashboard },
          { path: 'students', lazy: admin.students },
          { path: 'students/:id', lazy: admin.student },
          { path: 'teachers', lazy: admin.teachers },
          { path: 'teachers/:id', lazy: admin.teacher },
          { path: 'classes', lazy: admin.classes },
          { path: 'classes/:id', lazy: admin.class },
          { path: 'classes/:id/scan', lazy: scanTests },
          { path: 'grades/import', lazy: importGrades },
          { path: 'subjects', lazy: admin.subjects },
          { path: 'grades', lazy: admin.grades },
        ],
      },
      {
        path: '/teacher',
        element: (
          <RequireAuth roles={['TEACHER']}>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, lazy: teacher.dashboard },
          { path: 'classes', lazy: teacher.classes },
          { path: 'classes/:id', lazy: teacher.class },
          { path: 'classes/:id/scan', lazy: scanTests },
          { path: 'grades/import', lazy: importGrades },
          { path: 'students/:id', lazy: teacher.student },
          { path: 'timetable', lazy: myTimetable },
        ],
      },
      {
        path: '/student',
        element: (
          <RequireAuth roles={['STUDENT']}>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, lazy: student.dashboard },
          { path: 'grades', lazy: student.grades },
          { path: 'class', lazy: student.class },
          { path: 'timetable', lazy: myTimetable },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
