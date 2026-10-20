import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** A single number with a label, for dashboards. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  isLoading,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  isLoading?: boolean
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-start justify-between gap-4 px-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-8 w-16" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          )}
          {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
        </div>
        {Icon && (
          <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </CardContent>
    </Card>
  )
}
