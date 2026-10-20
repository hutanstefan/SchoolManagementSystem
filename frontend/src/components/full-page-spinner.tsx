import { LoaderCircle } from 'lucide-react'

export function FullPageSpinner() {
  return (
    <div
      className="flex min-h-svh items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <LoaderCircle className="text-muted-foreground size-6 animate-spin" />
    </div>
  )
}
