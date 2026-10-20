import type { Schemas } from '@/api/client'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatAverage } from '@/lib/format'

type SubjectGrades = Schemas['SubjectGradesDto']

/**
 * Average per subject as horizontal bars on a 1–10 scale, best first.
 * Subjects without grades are left out (the report card table lists them).
 */
export function SubjectAverages({ subjects }: { subjects: SubjectGrades[] }) {
  const rows = subjects
    .filter(
      (row): row is SubjectGrades & { average: number } => row.average !== null,
    )
    .sort((a, b) => b.average - a.average)

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-8 text-center text-sm">
        Averages appear here once you have grades.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3 p-4" aria-label="Average by subject">
      {rows.map((row) => (
        <li
          key={row.subject.id}
          className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 text-sm"
        >
          <span className="truncate">{row.subject.name}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Taller than the bar, so it is easy to hover. */}
              <div
                className="flex h-5 items-center"
                tabIndex={0}
                aria-label={`${row.subject.name}: average ${formatAverage(row.average)} from ${row.grades.length} grades`}
              >
                <div className="bg-muted h-2.5 w-full rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${(row.average / 10) * 100}%` }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {formatAverage(row.average)} from {row.grades.length}{' '}
              {row.grades.length === 1 ? 'grade' : 'grades'}
            </TooltipContent>
          </Tooltip>
          <span className="text-right font-medium tabular-nums">
            {formatAverage(row.average)}
          </span>
        </li>
      ))}
    </ul>
  )
}
