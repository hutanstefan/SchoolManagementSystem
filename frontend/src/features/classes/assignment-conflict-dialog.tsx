import { useState } from 'react'
import type { Schemas } from '@/api/client'
import { errorMessage } from '@/api/client'
import { SubmitButton } from '@/components/submit-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  timetableConflictOf,
  type TimetableConflict,
} from '@/features/timetable/api'
import { WEEKDAY_LABEL, fullName, periodTime } from '@/lib/format'
import { useUpdateClassSubject } from './api'

export interface AssignmentConflictState {
  classSubjectId: string
  subjectName: string
  /** The change that was refused. */
  body: Schemas['UpdateClassSubjectDto']
  conflict: TimetableConflict
}

/**
 * Conflicts when editing a subject of a class:
 * - fewer weekly hours than lessons in the timetable: pick the lessons to
 *   remove, and both changes are saved together;
 * - the new teacher already teaches other classes at some of its times:
 *   shows where, so the admin can move those lessons or pick someone else.
 */
export function AssignmentConflictDialog({
  initial,
  onClose,
}: {
  initial: AssignmentConflictState
  onClose: () => void
}) {
  const update = useUpdateClassSubject({ handlesConflicts: true })
  const [current, setCurrent] = useState(initial)
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const { conflict, subjectName } = current

  const slot = (lesson: TimetableConflict['lessons'][number]) =>
    `${WEEKDAY_LABEL[lesson.day]}, period ${lesson.period} (${periodTime(lesson.period)})`

  if (conflict.type === 'TEACHER_BUSY') {
    const teacher = conflict.lessons[0]?.teacher
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {teacher ? fullName(teacher) : 'The teacher'} isn't free at every{' '}
              {subjectName} lesson
            </DialogTitle>
            <DialogDescription>
              They already teach other classes at these times. Move these
              lessons in the timetable first, or choose another teacher.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y rounded-md border text-sm">
            {conflict.lessons.map((lesson) => (
              <li key={lesson.id} className="flex justify-between gap-3 p-3">
                <span>{slot(lesson)}</span>
                <span className="text-muted-foreground">
                  {lesson.class.name} · {lesson.subject.name}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const scheduled = conflict.lessons.length
  const hours = conflict.hoursPerWeek ?? 0
  const toRemove = scheduled - hours

  const apply = async () => {
    setError(null)
    try {
      await update.mutateAsync({
        id: current.classSubjectId,
        body: { ...current.body, removeLessonIds: selected },
      })
      onClose()
    } catch (caught) {
      const next = timetableConflictOf(caught)
      if (next) {
        setCurrent({ ...current, conflict: next })
        setSelected([])
      } else {
        setError(errorMessage(caught))
      }
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Choose {toRemove} {subjectName}{' '}
            {toRemove === 1 ? 'lesson' : 'lessons'} to remove
          </DialogTitle>
          <DialogDescription>
            {subjectName} has {scheduled} lessons in the timetable, but you set{' '}
            {hours} {hours === 1 ? 'hour' : 'hours'} a week. The lessons you
            pick are removed and the new hours are saved together.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col divide-y rounded-md border">
          <legend className="sr-only">Lessons to remove</legend>
          {conflict.lessons.map((lesson) => {
            const checked = selected.includes(lesson.id)
            return (
              <label
                key={lesson.id}
                className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 p-3 text-sm"
              >
                <Checkbox
                  checked={checked}
                  disabled={!checked && selected.length >= toRemove}
                  onCheckedChange={(value) =>
                    setSelected((current) =>
                      value === true
                        ? [...current, lesson.id]
                        : current.filter((id) => id !== lesson.id),
                    )
                  }
                />
                <span className="flex-1">{slot(lesson)}</span>
                {lesson.room && (
                  <span className="text-muted-foreground">{lesson.room}</span>
                )}
              </label>
            )
          })}
        </fieldset>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton
            type="button"
            disabled={selected.length !== toRemove}
            pending={update.isPending}
            onClick={() => void apply()}
          >
            Remove {selected.length || ''} and save
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
