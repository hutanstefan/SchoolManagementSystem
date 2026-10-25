import {
  BookOpenText,
  CalendarX2,
  OctagonAlert,
  CalendarClock,
  ClipboardCheck,
  ClipboardX,
  PencilLine,
  School,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { formatTimeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Notification, NotificationType } from './api'

const LOOK: Record<NotificationType, { icon: LucideIcon; className: string }> =
  {
    GRADE_ADDED: {
      icon: ClipboardCheck,
      className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    },
    GRADE_CHANGED: {
      icon: PencilLine,
      className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    },
    GRADE_REMOVED: {
      icon: ClipboardX,
      className: 'bg-muted text-muted-foreground',
    },
    TIMETABLE_CHANGED: {
      icon: CalendarClock,
      className: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
    },
    ASSIGNMENT_CHANGED: {
      icon: School,
      className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    },
    HOMEROOM_ALERT: {
      icon: TriangleAlert,
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    ABSENCE_WARNING: {
      icon: CalendarX2,
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    ABSENCE_LIMIT: {
      icon: OctagonAlert,
      className: 'bg-destructive/10 text-destructive dark:text-red-300',
    },
    LECTURE_SHARED: {
      icon: BookOpenText,
      className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    },
  }

export function NotificationIcon({ type }: { type: NotificationType }) {
  const { icon: Icon, className } = LOOK[type]
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

/** One notification: icon, title, text, when, and a dot while unread. */
export function NotificationItem({
  notification,
  onOpen,
  compact = false,
}: {
  notification: Notification
  onOpen: (notification: Notification) => void
  compact?: boolean
}) {
  const unread = notification.readAt === null
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'hover:bg-accent focus-visible:bg-accent flex w-full items-start gap-3 px-4 py-3 text-left outline-none',
        unread && 'bg-primary/[0.03]',
      )}
    >
      <NotificationIcon type={notification.type} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm',
            unread ? 'font-semibold' : 'font-medium',
          )}
        >
          {notification.title}
        </span>
        <span
          className={cn(
            'text-muted-foreground block text-sm',
            compact && 'line-clamp-2',
          )}
        >
          {notification.body}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs">
          {formatTimeAgo(notification.createdAt)}
        </span>
      </span>
      {unread && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500">
          <span className="sr-only">Unread</span>
        </span>
      )}
    </button>
  )
}
