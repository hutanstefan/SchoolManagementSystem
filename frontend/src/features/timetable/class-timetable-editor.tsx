import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { SelectField, TextField } from '@/components/form-fields'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ClassDetail } from '@/features/classes/api'
import {
  PERIODS,
  WEEKDAYS,
  WEEKDAY_LABEL,
  fullName,
  periodTime,
  type Weekday,
} from '@/lib/format'
import {
  useAddLesson,
  useClassTimetable,
  useDeleteLesson,
  useUpdateLesson,
  type Lesson,
} from './api'
import { TimetableGrid } from './timetable-grid'

type DialogState =
  | { mode: 'add'; day: Weekday; period: number }
  | { mode: 'edit'; lesson: Lesson }

/** The class timetable, editable: click an empty slot to add a lesson. */
export function ClassTimetableEditor({
  schoolClass,
}: {
  schoolClass: ClassDetail
}) {
  const timetable = useClassTimetable(schoolClass.id)
  const [dialog, setDialog] = useState<DialogState | null>(null)

  if (timetable.isPending) return <LoadingBlock />
  if (timetable.error) {
    return (
      <ErrorState
        error={timetable.error}
        onRetry={() => void timetable.refetch()}
      />
    )
  }

  const scheduled = new Map<string, number>()
  for (const day of timetable.data.days) {
    for (const lesson of day.lessons) {
      scheduled.set(
        lesson.classSubjectId,
        (scheduled.get(lesson.classSubjectId) ?? 0) + 1,
      )
    }
  }

  return (
    <Card className="gap-0 py-0">
      <p className="text-muted-foreground border-b p-4 text-sm">
        Click an empty slot to add a lesson, or a lesson to move or remove it. A
        teacher can't be in two classes at the same time.
      </p>
      <div className="p-2">
        <TimetableGrid
          timetable={timetable.data}
          mode="class"
          onEmptyCellClick={(day, period) =>
            setDialog({ mode: 'add', day, period })
          }
          onLessonClick={(lesson) => setDialog({ mode: 'edit', lesson })}
        />
      </div>
      <LessonDialog
        schoolClass={schoolClass}
        scheduled={scheduled}
        state={dialog}
        onClose={() => setDialog(null)}
      />
    </Card>
  )
}

const schema = z.object({
  classSubjectId: z.string().min(1, 'Pick a subject'),
  day: z.enum(WEEKDAYS),
  period: z.coerce.number<string>().int().min(1).max(8),
  room: z.string().trim().max(30, 'At most 30 characters'),
})
type Values = z.input<typeof schema>
type Output = z.output<typeof schema>

function LessonDialog({
  schoolClass,
  scheduled,
  state,
  onClose,
}: {
  schoolClass: ClassDetail
  scheduled: Map<string, number>
  state: DialogState | null
  onClose: () => void
}) {
  const add = useAddLesson()
  const update = useUpdateLesson()
  const remove = useDeleteLesson()
  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: { classSubjectId: '', day: 'MONDAY', period: '1', room: '' },
  })

  useEffect(() => {
    if (!state) return
    form.reset(
      state.mode === 'add'
        ? {
            classSubjectId: '',
            day: state.day,
            period: String(state.period),
            room: '',
          }
        : {
            classSubjectId: state.lesson.classSubjectId,
            day: state.lesson.day,
            period: String(state.lesson.period),
            room: state.lesson.room ?? '',
          },
    )
  }, [state, form])

  const submit = async ({ classSubjectId, day, period, room }: Output) => {
    if (state?.mode === 'edit') {
      await update.mutateAsync({
        id: state.lesson.id,
        body: { day, period, room: room || null },
      })
    } else {
      await add.mutateAsync({
        classId: schoolClass.id,
        body: { classSubjectId, day, period, room: room || null },
      })
    }
    onClose()
  }

  const subjectOptions = schoolClass.subjects.map((a) => ({
    value: a.classSubjectId,
    label: `${a.subject.name}${a.teacher ? ` · ${fullName(a.teacher)}` : ''} (${
      scheduled.get(a.classSubjectId) ?? 0
    }/${a.hoursPerWeek})`,
  }))

  return (
    <FormDialog
      open={state !== null}
      onOpenChange={(open) => !open && onClose()}
      title={
        state?.mode === 'edit'
          ? `${state.lesson.subject.name} lesson`
          : 'Add lesson'
      }
      description={
        state?.mode === 'edit'
          ? 'Move the lesson to another slot or change the room.'
          : 'The numbers show lessons scheduled out of the weekly hours.'
      }
      form={form}
      onSubmit={submit}
      submitLabel={state?.mode === 'edit' ? 'Save changes' : 'Add lesson'}
      pending={add.isPending || update.isPending}
      extraActions={
        state?.mode === 'edit' && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(state.lesson.id, { onSuccess: onClose })
            }
          >
            <Trash2 aria-hidden /> Remove
          </Button>
        )
      }
    >
      <SelectField
        control={form.control}
        name="classSubjectId"
        label="Subject"
        options={subjectOptions}
        disabled={state?.mode === 'edit'}
        placeholder={
          subjectOptions.length === 0
            ? 'Add subjects to the class first'
            : 'Select…'
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={form.control}
          name="day"
          label="Day"
          options={WEEKDAYS.map((day) => ({
            value: day,
            label: WEEKDAY_LABEL[day],
          }))}
        />
        <SelectField
          control={form.control}
          name="period"
          label="Period"
          options={PERIODS.map((period) => ({
            value: String(period),
            label: `${period} · ${periodTime(period)}`,
          }))}
        />
      </div>
      <TextField
        control={form.control}
        name="room"
        label="Room (optional)"
        placeholder="e.g. Lab 2"
      />
    </FormDialog>
  )
}
