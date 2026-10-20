import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type Column } from '@/components/data-table'
import { FormDialog } from '@/components/form-dialog'
import { TextField } from '@/components/form-fields'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { nameField } from '@/lib/validation'
import {
  useCreateSubject,
  useDeleteSubject,
  useRenameSubject,
  useSubjects,
  type Subject,
} from './api'

const schema = z.object({ name: nameField })
type Values = z.infer<typeof schema>

export function SubjectsPage() {
  const subjects = useSubjects()
  const remove = useDeleteSubject()
  const [editing, setEditing] = useState<Subject | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Subject | null>(null)

  const openForm = (subject: Subject | null) => {
    setEditing(subject)
    setFormOpen(true)
  }

  const columns: Column<Subject>[] = [
    {
      header: 'Name',
      cell: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      header: <span className="sr-only">Actions</span>,
      className: 'w-24 text-right',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Rename ${s.name}`}
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
        description="The subjects taught in the school. Add them to classes from a class page."
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject: Subject | null
}) {
  const create = useCreateSubject()
  const rename = useRenameSubject()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  })

  useEffect(() => {
    if (open) form.reset({ name: subject?.name ?? '' })
  }, [open, subject, form])

  const submit = async ({ name }: Values) => {
    if (subject) await rename.mutateAsync({ id: subject.id, name })
    else await create.mutateAsync({ name })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={subject ? 'Rename subject' : 'Add subject'}
      form={form}
      onSubmit={submit}
      submitLabel={subject ? 'Rename' : 'Add subject'}
      pending={create.isPending || rename.isPending}
    >
      <TextField
        control={form.control}
        name="name"
        label="Name"
        placeholder="e.g. Mathematics"
        autoFocus
      />
    </FormDialog>
  )
}
