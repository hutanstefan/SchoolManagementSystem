import { LogOut, Pencil, Trash2, UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SubmitButton } from '@/components/submit-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  useDeleteGroup,
  useRemoveMember,
  useRenameGroup,
  type Conversation,
  type ConversationMember,
} from './api'
import { ChatAvatar } from './chat-avatar'
import { describeUser } from './format'
import { AddMembersDialog } from './group-dialogs'
import { messagesPath } from './paths'

/**
 * A group's members. Its creator renames it, adds and removes people and
 * deletes it; anyone else can leave.
 */
export function GroupSettingsDialog({
  conversation,
  open,
  onOpenChange,
}: {
  conversation: Conversation
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isOwner = conversation.myRole === 'OWNER'
  const rename = useRenameGroup(conversation.id)
  const remove = useRemoveMember(conversation.id)
  const deleteGroup = useDeleteGroup(conversation.id)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(conversation.name)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<ConversationMember | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const backToList = () => {
    onOpenChange(false)
    void navigate(messagesPath(user!.role))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Group</DialogTitle>
            <DialogDescription>
              {conversation.members.length} members
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (!name.trim()) return
                rename.mutate(name.trim(), {
                  onSuccess: () => setEditing(false),
                })
              }}
            >
              <Input
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                aria-label="Group name"
                autoFocus
              />
              <SubmitButton pending={rename.isPending} disabled={!name.trim()}>
                Save
              </SubmitButton>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <p className="flex-1 font-medium">{conversation.name}</p>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setName(conversation.name)
                    setEditing(true)
                  }}
                >
                  <Pencil aria-hidden /> Rename
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Members</h3>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdding(true)}
              >
                <UserPlus aria-hidden /> Add people
              </Button>
            )}
          </div>
          <ul className="-mx-1 max-h-72 divide-y overflow-y-auto px-1">
            {conversation.members.map((member) => (
              <li key={member.user.id} className="flex items-center gap-3 py-2">
                <ChatAvatar person={member.user} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {member.user.firstName} {member.user.lastName}
                    {member.user.id === user?.id && ' (you)'}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {describeUser(member.user)}
                  </span>
                </span>
                {member.role === 'OWNER' && (
                  <Badge variant="secondary">Creator</Badge>
                )}
                {isOwner && member.role !== 'OWNER' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Remove ${member.user.firstName} ${member.user.lastName}`}
                    onClick={() => setRemoving(member)}
                  >
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex justify-end border-t pt-4">
            {isOwner ? (
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden /> Delete group
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setLeaving(true)}>
                <LogOut aria-hidden /> Leave group
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddMembersDialog
        conversationId={conversation.id}
        memberIds={conversation.members.map((m) => m.user.id)}
        open={adding}
        onOpenChange={setAdding}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title="Remove from the group?"
        description={
          removing &&
          `${removing.user.firstName} ${removing.user.lastName} will no longer see the group or its new messages.`
        }
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.user.id, {
            onSuccess: () => setRemoving(null),
          })
        }
      />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Leave the group?"
        description="You will no longer see its messages. Only the creator can add you back."
        confirmLabel="Leave"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(user!.id, {
            onSuccess: () => {
              setLeaving(false)
              backToList()
            },
          })
        }
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete the group?"
        description="The group and all its messages are deleted for everyone. This can't be undone."
        pending={deleteGroup.isPending}
        onConfirm={() =>
          deleteGroup.mutate(undefined, {
            onSuccess: () => {
              setDeleting(false)
              backToList()
            },
          })
        }
      />
    </>
  )
}
