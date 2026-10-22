import { Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { initials } from './format'

/** Initials for a person, a people icon for a group. */
export function ChatAvatar({
  person,
  group = false,
  className,
}: {
  person?: { firstName: string; lastName: string } | null
  group?: boolean
  className?: string
}) {
  return (
    <Avatar className={cn('size-9', className)}>
      <AvatarFallback
        className={cn(
          'text-xs font-medium',
          group && 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
        )}
      >
        {group || !person ? (
          <Users className="size-4" aria-hidden />
        ) : (
          initials(person)
        )}
      </AvatarFallback>
    </Avatar>
  )
}
