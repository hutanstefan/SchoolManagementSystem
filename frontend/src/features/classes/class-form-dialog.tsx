import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { SelectField, TextField } from '@/components/form-fields'
import { useAllTeachers } from '@/features/teachers/api'
import { fullName } from '@/lib/format'
import { useCreateClass, useUpdateClass, type SchoolClass } from './api'

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(20, 'At most 20 characters')
    .regex(/^[0-9A-Z][0-9A-Z -]*$/i, 'Only letters, digits, spaces and dashes'),
  homeroomTeacherId: z.string().nullable(),
})
type Values = z.infer<typeof schema>

type ClassFields = Pick<SchoolClass, 'id' | 'name' | 'homeroomTeacher'>

/** Create a class (schoolClass = null) or edit an existing one. */
export function ClassFormDialog({
  open,
  onOpenChange,
  schoolClass,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schoolClass: ClassFields | null
  onCreated?: (created: { id: string }) => void
}) {
  const teachers = useAllTeachers()
  const create = useCreateClass()
  const update = useUpdateClass()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', homeroomTeacherId: null },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: schoolClass?.name ?? '',
        homeroomTeacherId: schoolClass?.homeroomTeacher?.id ?? null,
      })
    }
  }, [open, schoolClass, form])

  const submit = async (values: Values) => {
    // The API stores names in upper case ("9a" -> "9A"); do the same here.
    const body = { ...values, name: values.name.toUpperCase() }
    if (schoolClass) {
      await update.mutateAsync({ id: schoolClass.id, body })
    } else {
      onCreated?.(await create.mutateAsync(body))
    }
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={schoolClass ? 'Edit class' : 'Add class'}
      form={form}
      onSubmit={submit}
      submitLabel={schoolClass ? 'Save changes' : 'Add class'}
      pending={create.isPending || update.isPending}
    >
      <TextField
        control={form.control}
        name="name"
        label="Name"
        placeholder="e.g. 9A"
        className="uppercase placeholder:normal-case"
        description="Grade and letter, e.g. 9A or 12B."
      />
      <SelectField
        control={form.control}
        name="homeroomTeacherId"
        label="Homeroom teacher"
        noneLabel="None"
        options={(teachers.data?.data ?? []).map((t) => ({
          value: t.id,
          label: fullName(t),
        }))}
      />
    </FormDialog>
  )
}
