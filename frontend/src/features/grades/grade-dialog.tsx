import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormDialog } from '@/components/form-dialog'
import { TextField } from '@/components/form-fields'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { todayIso } from '@/lib/format'
import { cn } from '@/lib/utils'
import { notFutureDateField } from '@/lib/validation'
import {
  useCreateGrade,
  useDeleteGrade,
  useUpdateGrade,
  type GradeEntry,
} from './api'
import { gradeTone } from './grade-tone'

const schema = z.object({
  value: z
    .number({ error: 'Pick a grade' })
    .int()
    .min(1, 'Pick a grade')
    .max(10),
  date: notFutureDateField,
})
type Values = z.infer<typeof schema>

export type GradeDialogState =
  | {
      mode: 'add'
      student: { id: string; name: string }
      subject: { id: string; name: string }
      /** The semester the grade goes to; the current one when omitted. */
      semester?: 1 | 2
    }
  | {
      mode: 'edit'
      grade: Pick<GradeEntry, 'id' | 'value' | 'date'>
      student: { id: string; name: string }
      subject: { id: string; name: string }
    }

/** Add a grade for a student, or change / delete an existing one. */
export function GradeDialog({
  state,
  onClose,
}: {
  state: GradeDialogState | null
  onClose: () => void
}) {
  const create = useCreateGrade()
  const update = useUpdateGrade()
  const remove = useDeleteGrade()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { value: 0, date: todayIso() },
  })

  useEffect(() => {
    if (!state) return
    form.reset(
      state.mode === 'edit'
        ? { value: state.grade.value, date: state.grade.date }
        : { value: 0, date: todayIso() },
    )
  }, [state, form])

  const submit = async (values: Values) => {
    if (state?.mode === 'edit') {
      await update.mutateAsync({ id: state.grade.id, body: values })
    } else if (state) {
      await create.mutateAsync({
        studentId: state.student.id,
        subjectId: state.subject.id,
        semester: state.semester,
        ...values,
      })
    }
    onClose()
  }

  return (
    <>
      <FormDialog
        open={state !== null}
        onOpenChange={(open) => !open && onClose()}
        title={state?.mode === 'edit' ? 'Edit grade' : 'Add grade'}
        description={
          state &&
          [
            state.student.name,
            state.subject.name,
            state.mode === 'add' &&
              state.semester &&
              `Semester ${state.semester}`,
          ]
            .filter(Boolean)
            .join(' · ')
        }
        form={form}
        onSubmit={submit}
        submitLabel={state?.mode === 'edit' ? 'Save changes' : 'Add grade'}
        pending={create.isPending || update.isPending}
        extraActions={
          state?.mode === 'edit' && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden /> Delete
            </Button>
          )
        }
      >
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grade</FormLabel>
              <FormControl>
                <div
                  role="radiogroup"
                  aria-label="Grade"
                  className="grid grid-cols-5 gap-2 sm:grid-cols-10"
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map(
                    (value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={field.value === value}
                        onClick={() => field.onChange(value)}
                        className={cn(
                          'h-10 rounded-md border text-sm font-semibold tabular-nums transition',
                          field.value === value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : cn(
                                gradeTone(value),
                                'hover:ring-ring/50 hover:ring-2',
                              ),
                        )}
                      >
                        {value}
                      </button>
                    ),
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <TextField
          control={form.control}
          name="date"
          label="Date"
          type="date"
          max={todayIso()}
        />
      </FormDialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this grade?"
        description="The grade is removed from the averages. The change stays in the grade history."
        pending={remove.isPending}
        onConfirm={() =>
          state?.mode === 'edit' &&
          remove.mutate(state.grade.id, {
            onSuccess: () => {
              setConfirmDelete(false)
              onClose()
            },
          })
        }
      />
    </>
  )
}
