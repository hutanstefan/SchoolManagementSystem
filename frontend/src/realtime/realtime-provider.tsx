import { useEffect, useMemo, type ReactNode } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '@/auth/auth-context'
import { tokenStorage } from '@/lib/storage'
import { RealtimeContext } from './realtime-context'

/**
 * One Socket.IO connection per tab of a logged-in teacher or student, shared
 * by notifications and chat (admins have neither). It reconnects by itself
 * (sleep, network loss) and closes on logout.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user && user.role !== 'ADMIN' ? user.id : null

  // A new socket per user; creating it doesn't connect yet.
  const socket = useMemo(
    () =>
      userId
        ? io({
            path: '/api/socket.io',
            transports: ['websocket'],
            autoConnect: false,
            // Read on every (re)connection, so it's always the current token.
            auth: (send) => send({ token: tokenStorage.get() }),
          })
        : null,
    [userId],
  )

  useEffect(() => {
    if (!socket) return
    socket.connect()
    return () => {
      socket.disconnect()
    }
  }, [socket])

  return (
    <RealtimeContext.Provider value={socket}>
      {children}
    </RealtimeContext.Provider>
  )
}
