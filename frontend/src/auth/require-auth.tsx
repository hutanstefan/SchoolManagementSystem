import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { ForbiddenPage } from '@/pages/forbidden-page'
import { useAuth } from './auth-context'
import type { Role } from './roles'

/**
 * Guards a group of routes: anonymous users go to /login (and come back
 * afterwards), users with another role get a 403 page.
 *
 * This is only for user experience; the API enforces the same rules.
 */
export function RequireAuth({
  roles,
  children,
}: {
  roles: Role[]
  children: ReactNode
}) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!roles.includes(user.role)) return <ForbiddenPage />
  return children
}
