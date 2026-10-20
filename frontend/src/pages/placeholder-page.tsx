import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'

/** Temporary page for sections built in the next steps. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
          <Construction className="size-8" aria-hidden />
          This page is being built.
        </CardContent>
      </Card>
    </>
  )
}
