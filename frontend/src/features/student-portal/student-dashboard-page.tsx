import { Award, CheckCircle2, ClipboardList, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { AnimatedNumber, StatCard } from '@/components/stat-card'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyReport, type StudentReport } from '@/features/grades/api'
import { GradeChip } from '@/features/grades/grade-badges'
import { ChartCard } from '@/features/stats/chart-card'
import { PASSING_GRADE } from '@/features/stats/chart-utils'
import {
  AverageTrendChart,
  AveragesChart,
  PassFailLegend,
} from '@/features/stats/charts'
import { averageTrend } from '@/features/stats/trend'
import { useMyTimetable } from '@/features/timetable/api'
import { TodayLessons } from '@/features/timetable/today-lessons'
import {
  formatAverage,
  formatDate,
  formatLongDate,
  fullName,
  todayWeekday,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { LatestLectures } from '@/features/lectures/latest-lectures'
import { useMyClass } from './use-my-class'

/** The newest grades across all subjects. */
function latestGrades(report: StudentReport, count: number) {
  return report.subjects
    .flatMap((row) =>
      row.grades.map((grade) => ({ grade, subject: row.subject })),
    )
    .sort((a, b) => b.grade.date.localeCompare(a.grade.date))
    .slice(0, count)
}

function bestSubject(report: StudentReport) {
  return report.subjects.reduce<StudentReport['subjects'][number] | null>(
    (best, row) =>
      row.average !== null && (best?.average ?? -1) < row.average ? row : best,
    null,
  )
}

export function StudentDashboardPage() {
  const { user } = useAuth()
  const report = useMyReport()
  const timetable = useMyTimetable()
  const { schoolClass } = useMyClass()

  const today = todayWeekday()
  const lessonsToday = today
    ? (timetable.data?.days.find((d) => d.day === today)?.lessons.length ?? 0)
    : 0
  const subjects = report.data?.subjects ?? []
  const allGrades = subjects.flatMap((row) => row.grades)
  const gradeCount = allGrades.length
  const best = report.data ? bestSubject(report.data) : null
  const failing = subjects.filter(
    (row) => row.roundedAverage !== null && row.roundedAverage < PASSING_GRADE,
  )
  const missing = subjects.filter((row) => !row.hasMinimumGrades)
  const trend = averageTrend(allGrades)
  // The class of the picked year (the report says), else the current one.
  const className = report.data
    ? report.data.class?.name
    : user?.student?.class?.name
  const reportState = {
    isLoading: report.isPending,
    error: report.error,
    onRetry: () => void report.refetch(),
  }

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? ''}`}
        description={
          <>
            {className ? `Class ${className} · ` : ''}
            {formatLongDate()}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AverageHero
          average={report.data?.overallAverage}
          isLoading={report.isPending}
          failing={failing.length}
          missing={missing.length}
          className="sm:col-span-2"
        />
        <StatCard
          label="Best subject"
          value={best ? best.subject.name : '—'}
          hint={best && `Average ${formatAverage(best.average)}`}
          icon={Award}
          tone="amber"
          isLoading={report.isPending}
        />
        <StatCard
          label="Grades"
          value={gradeCount}
          icon={ClipboardList}
          tone="sky"
          isLoading={report.isPending}
          hint={
            today
              ? `${lessonsToday} ${lessonsToday === 1 ? 'lesson' : 'lessons'} today`
              : 'No lessons today'
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <ChartCard
          title="Subject averages"
          description="Hover a bar for the details"
          action={<PassFailLegend className="hidden sm:flex" />}
          className="xl:col-span-3"
          isEmpty={gradeCount === 0}
          emptyTitle="No grades yet"
          emptyDescription="Your averages appear here once you get grades."
          {...reportState}
        >
          <AveragesChart
            caption="My subject averages"
            minRows={9}
            rows={subjects.map((row) => ({
              key: row.subject.id,
              label: row.subject.name,
              average: row.average,
              failing:
                row.roundedAverage !== null &&
                row.roundedAverage < PASSING_GRADE,
              detail: `${row.grades.length} of at least ${row.minimumGrades} grades`,
            }))}
          />
        </ChartCard>

        <Card className="gap-0 py-0 xl:col-span-2">
          <SectionHeader
            title="Latest grades"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/student/grades">All grades</Link>
              </Button>
            }
          />
          {report.isPending ? (
            <LoadingBlock rows={4} />
          ) : report.error ? (
            <ErrorState
              error={report.error}
              onRetry={() => void report.refetch()}
            />
          ) : gradeCount === 0 ? (
            <EmptyState title="No grades yet" />
          ) : (
            <ul className="divide-y">
              {latestGrades(report.data, 6).map(({ grade, subject }) => (
                <li
                  key={grade.id}
                  className="flex items-center gap-3 px-5 py-2.5"
                >
                  <GradeChip grade={grade} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{subject.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(grade.date)}
                      {grade.teacher && ` · ${fullName(grade.teacher)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <ChartCard
          title="My progress"
          description="Mean of all my grades so far"
          className="xl:col-span-3"
          isEmpty={trend.length < 2}
          emptyTitle="Not enough grades yet"
          emptyDescription="The line appears after grades on two different days."
          {...reportState}
        >
          <AverageTrendChart data={trend} />
        </ChartCard>

        <Card className="gap-0 py-0 xl:col-span-2">
          <SectionHeader
            title="Today's lessons"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/student/timetable">Full timetable</Link>
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
            <TodayLessons timetable={timetable.data} mode="class" />
          )}
        </Card>

        <LatestLectures className="xl:col-span-5" />

        <Card className="gap-0 py-0 xl:col-span-5">
          <SectionHeader
            title="My profile"
            action={
              user?.student?.class && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/student/class">My class</Link>
                </Button>
              )
            }
          />
          <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3 xl:grid-cols-6">
            <ProfileField label="Name" value={fullName(user)} />
            <ProfileField
              label="Reg. no. (nr. matricol)"
              value={user?.student?.registrationNumber}
            />
            <ProfileField label="Email" value={user?.email} />
            <ProfileField
              label="Date of birth"
              value={formatDate(user?.student?.dateOfBirth)}
            />
            <ProfileField
              label="Class"
              value={className ?? 'Not enrolled yet'}
            />
            <ProfileField
              label="Homeroom teacher"
              value={
                schoolClass.data?.homeroomTeacher
                  ? fullName(schoolClass.data.homeroomTeacher)
                  : '—'
              }
            />
          </dl>
        </Card>
      </div>
    </>
  )
}

