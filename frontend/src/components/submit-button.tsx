import { LoaderCircle } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'

export function SubmitButton({
  pending,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </Button>
  )
}
