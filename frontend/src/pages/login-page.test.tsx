import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { ADMIN_USER, page, renderWithAuth, STUDENT_USER } from '@/test/render'
import { LoginPage } from './login-page'

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/admin', element: page('Admin dashboard') },
  { path: '/student', element: page('Student dashboard') },
]

describe('LoginPage', () => {
  it('validates the form before calling the API', async () => {
    const login = vi.fn()
    renderWithAuth(routes, { path: '/login', auth: { login } })

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it("logs in and opens the user's dashboard", async () => {
    const login = vi.fn().mockResolvedValue(STUDENT_USER)
    renderWithAuth(routes, { path: '/login', auth: { login } })

    await userEvent.type(screen.getByLabelText('Email'), 'student@school.test')
    await userEvent.type(screen.getByLabelText('Password'), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Student dashboard')).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith('student@school.test', 'Password123!')
  })

  it('shows the error returned by the API', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiError(401, 'Invalid email or password'))
    renderWithAuth(routes, { path: '/login', auth: { login } })

    await userEvent.type(screen.getByLabelText('Email'), 'admin@school.test')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByText('Invalid email or password'),
    ).toBeInTheDocument()
  })

  it('logs in with a demo account in one click', async () => {
    const login = vi.fn().mockResolvedValue(ADMIN_USER)
    renderWithAuth(routes, { path: '/login', auth: { login } })

    await userEvent.click(
      screen.getByRole('button', { name: 'Log in as Administrator' }),
    )

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith('admin@school.test', 'Password123!'),
    )
    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument()
  })

  it('redirects a user who is already logged in', async () => {
    renderWithAuth(routes, {
      path: '/login',
      auth: { status: 'authenticated', user: ADMIN_USER },
    })

    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument()
  })
})
