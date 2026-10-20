import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Schemas } from '@/api/client'
import { Button } from '@/components/ui/button'

export function PaginationBar({
  meta,
  onPageChange,
}: {
  meta: Schemas['PaginationMetaDto'] | undefined
  onPageChange: (page: number) => void
}) {
  if (!meta || meta.total === 0) return null

  const first = (meta.page - 1) * meta.pageSize + 1
  const last = Math.min(meta.page * meta.pageSize, meta.total)

  return (
    <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        {first}–{last} of {meta.total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="tabular-nums">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={meta.page >= meta.totalPages}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
