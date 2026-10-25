import { CalendarX2, Lock, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DataTable, type Column } from '@/components/data-table'
import { Segmented } from '@/components/segmented'
import { EmptyState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AbsenceCountCell } from '@/features/absences/absence-count'
import {
  AttendanceDialog,
  type AttendanceTarget,
} from '@/features/absences/attendance-dialog'
import {
  StudentAbsencesDialog,
  type StudentAbsencesTarget,
} from '@/features/absences/student-absences-dialog'
import type { ClassSubject } from '@/features/classes/api'
import type { Semester } from '@/features/school-years/api'
import { SubjectDot } from '@/features/subjects/subject-icon'
import { usePeriod } from '@/periods/period-context'
import { startedSemesters } from '@/periods/resolve'
import { formatAverage, fullName } from '@/lib/format'
import {
  useGradebook,
  type Gradebook as GradebookData,
  type GradeEntry,
} from './api'
import { AverageCell, GradeChip } from './grade-badges'
import { GradeDialog, type GradeDialogState } from './grade-dialog'
import { MissingGradesHint } from './report-card'

type Row = GradebookData['students'][number]

/**
 * The class register for one subject: every student with their grades and
 * average. Shared by the admin and the teacher; the callbacks decide who may
 * add grades and which grades may be changed.
 */
