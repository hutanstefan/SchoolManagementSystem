import { useAuth } from '@/auth/auth-context'
import { ROLE_LABEL } from '@/auth/roles'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/** Welcome page; each role gets its full dashboard in a later step. */
export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.firstName}`}
        description="Here is an overview of your account."
      />
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>
            {user.firstName} {user.lastName}
          </CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          <Badge>{ROLE_LABEL[user.role]}</Badge>
          {user.student && (
            <Badge variant="secondary">
              {user.student.class
                ? `Class ${user.student.class.name}`
                : 'Not enrolled in a class'}
            </Badge>
          )}
        </CardContent>
      </Card>
    </>
  )
}
