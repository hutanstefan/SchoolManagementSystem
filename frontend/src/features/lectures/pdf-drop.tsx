import { FileText, FileUp, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Drop zone for one PDF; shows the chosen file with a way to remove it. */
export function PdfDrop({
  file,
  onChange,
  invalid,
}: {
  file: File | null
  onChange: (file: File | null) => void
  invalid?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const drop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files[0]
    if (dropped) onChange(dropped)
  }

  if (file) {
    return (
      <div className="bg-muted/40 flex items-center gap-3 rounded-lg border p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-muted-foreground text-xs">
            PDF · {formatBytes(file.size)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove the file"
          onClick={() => onChange(null)}
        >
          <X />
        </Button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        aria-invalid={invalid}
        className={cn(
          'text-muted-foreground hover:border-primary/50 hover:text-foreground flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition',
          dragging && 'border-primary bg-primary/5 text-foreground',
          invalid && 'border-destructive/60',
        )}
      >
        <FileUp className="size-7" aria-hidden />
        <span className="text-foreground font-medium">
          Drop the PDF here, or click to choose it
        </span>
        <span>PDF only · up to 20 MB</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        aria-label="PDF file"
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
      />
    </>
  )
}
