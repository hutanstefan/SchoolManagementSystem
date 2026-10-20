import { Award, CalendarDays, ClipboardList, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useMyReport, type StudentReport } from '@/features/grades/api'
import { GradeChip } from '@/features/grades/grade-badges'
import { useMyTimetable } from '@/features/timetable/api'
import { TodayLessons } from '@/features/timetable/today-lessons'
import {
  formatAverage,
  formatDate,
  formatLongDate,
  fullName,
  todayWeekday,
} from '@/lib/format'
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
  const gradeCount =
    report.data?.subjects.reduce((sum, row) => sum + row.grades.length, 0) ?? 0
  const best = report.data ? bestSubject(report.data) : null
  const className = user?.student?.class?.name

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.firstName ?? ''}`}
        description={
          <>
            {className ? `Class ${className} · ` : ''}
            {formatLongDate()}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="General average"
          value={formatAverage(report.data?.overallAverage)}
          icon={TrendingUp}
          isLoading={report.isPending}
          hint={
            report.data?.overallAverage === null &&
            'Shown once every subject has grades'
          }
        />
        <StatCard
          label="Grades"
          value={gradeCount}
          icon={ClipboardList}
          isLoading={report.isPending}
        />
        <StatCard
          label="Best subject"
          value={best ? best.subject.name : '—'}
          hint={best && `Average ${formatAverage(best.average)}`}
          icon={Award}
          isLoading={report.isPending}
        />
        <StatCard
          label="Lessons today"
          value={today ? lessonsToday : '—'}
          hint={!today && 'Weekend'}
          icon={CalendarDays}
          isLoading={timetable.isPending}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="gap-0 py-0 lg:col-span-3">
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

        <Card className="gap-0 py-0 lg:col-span-2">
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
                  className="flex items-center gap-3 px-4 py-2.5"
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

        <Card className="gap-0 py-0 lg:col-span-5">
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
          <dl className="grid gap-4 p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <ProfileField label="Name" value={fullName(user)} />
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
