import { ClipboardList, FileSpreadsheet, School, Users } from 'lucide-react'
import { Link } from 'react-router'
import { ClassTile } from '@/components/class-tile'
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
import { useTeachingStats, type TeachingStatsRow } from '@/features/stats/api'
import { cn } from '@/lib/utils'
import type { TaughtClass } from './teaching'
import { useMyClasses } from './use-my-classes'
import { SubjectDot } from '@/features/subjects/subject-icon'
import { usePeriod } from '@/periods/period-context'

export function MyClassesPage() {
  const { profile, taught } = useMyClasses()
  const { isArchived, year } = usePeriod()
  const stats = useTeachingStats()

  return (
    <>
      <PageHeader
        title="My classes"
        description={`Classes you teach or are the homeroom teacher of in ${year?.name ?? 'this school year'}.`}
        actions={
          !isArchived && (
            <Button asChild variant="outline">
              <Link to="/teacher/grades/import">
                <FileSpreadsheet aria-hidden /> Import grades from Excel
              </Link>
            </Button>
          )
        }
      />
      {profile.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {taught.map((c) => (
            <ClassCard
              key={c.id}
              taughtClass={c}
              stats={stats.data?.rows.filter((r) => r.class.id === c.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}

function ClassCard({
  taughtClass: c,
  stats,
}: {
  taughtClass: TaughtClass
  /** The teacher's subjects in this class (none for a homeroom-only class). */
  stats: TeachingStatsRow[] | undefined
}) {
  const hours = c.subjects.reduce((sum, s) => sum + s.hoursPerWeek, 0)
  const averages = (stats ?? [])
    .map((r) => r.average)
    .filter((a): a is number => a !== null)
  const average =
    averages.length > 0
      ? averages.reduce((sum, a) => sum + a, 0) / averages.length
      : null
  const missing = (stats ?? []).reduce(
    (sum, r) => sum + r.studentsMissingGrades,
    0,
  )
  const failing = (stats ?? []).reduce((sum, r) => sum + r.studentsAtRisk, 0)

  return (
    <Card className="hover:shadow-lifted transition-shadow">
      <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-x-3 has-data-[slot=card-action]:grid-cols-[auto_1fr_auto]">
        <ClassTile name={c.name} className="row-span-2 size-12 text-base" />
        <CardTitle className="text-lg">
          <Link to={`/teacher/classes/${c.id}`} className="hover:underline">
            Class {c.name}
          </Link>
        </CardTitle>
        <CardDescription className="col-start-2">
          {c.studentCount === null
            ? '…'
            : `${c.studentCount} ${c.studentCount === 1 ? 'student' : 'students'}`}
          {hours > 0 && ` · ${hours} h / week`}
        </CardDescription>
        {c.isHomeroom && (
          <CardAction className="col-start-3 self-center">
            <Badge variant="primary-soft">Homeroom</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {stats && stats.length > 0 && (
          <dl className="bg-muted/40 grid grid-cols-3 gap-2 rounded-lg p-3 text-center">
            <ClassFigure
              label="Average"
              value={average === null ? '—' : average.toFixed(2)}
            />
            <ClassFigure
              label="Under 5"
              value={failing}
              className={failing > 0 ? 'text-destructive' : undefined}
            />
            <ClassFigure
              label="Need grades"
              value={missing}
              className={
                missing > 0 ? 'text-amber-600 dark:text-amber-400' : undefined
              }
            />
          </dl>
        )}
        {c.subjects.length > 0 ? (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label="Subjects you teach"
          >
            {c.subjects.map((s) => (
              <li key={s.id}>
                <Badge variant="outline">
                  <SubjectDot color={s.color} />
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
      <CardFooter className="flex-wrap gap-2">
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

function ClassFigure({
  label,
  value,
  className,
}: {
  label: string
  value: string | number
  className?: string
}) {
  return (
    <div>
      <dd className={cn('text-lg font-semibold tabular-nums', className)}>
        {value}
      </dd>
      <dt className="text-muted-foreground text-xs">{label}</dt>
    </div>
  )
}
