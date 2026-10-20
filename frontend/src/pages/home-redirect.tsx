import { Navigate } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { HOME_PATH } from '@/auth/roles'
import { FullPageSpinner } from '@/components/full-page-spinner'

/** "/" sends users to their dashboard, or to the login page. */
export function HomeRedirect() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullPageSpinner />
  return <Navigate to={user ? HOME_PATH[user.role] : '/login'} replace />
}
