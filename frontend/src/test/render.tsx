import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router'
import { AuthContext, type AuthContextValue } from '@/auth/auth-context'
import type { AuthUser } from '@/auth/roles'

export const ADMIN_USER: AuthUser = {
  id: 'u-admin',
  email: 'admin@school.test',
  firstName: 'Ana',
  lastName: 'Popescu',
  role: 'ADMIN',
  student: null,
  teacher: null,
}

export const STUDENT_USER: AuthUser = {
  id: 'u-student',
  email: 'student@school.test',
  firstName: 'Andrei',
  lastName: 'Georgescu',
  role: 'STUDENT',
  student: {
    id: 's-1',
    dateOfBirth: '2011-07-25',
    class: { id: 'c-9a', name: '9A' },
  },
  teacher: null,
}

/** Renders routes with a fake auth state, without calling the API. */
export function renderWithAuth(
  routes: RouteObject[],
  { path, auth = {} }: { path: string; auth?: Partial<AuthContextValue> },
) {
  const value: AuthContextValue = {
    status: 'anonymous',
    user: null,
    login: () => Promise.reject(new Error('not mocked')),
    logout: () => Promise.resolve(),
    ...auth,
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={value}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
  return { ...utils, router }
}

export function page(text: string): ReactElement {
  return <h1>{text}</h1>
}
