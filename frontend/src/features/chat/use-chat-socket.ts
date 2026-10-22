import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { queryKeys } from '@/api/query-keys'
import { useAuth } from '@/auth/auth-context'
import { useSocketEvent } from '@/realtime/realtime-context'
import {
  addMessageToCache,
  bumpConversation,
  markMessageDeletedInCache,
  setReadInCache,
  type Message,
} from './api'
import { activeConversation, startTyping, stopTyping } from './chat-state'
import { messagesPath } from './paths'

/**
 * Live chat for the whole app: new messages go straight into the open
 * thread and the conversation list, the "Messages" badge counts the unread
 * ones, and a toast shows messages from other conversations.
 */
export function useChatSocket(): void {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const myId = user?.id

  const refreshUnread = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.chat.unreadCount })

  useSocketEvent<{ conversationId: string; message: Message }>(
    'chat:message',
    ({ message }) => {
      const fromOther = message.sender?.id !== myId
      const counts = fromOther && message.kind === 'TEXT'
      const isOpen =
        activeConversation.get() === message.conversationId &&
        document.visibilityState === 'visible'

      if (message.sender) stopTyping(message.conversationId, message.sender.id)
      addMessageToCache(queryClient, message)
      const known = bumpConversation(
        queryClient,
        message,
        counts && !isOpen ? 1 : 0,
      )
      // A conversation we don't have yet (someone wrote to us first).
      if (!known) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.chat.conversations,
        })
      }
      if (counts && !isOpen) {
        refreshUnread()
        if (user) {
          const name = message.sender
            ? `${message.sender.firstName} ${message.sender.lastName}`
            : 'New message'
          toast(name, {
            description: message.body,
            action: {
              label: 'Open',
              onClick: () =>
                void navigate(messagesPath(user.role, message.conversationId)),
            },
          })
        }
      }
    },
  )

  useSocketEvent<{
    conversationId: string
    userId: string
    lastReadAt: string
  }>('chat:read', ({ conversationId, userId, lastReadAt }) => {
    setReadInCache(
      queryClient,
      conversationId,
      userId,
      lastReadAt,
      userId === myId,
    )
    if (userId === myId) refreshUnread()
  })

  useSocketEvent<{ conversationId: string; messageId: string }>(
    'chat:message-deleted',
    ({ conversationId, messageId }) => {
      markMessageDeletedInCache(queryClient, conversationId, messageId)
      refreshUnread()
    },
  )

  useSocketEvent<{
    conversationId: string
    user: { id: string; firstName: string }
  }>('chat:typing', ({ conversationId, user: typist }) =>
    startTyping(conversationId, typist),
  )

  // Created, renamed, members changed, deleted: reload it.
  useSocketEvent<{ conversationId: string }>(
    'chat:conversation',
    ({ conversationId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chat.conversations,
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chat.conversation(conversationId),
      })
      refreshUnread()
    },
  )

  // After a reconnection, catch up on what was missed.
  useSocketEvent('connect', () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.chat.all })
  })
}
