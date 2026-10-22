import { useNavigate } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import type { Role } from '@/auth/roles'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOpenDirect } from './api'
import { messagesPath } from './paths'
import { PeoplePicker } from './people-picker'

const WHO_CAN_I_WRITE_TO: Partial<Record<Role, string>> = {
  TEACHER: 'Other teachers and the students of the classes you teach.',
  STUDENT:
    'Your teachers. Classmates can talk together in groups made by a teacher.',
}

/** Pick someone and open the direct conversation with them. */
export function NewMessageDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const openDirect = useOpenDirect()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          {user && (
            <DialogDescription>
              {WHO_CAN_I_WRITE_TO[user.role]}
            </DialogDescription>
          )}
        </DialogHeader>
        {open && (
          <PeoplePicker
            mode="one"
            onPick={(contact) =>
              openDirect.mutate(contact.id, {
                onSuccess: (conversation) => {
                  onOpenChange(false)
                  void navigate(messagesPath(user!.role, conversation.id))
                },
              })
            }
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
