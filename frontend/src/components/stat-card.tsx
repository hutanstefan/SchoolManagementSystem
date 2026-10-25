import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCountUp } from '@/hooks/use-count-up'
import { cn } from '@/lib/utils'
import { TONE_CLASSES, type Tone } from './tones'

/** A number that counts up from 0 when it first appears. */
export function AnimatedNumber({
  value,
  decimals = 0,
}: {
  value: number
  decimals?: number
}) {
  const shown = useCountUp(value)
  return <>{shown.toFixed(decimals)}</>
}

/** A single figure with a label, for dashboards. */
export function StatCard({
  label,
  value,
  decimals = 0,
  hint,
  icon: Icon,
  tone = 'indigo',
  isLoading,
  className,
}: {
  label: string
  /** Numbers count up; anything else is shown as is. */
  value: ReactNode
  decimals?: number
  hint?: ReactNode
  icon?: LucideIcon
  tone?: Tone
  isLoading?: boolean
  className?: string
}) {
  return (
    <Card
      className={cn(
        'group hover:shadow-lifted relative gap-0 overflow-hidden p-5 transition-shadow',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-1.5 truncate text-3xl font-semibold tracking-tight tabular-nums">
              {typeof value === 'number' ? (
                <AnimatedNumber value={value} decimals={decimals} />
              ) : (
                (value ?? '—')
              )}
            </p>
          )}
          {hint && (
            <div className="text-muted-foreground mt-1.5 text-xs">{hint}</div>
          )}
        </div>
        {Icon && (
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
              TONE_CLASSES[tone],
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
        )}
      </div>
    </Card>
  )
}
