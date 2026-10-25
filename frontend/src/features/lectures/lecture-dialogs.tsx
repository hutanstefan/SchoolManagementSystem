import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import {
  useForm,
  useWatch,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { ErrorState, LoadingBlock } from '@/components/states'
import { SelectField, TextField } from '@/components/form-fields'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Schemas } from '@/api/client'
import {
  MAX_LECTURE_BYTES,
  useCreateLecture,
  useLecture,
  useLectureHistory,
  useRecipients,
  useSetLectureStudents,
  useUpdateLecture,
  type Lecture,
  type LectureAccessChange,
} from './api'
import { titleFromFileName } from './lecture-utils'
import { PdfDrop } from './pdf-drop'
import { StudentPicker } from './student-picker'

type Subject = Schemas['SubjectSummaryDto']

const details = {
  title: z
    .string()
    .trim()
    .min(1, 'Give the lecture a title')
    .max(120, 'At most 120 characters'),
  subjectId: z.string().min(1, 'Pick a subject'),
  description: z.string().trim().max(1000, 'At most 1000 characters'),
}

const shareSchema = z.object({
  ...details,
  file: z
    .custom<File | null>()
    .refine((file) => file !== null, 'Choose a PDF file')
    .refine(
      (file) => !file || file.name.toLowerCase().endsWith('.pdf'),
      'Only PDF files can be shared',
    )
    .refine(
      (file) => !file || file.size <= MAX_LECTURE_BYTES,
      'The file is bigger than 20 MB',
    ),
})
type ShareInput = z.input<typeof shareSchema>
type ShareValues = z.output<typeof shareSchema>

