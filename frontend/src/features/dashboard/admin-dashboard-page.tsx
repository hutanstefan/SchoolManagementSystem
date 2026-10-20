import { BookOpen, GraduationCap, School, UserX, Users } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { SectionHeader } from '@/components/section-header'
import { StatCard } from '@/components/stat-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAllClasses, type SchoolClass } from '@/features/classes/api'
import { useGrades, type Grade } from '@/features/grades/api'
import { gradeTone } from '@/features/grades/grade-tone'
import { useStudents } from '@/features/students/api'
import { useSubjects } from '@/features/subjects/api'
import { useTeachers } from '@/features/teachers/api'
import { formatDate, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'

const gradeColumns: Column<Grade>[] = [
  {
    header: 'Student',
    cell: (g) => (
      <Link
        to={`/admin/students/${g.student.id}`}
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
  // pageSize 1: only the totals in `meta` are needed.
  const students = useStudents({ pageSize: 1 })
  const unassigned = useStudents({ pageSize: 1, unassigned: true })
  const teachers = useTeachers({ pageSize: 1 })
  const classes = useAllClasses()
  const subjects = useSubjects()
  const recentGrades = useGrades({
    pageSize: 8,
    sort: 'date',
    order: 'desc',
  })

  const unassignedCount = unassigned.data?.meta.total ?? 0

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.firstName ?? ''}`}
        description="An overview of the school."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Students"
          value={students.data?.meta.total}
          icon={GraduationCap}
          isLoading={students.isPending}
        />
        <StatCard
          label="Without a class"
          value={unassignedCount}
          icon={UserX}
          isLoading={unassigned.isPending}
          hint={
            unassignedCount > 0 && (
              <Link
                to="/admin/students?class=unassigned"
                className="hover:underline"
              >
                Assign them to a class
              </Link>
            )
          }
        />
        <StatCard
          label="Teachers"
          value={teachers.data?.meta.total}
          icon={Users}
          isLoading={teachers.isPending}
        />
        <StatCard
          label="Classes"
          value={classes.data?.meta.total}
          icon={School}
          isLoading={classes.isPending}
        />
        <StatCard
          label="Subjects"
          value={subjects.data?.length}
          icon={BookOpen}
          isLoading={subjects.isPending}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="gap-0 py-0 lg:col-span-3">
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
        <Card className="gap-0 py-0 lg:col-span-2">
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
