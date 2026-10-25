import { AlertTriangle, GraduationCap, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { PersonCell } from '@/components/person-avatar'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAllClasses, type SchoolClass } from '@/features/classes/api'
import { useGrades, type Grade } from '@/features/grades/api'
import { gradeTone } from '@/features/grades/grade-tone'
import { useSchoolStats } from '@/features/stats/api'
import { ChartCard } from '@/features/stats/chart-card'
import {
  ActivityChart,
  AveragesChart,
  GradeDistributionChart,
  PassFailLegend,
} from '@/features/stats/charts'
import { useStudents } from '@/features/students/api'
import { useSubjects } from '@/features/subjects/api'
import { useTeachers } from '@/features/teachers/api'
import { formatDate, formatLongDate, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SubjectDot } from '@/features/subjects/subject-icon'
import { usePeriod } from '@/periods/period-context'

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
          to={`/admin/students/${g.student.id}`}
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
      <span className="flex items-center gap-2">
        <SubjectDot color={g.subject.color} />
        <span>
          {g.subject.name}
          {g.class && (
            <span className="text-muted-foreground"> · {g.class.name}</span>
          )}
        </span>
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

const classColumns: Column<SchoolClass>[] = [
  {
    header: 'Class',
    cell: (c) => (
      <Link
        to={`/admin/classes/${c.id}`}
        className="font-medium hover:underline"
      >
        {c.name}
      </Link>
    ),
  },
  {
    header: 'Homeroom teacher',
    cell: (c) => (c.homeroomTeacher ? fullName(c.homeroomTeacher) : '—'),
  },
  {
    header: 'Students',
    cell: (c) => c.studentCount,
    className: 'text-right tabular-nums',
  },
]

export function AdminDashboardPage() {
  const { user } = useAuth()
  const { year, semester, isArchived } = usePeriod()
  // pageSize 1: only the totals in `meta` are needed. Students: the ones in a
  // class that year.
  const students = useStudents({ pageSize: 1, unassigned: false })
  const unassigned = useStudents({ pageSize: 1, unassigned: true })
  const teachers = useTeachers({ pageSize: 1 })
  const classes = useAllClasses()
  const subjects = useSubjects()
  const stats = useSchoolStats()
  const recentGrades = useGrades({
    pageSize: 8,
    sort: 'date',
    order: 'desc',
  })

  const unassignedCount = unassigned.data?.meta.total ?? 0
  const chartState = {
    isLoading: stats.isPending,
    error: stats.error,
    onRetry: () => void stats.refetch(),
    isEmpty: stats.data?.gradeCount === 0,
    emptyTitle: 'No grades yet',
    emptyDescription: 'Charts appear once teachers start grading.',
  }

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? ''}`}
        description={
          isArchived
            ? `How ${year?.name ?? 'the year'} went · Semester ${semester}`
            : `Here's how the school is doing · ${formatLongDate()}`
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students"
          value={students.data?.meta.total}
          icon={GraduationCap}
          tone="indigo"
          isLoading={students.isPending}
          hint={
            isArchived ? (
              'In a class that year'
            ) : unassignedCount > 0 ? (
              <Link
                to="/admin/students?class=unassigned"
                className="text-amber-600 hover:underline dark:text-amber-400"
              >
                {unassignedCount} without a class
              </Link>
            ) : (
              'Everyone is in a class'
            )
          }
        />
        <StatCard
          label="Teachers"
          value={teachers.data?.meta.total}
          icon={Users}
          tone="violet"
          isLoading={teachers.isPending}
          hint={
            classes.data &&
            subjects.data &&
            `${classes.data.meta.total} classes · ${subjects.data.length} subjects`
          }
        />
        <StatCard
          label="School average"
          value={stats.data?.average ?? '—'}
          decimals={2}
          icon={TrendingUp}
          tone="emerald"
          isLoading={stats.isPending}
          hint={
            stats.data &&
            `From ${stats.data.gradeCount.toLocaleString()} grades`
          }
        />
        <StatCard
          label="Students at risk"
          value={stats.data?.studentsAtRisk}
          icon={AlertTriangle}
          tone={stats.data?.studentsAtRisk ? 'rose' : 'emerald'}
          isLoading={stats.isPending}
          hint="Average under 5 in at least one subject"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <ChartCard
          title="Grade distribution"
          description={`Every grade given in semester ${semester}`}
          action={<PassFailLegend className="hidden sm:flex" />}
          className="xl:col-span-3"
          {...chartState}
        >
          {stats.data && (
            <GradeDistributionChart data={stats.data.gradeDistribution} />
          )}
        </ChartCard>
        <ChartCard
          title="Grading activity"
          description={
            isArchived
              ? 'Grades given per week that semester'
              : 'Grades given per week'
          }
          className="xl:col-span-2"
          {...chartState}
        >
          {stats.data && <ActivityChart data={stats.data.activity} />}
        </ChartCard>

        <ChartCard
          title="Class averages"
          description="Mean of the students' subject averages"
          className="xl:col-span-2"
          {...chartState}
        >
          {stats.data && (
            <AveragesChart
              caption="Class averages"
              minRows={stats.data.subjects.length}
              rows={stats.data.classes.map((c) => ({
                key: c.class.id,
                label: c.class.name,
                average: c.average,
                detail: `${c.studentCount} students · ${c.studentsAtRisk} at risk`,
              }))}
            />
          )}
        </ChartCard>
        <ChartCard
          title="Subject averages"
          description="Across every class that studies the subject"
          className="xl:col-span-3"
          {...chartState}
        >
          {stats.data && (
            <AveragesChart
              caption="Subject averages"
              minRows={stats.data.classes.length}
              rows={stats.data.subjects.map((s) => ({
                key: s.subject.id,
                label: s.subject.name,
                average: s.average,
                detail: `${s.gradeCount} grades`,
              }))}
            />
          )}
        </ChartCard>

        <Card className="gap-0 py-0 xl:col-span-3">
          <SectionHeader
            title="Latest grades"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/grades">View all</Link>
              </Button>
            }
          />
          <DataTable
            columns={gradeColumns}
            rows={recentGrades.data?.data}
            rowKey={(g) => g.id}
            isLoading={recentGrades.isPending}
            error={recentGrades.error}
            onRetry={() => void recentGrades.refetch()}
            emptyTitle="No grades yet"
          />
        </Card>
        <Card className="gap-0 py-0 xl:col-span-2">
          <SectionHeader
            title="Classes"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/classes">Manage</Link>
              </Button>
            }
          />
          <DataTable
            columns={classColumns}
            rows={classes.data?.data}
            rowKey={(c) => c.id}
            isLoading={classes.isPending}
            error={classes.error}
            onRetry={() => void classes.refetch()}
            emptyTitle="No classes yet"
          />
        </Card>
      </div>
    </>
  )
}
