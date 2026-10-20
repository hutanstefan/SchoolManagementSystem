import { createBrowserRouter, type RouteObject } from 'react-router'
import { RequireAuth } from '@/auth/require-auth'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardPage } from '@/pages/dashboard-page'
import { HomeRedirect } from '@/pages/home-redirect'
import { LoginPage } from '@/pages/login-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { PlaceholderPage } from '@/pages/placeholder-page'

export const routes: RouteObject[] = [
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: (
      <RequireAuth roles={['ADMIN']}>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'students', element: <PlaceholderPage title="Students" /> },
      { path: 'teachers', element: <PlaceholderPage title="Teachers" /> },
      { path: 'classes', element: <PlaceholderPage title="Classes" /> },
      { path: 'subjects', element: <PlaceholderPage title="Subjects" /> },
      { path: 'grades', element: <PlaceholderPage title="Grades" /> },
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
      { path: 'timetable', element: <PlaceholderPage title="My timetable" /> },
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
      { path: 'timetable', element: <PlaceholderPage title="My timetable" /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export const router = createBrowserRouter(routes)
