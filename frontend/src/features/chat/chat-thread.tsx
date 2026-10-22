import {
  ArrowLeft,
  EllipsisVertical,
  Info,
  LoaderCircle,
  SendHorizontal,
  Trash2,
} from 'lucide-react'
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react'
import { useAuth } from '@/auth/auth-context'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSocket } from '@/realtime/realtime-context'
import {
  flattenMessages,
  MAX_MESSAGE_LENGTH,
  useConversation,
  useDeleteMessage,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
  type Conversation,
  type Message,
} from './api'
import { ChatAvatar } from './chat-avatar'
import { activeConversation, typingText, useTypists } from './chat-state'
import {
  describeUser,
  formatClock,
  formatDayLabel,
  sameDay,
  startsBlock,
} from './format'
import { GroupSettingsDialog } from './group-settings-dialog'

/** Close enough to the bottom to follow new messages. */
const STICK_TO_BOTTOM_PX = 120

/** One conversation: header, messages, who is typing, and the composer. */
export function ChatThread({
  conversationId,
  onBack,
}: {
  conversationId: string
  onBack: () => void
}) {
  const conversation = useConversation(conversationId)

  // While it's on screen, its new messages count as read and don't pop up.
  useEffect(() => {
    activeConversation.set(conversationId)
    return () => activeConversation.set(null)
  }, [conversationId])

  if (conversation.isPending) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-12 w-1/2" />
      </div>
    )
  }
  if (conversation.error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          title="This conversation isn't available"
          description="It was deleted, or you are no longer a member."
          action={
            <Button variant="outline" onClick={onBack}>
              Back to messages
            </Button>
          }
        />
      </div>
    )
  }
  return (
    <ThreadView
      key={conversationId}
      conversation={conversation.data}
      onBack={onBack}
    />
  )
}

