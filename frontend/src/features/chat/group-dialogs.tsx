import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddMembers, useCreateGroup } from './api'
import { messagesPath } from './paths'
import { PeoplePicker } from './people-picker'

/** A teacher or admin names the group and picks its members. */
export function NewGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const create = useCreateGroup()
  const [name, setName] = useState('')
  const [members, setMembers] = useState<string[]>([])

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setName('')
      setMembers([])
    }
  }
  const valid = name.trim().length > 0 && members.length > 0

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Students in a group can write to each other. You can add and remove
            people later.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            create.mutate(
              { name: name.trim(), memberIds: members },
              {
                onSuccess: (conversation) => {
                  close(false)
                  void navigate(messagesPath(user!.role, conversation.id))
                },
              },
            )
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              maxLength={60}
              placeholder="e.g. 9A · Mathematics"
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          {open && (
            <PeoplePicker
              mode="many"
              selected={members}
              onSelectedChange={setMembers}
            />
          )}
          <DialogFooter className="items-center gap-2 sm:justify-between">
            <p className="text-muted-foreground text-sm">
              {members.length} selected
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <SubmitButton pending={create.isPending} disabled={!valid}>
                Create group
              </SubmitButton>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** The group's creator adds more people. */
export function AddMembersDialog({
  conversationId,
  memberIds,
  open,
  onOpenChange,
}: {
  conversationId: string
  memberIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const add = useAddMembers(conversationId)
  const [selected, setSelected] = useState<string[]>([])
  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) setSelected([])
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>
            They will see the messages written from now on.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PeoplePicker
            mode="many"
            selected={selected}
            onSelectedChange={setSelected}
            exclude={memberIds}
          />
        )}
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-muted-foreground text-sm">
            {selected.length} selected
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton
              type="button"
              pending={add.isPending}
              disabled={selected.length === 0}
              onClick={() =>
                add.mutate(selected, { onSuccess: () => close(false) })
              }
            >
              Add {selected.length || ''}
            </SubmitButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
