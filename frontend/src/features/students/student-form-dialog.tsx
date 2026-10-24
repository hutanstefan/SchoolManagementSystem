import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { SelectField, TextField } from '@/components/form-fields'
import { useAllClasses } from '@/features/classes/api'
import {
  emailField,
  nameField,
  optionalPasswordField,
  passwordField,
  pastDateField,
} from '@/lib/validation'
import { useCreateStudent, useUpdateStudent, type Student } from './api'

const baseSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  email: emailField,
  dateOfBirth: pastDateField,
  classId: z.string().nullable(),
})
const createSchema = baseSchema.extend({ password: passwordField })
const editSchema = baseSchema.extend({ password: optionalPasswordField })

type Values = z.infer<typeof editSchema>

function toValues(student: Student | null): Values {
  return {
    firstName: student?.firstName ?? '',
    lastName: student?.lastName ?? '',
    email: student?.email ?? '',
    dateOfBirth: student?.dateOfBirth ?? '',
    classId: student?.class?.id ?? null,
    password: '',
  }
}

/** Create a student (student = null) or edit an existing one. */
export function StudentFormDialog({
  open,
  onOpenChange,
  student,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: Student | null
}) {
  const isEdit = student !== null
  const classes = useAllClasses('open')
  const create = useCreateStudent()
  const update = useUpdateStudent()

  const form = useForm<Values>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: toValues(student),
  })

  useEffect(() => {
    if (open) form.reset(toValues(student))
  }, [open, student, form])

  const submit = async (values: Values) => {
    const { password, ...rest } = values
    if (isEdit) {
      await update.mutateAsync({
        id: student.id,
        body: password ? { ...rest, password } : rest,
      })
    } else {
      await create.mutateAsync({ ...rest, password })
    }
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit student' : 'Add student'}
      description={
        isEdit
          ? 'Change the details or move the student to another class.'
          : 'Creates the student account they will log in with.'
      }
      form={form}
      onSubmit={submit}
      submitLabel={isEdit ? 'Save changes' : 'Add student'}
      pending={create.isPending || update.isPending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="firstName" label="First name" />
        <TextField control={form.control} name="lastName" label="Last name" />
      </div>
      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        autoComplete="off"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="dateOfBirth"
          label="Date of birth"
          type="date"
        />
        <SelectField
          control={form.control}
          name="classId"
          label="Class"
          noneLabel="No class"
          options={(classes.data?.data ?? []).map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
      </div>
      <TextField
        control={form.control}
        name="password"
        label={isEdit ? 'New password' : 'Password'}
        type="password"
        autoComplete="new-password"
        description={
          isEdit
            ? 'Leave empty to keep the current password. Changing it logs the student out.'
            : 'At least 8 characters, with a letter and a digit.'
        }
      />
    </FormDialog>
  )
}
