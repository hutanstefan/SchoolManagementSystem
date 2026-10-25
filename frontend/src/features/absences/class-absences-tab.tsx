import { Lock, OctagonAlert, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { DataTable, type Column } from '@/components/data-table'
import { Segmented } from '@/components/segmented'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { Semester } from '@/features/school-years/api'
import { SubjectDot } from '@/features/subjects/subject-icon'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePeriod } from '@/periods/period-context'
import { startedSemesters } from '@/periods/resolve'
import { AbsenceCountCell } from './absence-count'
import { useClassAbsences, type ClassAbsenceRow } from './api'
import { absenceStatus } from './limits'
import {
  StudentAbsencesDialog,
  type StudentAbsencesTarget,
} from './student-absences-dialog'

type Filter = 'all' | 'risk'

/**
 * The absences of a whole class in a semester, for the homeroom teacher and
 * admins: who is close to, or over, a subject's limit, and every absence of
 * a student (to excuse a medical note, say).
 */
export function ClassAbsencesTab({
  classId,
  schoolYearId,
}: {
  classId: string
  /** The class's year: its semester follows the one picked in the sidebar. */
  schoolYearId: string
}) {
  const period = usePeriod()
  const [chosenSemester, setChosenSemester] = useState<Semester | undefined>()
  const semester =
    chosenSemester ??
    (schoolYearId === period.year?.id ? period.semester : undefined)
  const absences = useClassAbsences(classId, semester)
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<StudentAbsencesTarget | null>(null)

  const data = absences.data
  const shownSemester = data?.period.semester ?? semester ?? 1
  const started = data ? startedSemesters(data.period.schoolYear) : [1]
  const over = data?.students.filter((s) => s.overLimit > 0).length ?? 0
  const near =
    data?.students.filter((s) => s.overLimit === 0 && s.nearLimit > 0).length ??
    0
  const rows = data?.students.filter(
    (s) => filter === 'all' || s.overLimit + s.nearLimit > 0,
  )

  const openStudent = (row: ClassAbsenceRow) =>
    setOpen({
      student: { id: row.student.id, name: fullName(row.student) },
      schoolYearId: data?.period.schoolYear.id,
      semester: data?.period.semester,
      canExcusePeriod: data ? !data.readOnly : false,
    })

  /** The subjects where the student is close to, or over, the limit. */
  const risksOf = (row: ClassAbsenceRow) => {
    const risky = row.subjects.filter(
      (s) => absenceStatus(s.unexcused, s.maxAbsences) !== 'ok',
    )
    if (risky.length === 0) {
      return <span className="text-muted-foreground text-sm">—</span>
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {risky.map((s) => {
          const status = absenceStatus(s.unexcused, s.maxAbsences)
          return (
            <span
              key={s.subject.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                status === 'over'
                  ? 'bg-destructive/10 text-destructive dark:text-red-300'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
              )}
            >
              <SubjectDot color={s.subject.color} />
              {s.subject.name}
              <span className="tabular-nums opacity-80">
                {s.unexcused}/{s.maxAbsences}
              </span>
            </span>
          )
        })}
      </div>
    )
  }

  const columns: Column<ClassAbsenceRow>[] = [
    {
      header: 'Reg. no.',
      className: 'hidden w-24 @2xl:table-cell',
      cell: (row) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          {row.registrationNumber}
        </span>
      ),
    },
    {
      header: 'Student',
      cell: (row) => (
        <>
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={() => openStudent(row)}
          >
            {fullName(row.student)}
          </button>
          {/* Narrow: the subjects at risk under the name. */}
          {row.overLimit + row.nearLimit > 0 && (
            <div className="mt-1.5 @xl:hidden">{risksOf(row)}</div>
          )}
        </>
      ),
    },
    {
      header: 'Absences',
      className: 'w-36',
      cell: (row) => (
        <AbsenceCountCell
          count={row.total}
          maxAbsences={null}
          onClick={() => openStudent(row)}
          label={`Absences of ${fullName(row.student)}`}
        />
      ),
    },
    {
      header: 'Close to or over a limit',
      className: 'hidden @xl:table-cell',
      cell: risksOf,
    },
  ]

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex flex-wrap items-center gap-2">
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
          <Segmented
            label="Students"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All students' },
              { value: 'risk', label: 'At risk' },
            ]}
          />
          {data?.readOnly && (
            <Badge variant="warning-soft" className="gap-1">
              <Lock aria-hidden /> Read-only
            </Badge>
          )}
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={over > 0 ? 'destructive-soft' : 'outline'}>
              <OctagonAlert aria-hidden /> {over} over a limit
            </Badge>
            <Badge variant={near > 0 ? 'warning-soft' : 'outline'}>
              <TriangleAlert aria-hidden /> {near} close to one
            </Badge>
          </div>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.student.id}
        isLoading={absences.isPending}
        error={absences.error}
        onRetry={() => void absences.refetch()}
        emptyTitle={
          filter === 'risk'
            ? 'Nobody is close to a limit'
            : 'No students in this class'
        }
        emptyDescription={
          filter === 'risk'
            ? 'Students show up here from 80% of a subject’s absence limit.'
            : undefined
        }
      />
      <p className="text-muted-foreground border-t px-4 py-3 text-xs">
        Limits are per subject and semester; only unexcused absences count.
        Click a student to see, excuse or delete their absences.
      </p>
      <StudentAbsencesDialog target={open} onClose={() => setOpen(null)} />
    </Card>
  )
}
