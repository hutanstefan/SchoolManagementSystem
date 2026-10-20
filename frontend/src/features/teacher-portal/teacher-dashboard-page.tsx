import {
  CalendarDays,
  ClipboardList,
  GraduationCap,
  School,
} from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useGrades, type Grade } from '@/features/grades/api'
import { gradeTone } from '@/features/grades/grade-tone'
import { useMyTimetable } from '@/features/timetable/api'
import { TodayLessons } from '@/features/timetable/today-lessons'
import {
  formatDate,
  formatLongDate,
  fullName,
  todayWeekday,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMyClasses } from './use-my-classes'

const gradeColumns: Column<Grade>[] = [
  {
    header: 'Student',
    cell: (g) => (
      <Link
        to={`/teacher/students/${g.student.id}`}
        className="font-medium hover:underline"
      >
        {fullName(g.student)}
      </Link>
    ),
  },
  {
    header: 'Subject',
    cell: (g) => (
      <span>
        {g.subject.name}
        {g.class && (
          <span className="text-muted-foreground"> · {g.class.name}</span>
        )}
      </span>
    ),
  },
  {
    header: 'Grade',
    cell: (g) => (
      <span
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md border text-sm font-semibold',
          gradeTone(g.value),
        )}
      >
        {g.value}
      </span>
    ),
  },
  {
    header: 'Date',
    cell: (g) => formatDate(g.date),
    className: 'hidden whitespace-nowrap sm:table-cell',
  },
]

export function TeacherDashboardPage() {
  const { user } = useAuth()
  const { profile, classes, taught } = useMyClasses()
  const timetable = useMyTimetable()
  const latestGrades = useGrades({ pageSize: 6, sort: 'date', order: 'desc' })

  const studentCount = classes.data?.data.reduce(
    (sum, c) => sum + c.studentCount,
    0,
  )
  const hours = profile.data?.teaching.reduce(
    (sum, a) => sum + a.hoursPerWeek,
    0,
  )
  const today = todayWeekday()
  const lessonsToday = today
    ? (timetable.data?.days.find((d) => d.day === today)?.lessons.length ?? 0)
    : 0
  const homerooms = profile.data?.homeroomClasses ?? []

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.firstName ?? ''}`}
        description={formatLongDate()}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My classes"
          value={taught.length}
          icon={School}
          isLoading={profile.isPending}
          hint={
            homerooms.length > 0 && (
              <>
                Homeroom teacher of{' '}
                {homerooms.map((c, index) => (
                  <span key={c.id}>
                    {index > 0 && ', '}
                    <Link
                      to={`/teacher/classes/${c.id}`}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                  </span>
                ))}
              </>
            )
          }
        />
        <StatCard
          label="Students"
          value={studentCount}
          icon={GraduationCap}
          isLoading={classes.isPending}
        />
        <StatCard
          label="Hours per week"
          value={hours}
          icon={CalendarDays}
          isLoading={profile.isPending}
        />
        <StatCard
          label="Lessons today"
          value={today ? lessonsToday : '—'}
          hint={!today && 'Weekend'}
          icon={ClipboardList}
          isLoading={timetable.isPending}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="gap-0 py-0 lg:col-span-3">
          <SectionHeader
            title="Today's lessons"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/teacher/timetable">Full timetable</Link>
              </Button>
            }
          />
          {timetable.isPending ? (
            <LoadingBlock rows={4} />
          ) : timetable.error ? (
            <ErrorState
              error={timetable.error}
              onRetry={() => void timetable.refetch()}
            />
          ) : (
            <TodayLessons
              timetable={timetable.data}
              mode="teacher"
              classLink={(id) => `/teacher/classes/${id}`}
            />
          )}
        </Card>

        <Card className="gap-0 py-0 lg:col-span-2">
          <SectionHeader
            title="My classes"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/teacher/classes">View all</Link>
              </Button>
            }
          />
          {profile.isPending ? (
            <LoadingBlock rows={3} />
          ) : profile.error ? (
            <ErrorState
              error={profile.error}
              onRetry={() => void profile.refetch()}
            />
          ) : taught.length === 0 ? (
            <EmptyState
              icon={School}
              title="No classes yet"
              description="The administrator assigns teachers to classes."
            />
          ) : (
            <ul className="divide-y">
              {taught.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/teacher/classes/${c.id}`}
                    className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">Class {c.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {c.subjects.length > 0
                          ? c.subjects.map((s) => s.name).join(', ')
                          : 'Homeroom only'}
                      </p>
                    </div>
                    {c.isHomeroom && (
                      <Badge variant="secondary">Homeroom</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="gap-0 py-0 lg:col-span-5">
          <SectionHeader title="Latest grades in your classes" />
          <DataTable
            columns={gradeColumns}
            rows={latestGrades.data?.data}
            rowKey={(g) => g.id}
            isLoading={latestGrades.isPending}
            error={latestGrades.error}
            onRetry={() => void latestGrades.refetch()}
            emptyTitle="No grades yet"
          />
        </Card>
      </div>
    </>
  )
}
