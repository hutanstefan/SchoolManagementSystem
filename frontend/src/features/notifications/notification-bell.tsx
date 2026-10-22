import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarkAllRead, useNotifications, useUnreadCount } from './api'
import { NotificationItem } from './notification-item'
import { useOpenNotification } from './use-open-notification'

const LATEST = 6

/** The bell in the header: unread count, and the latest notifications. */
export function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const unread = useUnreadCount()
  const latest = useNotifications({ page: 1, pageSize: LATEST })
  const markAllRead = useMarkAllRead()
  const openNotification = useOpenNotification(() => setOpen(false))

  const count = unread.data ?? 0
  const area = user?.role === 'TEACHER' ? 'teacher' : 'student'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            count > 0 ? `Notifications, ${count} unread` : 'Notifications'
          }
        >
          <Bell />
          {count > 0 && (
            <span className="bg-destructive absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-medium">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={count === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck aria-hidden /> Mark all as read
          </Button>
        </div>
        <div className="max-h-[min(28rem,70vh)] divide-y overflow-y-auto">
          {latest.isPending ? (
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : latest.data?.data.length ? (
            latest.data.data.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={openNotification}
                compact
              />
            ))
          ) : (
            <EmptyState
              title="No notifications yet"
              description="New grades and timetable changes will show up here."
            />
          )}
        </div>
        <div className="border-t p-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            <Link to={`/${area}/notifications`}>See all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
