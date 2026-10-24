import { createElement } from 'react'
import { cn } from '@/lib/utils'
import {
  SUBJECT_COLORS,
  subjectIcon,
  type SubjectColor,
} from './subject-colors'

interface SubjectLike {
  name: string
  color: SubjectColor
}

/** The subject's icon on its colour. */
export function SubjectIcon({
  subject,
  className,
}: {
  subject: SubjectLike
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4',
        SUBJECT_COLORS[subject.color].tile,
        className,
      )}
    >
      {createElement(subjectIcon(subject.name))}
    </span>
  )
}

/** A small swatch of the subject's colour. */
export function SubjectDot({
  color,
  className,
}: {
  color: SubjectColor
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        SUBJECT_COLORS[color].solid,
        className,
      )}
    />
  )
}