/** The general average, large, on the brand gradient. */
function AverageHero({
  average,
  isLoading,
  failing,
  missing,
  className,
}: {
  average: number | null | undefined
  isLoading: boolean
  failing: number
  missing: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-brand shadow-lifted relative overflow-hidden rounded-xl p-5 text-white',
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute -top-16 -right-10 size-48 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-20 left-1/3 size-40 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative flex h-full flex-col justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-white/80">
          <TrendingUp className="size-4" aria-hidden />
          General average
        </div>
        {isLoading ? (
          <Skeleton className="h-12 w-28 bg-white/20" />
        ) : (
          <p className="text-5xl font-semibold tracking-tight tabular-nums">
            {typeof average === 'number' ? (
              <AnimatedNumber value={average} decimals={2} />
            ) : (
              '—'
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          {isLoading ? null : average === null || average === undefined ? (
            <HeroChip>Shown once every subject has grades</HeroChip>
          ) : failing > 0 ? (
            <HeroChip>
              {failing} {failing === 1 ? 'subject' : 'subjects'} under 5
            </HeroChip>
          ) : (
            <HeroChip>
              <CheckCircle2 className="size-3.5" aria-hidden />
              Passing every subject
            </HeroChip>
          )}
          {!isLoading && missing > 0 && (
            <HeroChip>
              {missing} {missing === 1 ? 'subject needs' : 'subjects need'} more
              grades
            </HeroChip>
          )}
        </div>
      </div>
    </div>
  )
}

function HeroChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-medium backdrop-blur-sm">
      {children}
    </span>
  )
}

function ProfileField({
  label,
  value,
}: {
  label: string
  value: string | undefined
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value ?? '—'}</dd>
    </div>
  )
}
