import { ShieldX } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { HOME_PATH } from '@/auth/roles'
import { Button } from '@/components/ui/button'

export function ForbiddenPage() {
  const { user } = useAuth()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <ShieldX className="text-muted-foreground size-12" aria-hidden />
      <div>
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground mt-1">
          You don&apos;t have permission to view this page.
        </p>
      </div>
      <Button asChild>
        <Link to={user ? HOME_PATH[user.role] : '/login'}>
          Go to my dashboard
        </Link>
      </Button>
    </div>
  )
}
