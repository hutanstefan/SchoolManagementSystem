import { MessagesSquare } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { EmptyState } from '@/components/states'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ChatThread } from './chat-thread'
import { ConversationList } from './conversation-list'
import { NewGroupDialog } from './group-dialogs'
import { NewMessageDialog } from './new-message-dialog'
import { messagesPath } from './paths'

/**
 * Messages: the conversations on the left, the open one on the right. On a
 * phone, one of the two at a time.
 */
export function MessagesPage() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [newMessage, setNewMessage] = useState(false)
  const [newGroup, setNewGroup] = useState(false)
  const canCreateGroups = user?.role === 'TEACHER'

  return (
    <>
      <Card className="h-[calc(100svh-7.5rem)] min-h-[28rem] flex-row gap-0 overflow-hidden py-0 md:h-[calc(100svh-9.5rem)]">
        <aside
          className={cn(
            'flex w-full min-w-0 flex-col md:w-80 md:shrink-0 md:border-r',
            conversationId && 'hidden md:flex',
          )}
        >
          <ConversationList
            onNewMessage={() => setNewMessage(true)}
            onNewGroup={canCreateGroups ? () => setNewGroup(true) : undefined}
          />
        </aside>
        <section
          className={cn(
            'min-w-0 flex-1 flex-col',
            conversationId ? 'flex' : 'hidden md:flex',
          )}
        >
          {conversationId ? (
            <ChatThread
              conversationId={conversationId}
              onBack={() => void navigate(messagesPath(user!.role))}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={MessagesSquare}
                title="Pick a conversation"
                description={
                  canCreateGroups
                    ? 'Or start a new one, or create a group for a class.'
                    : 'Or write to one of your teachers.'
                }
              />
            </div>
          )}
        </section>
      </Card>
      <NewMessageDialog open={newMessage} onOpenChange={setNewMessage} />
      {canCreateGroups && (
        <NewGroupDialog open={newGroup} onOpenChange={setNewGroup} />
      )}
    </>
  )
}
