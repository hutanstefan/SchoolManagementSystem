import type { ReactNode } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
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
import { Form } from '@/components/ui/form'
import { SubmitButton } from './submit-button'

/**
 * Dialog with a react-hook-form form inside. The caller closes it on success;
 * on error the dialog stays open (the error itself is shown as a toast).
 */
export function FormDialog<T extends FieldValues, TOut = T>({
  open,
  onOpenChange,
  title,
  description,
  form,
  onSubmit,
  submitLabel = 'Save',
  pending,
  extraActions,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  form: UseFormReturn<T, unknown, TOut>
  onSubmit: (values: TOut) => void | Promise<void>
  submitLabel?: string
  pending?: boolean
  /** Shown on the left of the footer, e.g. a delete button. */
  extraActions?: ReactNode
  children: ReactNode
}) {
  const submit = async (values: TOut) => {
    try {
      await onSubmit(values)
    } catch {
      // The MutationCache already shows the error; keep the dialog open.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(event) => void form.handleSubmit(submit)(event)}
            className="flex flex-col gap-4"
            noValidate
          >
            {children}
            <DialogFooter className="mt-2 gap-2 sm:justify-between">
              <div>{extraActions}</div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={pending}>
                    Cancel
                  </Button>
                </DialogClose>
                <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
