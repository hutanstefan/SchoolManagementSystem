import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/api/query-keys'
import { useSocketEvent } from '@/realtime/realtime-context'
import type { Notification, NotificationType } from './api'
import { useOpenNotification } from './use-open-notification'

/** What else on the page may be out of date after each kind of notification. */
const AFFECTS: Record<NotificationType, QueryKey[]> = {
  GRADE_ADDED: [queryKeys.grades.all],
  GRADE_CHANGED: [queryKeys.grades.all],
  GRADE_REMOVED: [queryKeys.grades.all],
  HOMEROOM_ALERT: [queryKeys.grades.all],
  TIMETABLE_CHANGED: [queryKeys.timetable.all],
  ASSIGNMENT_CHANGED: [
    queryKeys.teachers.me,
    queryKeys.classes.all,
    queryKeys.timetable.all,
    queryKeys.grades.all,
  ],
}

/**
 * Live notifications: a new one refreshes the bell and the data it is about
 * (the dashboard shows the new grade right away), and pops up a toast.
 */
export function useNotificationsSocket(): void {
  const queryClient = useQueryClient()
  const open = useOpenNotification()
  const refreshList = () =>
    void queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.all,
    })

  // Also after a reconnection: something may have arrived meanwhile.
  useSocketEvent('connect', refreshList)
  useSocketEvent('notifications:read', refreshList)
  useSocketEvent<Notification>('notification', (notification) => {
    refreshList()
    for (const queryKey of AFFECTS[notification.type]) {
      void queryClient.invalidateQueries({ queryKey })
    }
    toast(notification.title, {
      description: notification.body,
      action: notification.link
        ? { label: 'View', onClick: () => open(notification) }
        : undefined,
    })
  })
}
