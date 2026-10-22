import { useNavigate } from 'react-router'
import type { Notification } from './api'
import { useMarkRead } from './api'

/** Opening a notification marks it as read and goes to the page it's about. */
export function useOpenNotification(onOpened?: () => void) {
  const navigate = useNavigate()
  const markRead = useMarkRead()
  return (notification: Pick<Notification, 'id' | 'readAt' | 'link'>) => {
    if (notification.readAt === null) markRead.mutate(notification.id)
    onOpened?.()
    if (notification.link) void navigate(notification.link)
  }
}
