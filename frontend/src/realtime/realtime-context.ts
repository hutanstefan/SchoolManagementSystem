import { createContext, useContext, useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'

/** The live connection of the logged-in user, or null while logged out. */
export const RealtimeContext = createContext<Socket | null>(null)

export function useSocket(): Socket | null {
  return useContext(RealtimeContext)
}

/**
 * Listens to a server event while the component is mounted. The handler can
 * change on every render (it sees the latest props and state) without
 * re-subscribing.
 */
export function useSocketEvent<T>(
  event: string,
  handler: (payload: T) => void,
): void {
  const socket = useSocket()
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    if (!socket) return
    const listener = (payload: T) => latest.current(payload)
    socket.on(event, listener)
    return () => {
      socket.off(event, listener)
    }
  }, [socket, event])
}
