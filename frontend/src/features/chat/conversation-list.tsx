import { MessageSquarePlus, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { SearchInput } from '@/components/search-input'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useConversations, type Conversation } from './api'
import { ChatAvatar } from './chat-avatar'
import { formatListTime, previewOf } from './format'
import { messagesPath } from './paths'

/** The user's conversations, latest first, with unread counts. */
export function ConversationList({
  onNewMessage,
  onNewGroup,
}: {
  onNewMessage: () => void
  onNewGroup?: () => void
}) {
  const { user } = useAuth()
  const conversations = useConversations()
  const [search, setSearch] = useState('')
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = (conversations.data ?? []).filter((c) =>
    words.every((word) => c.name.toLowerCase().includes(word)),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <h1 className="flex-1 text-lg font-semibold">Messages</h1>
        {onNewGroup && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onNewGroup}
                aria-label="New group"
              >
                <UsersRound />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New group</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewMessage}
              aria-label="New message"
            >
              <MessageSquarePlus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New message</TooltipContent>
        </Tooltip>
      </div>
      <div className="border-b p-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search conversations"
          className="sm:max-w-none"
        />
      </div>
      <nav
        aria-label="Conversations"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {conversations.isPending ? (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-3 p-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))
        ) : shown.length === 0 ? (
          <EmptyState
            title={search ? 'No conversation found' : 'No conversations yet'}
            description={
              search
                ? undefined
                : 'Start one with the “New message” button above.'
            }
          />
        ) : (
          shown.map((conversation) => (
            <ConversationLink
              key={conversation.id}
              conversation={conversation}
              to={messagesPath(user!.role, conversation.id)}
              myId={user?.id}
            />
          ))
        )}
      </nav>
    </div>
  )
}

function ConversationLink({
  conversation,
  to,
  myId,
}: {
  conversation: Conversation
  to: string
  myId: string | undefined
}) {
  const other = conversation.members.find((m) => m.user.id !== myId)?.user
  const unread = conversation.unreadCount > 0
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'hover:bg-accent flex items-center gap-3 px-3 py-2.5 transition-colors',
          isActive && 'bg-accent',
        )
      }
    >
      <ChatAvatar person={other} group={conversation.type === 'GROUP'} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              'flex-1 truncate text-sm',
              unread ? 'font-semibold' : 'font-medium',
            )}
          >
            {conversation.name}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {formatListTime(conversation.lastMessageAt)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'flex-1 truncate text-sm',
              unread ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {previewOf(conversation, myId)}
          </span>
          {unread && (
            <span className="bg-primary text-primary-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </span>
      </span>
    </NavLink>
  )
}
