import { BarChart3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionHeader } from '@/components/section-header'
import { EmptyState, ErrorState } from '@/components/states'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** A card with a title and a chart, with loading, error and empty states. */
export function ChartCard({
  title,
  description,
  action,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyTitle = 'Nothing to show yet',
  emptyDescription,
  className,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  isEmpty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <SectionHeader title={title} description={description} action={action} />
      {isLoading ? (
        <div className="p-5">
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isEmpty ? (
        <EmptyState
          icon={BarChart3}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <div className="px-3 pt-4 pb-3 sm:px-4">{children}</div>
      )}
    </Card>
  )
}
