import type { ReactNode } from 'react'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TONE_CLASSES, toneFor } from './tones'

type Person = { firstName: string; lastName: string }

/** A round avatar with the person's initials. */
export function PersonAvatar({
  person,
  className,
}: {
  person: Person
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        TONE_CLASSES[toneFor(`${person.firstName} ${person.lastName}`)],
        className,
      )}
    >
      {initials(person)}
    </span>
  )
}

/** Avatar, name and a second line (e.g. the email), for table cells. */
export function PersonCell({
  person,
  secondary,
  children,
}: {
  person: Person
  secondary?: ReactNode
  /** Replaces the plain name, e.g. with a link. */
  children?: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar person={person} />
      <div className="min-w-0">
        <div className="truncate font-medium">
          {children ?? `${person.firstName} ${person.lastName}`}
        </div>
        {secondary && (
          <div className="text-muted-foreground truncate text-xs">
            {secondary}
          </div>
        )}
      </div>
    </div>
  )
}
