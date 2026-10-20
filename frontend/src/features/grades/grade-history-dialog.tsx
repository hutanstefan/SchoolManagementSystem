import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { ROLE_LABEL } from '@/auth/roles'
import { formatDate, fullName } from '@/lib/format'
import type { Schemas } from '@/api/client'
import { useGradeHistory } from './api'

type Entry = Schemas['GradeHistoryEntryDto']

const ACTION_LABEL: Record<Entry['action'], string> = {
  CREATED: 'Added',
  UPDATED: 'Changed',
  DELETED: 'Deleted',
}

function describe(entry: Entry): string {
  const date = (value: string | null) => formatDate(value)
  switch (entry.action) {
    case 'CREATED':
      return `Grade ${entry.newValue} on ${date(entry.newDate)}`
    case 'DELETED':
      return `Grade ${entry.oldValue} on ${date(entry.oldDate)}`
    case 'UPDATED': {
      const changes: string[] = []
      if (entry.oldValue !== entry.newValue) {
        changes.push(`grade ${entry.oldValue} → ${entry.newValue}`)
      }
      if (entry.oldDate !== entry.newDate) {
        changes.push(`date ${date(entry.oldDate)} → ${date(entry.newDate)}`)
      }
      return changes.length > 0 ? changes.join(', ') : 'No visible change'
    }
  }
}

const dateTime = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

/** Audit trail of one grade: who added, changed or deleted it, and when. */
export function GradeHistoryDialog({
  gradeId,
  onClose,
}: {
  gradeId: string | null
  onClose: () => void
}) {
  const history = useGradeHistory(gradeId)

  return (
    <Dialog open={gradeId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grade history</DialogTitle>
          <DialogDescription>
            Every change is recorded in the same transaction as the change
            itself.
          </DialogDescription>
        </DialogHeader>
        {history.isPending ? (
          <LoadingBlock rows={3} />
        ) : history.error ? (
          <ErrorState
            error={history.error}
            onRetry={() => void history.refetch()}
          />
        ) : (
          <ol className="relative flex flex-col gap-4 border-l pl-5">
            {history.data.map((entry) => (
              <li key={entry.id} className="relative">
                <span
                  className="bg-primary absolute top-1.5 -left-[25px] size-2.5 rounded-full"
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      entry.action === 'DELETED' ? 'destructive' : 'secondary'
                    }
                  >
                    {ACTION_LABEL[entry.action]}
                  </Badge>
                  <span className="text-sm">{describe(entry)}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {dateTime(entry.changedAt)} by{' '}
                  {entry.changedBy
                    ? `${fullName(entry.changedBy)} (${ROLE_LABEL[entry.changedBy.role]})`
                    : 'a deleted user'}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
