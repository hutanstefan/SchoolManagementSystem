import { Pencil, FileSpreadsheet, ScanLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import { BackLink } from '@/components/back-link'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ClassTile } from '@/components/class-tile'
import { PageHeader } from '@/components/page-header'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Gradebook } from '@/features/grades/gradebook'
import { ClassTimetableEditor } from '@/features/timetable/class-timetable-editor'
import { fullName } from '@/lib/format'
import { usePeriod } from '@/periods/period-context'
import { useClass, useDeleteClass } from './api'
import { ClassFormDialog } from './class-form-dialog'
import { ClassNotInYear } from './class-not-in-year'
import { describeClass } from './class-label'
import { classInYear } from './follow-year'
import { ClassStudentsTab } from './class-students-tab'
import { ClassSubjectsTab } from './class-subjects-tab'

const TABS = ['students', 'subjects', 'timetable', 'gradebook'] as const
type Tab = (typeof TABS)[number]

export function ClassDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const schoolClass = useClass(id)
  const location = useLocation()
  const follow = classInYear(schoolClass.data, usePeriod().year)
  const remove = useDeleteClass()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // The open tab lives in the URL, so reloads and links keep it.
  const tabParam = searchParams.get('tab')
  const tab: Tab = TABS.includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'students'
  const setTab = (value: string) =>
    setSearchParams({ tab: value }, { replace: true })

  if (schoolClass.isPending) return <LoadingBlock />
  if (schoolClass.error) {
    return (
      <ErrorState
        error={schoolClass.error}
        onRetry={() => void schoolClass.refetch()}
      />
    )
  }

  // The year picked in the sidebar decides which year's class is shown.
  if (follow.status === 'moved') {
    return (
      <Navigate
        to={`/admin/classes/${follow.classId}${location.search}`}
        replace
      />
    )
  }
  if (follow.status === 'missing') {
    return (
      <ClassNotInYear
        schoolClass={schoolClass.data}
        year={follow.year}
        listPath="/admin/classes"
        listLabel="All classes"
      />
    )
  }

  const c = schoolClass.data
  const readOnly = c.schoolYear.status === 'CLOSED'
  const { section } = describeClass(c)

  return (
    <>
      <BackLink to="/admin/classes" label="All classes" />
      <PageHeader
        leading={<ClassTile name={c.name} />}
        title={`Class ${c.name}`}
        description={
          <>
            {c.gradeLevel !== null && (
              <>
                Grade {c.gradeLevel}
                {section && `, section ${section}`} ·{' '}
              </>
            )}
            {c.schoolYear.name}
            {readOnly && ' (closed)'} · Homeroom teacher:{' '}
            {c.homeroomTeacher ? fullName(c.homeroomTeacher) : 'none'} ·{' '}
            {c.studentCount} {c.studentCount === 1 ? 'student' : 'students'}
          </>
        }
        actions={
          !readOnly && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden /> Edit
              </Button>
              <Button variant="outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden /> Delete
              </Button>
            </>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="gradebook">Gradebook</TabsTrigger>
        </TabsList>
        <TabsContent value="students">
          <ClassStudentsTab classId={c.id} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="subjects">
          <ClassSubjectsTab schoolClass={c} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="timetable">
          <ClassTimetableEditor schoolClass={c} readOnly={readOnly} />
        </TabsContent>
        <TabsContent value="gradebook">
          <Gradebook
            classId={c.id}
            schoolYearId={c.schoolYear.id}
            subjects={c.subjects}
            canAddGrades={() => true}
            canEditGrade={() => true}
            studentLink={(studentId) => `/admin/students/${studentId}`}
            initialSubjectId={searchParams.get('subject')}
            actions={(subjectId) => (
              <>
                <Button asChild variant="outline">
                  <Link
                    to={`/admin/grades/import?subject=${subjectId}&class=${c.id}`}
                  >
                    <FileSpreadsheet aria-hidden /> Import from Excel
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/admin/classes/${c.id}/scan?subject=${subjectId}`}>
                    <ScanLine aria-hidden /> Scan tests
                  </Link>
                </Button>
              </>
            )}
          />
        </TabsContent>
      </Tabs>

      <ClassFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        schoolClass={c}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete class ${c.name}?`}
        description="Its students become unassigned and its subjects and timetable are deleted. Grades are kept."
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(c.id, {
            onSuccess: () => void navigate('/admin/classes', { replace: true }),
          })
        }
      />
    </>
  )
}
