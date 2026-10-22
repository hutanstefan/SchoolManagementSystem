import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'sonner'
import { queryKeys } from '@/api/query-keys'
import { useAuth } from '@/auth/auth-context'
import { tokenStorage } from '@/lib/storage'
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
 * Keeps one Socket.IO connection open while a teacher or student is logged
 * in. A new notification refreshes the bell and the data it is about (the
 * dashboard shows the new grade right away), and pops up a toast.
 */
export function useNotificationsSocket(): void {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const open = useOpenNotification()
  // The latest `open` without reconnecting when it changes.
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  })
  const enabled = user !== null && user.role !== 'ADMIN'

  useEffect(() => {
    if (!enabled) return
    const socket = io({
      path: '/api/socket.io',
      transports: ['websocket'],
      // Read on every (re)connection, so it's always the current token.
      auth: (send) => send({ token: tokenStorage.get() }),
    })
    const refreshList = () =>
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      })

    // Also after a reconnection: something may have arrived meanwhile.
    socket.on('connect', refreshList)
    socket.on('notifications:read', refreshList)
    socket.on('notification', (notification: Notification) => {
      refreshList()
      for (const queryKey of AFFECTS[notification.type]) {
        void queryClient.invalidateQueries({ queryKey })
      }
      toast(notification.title, {
        description: notification.body,
        action: notification.link
          ? { label: 'View', onClick: () => openRef.current(notification) }
          : undefined,
      })
    })
    return () => {
      socket.disconnect()
    }
  }, [enabled, queryClient])
}
