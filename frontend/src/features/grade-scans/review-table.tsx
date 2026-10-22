import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Student } from '@/features/students/api'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Confidence } from './api'
import { rowProblems, type ReviewRow, type RowProblem } from './review'

const NONE = '__none__'

const PROBLEM_TEXT: Record<RowProblem, string> = {
  failed: 'This photo could not be read: untick it or fill in both fields.',
  'no-student': 'Pick the student.',
  'no-grade': 'Pick the grade.',
  duplicate: 'This student is on another photo too.',
}

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

/**
 * What was read from each photo, next to fields the teacher can correct.
 * Problems are shown on the row, and saving stays disabled until they are fixed.
 */
export function ReviewTable({
  rows,
  photoUrls,
  students,
  mainModel,
  onChange,
}: {
  rows: ReviewRow[]
  photoUrls: (string | null)[]
  students: Student[]
  /** The usual model; a row read by another one (a fallback) says so. */
  mainModel: string | null
  onChange: (index: number, change: Partial<ReviewRow>) => void
}) {
  const [zoomed, setZoomed] = useState<number | null>(null)
  const problems = rowProblems(rows)
  const zoomedRow = zoomed === null ? null : rows[zoomed]

  return (
    <>
      <Table className="[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Save</span>
            </TableHead>
            <TableHead className="w-20">Photo</TableHead>
            <TableHead>On the paper</TableHead>
            <TableHead className="w-56">Student</TableHead>
            <TableHead className="w-28">Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const { test } = row
            const url = photoUrls[index]
            return (
              <TableRow
                key={test.index}
                className={cn('align-top', !row.include && 'opacity-60')}
              >
                <TableCell className="pt-4">
                  <Checkbox
                    checked={row.include}
                    onCheckedChange={(checked) =>
                      onChange(index, { include: checked === true })
                    }
                    aria-label={`Save the grade from ${test.fileName}`}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setZoomed(index)}
                    className="bg-muted block h-20 w-16 overflow-hidden rounded border"
                    aria-label={`Enlarge ${test.fileName}`}
                  >
                    {url && (
                      <img
                        src={url}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                  </button>
                </TableCell>
                <TableCell className="whitespace-normal">
                  {test.status === 'failed' ? (
                    <p className="text-destructive text-sm">{test.error}</p>
                  ) : (
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
                        <p className="text-muted-foreground text-xs">
                          {test.note}
                        </p>
                      )}
                      {test.readBy && test.readBy !== mainModel && (
                        <p className="text-muted-foreground text-xs">
                          Read by {test.readBy} (the main model was busy)
                        </p>
                      )}
                    </div>
                  )}
                  {problems[index]!.map((problem) => (
                    <p
                      key={problem}
                      role="alert"
                      className="text-destructive mt-1 text-xs font-medium"
                    >
                      {PROBLEM_TEXT[problem]}
                    </p>
                  ))}
                </TableCell>
                <TableCell>
                  <Select
                    value={row.studentId ?? NONE}
                    onValueChange={(value) =>
                      onChange(index, {
                        studentId: value === NONE ? null : value,
                        include: true,
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label={`Student for ${test.fileName}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Pick a student…</SelectItem>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {fullName(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={row.grade === null ? NONE : String(row.grade)}
                    onValueChange={(value) =>
                      onChange(index, {
                        grade: value === NONE ? null : Number(value),
                        include: true,
                      })
                    }
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label={`Grade for ${test.fileName}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {Array.from({ length: 10 }, (_, i) => 10 - i).map(
                        (value) => (
                          <SelectItem key={value} value={String(value)}>
                            {value}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Dialog
        open={zoomedRow !== null && zoomedRow !== undefined}
        onOpenChange={(open) => !open && setZoomed(null)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{zoomedRow?.test.fileName}</DialogTitle>
            <DialogDescription>
              {zoomedRow?.test.studentNameRead ?? 'No name found'} · grade{' '}
              {zoomedRow?.test.gradeRead ?? '—'}
            </DialogDescription>
          </DialogHeader>
          {zoomed !== null && photoUrls[zoomed] && (
            <img
              src={photoUrls[zoomed]}
              alt={zoomedRow?.test.fileName}
              className="max-h-[70vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
