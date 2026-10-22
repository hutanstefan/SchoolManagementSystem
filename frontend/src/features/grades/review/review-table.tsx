import { History } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GradeEntry } from '../api'
import { ExistingGradesDialog } from './existing-grades-dialog'
import {
  effectiveDate,
  rowProblems,
  sameDayGrades,
  type Decision,
  type ReviewContext,
  type ReviewRow,
  type RowProblem,
} from './review'

const NONE = '__none__'

/** A student the rows can be matched to. */
export interface ReviewStudent {
  id: string
  firstName: string
  lastName: string
  class?: { id: string; name: string } | null
}

const PROBLEM_TEXT: Record<RowProblem, string> = {
  failed: 'This could not be read: untick it or fill in both fields.',
  'no-student': 'Pick the student.',
  'no-grade': 'Pick the grade.',
  duplicate: 'This student is on another row too.',
  'same-day': '',
}

/**
 * What was read for each row next to fields the teacher can correct, the
 * student's existing grades, and what still blocks saving. Shared by the
 * test scan (photos) and the Excel import (rows of a file).
 */
export function ReviewTable<S>({
  rows,
  students,
  subjectName,
  context,
  canReplace,
  sourceHeader,
  renderSource,
  renderRead,
  onChange,
}: {
  rows: ReviewRow<S>[]
  students: ReviewStudent[]
  subjectName: string
  context: ReviewContext
  canReplace: (grade: GradeEntry) => boolean
  sourceHeader: string
  renderSource: (row: ReviewRow<S>) => ReactNode
  renderRead: (row: ReviewRow<S>) => ReactNode
  onChange: (index: number, change: Partial<ReviewRow<S>>) => void
}) {
  const [deciding, setDeciding] = useState<number | null>(null)
  const problems = rowProblems(rows, context)
  const studentName = (id: string | null) => {
    const student = students.find((s) => s.id === id)
    return student ? fullName(student) : ''
  }
  const decidingRow = deciding === null ? null : rows[deciding]
  // With students of several classes, the picker groups them by class.
  const groups = groupByClass(students)

  return (
    <>
      <Table className="[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Save</span>
            </TableHead>
            <TableHead className="w-20">{sourceHeader}</TableHead>
            <TableHead>Read</TableHead>
            <TableHead className="w-56">Student</TableHead>
            <TableHead className="w-28">Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const existing = row.studentId
              ? context.gradesOf(row.studentId)
              : []
            const sameDay = sameDayGrades(row, context)
            const label = `row ${index + 1}`
            return (
              <TableRow
                key={row.key}
                className={cn('align-top', !row.include && 'opacity-60')}
              >
                <TableCell className="pt-4">
                  <Checkbox
                    checked={row.include}
                    onCheckedChange={(checked) =>
                      onChange(index, { include: checked === true })
                    }
                    aria-label={`Save the grade of ${label}`}
                  />
                </TableCell>
                <TableCell>{renderSource(row)}</TableCell>
                <TableCell className="whitespace-normal">
                  {renderRead(row)}
                  {problems[index]!.filter((p) => p !== 'same-day').map(
                    (problem) => (
                      <p
                        key={problem}
                        role="alert"
                        className="text-destructive mt-1 text-xs font-medium"
                      >
                        {PROBLEM_TEXT[problem]}
                      </p>
                    ),
                  )}
                  {row.include && row.studentId && existing.length > 0 && (
                    <ExistingGradesLine
                      sameDay={sameDay}
                      count={existing.length}
                      decision={row.decision}
                      date={effectiveDate(row, context)}
                      onOpen={() => setDeciding(index)}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={row.studentId ?? NONE}
                    onValueChange={(value) =>
                      onChange(index, {
                        studentId: value === NONE ? null : value,
                        include: true,
                        // A decision was about the previous student's grades.
                        decision: null,
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label={`Student for ${label}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Pick a student…</SelectItem>
                      {groups.length === 1
                        ? groups[0]!.students.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {fullName(s)}
                            </SelectItem>
                          ))
                        : groups.map((group) => (
                            <SelectGroup key={group.name}>
                              <SelectLabel>{group.name}</SelectLabel>
                              {group.students.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {fullName(s)} · {group.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={row.grade === null ? NONE : String(row.grade)}
                    onValueChange={(value) =>
                      onChange(index, {
                        grade: value === NONE ? null : Number(value),
                        include: true,
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label={`Grade for ${label}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {Array.from({ length: 10 }, (_, i) => 10 - i).map(
                        (value) => (
                          <SelectItem key={value} value={String(value)}>
                            {value}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {decidingRow && deciding !== null && decidingRow.studentId && (
        <ExistingGradesDialog
          studentName={studentName(decidingRow.studentId)}
          subjectName={subjectName}
          newGrade={decidingRow.grade}
          date={effectiveDate(decidingRow, context)}
          grades={context.gradesOf(decidingRow.studentId)}
          canReplace={canReplace}
          decision={decidingRow.decision}
          onDecide={(decision) =>
            onChange(
              deciding,
              decision === 'skip'
                ? { include: false, decision: null }
                : { decision },
            )
          }
          onClose={() => setDeciding(null)}
        />
      )}
    </>
  )
}

function ExistingGradesLine({
  sameDay,
  count,
  decision,
  date,
  onOpen,
}: {
  sameDay: GradeEntry[]
  count: number
  decision: Decision | null
  date: string
  onOpen: () => void
}) {
  if (sameDay.length > 0 && decision === null) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1.5 h-7 border-amber-500/50 text-amber-700 dark:text-amber-400"
        onClick={onOpen}
      >
        <History aria-hidden /> Already has a {sameDay[0]!.value} on{' '}
        {formatDate(date)}: choose what to do
      </Button>
    )
  }
  const summary =
    decision?.kind === 'replace'
      ? 'Will replace an existing grade'
      : decision?.kind === 'add'
        ? 'Will be added as another grade'
        : `${count} ${count === 1 ? 'grade' : 'grades'} so far`
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
    >
      <History className="size-3" aria-hidden /> {summary} · see grades
    </button>
  )
}

function groupByClass(
  students: ReviewStudent[],
): { name: string; students: ReviewStudent[] }[] {
  const groups = new Map<string, ReviewStudent[]>()
  for (const student of students) {
    const name = student.class?.name ?? 'No class'
    groups.set(name, [...(groups.get(name) ?? []), student])
  }
  return [...groups].map(([name, list]) => ({ name, students: list }))
}