function DescriptionField<T extends FieldValues>({
  control,
}: {
  control: Control<T>
}) {
  return (
    <FormField
      control={control}
      name={'description' as FieldPath<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Description{' '}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </FormLabel>
          <FormControl>
            <Textarea
              {...field}
              rows={3}
              placeholder="What it is, and what to do with it"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/** Add a PDF to the library and choose who can read it, in one go. */
export function ShareLectureDialog({
  open,
  onOpenChange,
  subjects,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The subjects the teacher teaches this year. */
  subjects: Subject[]
}) {
  const create = useCreateLecture()
  const recipients = useRecipients(open)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const form = useForm<ShareInput, unknown, ShareValues>({
    resolver: zodResolver(shareSchema),
    defaultValues: { title: '', subjectId: '', description: '', file: null },
  })
  const title = useWatch({ control: form.control, name: 'title' })
  // A fresh selection each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelected(new Set())
  }

  useEffect(() => {
    if (!open) return
    form.reset({
      title: '',
      // One subject: nothing to choose.
      subjectId: subjects.length === 1 ? subjects[0]!.id : '',
      description: '',
      file: null,
    })
  }, [open, subjects, form])

  const submit = async (values: ShareValues) => {
    await create.mutateAsync({
      title: values.title,
      description: values.description,
      subjectId: values.subjectId,
      studentIds: [...selected],
      file: values.file,
    })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a lecture"
      description="The PDF stays in your library. Choose who can read it: whole classes, or any students you like."
      form={form}
      onSubmit={submit}
      submitLabel={
        selected.size > 0
          ? `Share with ${selected.size} ${selected.size === 1 ? 'student' : 'students'}`
          : 'Add to library'
      }
      pending={create.isPending}
      className="sm:max-w-4xl"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="file"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>PDF</FormLabel>
                <PdfDrop
                  file={field.value}
                  invalid={Boolean(fieldState.error)}
                  onChange={(file) => {
                    field.onChange(file)
                    if (file && !title.trim()) {
                      form.setValue('title', titleFromFileName(file.name))
                    }
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <TextField control={form.control} name="title" label="Title" />
          <SelectField
            control={form.control}
            name="subjectId"
            label="Subject"
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
          <DescriptionField control={form.control} />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <Label>Who can read it</Label>
          <StudentPicker
            className="h-80 md:h-[440px]"
            students={recipients.data}
            isLoading={recipients.isPending}
            selected={selected}
            onChange={setSelected}
          />
          <p className="text-muted-foreground text-xs">
            {selected.size === 0
              ? 'You can also share it later.'
              : 'They can read it until you remove them.'}
          </p>
        </div>
      </div>
    </FormDialog>
  )
}

const editSchema = z.object(details)
type EditValues = z.infer<typeof editSchema>

/** Title, subject and description of a lecture. */
export function EditLectureDialog({
  lecture,
  onClose,
  subjects,
}: {
  lecture: Lecture | null
  onClose: () => void
  subjects: Subject[]
}) {
  const update = useUpdateLecture()
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { title: '', subjectId: '', description: '' },
  })

  useEffect(() => {
    if (lecture)
      form.reset({
        title: lecture.title,
        subjectId: lecture.subject.id,
        description: lecture.description ?? '',
      })
  }, [lecture, form])

  // The lecture's own subject is always an option (an admin may edit it).
  const options = [
    ...subjects,
    ...(lecture && !subjects.some((s) => s.id === lecture.subject.id)
      ? [lecture.subject]
      : []),
  ]

  return (
    <FormDialog
      open={lecture !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Edit lecture"
      description={lecture?.fileName}
      form={form}
      onSubmit={async (values) => {
        await update.mutateAsync({
          id: lecture!.id,
          body: { ...values, description: values.description || null },
        })
        onClose()
      }}
      pending={update.isPending}
    >
      <TextField control={form.control} name="title" label="Title" />
      <SelectField
        control={form.control}
        name="subjectId"
        label="Subject"
        options={options.map((s) => ({ value: s.id, label: s.name }))}
      />
      <DescriptionField control={form.control} />
    </FormDialog>
  )
}

/** Choose who can read a lecture (starting from who can now). */
export function LectureAccessDialog({
  lecture,
  onClose,
}: {
  lecture: Lecture | null
  onClose: () => void
}) {
  const detail = useLecture(lecture?.id ?? null)
  const recipients = useRecipients(lecture !== null)
  const save = useSetLectureStudents()
  // null: unchanged so far (the current readers). Reset for each lecture.
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)
  if ((lecture?.id ?? null) !== shownId) {
    setShownId(lecture?.id ?? null)
    setSelected(null)
  }

  const current =
    selected ?? new Set(detail.data?.students.map((s) => s.id) ?? [])
  // Readers who are no longer in the list (e.g. graduated) stay selectable.
  const students = [
    ...(recipients.data ?? []),
    ...(detail.data?.students ?? []).filter(
      (s) => !recipients.data?.some((r) => r.id === s.id),
    ),
  ]

  return (
    <Dialog open={lecture !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Who can read it</DialogTitle>
          <DialogDescription>
            {lecture?.title}. Students you add get a notification. Every change
            is kept in the access history.
          </DialogDescription>
        </DialogHeader>
        <StudentPicker
          className="h-[420px]"
          students={students}
          isLoading={recipients.isPending || detail.isPending}
          selected={current}
          onChange={setSelected}
        />
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={save.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <SubmitButton
            type="button"
            pending={save.isPending}
            disabled={detail.isPending}
            onClick={() =>
              lecture &&
              save.mutate(
                { id: lecture.id, studentIds: [...current] },
                { onSuccess: onClose },
              )
            }
          >
            Save
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Who got or lost access to a lecture, and who changed it. */
export function LectureHistoryDialog({
  lecture,
  onClose,
}: {
  lecture: Lecture | null
  onClose: () => void
}) {
  const [page, setPage] = useState(1)
  const [shownId, setShownId] = useState<string | null>(null)
  if ((lecture?.id ?? null) !== shownId) {
    setShownId(lecture?.id ?? null)
    setPage(1)
  }
  const history = useLectureHistory(lecture?.id ?? null, page)
  const meta = history.data?.meta

  return (
    <Dialog open={lecture !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Access history</DialogTitle>
          <DialogDescription>
            {lecture?.title}. Who got or lost access, newest first.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[440px] min-h-24 overflow-y-auto py-1 pl-2">
          {history.isPending ? (
            <LoadingBlock rows={4} />
          ) : history.error ? (
            <ErrorState
              error={history.error}
              onRetry={() => void history.refetch()}
            />
          ) : history.data.data.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              It hasn't been shared with anyone yet.
            </p>
          ) : (
            <ol className="relative flex flex-col gap-5 border-l pl-5">
              {history.data.data.map((change) => (
                <AccessChange
                  key={`${change.at}-${change.action}-${change.actor?.id ?? ''}`}
                  change={change}
                />
              ))}
            </ol>
          )}
        </div>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Newer
              </Button>
              <span className="text-muted-foreground tabular-nums">
                {page} / {meta.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Older
              </Button>
            </div>
          ) : (
            <span aria-hidden />
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One change: who made it, when, and the students it was about. */
function AccessChange({ change }: { change: LectureAccessChange }) {
  const [expanded, setExpanded] = useState(false)
  const granted = change.action === 'GRANTED'
  const count = change.students.length
  const shown = expanded ? change.students : change.students.slice(0, 4)
  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn(
          'ring-background absolute top-1 -left-[27px] size-3 rounded-full ring-4',
          granted ? 'bg-emerald-500' : 'bg-rose-500',
        )}
      />
      <p className="text-sm">
        <span className="font-medium">
          {change.actor ? fullName(change.actor) : 'Someone'}
        </span>{' '}
        {granted ? 'gave access to' : 'removed access for'}{' '}
        <span className="font-medium">
          {count} {count === 1 ? 'student' : 'students'}
        </span>
      </p>
      <p className="text-muted-foreground text-xs">
        {formatDateTime(change.at)}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {shown.map((student) => (
          <li
            key={student.id}
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs',
              granted
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-rose-500/30 bg-rose-500/5',
            )}
          >
            {student.firstName} {student.lastName}
            {student.class && (
              <span className="text-muted-foreground">
                {' '}
                · {student.class.name}
              </span>
            )}
          </li>
        ))}
        {count > 4 && (
          <li>
            <button
              type="button"
              className="text-primary px-1 text-xs font-medium hover:underline"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show less' : `+${count - 4} more`}
            </button>
          </li>
        )}
      </ul>
    </li>
  )
}
