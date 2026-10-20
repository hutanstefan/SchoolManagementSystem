import { Link, useParams, useSearchParams } from 'react-router'
import { BackLink } from '@/components/back-link'
import { DataTable, type Column } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClass, useClassStudents } from '@/features/classes/api'
import { Gradebook } from '@/features/grades/gradebook'
import type { Student } from '@/features/students/api'
import { useMyTeacherProfile } from '@/features/teachers/api'
import { useClassTimetable } from '@/features/timetable/api'
import { TimetableGrid } from '@/features/timetable/timetable-grid'
import { formatDate, fullName } from '@/lib/format'

const TABS = ['gradebook', 'students', 'timetable'] as const
type Tab = (typeof TABS)[number]

/**
 * One class from the teacher's side. A teacher grades only their own subjects
 * and changes only the grades they gave; the homeroom teacher also sees the
 * other subjects' gradebooks (read-only). The API enforces the same rules.
 */
export function MyClassPage() {
  const { id = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const schoolClass = useClass(id)
  const profile = useMyTeacherProfile()

  const tabParam = searchParams.get('tab')
  const tab: Tab = TABS.includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'gradebook'
  const setTab = (value: string) =>
    setSearchParams({ tab: value }, { replace: true })

  if (schoolClass.isPending || profile.isPending) return <LoadingBlock />
  if (schoolClass.error || profile.error) {
    return (
      <ErrorState
        error={schoolClass.error ?? profile.error}
        onRetry={() => {
          void schoolClass.refetch()
          void profile.refetch()
        }}
      />
    )
  }

  const c = schoolClass.data
  const me = profile.data.id
  const isHomeroom = c.homeroomTeacher?.id === me
  const ownSubjects = c.subjects.filter((s) => s.teacher?.id === me)
  // Own subjects first, so the gradebook opens on one the teacher can grade.
  const gradebookSubjects = isHomeroom
    ? [...ownSubjects, ...c.subjects.filter((s) => s.teacher?.id !== me)]
    : ownSubjects

  return (
    <>
      <BackLink to="/teacher/classes" label="My classes" />
      <PageHeader
        title={`Class ${c.name}`}
        description={
          <>
            Homeroom teacher:{' '}
            {c.homeroomTeacher ? fullName(c.homeroomTeacher) : 'none'} ·{' '}
            {c.studentCount} {c.studentCount === 1 ? 'student' : 'students'}
          </>
        }
        actions={
          isHomeroom && (
            <Badge variant="secondary">You are the homeroom teacher</Badge>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="gradebook">Gradebook</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
        </TabsList>
        <TabsContent value="gradebook">
          <Gradebook
            classId={c.id}
            subjects={gradebookSubjects}
            canAddGrades={(gradebook) => gradebook.teacher?.id === me}
            canEditGrade={(grade) => grade.teacher?.id === me}
            studentLink={(studentId) => `/teacher/students/${studentId}`}
          />
        </TabsContent>
        <TabsContent value="students">
          <StudentsTab classId={c.id} />
        </TabsContent>
        <TabsContent value="timetable">
          <TimetableTab classId={c.id} />
        </TabsContent>
      </Tabs>
    </>
  )
}

const studentColumns: Column<Student>[] = [
  {
    header: 'Name',
    cell: (s) => (
      <Link
        to={`/teacher/students/${s.id}`}
        className="font-medium hover:underline"
      >
        {fullName(s)}
      </Link>
    ),
  },
  {
    header: 'Email',
    cell: (s) => s.email,
    className: 'hidden sm:table-cell',
  },
  {
    header: 'Date of birth',
    cell: (s) => formatDate(s.dateOfBirth),
    className: 'hidden whitespace-nowrap md:table-cell',
  },
]

function StudentsTab({ classId }: { classId: string }) {
  const students = useClassStudents(classId)
  return (
    <Card className="gap-0 py-0">
      <DataTable
        columns={studentColumns}
        rows={students.data}
        rowKey={(s) => s.id}
        isLoading={students.isPending}
        error={students.error}
        onRetry={() => void students.refetch()}
        emptyTitle="No students in this class"
      />
    </Card>
  )
}

function TimetableTab({ classId }: { classId: string }) {
  const timetable = useClassTimetable(classId)
  return (
    <Card className="py-0">
      <div className="p-2">
        {timetable.isPending ? (
          <LoadingBlock />
        ) : timetable.error ? (
          <ErrorState
            error={timetable.error}
            onRetry={() => void timetable.refetch()}
          />
        ) : (
          <TimetableGrid timetable={timetable.data} mode="class" />
        )}
      </div>
    </Card>
  )
}
