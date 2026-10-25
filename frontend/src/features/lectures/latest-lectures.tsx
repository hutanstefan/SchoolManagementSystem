import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { SectionHeader } from '@/components/section-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SubjectIcon } from '@/features/subjects/subject-icon'
import { formatTimeAgo, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useLectures, type Lecture } from './api'
import { LecturePreview } from './lecture-preview'
import { canPreviewInline, openLectureInNewTab } from './open-lecture'

/** The newest lectures shared with the student, for the dashboard. */
export function LatestLectures({ className }: { className?: string }) {
  const lectures = useLectures({ pageSize: 3 })
  const [previewing, setPreviewing] = useState<Lecture | null>(null)
  const latest = lectures.data?.data ?? []
  // Nothing to show yet: the dashboard stays as it was.
  if (latest.length === 0) return null

  return (
    <Card className={cn('gap-0 py-0', className)}>
      <SectionHeader
        title="New lectures"
        description="Shared with you by your teachers"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/student/lectures">All lectures</Link>
          </Button>
        }
      />
      <ul className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {latest.map((lecture) => (
          <li key={lecture.id}>
            <button
              type="button"
              onClick={() =>
                canPreviewInline()
                  ? setPreviewing(lecture)
                  : void openLectureInNewTab(lecture.id)
              }
              className="hover:bg-muted/50 group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
            >
              <SubjectIcon subject={lecture.subject} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {lecture.title}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {lecture.subject.name}
                  {lecture.teacher && ` · ${fullName(lecture.teacher)}`} ·{' '}
                  {formatTimeAgo(lecture.createdAt)}
                </span>
              </span>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
      <LecturePreview
        lecture={previewing}
        onClose={() => setPreviewing(null)}
      />
    </Card>
  )
}