function ThreadView({
  conversation,
  onBack,
}: {
  conversation: Conversation
  onBack: () => void
}) {
  const { user } = useAuth()
  const myId = user?.id
  const messages = useMessages(conversation.id)
  const list = flattenMessages(messages.data)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const other = conversation.members.find((m) => m.user.id !== myId)

  useMarkAsRead(conversation, list, myId)
  const {
    ref: scrollRef,
    onScroll,
    loadOlder,
  } = useScrollBehaviour(list, myId, messages)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft />
        </Button>
        <ChatAvatar
          person={other?.user}
          group={conversation.type === 'GROUP'}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{conversation.name}</h2>
          <p className="text-muted-foreground truncate text-xs">
            {conversation.type === 'GROUP'
              ? `${conversation.members.length} members`
              : other
                ? describeUser(other.user)
                : ''}
          </p>
        </div>
        {conversation.type === 'GROUP' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Group members and settings"
          >
            <Info />
          </Button>
        )}
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
        role="log"
        aria-live="polite"
        aria-label={`Messages with ${conversation.name}`}
      >
        {messages.isPending ? (
          <div className="flex justify-center p-8">
            <LoaderCircle className="text-muted-foreground animate-spin" />
          </div>
        ) : (
          <>
            {messages.hasNextPage && (
              <div className="mb-4 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadOlder}
                  disabled={messages.isFetchingNextPage}
                >
                  {messages.isFetchingNextPage && (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  )}
                  Load earlier messages
                </Button>
              </div>
            )}
            {list.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">
                No messages yet. Say hello!
              </p>
            ) : (
              <MessageList
                conversation={conversation}
                messages={list}
                myId={myId}
              />
            )}
          </>
        )}
      </div>

      <TypingLine conversationId={conversation.id} myId={myId} />
      <Composer conversationId={conversation.id} />

      {conversation.type === 'GROUP' && (
        <GroupSettingsDialog
          conversation={conversation}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- messages

function MessageList({
  conversation,
  messages,
  myId,
}: {
  conversation: Conversation
  messages: Message[]
  myId: string | undefined
}) {
  const [deleting, setDeleting] = useState<Message | null>(null)
  const deleteMessage = useDeleteMessage()
  const isGroup = conversation.type === 'GROUP'
  const lastMine = [...messages]
    .reverse()
    .find((m) => m.kind === 'TEXT' && m.sender?.id === myId && !m.deletedAt)

  return (
    <ol className="flex flex-col">
      {messages.map((message, index) => {
        const previous = messages[index - 1]
        const next = messages[index + 1]
        const newDay =
          !previous || !sameDay(previous.createdAt, message.createdAt)
        const first = startsBlock(previous, message)
        const last = !next || startsBlock(message, next)
        const mine = message.sender?.id === myId

        return (
          <Fragment key={message.id}>
            {newDay && (
              <li className="my-4 flex justify-center" aria-hidden>
                <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
                  {formatDayLabel(message.createdAt)}
                </span>
              </li>
            )}
            {message.kind === 'SYSTEM' ? (
              <li className="text-muted-foreground my-2 px-8 text-center text-xs">
                {message.body}
              </li>
            ) : (
              <MessageBubble
                message={message}
                mine={mine}
                showSender={isGroup && !mine && first}
                showAvatar={isGroup && !mine && last}
                indent={isGroup && !mine}
                first={first}
                last={last}
                onDelete={() => setDeleting(message)}
              />
            )}
            {message.id === lastMine?.id && (
              <SeenLine
                conversation={conversation}
                message={message}
                myId={myId}
              />
            )}
          </Fragment>
        )
      })}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this message?"
        description="It is removed for everyone in the conversation."
        pending={deleteMessage.isPending}
        onConfirm={() =>
          deleting &&
          deleteMessage.mutate(deleting, { onSuccess: () => setDeleting(null) })
        }
      />
    </ol>
  )
}

function MessageBubble({
  message,
  mine,
  showSender,
  showAvatar,
  indent,
  first,
  last,
  onDelete,
}: {
  message: Message
  mine: boolean
  showSender: boolean
  showAvatar: boolean
  indent: boolean
  first: boolean
  last: boolean
  onDelete: () => void
}) {
  const time = formatClock(new Date(message.createdAt))
  const deleted = message.deletedAt !== null
  return (
    <li
      className={cn(
        'group flex items-end gap-2',
        mine ? 'justify-end' : 'justify-start',
        first ? 'mt-3' : 'mt-0.5',
      )}
    >
      {indent && (
        <div className="w-8 shrink-0">
          {showAvatar && (
            <ChatAvatar person={message.sender} className="size-8" />
          )}
        </div>
      )}
      {mine && !deleted && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 self-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label="Message actions"
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div
        className={cn(
          'flex max-w-[min(32rem,80%)] flex-col',
          mine ? 'items-end' : 'items-start',
        )}
      >
        {showSender && message.sender && (
          <span className="text-muted-foreground mb-1 px-1 text-xs font-medium">
            {message.sender.firstName} {message.sender.lastName}
          </span>
        )}
        <div
          title={time}
          className={cn(
            'rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap',
            deleted
              ? 'text-muted-foreground border border-dashed italic'
              : mine
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted',
            mine && !first && 'rounded-tr-md',
            mine && !last && 'rounded-br-md',
            !mine && !first && 'rounded-tl-md',
            !mine && !last && 'rounded-bl-md',
          )}
        >
          {deleted ? 'Message deleted' : message.body}
        </div>
        {last && (
          <span className="text-muted-foreground mt-1 px-1 text-[11px]">
            {time}
          </span>
        )}
      </div>
    </li>
  )
}

/** "Seen" under my latest message (direct), "Seen by 3" in a group. */
function SeenLine({
  conversation,
  message,
  myId,
}: {
  conversation: Conversation
  message: Message
  myId: string | undefined
}) {
  const others = conversation.members.filter((m) => m.user.id !== myId)
  const seenBy = others.filter(
    (m) => m.lastReadAt !== null && m.lastReadAt >= message.createdAt,
  )
  if (seenBy.length === 0) return null
  const text =
    conversation.type === 'DIRECT'
      ? 'Seen'
      : seenBy.length === others.length
        ? 'Seen by everyone'
        : `Seen by ${seenBy.length}`
  return (
    <li className="text-muted-foreground mt-0.5 px-1 text-right text-[11px]">
      {text}
    </li>
  )
}

function TypingLine({
  conversationId,
  myId,
}: {
  conversationId: string
  myId: string | undefined
}) {
  const text = typingText(
    useTypists(conversationId).filter((t) => t.userId !== myId),
  )
  return (
    <p
      className="text-muted-foreground h-5 px-4 text-xs italic"
      aria-live="polite"
    >
      {text}
    </p>
  )
}

// ---------------------------------------------------------------- composer

const TYPING_EVERY_MS = 2000

function Composer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState('')
  const send = useSendMessage(conversationId)
  const socket = useSocket()
  const lastTyping = useRef(0)
  const input = useRef<HTMLTextAreaElement>(null)
  const body = text.trim()
  const tooLong = text.length > MAX_MESSAGE_LENGTH

  const submit = () => {
    if (!body || tooLong) return
    setText('')
    lastTyping.current = 0
    send.mutate(body, {
      // Keep what was written if it couldn't be sent.
      onError: () => setText((current) => current || body),
    })
    input.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="flex items-end gap-2 border-t p-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex-1">
        <Textarea
          ref={input}
          value={text}
          rows={1}
          placeholder="Write a message…"
          aria-label="Message"
          className="max-h-40 min-h-10 resize-none"
          onKeyDown={onKeyDown}
          onChange={(event) => {
            setText(event.target.value)
            const now = Date.now()
            if (socket && now - lastTyping.current > TYPING_EVERY_MS) {
              lastTyping.current = now
              socket.emit('chat:typing', { conversationId })
            }
          }}
        />
        {text.length > MAX_MESSAGE_LENGTH - 200 && (
          <p
            className={cn(
              'mt-1 text-right text-xs',
              tooLong ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {text.length} / {MAX_MESSAGE_LENGTH}
          </p>
        )}
      </div>
      <Button
        type="submit"
        size="icon"
        className="size-10"
        disabled={!body || tooLong}
        aria-label="Send"
      >
        <SendHorizontal />
      </Button>
    </form>
  )
}

// ------------------------------------------------------------------ hooks

function subscribeVisibility(callback: () => void) {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}

function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
  )
}

/**
 * Marks the conversation as read when it shows messages from others newer
 * than what the user has read, and the tab is visible.
 */
function useMarkAsRead(
  conversation: Conversation,
  messages: Message[],
  myId: string | undefined,
) {
  const { mutate: markRead } = useMarkConversationRead()
  const visible = useDocumentVisible()
  const markedUpTo = useRef<string | null>(null)
  const me = conversation.members.find((m) => m.user.id === myId)
  const latest = [...messages]
    .reverse()
    .find((m) => m.kind === 'TEXT' && m.sender?.id !== myId)
  const unread =
    conversation.unreadCount > 0 ||
    (latest !== undefined &&
      (me?.lastReadAt === null || (me?.lastReadAt ?? '') < latest.createdAt))
  const key = latest?.id ?? 'none'

  useEffect(() => {
    if (!visible || !unread || markedUpTo.current === key) return
    markedUpTo.current = key
    markRead(conversation.id)
  }, [visible, unread, key, conversation.id, markRead])
}

/**
 * Starts at the newest message, follows new ones when the user is near the
 * bottom (or sent it), and keeps the view still when older ones load above.
 */
function useScrollBehaviour(
  messages: Message[],
  myId: string | undefined,
  query: ReturnType<typeof useMessages>,
) {
  const ref = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const keepFromBottom = useRef<number | null>(null)
  const firstId = messages[0]?.id
  const last = messages[messages.length - 1]

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (keepFromBottom.current !== null) {
      // Older messages were added above: stay on the same message.
      element.scrollTop = element.scrollHeight - keepFromBottom.current
      keepFromBottom.current = null
    }
  }, [firstId])

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !last) return
    if (atBottom.current || last.sender?.id === myId) {
      element.scrollTop = element.scrollHeight
    }
  }, [last?.id, last, myId])

  const loadOlder = () => {
    const element = ref.current
    if (!element || !query.hasNextPage || query.isFetchingNextPage) return
    keepFromBottom.current = element.scrollHeight - element.scrollTop
    void query.fetchNextPage()
  }

  const onScroll = () => {
    const element = ref.current
    if (!element) return
    atBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      STICK_TO_BOTTOM_PX
    if (element.scrollTop < 60) loadOlder()
  }

  return { ref, onScroll, loadOlder }
}
