import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type Column } from '@/components/data-table'
import { FormDialog } from '@/components/form-dialog'
import { TextField } from '@/components/form-fields'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { nameField } from '@/lib/validation'
import {
  useCreateSubject,
  useDeleteSubject,
  useSubjects,
  useUpdateSubject,
  type Subject,
} from './api'
import {
  SUBJECT_COLOR_KEYS,
  SUBJECT_COLORS,
  type SubjectColor,
} from './subject-colors'
import { IconPicker } from './icon-picker'
import { SubjectIcon } from './subject-icon'
import {
  iconForName,
  SUBJECT_ICON_KEYS,
  SUBJECT_ICONS,
  type SubjectIconName,
} from './subject-icons'

const schema = z.object({
  name: nameField,
  color: z.enum(SUBJECT_COLOR_KEYS as [SubjectColor, ...SubjectColor[]]),
  icon: z.enum(SUBJECT_ICON_KEYS as [SubjectIconName, ...SubjectIconName[]]),
})
type Values = z.infer<typeof schema>

/** The colour fewest subjects have: a good start for a new one. */
function leastUsedColor(subjects: Subject[]): SubjectColor {
  const count = (color: SubjectColor) =>
    subjects.filter((s) => s.color === color).length
  return SUBJECT_COLOR_KEYS.reduce((best, color) =>
    count(color) < count(best) ? color : best,
  )
}

export function SubjectsPage() {
  const subjects = useSubjects()
  const remove = useDeleteSubject()
  const [editing, setEditing] = useState<Subject | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Subject | null>(null)

  const [newColor, setNewColor] = useState<SubjectColor>('INDIGO')

  const openForm = (subject: Subject | null) => {
    setEditing(subject)
    setNewColor(subject?.color ?? leastUsedColor(subjects.data ?? []))
    setFormOpen(true)
  }

  const columns: Column<Subject>[] = [
    {
      header: 'Name',
      cell: (s) => (
        <div className="flex items-center gap-3">
          <SubjectIcon subject={s} />
          <span className="font-medium">{s.name}</span>
        </div>
      ),
    },
    {
      header: 'Look',
      className: 'hidden @md:table-cell',
      cell: (s) => (
        <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className={cn('size-3 rounded-full', SUBJECT_COLORS[s.color].solid)}
          />
          {SUBJECT_COLORS[s.color].label} · {SUBJECT_ICONS[s.icon].label}
        </span>
      ),
    },
    {
      header: <span className="sr-only">Actions</span>,
      className: 'w-24 text-right',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${s.name}`}
            onClick={() => openForm(s)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${s.name}`}
            onClick={() => setDeleting(s)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Subjects"
        description="The subjects taught in the school. Each has a colour and icon, used in timetables, gradebooks and report cards."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus aria-hidden /> Add subject
          </Button>
        }
      />
      <Card className="max-w-2xl gap-0 py-0">
        <DataTable
          columns={columns}
          rows={subjects.data}
          rowKey={(s) => s.id}
          isLoading={subjects.isPending}
          error={subjects.error}
          onRetry={() => void subjects.refetch()}
          emptyTitle="No subjects yet"
        />
      </Card>

      <SubjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        subject={editing}
        initialColor={newColor}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="A subject that is taught in a class or has grades can't be deleted. Remove it from the classes first."
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  )
}

function SubjectFormDialog({
  open,
  onOpenChange,
  subject,
  initialColor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject: Subject | null
  initialColor: SubjectColor
}) {
  const create = useCreateSubject()
  const update = useUpdateSubject()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', color: 'INDIGO', icon: 'BOOK' },
  })
  /**
   * Until the admin picks an icon, a new subject's icon follows its name.
   * An existing subject keeps the one it has. Reset each time the dialog
   * opens.
   */
  const [iconPicked, setIconPicked] = useState(false)
  const [shown, setShown] = useState({ open: false, subject })
  if (shown.open !== open || shown.subject !== subject) {
    setShown({ open, subject })
    if (open) setIconPicked(subject !== null)
  }

  useEffect(() => {
    if (!open) return
    form.reset({
      name: subject?.name ?? '',
      color: initialColor,
      icon: subject?.icon ?? 'BOOK',
    })
  }, [open, subject, initialColor, form])

  const submit = async (values: Values) => {
    const body = {
      ...values,
      icon: iconPicked ? values.icon : iconForName(values.name),
    }
    if (subject) await update.mutateAsync({ id: subject.id, body })
    else await create.mutateAsync(body)
    onOpenChange(false)
  }
  const [name, color, picked] = useWatch({
    control: form.control,
    name: ['name', 'color', 'icon'],
  })
  const icon = iconPicked ? picked : iconForName(name)

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={subject ? 'Edit subject' : 'Add subject'}
      form={form}
      onSubmit={submit}
      submitLabel={subject ? 'Save changes' : 'Add subject'}
      pending={create.isPending || update.isPending}
      className="sm:max-w-lg"
    >
      <TextField
        control={form.control}
        name="name"
        label="Name"
        placeholder="e.g. Mathematics"
        autoFocus
      />
      <FormField
        control={form.control}
        name="color"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Colour</FormLabel>
            <FormControl>
              <div
                role="radiogroup"
                aria-label="Colour"
                className="flex flex-wrap gap-2"
              >
                {SUBJECT_COLOR_KEYS.map((key) => {
                  const checked = field.value === key
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={SUBJECT_COLORS[key].label}
                      title={SUBJECT_COLORS[key].label}
                      onClick={() => field.onChange(key)}
                      className={cn(
                        'ring-offset-background focus-visible:ring-ring flex size-8 items-center justify-center rounded-full text-white transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                        SUBJECT_COLORS[key].solid,
                        checked
                          ? 'ring-foreground/70 scale-110 ring-2 ring-offset-2'
                          : 'hover:scale-105',
                      )}
                    >
                      {checked && <Check className="size-4" aria-hidden />}
                    </button>
                  )
                })}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="icon"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Icon</FormLabel>
            <FormControl>
              <IconPicker
                value={icon}
                color={color}
                onChange={(next) => {
                  setIconPicked(true)
                  field.onChange(next)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="bg-muted/40 flex items-center gap-3 rounded-lg border p-3">
        <SubjectIcon subject={{ color, icon }} className="size-10" />
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{name || 'New subject'}</p>
          <p className="text-muted-foreground text-xs">
            How it looks in timetables, gradebooks and report cards
          </p>
        </div>
      </div>
    </FormDialog>
  )
}
