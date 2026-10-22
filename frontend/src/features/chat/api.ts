import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

export type Conversation = Schemas['ConversationDto']
export type ConversationMember = Schemas['ConversationMemberDto']
export type Message = Schemas['MessageDto']
export type MessagePage = Schemas['MessagePageDto']
export type ChatContact = Schemas['ChatContactDto']
export type ChatUser = Schemas['ChatUserDto']

export const MAX_MESSAGE_LENGTH = 2000
const PAGE_SIZE = 30

export function useContacts(search: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.chat.contacts(search),
    queryFn: () =>
      unwrap(
        api.GET('/api/chat/contacts', {
          params: { query: search ? { search } : {} },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.chat.conversations,
    queryFn: () => unwrap(api.GET('/api/chat/conversations')),
  })
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.chat.conversation(id ?? ''),
    queryFn: () =>
      unwrap(
        api.GET('/api/chat/conversations/{id}', {
          params: { path: { id: id! } },
        }),
      ),
    enabled: Boolean(id),
    retry: false,
  })
}

export function useChatUnreadCount() {
  return useQuery({
    queryKey: queryKeys.chat.unreadCount,
    queryFn: () => unwrap(api.GET('/api/chat/unread-count')),
    select: (data) => data.count,
  })
}

/** Newest page first; `before` = the oldest message of the pages so far. */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.chat.messages(conversationId),
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/api/chat/conversations/{id}/messages', {
          params: {
            path: { id: conversationId },
            query: {
              limit: PAGE_SIZE,
              ...(pageParam && { before: pageParam }),
            },
          },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.hasMore ? page.data[0]?.id : undefined),
  })
}

/** All loaded messages, oldest first. */
export function flattenMessages(
  data: InfiniteData<MessagePage> | undefined,
): Message[] {
  return data ? [...data.pages].reverse().flatMap((page) => page.data) : []
}

// --------------------------------------------------------- cache updates
// Live events and our own sends update the caches directly, so the thread
// and the list change instantly without reloading.

/** Adds a message to its thread (once, even if it arrives twice). */
export function addMessageToCache(queryClient: QueryClient, message: Message) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(
    queryKeys.chat.messages(message.conversationId),
    (data) => {
      if (!data) return data
      if (data.pages.some((page) => page.data.some((m) => m.id === message.id)))
        return data
      const [newest, ...older] = data.pages
      return {
        ...data,
        pages: [{ ...newest!, data: [...newest!.data, message] }, ...older],
      }
    },
  )
}

/** Moves the conversation to the top of the list with its new last message. */
export function bumpConversation(
  queryClient: QueryClient,
  message: Message,
  unreadDelta: number,
): boolean {
  let found = false
  queryClient.setQueryData<Conversation[]>(
    queryKeys.chat.conversations,
    (list) => {
      if (!list) return list
      const current = list.find((c) => c.id === message.conversationId)
      if (!current) return list
      found = true
      const updated: Conversation = {
        ...current,
        lastMessage: message,
        lastMessageAt: message.createdAt,
        unreadCount: current.unreadCount + unreadDelta,
      }
      return [updated, ...list.filter((c) => c.id !== current.id)]
    },
  )
  return found
}

export function markMessageDeletedInCache(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
) {
  const deletedAt = new Date().toISOString()
  queryClient.setQueryData<InfiniteData<MessagePage>>(
    queryKeys.chat.messages(conversationId),
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          data: page.data.map((m) =>
            m.id === messageId ? { ...m, body: '', deletedAt } : m,
          ),
        })),
      },
  )
  queryClient.setQueryData<Conversation[]>(
    queryKeys.chat.conversations,
    (list) =>
      list?.map((c) =>
        c.lastMessage?.id === messageId
          ? { ...c, lastMessage: { ...c.lastMessage, body: '', deletedAt } }
          : c,
      ),
  )
}

/** Someone read a conversation up to `lastReadAt`. */
export function setReadInCache(
  queryClient: QueryClient,
  conversationId: string,
  userId: string,
  lastReadAt: string,
  isMe: boolean,
) {
  const update = (c: Conversation): Conversation => ({
    ...c,
    unreadCount: isMe ? 0 : c.unreadCount,
    members: c.members.map((m) =>
      m.user.id === userId ? { ...m, lastReadAt } : m,
    ),
  })
  queryClient.setQueryData<Conversation[]>(
    queryKeys.chat.conversations,
    (list) => list?.map((c) => (c.id === conversationId ? update(c) : c)),
  )
  queryClient.setQueryData<Conversation>(
    queryKeys.chat.conversation(conversationId),
    (c) => c && update(c),
  )
}

// -------------------------------------------------------------- mutations

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      unwrap(
        api.POST('/api/chat/conversations/{id}/messages', {
          params: { path: { id: conversationId } },
          body: { body },
        }),
      ),
    onSuccess: (message) => {
      addMessageToCache(queryClient, message)
      if (!bumpConversation(queryClient, message, 0)) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.chat.conversations,
        })
      }
    },
  })
}

export function useMarkConversationRead() {
  return useMutation({
    mutationFn: (conversationId: string) =>
      unwrap(
        api.POST('/api/chat/conversations/{id}/read', {
          params: { path: { id: conversationId } },
        }),
      ),
    // The server's "chat:read" event updates the caches.
    meta: { silent: true },
  })
}

export function useDeleteMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: Message) =>
      unwrap(
        api.DELETE('/api/chat/messages/{id}', {
          params: { path: { id: message.id } },
        }),
      ),
    onSuccess: (_, message) =>
      markMessageDeletedInCache(
        queryClient,
        message.conversationId,
        message.id,
      ),
    meta: { successMessage: 'Message deleted' },
  })
}

function useConversationMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  successMessage?: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all }),
    meta: successMessage ? { successMessage } : undefined,
  })
}

export function useOpenDirect() {
  return useConversationMutation((userId: string) =>
    unwrap(api.POST('/api/chat/conversations/direct', { body: { userId } })),
  )
}

export function useCreateGroup() {
  return useConversationMutation(
    (body: { name: string; memberIds: string[] }) =>
      unwrap(api.POST('/api/chat/conversations/group', { body })),
    'Group created',
  )
}

export function useRenameGroup(id: string) {
  return useConversationMutation(
    (name: string) =>
      unwrap(
        api.PATCH('/api/chat/conversations/{id}', {
          params: { path: { id } },
          body: { name },
        }),
      ),
    'Group renamed',
  )
}

export function useAddMembers(id: string) {
  return useConversationMutation(
    (userIds: string[]) =>
      unwrap(
        api.POST('/api/chat/conversations/{id}/members', {
          params: { path: { id } },
          body: { userIds },
        }),
      ),
    'Members added',
  )
}

export function useRemoveMember(id: string) {
  return useConversationMutation((userId: string) =>
    unwrap(
      api.DELETE('/api/chat/conversations/{id}/members/{userId}', {
        params: { path: { id, userId } },
      }),
    ),
  )
}

export function useDeleteGroup(id: string) {
  return useConversationMutation(
    () =>
      unwrap(
        api.DELETE('/api/chat/conversations/{id}', {
          params: { path: { id } },
        }),
      ),
    'Group deleted',
  )
}
