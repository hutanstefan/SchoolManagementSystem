import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DataTable, type Column } from '@/components/data-table'
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
import type { ClassSubject } from '@/features/classes/api'
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
}: {
  classId: string
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
  const gradebook = useGradebook(classId, subjectId)
  const [dialog, setDialog] = useState<GradeDialogState | null>(null)

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
  const canAdd = data ? canAddGrades(data) : false
  const subjectRef = data && { id: data.subject.id, name: data.subject.name }

  // Class average: mean of the students' rounded averages, like the school report.
  const rounded = (data?.students ?? [])
    .map((row) => row.roundedAverage)
    .filter((value): value is number => value !== null)
  const classAverage =
    rounded.length > 0
      ? rounded.reduce((sum, value) => sum + value, 0) / rounded.length
      : null

  const columns: Column<Row>[] = [
    {
      header: 'Student',
      cell: (row) =>
        studentLink ? (
          <Link
            to={studentLink(row.student.id)}
            className="font-medium hover:underline"
          >
            {fullName(row.student)}
          </Link>
        ) : (
          <span className="font-medium">{fullName(row.student)}</span>
        ),
    },
    {
      header: 'Grades',
      className: 'min-w-44',
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.grades.map((grade) => (
            <GradeChip
              key={grade.id}
              grade={grade}
              onClick={
                canEditGrade(grade) && subjectRef
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
      className: 'w-40',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <AverageCell
            average={row.average}
            roundedAverage={row.roundedAverage}
          />
          {!row.hasMinimumGrades && data && (
            <MissingGradesHint
              count={row.grades.length}
              minimum={data.minimumGrades}
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
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
                  {a.subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canAdd && subjectId && actions?.(subjectId)}
        </div>
        {data && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <span>
              {data.teacher ? fullName(data.teacher) : 'No teacher assigned'}
            </span>
            <Badge variant="outline">{data.hoursPerWeek} h / week</Badge>
            <Badge variant="outline">min. {data.minimumGrades} grades</Badge>
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
    </Card>
  )
}
