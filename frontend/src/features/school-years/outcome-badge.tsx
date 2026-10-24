import { Badge } from '@/components/ui/badge'
import type { YearOutcome } from './api'
import { OUTCOMES } from './outcomes'

/** How a school year ended for a student. */
export function OutcomeBadge({ outcome }: { outcome: YearOutcome }) {
  const { label, icon: Icon, variant } = OUTCOMES[outcome]
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {label}
    </Badge>
  )
}
