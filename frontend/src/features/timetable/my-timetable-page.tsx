import { useAuth } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { ErrorState, LoadingBlock } from '@/components/states'
import { Card } from '@/components/ui/card'
import { useMyTimetable } from './api'
import { TimetableGrid } from './timetable-grid'

/** The weekly timetable of the logged-in teacher or student. */
export function MyTimetablePage() {
  const { user } = useAuth()
  const timetable = useMyTimetable()
  const isTeacher = user?.role === 'TEACHER'

  const lessonCount =
    timetable.data?.days.reduce((sum, day) => sum + day.lessons.length, 0) ?? 0

  return (
    <>
      <PageHeader
        title="My timetable"
        description={
          timetable.data
            ? `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'} a week`
            : undefined
        }
      />
      <Card className="py-0">
        <div className="p-2">
          {timetable.isPending ? (
            <LoadingBlock />
          ) : timetable.error ? (
            <ErrorState
              error={timetable.error}
              onRetry={() => void timetable.refetch()}
            />
          ) : (
            <TimetableGrid
              timetable={timetable.data}
              mode={isTeacher ? 'teacher' : 'class'}
            />
          )}
        </div>
      </Card>
    </>
  )
}
