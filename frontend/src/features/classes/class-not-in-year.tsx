import { CalendarX2 } from 'lucide-react'
import { Link } from 'react-router'
import { BackLink } from '@/components/back-link'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePeriod } from '@/periods/period-context'
import type { ClassDetail } from './api'

/** A class page while the sidebar shows a year the class didn't exist in. */
export function ClassNotInYear({
  schoolClass,
  year,
  listPath,
  listLabel,
}: {
  schoolClass: ClassDetail
  year: { name: string }
  /** The page listing the classes, e.g. /admin/classes. */
  listPath: string
  listLabel: string
}) {
  const { setYear } = usePeriod()
  const years = schoolClass.lineage.map((c) => c.schoolYear.name)
  return (
    <>
      <BackLink to={listPath} label={listLabel} />
      <Card>
        <EmptyState
          icon={CalendarX2}
          title={`Class ${schoolClass.name} isn't in ${year.name}`}
          description={`It only exists in ${years.join(', ')}. To see ${year.name}, open that year's classes.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setYear(schoolClass.schoolYear.id)}>
                Back to {schoolClass.schoolYear.name}
              </Button>
              <Button asChild variant="outline">
                <Link to={listPath}>Classes of {year.name}</Link>
              </Button>
            </div>
          }
        />
      </Card>
    </>
  )
}
