import { useState } from 'react'
import { ChoiceList, type Choice } from '@/components/choice-list'
import { SubmitButton } from '@/components/submit-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { errorMessage } from '@/api/client'
import { WEEKDAY_LABEL, fullName, type Weekday } from '@/lib/format'
import {
  timetableConflictOf,
  useAddLesson,
  useUpdateLesson,
  type Lesson,
  type TimetableConflict,
} from './api'
import { FreeSlotPicker, type Slot } from './free-slot-picker'

/** What the admin tried to do when the conflict happened. */
export type LessonAttempt =
  | {
      kind: 'add'
      classId: string
      classSubjectId: string
      subjectName: string
      day: Weekday
      period: number
      room: string | null
    }
  | {
      kind: 'move'
      lesson: Lesson
      day: Weekday
      period: number
      room: string | null
    }

export interface ConflictState {
  attempt: LessonAttempt
  conflict: TimetableConflict
}

type Resolution =
  'replace' | 'swap' | 'other-slot' | 'add-hour' | 'move-existing'

const slotLabel = (day: Weekday, period: number) =>
  `${WEEKDAY_LABEL[day]}, period ${period}`
const lessonLabel = (lesson: Lesson) =>
  `${lesson.subject.name}${lesson.teacher ? ` (${fullName(lesson.teacher)})` : ''}`

/**
 * Turns a timetable conflict into a decision: replace or swap the lesson in
 * the way, add an hour, move an existing lesson, or pick a free slot. Each
 * choice is one request, checked again by the API; if it clashes with
 * something else, the dialog shows the new conflict.
 */
export function ConflictDialog({
  initial,
  onClose,
}: {
  /** Render with a new `key` for each conflict, so the choices start fresh. */
  initial: ConflictState
  onClose: () => void
}) {
  const add = useAddLesson()
  const update = useUpdateLesson()
  const [current, setCurrent] = useState(initial)
  const [choice, setChoice] = useState<Resolution | null>(null)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [lessonToMove, setLessonToMove] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { attempt, conflict } = current
  const subjectName =
    attempt.kind === 'add' ? attempt.subjectName : attempt.lesson.subject.name
  const classSubjectId =
    attempt.kind === 'add'
      ? attempt.classSubjectId
      : attempt.lesson.classSubjectId
  const target = slotLabel(attempt.day, attempt.period)
  const [inTheWay] = conflict.lessons

  // The choices that make sense for this conflict.
  const choices: Choice<Resolution>[] = []
  let explanation: string
  switch (conflict.type) {
    case 'CLASS_SLOT_TAKEN':
      explanation = `${inTheWay?.class.name} already has ${inTheWay ? lessonLabel(inTheWay) : 'a lesson'} on ${target}.`
      if (attempt.kind === 'move') {
        choices.push({
          value: 'swap',
          label: 'Swap the two lessons',
          description: `${inTheWay?.subject.name} moves to ${slotLabel(attempt.lesson.day, attempt.lesson.period)}, where ${subjectName} was.`,
        })
      }
      choices.push(
        {
          value: 'replace',
          label: `Replace ${inTheWay?.subject.name} with ${subjectName}`,
          description: `The ${inTheWay?.subject.name} lesson is removed from the timetable.`,
        },
        {
          value: 'other-slot',
          label: `Put ${subjectName} in another slot`,
          description: 'Only slots where the class and the teacher are free.',
        },
      )
      break
    case 'TEACHER_BUSY':
      explanation = `${inTheWay?.teacher ? fullName(inTheWay.teacher) : 'The teacher'} teaches ${inTheWay?.class.name} (${inTheWay?.subject.name}) on ${target}, and can't be in two classes at once.`
      choices.push({
        value: 'other-slot',
        label: `Put ${subjectName} in another slot`,
        description: 'Only slots where the class and the teacher are free.',
      })
      break
    case 'WEEKLY_HOURS_FULL':
      explanation = `All ${conflict.hoursPerWeek} weekly hours of ${subjectName} are already in the timetable.`
      choices.push(
        {
          value: 'add-hour',
          label: `Make it ${(conflict.hoursPerWeek ?? 0) + 1} hours a week`,
          description: `${subjectName} gets ${(conflict.hoursPerWeek ?? 0) + 1} hours a week, and the lesson is added on ${target}.`,
          disabled: (conflict.hoursPerWeek ?? 0) >= 10,
        },
        {
          value: 'move-existing',
          label: `Move one of the ${subjectName} lessons here`,
          description: 'Keeps the weekly hours as they are.',
        },
      )
      break
    default:
      explanation = 'This change clashes with the timetable.'
  }

  const apply = async () => {
    setError(null)
    const room = attempt.room
    try {
      if (choice === 'move-existing') {
        await update.mutateAsync({
          id: lessonToMove!,
          body: { day: attempt.day, period: attempt.period },
        })
      } else if (attempt.kind === 'add') {
        const where = choice === 'other-slot' ? slot! : attempt
        await add.mutateAsync({
          classId: attempt.classId,
          body: {
            classSubjectId: attempt.classSubjectId,
            day: where.day,
            period: where.period,
            room,
            replaceLessonId: choice === 'replace' ? inTheWay?.id : undefined,
            increaseHours: choice === 'add-hour' ? true : undefined,
          },
        })
      } else {
        const where = choice === 'other-slot' ? slot! : attempt
        await update.mutateAsync({
          id: attempt.lesson.id,
          body: {
            day: where.day,
            period: where.period,
            room,
            swap: choice === 'swap' ? true : undefined,
            replaceLessonId: choice === 'replace' ? inTheWay?.id : undefined,
          },
        })
      }
      onClose()
    } catch (caught) {
      const next = timetableConflictOf(caught)
      if (next) {
        // The chosen fix clashes with something else: show that instead.
        const nextAttempt =
          choice === 'other-slot' && slot ? { ...attempt, ...slot } : attempt
        setCurrent({ attempt: nextAttempt, conflict: next })
        setChoice(null)
        setSlot(null)
      } else {
        setError(errorMessage(caught))
      }
    }
  }

  const ready =
    choice !== null &&
    (choice !== 'other-slot' || slot !== null) &&
    (choice !== 'move-existing' || lessonToMove !== null)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {attempt.kind === 'add'
              ? `${subjectName} can't go on ${target} yet`
              : `${subjectName} can't move to ${target} yet`}
          </DialogTitle>
          <DialogDescription>{explanation}</DialogDescription>
        </DialogHeader>

        <ChoiceList
          name="resolution"
          legend="How to resolve it"
          value={choice}
          onChange={setChoice}
          choices={choices}
        />

        {choice === 'other-slot' && (
          <div className="ml-7 flex flex-col gap-2">
            <p className="text-sm font-medium">Free slots</p>
            <FreeSlotPicker
              classSubjectId={classSubjectId}
              excludeLessonId={
                attempt.kind === 'move' ? attempt.lesson.id : undefined
              }
              value={slot}
              onChange={setSlot}
            />
          </div>
        )}
        {choice === 'move-existing' && (
          <div className="ml-7 flex flex-col gap-2">
            <p className="text-sm font-medium">Which lesson?</p>
            <ChoiceList
              name="lesson-to-move"
              legend="Lesson to move"
              value={lessonToMove}
              onChange={setLessonToMove}
              choices={conflict.lessons.map((lesson) => ({
                value: lesson.id,
                label: slotLabel(lesson.day, lesson.period),
                description: lesson.room ?? undefined,
              }))}
            />
          </div>
        )}
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
            disabled={!ready}
            pending={add.isPending || update.isPending}
            onClick={() => void apply()}
          >
            Apply
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
