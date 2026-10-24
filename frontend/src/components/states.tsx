import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { errorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span className="bg-primary/10 text-primary mb-1 flex size-12 items-center justify-center rounded-2xl">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 px-4 py-12 text-center"
    >
      <span className="bg-destructive/10 text-destructive mb-1 flex size-12 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <p className="font-medium">Could not load the data</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        {errorMessage(error)}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col gap-3 p-4"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  )
}
