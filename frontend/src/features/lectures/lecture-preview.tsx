import { useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, LoaderCircle } from 'lucide-react'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SubjectIcon } from '@/features/subjects/subject-icon'
import { formatBytes, fullName } from '@/lib/format'
import { lectureLink, type Lecture } from './api'
import { downloadLecture, openLectureInNewTab } from './open-lecture'

/** The PDF in the browser's own viewer, with download and new-tab buttons. */
export function LecturePreview({
  lecture,
  onClose,
}: {
  lecture: Lecture | null
  onClose: () => void
}) {
  // A fresh link each time it opens: links only work for a few minutes.
  const link = useQuery({
    queryKey: ['lectures', 'link', lecture?.id],
    queryFn: () => lectureLink(lecture!.id),
    enabled: lecture !== null,
    staleTime: 0,
    gcTime: 0,
  })

  return (
    <Dialog open={lecture !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[90vh] flex-col gap-3 p-4 sm:max-w-5xl sm:p-5">
        {lecture && (
          <>
            <DialogHeader className="flex-row items-center gap-3 pr-8 text-left">
              <SubjectIcon subject={lecture.subject} className="size-10" />
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate">{lecture.title}</DialogTitle>
                <DialogDescription className="truncate">
                  {lecture.subject.name}
                  {lecture.teacher && ` · ${fullName(lecture.teacher)}`} ·{' '}
                  {formatBytes(lecture.fileSize)}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openLectureInNewTab(lecture.id)}
                >
                  <ExternalLink aria-hidden />
                  <span className="hidden sm:inline">New tab</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => void downloadLecture(lecture.id)}
                >
                  <Download aria-hidden />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </div>
            </DialogHeader>
            <div className="bg-muted relative min-h-0 flex-1 overflow-hidden rounded-lg border">
              {link.data ? (
                <iframe
                  key={link.data.url}
                  src={link.data.url}
                  title={`Preview of ${lecture.title}`}
                  className="size-full"
                />
              ) : link.error ? (
                <ErrorState
                  error={link.error}
                  onRetry={() => void link.refetch()}
                />
              ) : (
                <div
                  className="flex size-full items-center justify-center"
                  role="status"
                  aria-label="Loading the PDF"
                >
                  <LoaderCircle className="text-muted-foreground size-6 animate-spin" />
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
