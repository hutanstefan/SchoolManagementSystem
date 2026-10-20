import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ADMIN_USER, page, renderWithAuth, STUDENT_USER } from '@/test/render'
import { RequireAuth } from './require-auth'

const routes = [
  { path: '/login', element: page('Login page') },
  {
    path: '/admin',
    element: <RequireAuth roles={['ADMIN']}>{page('Admin area')}</RequireAuth>,
  },
]

describe('RequireAuth', () => {
  it('sends anonymous users to the login page', () => {
    const { router } = renderWithAuth(routes, { path: '/admin' })

    expect(screen.getByText('Login page')).toBeInTheDocument()
    // Remembers where to come back after logging in.
    expect(router.state.location.state).toEqual({ from: '/admin' })
  })

  it('shows the page to a user with an allowed role', () => {
    renderWithAuth(routes, {
      path: '/admin',
      auth: { status: 'authenticated', user: ADMIN_USER },
    })

    expect(screen.getByText('Admin area')).toBeInTheDocument()
  })

  it('shows "Access denied" to a user with another role', () => {
    renderWithAuth(routes, {
      path: '/admin',
      auth: { status: 'authenticated', user: STUDENT_USER },
    })

    expect(screen.getByText('Access denied')).toBeInTheDocument()
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument()
  })

  it('waits while the session is being restored', () => {
    renderWithAuth(routes, { path: '/admin', auth: { status: 'loading' } })

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})
