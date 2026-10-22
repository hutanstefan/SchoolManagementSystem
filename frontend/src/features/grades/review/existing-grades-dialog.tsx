import { useState } from 'react'
import { ChoiceList, type Choice } from '@/components/choice-list'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GradeEntry } from '../api'
import { gradeTone } from '../grade-tone'
import type { Decision } from './review'

type Option = 'add' | 'skip' | `replace:${string}`

/**
 * The grades a student already has in the subject, with their dates, and the
 * choice for the new grade: add it as another grade, replace one of them, or
 * don't save it. Grades given on the same day are highlighted.
 */
export function ExistingGradesDialog({
  studentName,
  subjectName,
  newGrade,
  date,
  grades,
  canReplace,
  decision,
  onDecide,
  onClose,
}: {
  studentName: string
  subjectName: string
  newGrade: number | null
  /** The date the new grade will have (YYYY-MM-DD). */
  date: string
  grades: GradeEntry[]
  /** Teachers can only replace the grades they gave. */
  canReplace: (grade: GradeEntry) => boolean
  decision: Decision | null
  onDecide: (decision: Decision | 'skip') => void
  onClose: () => void
}) {
  const [option, setOption] = useState<Option | null>(
    decision?.kind === 'replace'
      ? `replace:${decision.gradeId}`
      : decision?.kind === 'add'
        ? 'add'
        : null,
  )
  const sameDay = (grade: GradeEntry) => grade.date.slice(0, 10) === date
  // Newest first, same-day grades on top.
  const sorted = [...grades].sort(
    (a, b) =>
      Number(sameDay(b)) - Number(sameDay(a)) || b.date.localeCompare(a.date),
  )

  const choices: Choice<Option>[] = [
    {
      value: 'add',
      label: `Add ${newGrade ?? 'the new grade'} as another grade`,
      description: `${studentName} keeps all the grades below.`,
    },
    ...sorted.filter(canReplace).map((grade) => ({
      value: `replace:${grade.id}` as const,
      label: `Replace the ${grade.value} from ${formatDate(grade.date)} with ${newGrade ?? 'the new grade'}`,
      description: 'The change is kept in the grade history.',
    })),
    {
      value: 'skip',
      label: "Don't save this grade",
    },
  ]

  const confirm = () => {
    if (option === 'skip') onDecide('skip')
    else if (option === 'add') onDecide({ kind: 'add' })
    else if (option) {
      onDecide({ kind: 'replace', gradeId: option.slice('replace:'.length) })
    }
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {studentName} · {subjectName}
          </DialogTitle>
          <DialogDescription>
            {grades.some(sameDay)
              ? `Already has a grade on ${formatDate(date)}. What should happen with the new ${newGrade ?? 'grade'}?`
              : `Grades so far. The new ${newGrade ?? 'grade'} is dated ${formatDate(date)}.`}
          </DialogDescription>
        </DialogHeader>

        <ul
          className="max-h-56 divide-y overflow-y-auto rounded-md border text-sm"
          aria-label="Grades so far"
        >
          {sorted.map((grade) => (
            <li
              key={grade.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2',
                sameDay(grade) && 'bg-amber-500/10',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-7 items-center justify-center rounded-md border font-semibold tabular-nums',
                  gradeTone(grade.value),
                )}
              >
                {grade.value}
              </span>
              <span className="flex-1">
                {formatDate(grade.date)}
                {sameDay(grade) && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {' '}
                    · same day
                  </span>
                )}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {grade.teacher ? fullName(grade.teacher) : ''}
              </span>
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="text-muted-foreground px-3 py-2">No grades yet.</li>
          )}
        </ul>

        <ChoiceList
          name="existing-grade"
          legend="What to do with the new grade"
          value={option}
          onChange={setOption}
          choices={choices}
        />

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={option === null} onClick={confirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
