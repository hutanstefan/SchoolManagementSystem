import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Confidence, ScannedTest } from './api'

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        confidence === 'high' &&
          'border-emerald-600/30 text-emerald-700 dark:text-emerald-400',
        confidence === 'low' &&
          'border-amber-600/40 text-amber-700 dark:text-amber-400',
      )}
    >
      {confidence === 'low' && <AlertTriangle aria-hidden />}
      {confidence} confidence
    </Badge>
  )
}

/** The photo, small; click to see it full size. */
export function PhotoThumb({
  url,
  test,
}: {
  url: string | null
  test: ScannedTest
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-muted block h-20 w-16 overflow-hidden rounded border"
        aria-label={`Enlarge ${test.fileName}`}
      >
        {url && <img src={url} alt="" className="size-full object-cover" />}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{test.fileName}</DialogTitle>
            <DialogDescription>
              {test.studentNameRead ?? 'No name found'} · grade{' '}
              {test.gradeRead ?? '—'}
            </DialogDescription>
          </DialogHeader>
          {url && (
            <img
              src={url}
              alt={test.fileName}
              className="max-h-[70vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** What the AI read on the photo. */
export function ScanReading({
  test,
  mainModel,
}: {
  test: ScannedTest
  mainModel: string | null
}) {
  if (test.status === 'failed') {
    return <p className="text-destructive text-sm">{test.error}</p>
  }
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        <span className="font-medium">
          {test.studentNameRead ?? 'No name found'}
        </span>
        <span className="text-muted-foreground">
          {' · grade '}
          {test.gradeRead ?? '—'}
        </span>
      </p>
      <div>
        <ConfidenceBadge confidence={test.confidence} />
      </div>
      {test.note && (
        <p className="text-muted-foreground text-xs">{test.note}</p>
      )}
      {test.readBy && test.readBy !== mainModel && (
        <p className="text-muted-foreground text-xs">
          Read by {test.readBy} (the main model was busy)
        </p>
      )}
    </div>
  )
}
