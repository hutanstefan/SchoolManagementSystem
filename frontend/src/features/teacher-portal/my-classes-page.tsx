import { ClipboardList, School, Users } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { TaughtClass } from './teaching'
import { useMyClasses } from './use-my-classes'

export function MyClassesPage() {
  const { profile, taught } = useMyClasses()

  return (
    <>
      <PageHeader
        title="My classes"
        description="Classes you teach or are the homeroom teacher of."
      />
      {profile.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : profile.error ? (
        <Card>
          <ErrorState
            error={profile.error}
            onRetry={() => void profile.refetch()}
          />
        </Card>
      ) : taught.length === 0 ? (
        <Card>
          <EmptyState
            icon={School}
            title="No classes yet"
            description="The administrator assigns teachers to classes and subjects."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {taught.map((c) => (
            <ClassCard key={c.id} taughtClass={c} />
          ))}
        </div>
      )}
    </>
  )
}

function ClassCard({ taughtClass: c }: { taughtClass: TaughtClass }) {
  const hours = c.subjects.reduce((sum, s) => sum + s.hoursPerWeek, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <Link to={`/teacher/classes/${c.id}`} className="hover:underline">
            Class {c.name}
          </Link>
        </CardTitle>
        <CardDescription>
          {c.studentCount === null
            ? '…'
            : `${c.studentCount} ${c.studentCount === 1 ? 'student' : 'students'}`}
          {hours > 0 && ` · ${hours} h / week`}
        </CardDescription>
        {c.isHomeroom && (
          <CardAction>
            <Badge variant="secondary">Homeroom</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {c.subjects.length > 0 ? (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label="Subjects you teach"
          >
            {c.subjects.map((s) => (
              <li key={s.id}>
                <Badge variant="outline">
                  {s.name}
                  <span className="text-muted-foreground">
                    {s.hoursPerWeek} h
                  </span>
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            You don't teach a subject here. As homeroom teacher you can see
            every gradebook.
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button asChild size="sm">
          <Link to={`/teacher/classes/${c.id}?tab=gradebook`}>
            <ClipboardList aria-hidden /> Gradebook
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={`/teacher/classes/${c.id}?tab=students`}>
            <Users aria-hidden /> Students
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
