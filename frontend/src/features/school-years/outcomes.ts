import { Award, GraduationCap, RotateCcw, type LucideIcon } from 'lucide-react'
import type { YearOutcome } from './api'

export const OUTCOMES: Record<
  YearOutcome,
  {
    label: string
    icon: LucideIcon
    variant: 'success-soft' | 'primary-soft' | 'destructive-soft'
  }
> = {
  PROMOTED: { label: 'Promoted', icon: Award, variant: 'success-soft' },
  GRADUATED: {
    label: 'Graduated',
    icon: GraduationCap,
    variant: 'primary-soft',
  },
  REPEATING: {
    label: 'Repeats the year',
    icon: RotateCcw,
    variant: 'destructive-soft',
  },
}

export const OUTCOME_LABEL = Object.fromEntries(
  Object.entries(OUTCOMES).map(([key, value]) => [key, value.label]),
) as Record<YearOutcome, string>
