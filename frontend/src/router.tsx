import { createBrowserRouter, type RouteObject } from 'react-router'
import { RequireAuth } from '@/auth/require-auth'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardPage } from '@/pages/dashboard-page'
import { HomeRedirect } from '@/pages/home-redirect'
import { NotFoundPage } from '@/pages/not-found-page'
import { PlaceholderPage } from '@/pages/placeholder-page'

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
          { index: true, element: <DashboardPage /> },
          { path: 'classes', element: <PlaceholderPage title="My classes" /> },
          {
            path: 'timetable',
            element: <PlaceholderPage title="My timetable" />,
          },
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
          { index: true, element: <DashboardPage /> },
          { path: 'grades', element: <PlaceholderPage title="My grades" /> },
          {
            path: 'timetable',
            element: <PlaceholderPage title="My timetable" />,
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