export function Gradebook({
  classId,
  subjects,
  canAddGrades,
  canEditGrade,
  studentLink,
  initialSubjectId,
  actions,
  schoolYearId,
}: {
  classId: string
  /** The class's school year: its semester follows the one picked in the sidebar. */
  schoolYearId?: string
  /** Subjects to choose from (a teacher only sees their own). */
  subjects: ClassSubject[]
  canAddGrades: (gradebook: GradebookData) => boolean
  canEditGrade: (grade: GradeEntry) => boolean
  studentLink?: (studentId: string) => string
  /** Subject to open first (e.g. from the URL), if it is in the list. */
  initialSubjectId?: string | null
  /** Extra buttons for the open subject, shown when the user can grade it. */
  actions?: (subjectId: string) => ReactNode
}) {
  const [chosenSubjectId, setChosenSubjectId] = useState<string | null>(
    subjects.some((s) => s.subject.id === initialSubjectId)
      ? (initialSubjectId ?? null)
      : null,
  )
  const subjectId = chosenSubjectId ?? subjects[0]?.subject.id ?? null
  const period = usePeriod()
  const [chosenSemester, setChosenSemester] = useState<Semester | undefined>()
  const semester =
    chosenSemester ??
    (schoolYearId && schoolYearId === period.year?.id
      ? period.semester
      : undefined)
  const gradebook = useGradebook(classId, subjectId, semester)
  const [dialog, setDialog] = useState<GradeDialogState | null>(null)
  const [attendance, setAttendance] = useState<AttendanceTarget | null>(null)
  const [absencesOf, setAbsencesOf] = useState<StudentAbsencesTarget | null>(
    null,
  )

  if (subjects.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No subjects to grade"
          description="The gradebook needs at least one subject in the class."
        />
      </Card>
    )
  }

  const data = gradebook.data
  const readOnly = data?.readOnly ?? false
  const canAdd = data && !readOnly ? canAddGrades(data) : false
  const canEdit = (grade: GradeEntry) => !readOnly && canEditGrade(grade)
  const shownSemester = data?.period.semester ?? semester ?? 1
  const started = data ? startedSemesters(data.period.schoolYear) : [1]
  const subjectRef = data && { id: data.subject.id, name: data.subject.name }

  // Class average: mean of the students' rounded averages, like the school report.
  const rounded = (data?.students ?? [])
    .map((row) => row.roundedAverage)
    .filter((value): value is number => value !== null)
  const classAverage =
    rounded.length > 0
      ? rounded.reduce((sum, value) => sum + value, 0) / rounded.length
      : null

  const takeAttendance = () =>
    data &&
    setAttendance({
      classId: data.class.id,
      className: data.class.name,
      subject: data.subject,
      students: data.students.map((row) => ({
        id: row.student.id,
        name: fullName(row.student),
        registrationNumber: row.registrationNumber,
      })),
      // Only an admin can be on another semester than the current one here.
      semester:
        data.period.semester !== data.period.schoolYear.currentSemester
          ? data.period.semester
          : undefined,
    })

  const averageOf = (row: Row) => (
    <div className="flex items-center gap-2">
      <AverageCell average={row.average} roundedAverage={row.roundedAverage} />
      {!row.hasMinimumGrades && data && (
        <MissingGradesHint
          count={row.grades.length}
          minimum={data.minimumGrades}
        />
      )}
    </div>
  )
  const absenceCell = (row: Row) =>
    data && (
      <AbsenceCountCell
        count={row.absences}
        maxAbsences={data.maxAbsences}
        label={`Absences of ${fullName(row.student)}`}
        onClick={() =>
          setAbsencesOf({
            student: { id: row.student.id, name: fullName(row.student) },
            subject: data.subject,
            schoolYearId: data.period.schoolYear.id,
            semester: data.period.semester,
          })
        }
      />
    )

  // Narrow (phones, tablets with the sidebar): the average and absences go
  // under the name, and the register number is left out.
  const columns: Column<Row>[] = [
    {
      header: 'Reg. no.',
      className: 'hidden w-24 @3xl:table-cell',
      cell: (row) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          {row.registrationNumber}
        </span>
      ),
    },
    {
      header: 'Student',
      className: 'whitespace-normal',
      cell: (row) => (
        <>
          {studentLink ? (
            <Link
              to={studentLink(row.student.id)}
              className="font-medium hover:underline"
            >
              {fullName(row.student)}
            </Link>
          ) : (
            <span className="font-medium">{fullName(row.student)}</span>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 @xl:hidden">
            {averageOf(row)}
            {absenceCell(row)}
          </div>
        </>
      ),
    },
    {
      header: 'Grades',
      className: 'min-w-32 @xl:min-w-44',
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.grades.map((grade) => (
            <GradeChip
              key={grade.id}
              grade={grade}
              onClick={
                canEdit(grade) && subjectRef
                  ? () =>
                      setDialog({
                        mode: 'edit',
                        grade,
                        student: {
                          id: row.student.id,
                          name: fullName(row.student),
                        },
                        subject: subjectRef,
                      })
                  : undefined
              }
            />
          ))}
          {canAdd && subjectRef && (
            <Button
              variant="outline"
              size="icon"
              className="size-8 border-dashed"
              aria-label={`Add a grade for ${fullName(row.student)}`}
              onClick={() =>
                setDialog({
                  mode: 'add',
                  student: { id: row.student.id, name: fullName(row.student) },
                  subject: subjectRef,
                  semester: data?.period.semester,
                })
              }
            >
              <Plus />
            </Button>
          )}
          {row.grades.length === 0 && !canAdd && (
            <span className="text-muted-foreground text-sm">No grades</span>
          )}
        </div>
      ),
    },
    {
      header: 'Average',
      className: 'hidden w-40 @xl:table-cell',
      cell: averageOf,
    },
    {
      header: 'Absences',
      className: 'hidden w-32 @xl:table-cell',
      cell: absenceCell,
    },
  ]

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={subjectId ?? undefined}
            onValueChange={setChosenSubjectId}
          >
            <SelectTrigger className="sm:w-56" aria-label="Subject">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((a) => (
                <SelectItem key={a.subject.id} value={a.subject.id}>
                  <SubjectDot color={a.subject.color} />
                  {a.subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Segmented
            label="Semester"
            value={shownSemester}
            onChange={setChosenSemester}
            options={([1, 2] as const).map((s) => ({
              value: s,
              label: `Sem. ${s}`,
              disabled: !started.includes(s),
            }))}
          />
          {data?.canTakeAttendance && (
            <Button onClick={takeAttendance}>
              <CalendarX2 aria-hidden /> Take attendance
            </Button>
          )}
          {canAdd && subjectId && actions?.(subjectId)}
          {readOnly && (
            <Badge variant="warning-soft" className="gap-1">
              <Lock aria-hidden /> Read-only
            </Badge>
          )}
        </div>
        {data && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <span>
              {data.teacher ? fullName(data.teacher) : 'No teacher assigned'}
            </span>
            <Badge variant="outline">{data.hoursPerWeek} h / week</Badge>
            <Badge variant="outline">min. {data.minimumGrades} grades</Badge>
            <Badge variant="outline">
              {data.maxAbsences === null
                ? 'No absence limit'
                : `max. ${data.maxAbsences} absences`}
            </Badge>
            <Badge variant="secondary">
              Class average {formatAverage(classAverage)}
            </Badge>
          </div>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={data?.students}
        rowKey={(row) => row.student.id}
        isLoading={gradebook.isPending}
        error={gradebook.error}
        onRetry={() => void gradebook.refetch()}
        emptyTitle="No students in this class"
      />
      <GradeDialog state={dialog} onClose={() => setDialog(null)} />
      <AttendanceDialog
        target={attendance}
        onClose={() => setAttendance(null)}
      />
      <StudentAbsencesDialog
        target={absencesOf}
        onClose={() => setAbsencesOf(null)}
      />
    </Card>
  )
}
