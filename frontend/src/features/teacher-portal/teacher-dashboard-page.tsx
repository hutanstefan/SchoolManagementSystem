import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  School,
} from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { SubjectDot } from '@/features/subjects/subject-icon'
import { PersonCell } from '@/components/person-avatar'
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
import { useTeachingStats } from '@/features/stats/api'
import { ChartCard } from '@/features/stats/chart-card'
import {
  AveragesChart,
  GradeDistributionChart,
  PassFailLegend,
} from '@/features/stats/charts'
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
      <PersonCell
        person={g.student}
        secondary={
          // Narrow: the subject under the name (its column is left out).
          <span className="@md:hidden">
            {g.subject.name}
            {g.class && ` · ${g.class.name}`}
          </span>
        }
      >
        <Link
          to={`/teacher/students/${g.student.id}`}
          className="hover:underline"
        >
          {fullName(g.student)}
        </Link>
      </PersonCell>
    ),
  },
  {
    header: 'Subject',
    className: 'hidden @md:table-cell',
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
    className: 'hidden whitespace-nowrap @lg:table-cell',
  },
]

export function TeacherDashboardPage() {
  const { user } = useAuth()
  const { profile, classes, taught } = useMyClasses()
  const timetable = useMyTimetable()
  const stats = useTeachingStats()
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
  const rows = stats.data?.rows ?? []
  const failing = rows.reduce((sum, r) => sum + r.studentsAtRisk, 0)
  const missing = rows.reduce((sum, r) => sum + r.studentsMissingGrades, 0)
  const attention = rows.filter(
    (r) => r.studentsAtRisk > 0 || r.studentsMissingGrades > 0,
  )
  const oneSubject = new Set(rows.map((r) => r.subject.id)).size === 1
  const gradeCount =
    stats.data?.gradeDistribution.reduce((sum, d) => sum + d.count, 0) ?? 0
  const chartState = {
    isLoading: stats.isPending,
    error: stats.error,
    onRetry: () => void stats.refetch(),
  }

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? ''}`}
        description={
          today
            ? `${formatLongDate()} · ${lessonsToday} ${
                lessonsToday === 1 ? 'lesson' : 'lessons'
              } today`
            : formatLongDate()
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My classes"
          value={taught.length}
          icon={School}
          tone="indigo"
          isLoading={profile.isPending}
          hint={
            homerooms.length > 0 ? (
              <>
                Homeroom teacher of{' '}
                {homerooms.map((c, index) => (
                  <span key={c.id}>
                    {index > 0 && ', '}
                    <Link
                      to={`/teacher/classes/${c.id}`}
                      className="text-foreground font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </span>
                ))}
              </>
            ) : (
              hours !== undefined && `${hours} hours per week`
            )
          }
        />
        <StatCard
          label="Students"
          value={studentCount}
          icon={GraduationCap}
          tone="violet"
          isLoading={classes.isPending}
          hint={hours !== undefined && `${hours} hours of teaching a week`}
        />
        <StatCard
          label="Failing averages"
          value={failing}
          icon={AlertTriangle}
          tone={failing > 0 ? 'rose' : 'emerald'}
          isLoading={stats.isPending}
          hint="Averages under 5 in your subjects"
        />
        <StatCard
          label="Need more grades"
          value={missing}
          icon={ClipboardList}
          tone={missing > 0 ? 'amber' : 'emerald'}
          isLoading={stats.isPending}
          hint="Fewer grades than the minimum (hours + 1)"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <ChartCard
          title="Averages by class"
          description={
            oneSubject
              ? `Mean of the students' averages in ${rows[0]!.subject.name}`
              : "Mean of the students' averages in each subject you teach"
          }
          className="xl:col-span-3"
          isEmpty={rows.length === 0}
          emptyTitle="No classes yet"
          emptyDescription="The administrator assigns teachers to classes."
          {...chartState}
        >
          <AveragesChart
            caption="Averages by class and subject"
            minRows={5}
            rows={rows.map((r) => ({
              key: `${r.class.id}:${r.subject.id}`,
              // Just the class when the teacher teaches a single subject.
              label: oneSubject
                ? r.class.name
                : `${r.class.name} · ${r.subject.name}`,
              title: `Class ${r.class.name} · ${r.subject.name}`,
              average: r.average,
              detail: `${r.studentCount} students · ${r.studentsAtRisk} under 5`,
            }))}
          />
        </ChartCard>

        <Card className="gap-0 py-0 xl:col-span-2">
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

        <ChartCard
          title="Grade distribution"
          description="Grades in your subjects"
          action={<PassFailLegend className="hidden sm:flex" />}
          className="xl:col-span-3"
          isEmpty={gradeCount === 0}
          emptyTitle="No grades yet"
          {...chartState}
        >
          {stats.data && (
            <GradeDistributionChart data={stats.data.gradeDistribution} />
          )}
        </ChartCard>

        <Card className="gap-0 py-0 xl:col-span-2">
          <SectionHeader
            title="Needs attention"
            description="Open the gradebook to catch up"
          />
          {stats.isPending ? (
            <LoadingBlock rows={4} />
          ) : stats.error ? (
            <ErrorState
              error={stats.error}
              onRetry={() => void stats.refetch()}
            />
          ) : attention.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All caught up"
              description="Every student has enough grades and a passing average."
            />
          ) : (
            <ul className="divide-y">
              {attention.map((r) => (
                <li key={`${r.class.id}:${r.subject.id}`}>
                  <Link
                    to={`/teacher/classes/${r.class.id}?tab=gradebook&subject=${r.subject.id}`}
                    className="hover:bg-muted/50 group flex items-center gap-3 px-5 py-3 transition-colors"
                  >
                    <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                      {r.class.name}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium">
                        <SubjectDot color={r.subject.color} />
                        <span className="truncate">{r.subject.name}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {r.studentsAtRisk > 0 && (
                          <Badge variant="destructive-soft">
                            {r.studentsAtRisk} under 5
                          </Badge>
                        )}
                        {r.studentsMissingGrades > 0 && (
                          <Badge variant="warning-soft">
                            {r.studentsMissingGrades} need grades
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="gap-0 py-0 xl:col-span-5">
          <SectionHeader
            title="Latest grades in your classes"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/teacher/classes">My classes</Link>
              </Button>
            }
          />
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
