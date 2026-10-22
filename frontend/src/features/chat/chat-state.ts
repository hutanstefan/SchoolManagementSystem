import { useSyncExternalStore } from 'react'

/**
 * Small pieces of live chat state shared outside React Query: which
 * conversation is open (its new messages are read at once, no toast) and who
 * is typing where.
 */

type Listener = () => void

function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<Listener>()
  return {
    get: () => value,
    set: (next: T) => {
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** The conversation open on screen, if any. */
export const activeConversation = createStore<string | null>(null)

export interface Typist {
  userId: string
  firstName: string
  /** Shown until then (ms), unless they type again. */
  until: number
}

/** conversationId -> who is typing there. */
const typing = createStore<Record<string, Typist[]>>({})

/** Someone is typing: shown for 4 s, or until their message arrives. */
export function startTyping(
  conversationId: string,
  user: { id: string; firstName: string },
) {
  const until = Date.now() + 4000
  const current = (typing.get()[conversationId] ?? []).filter(
    (t) => t.userId !== user.id,
  )
  typing.set({
    ...typing.get(),
    [conversationId]: [
      ...current,
      { userId: user.id, firstName: user.firstName, until },
    ],
  })
  setTimeout(() => expireTyping(conversationId), 4100)
}

export function stopTyping(conversationId: string, userId: string) {
  const current = typing.get()[conversationId]
  if (!current?.some((t) => t.userId === userId)) return
  typing.set({
    ...typing.get(),
    [conversationId]: current.filter((t) => t.userId !== userId),
  })
}

function expireTyping(conversationId: string) {
  const now = Date.now()
  const current = typing.get()[conversationId] ?? []
  const still = current.filter((t) => t.until > now)
  if (still.length !== current.length) {
    typing.set({ ...typing.get(), [conversationId]: still })
  }
}

const NOBODY: Typist[] = []

export function useTypists(conversationId: string): Typist[] {
  return useSyncExternalStore(
    typing.subscribe,
    () => typing.get()[conversationId] ?? NOBODY,
  )
}

/** "Ana is typing…", "Ana and Ion are typing…", "3 people are typing…" */
export function typingText(typists: Typist[]): string | null {
  if (typists.length === 0) return null
  if (typists.length === 1) return `${typists[0]!.firstName} is typing…`
  if (typists.length === 2) {
    return `${typists[0]!.firstName} and ${typists[1]!.firstName} are typing…`
  }
  return `${typists.length} people are typing…`
}
