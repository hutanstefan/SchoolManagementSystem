import { ImagePlus, Loader2, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { cn } from '@/lib/utils'

export interface Photo {
  id: string
  /** The prepared (resized JPEG) file, or null while it is being prepared. */
  file: File | null
  url: string | null
  name: string
}

/** Drop zone and thumbnails for the photos of tests. */
export function PhotoPicker({
  photos,
  max,
  disabled,
  onAdd,
  onRemove,
}: {
  photos: Photo[]
  max: number
  disabled?: boolean
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const full = photos.length >= max

  const drop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (!disabled) onAdd([...event.dataTransfer.files])
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={disabled || full}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          'text-muted-foreground hover:border-primary/50 hover:text-foreground flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center text-sm transition disabled:pointer-events-none disabled:opacity-50',
          dragging && 'border-primary bg-primary/5 text-foreground',
        )}
      >
        <ImagePlus className="size-8" aria-hidden />
        <span className="text-foreground font-medium">
          {full
            ? `${max} photos at most`
            : 'Drop photos of the tests here, or click to choose'}
        </span>
        <span>One test per photo · JPEG, PNG or WebP · up to {max} photos</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          onAdd([...(event.target.files ?? [])])
          event.target.value = ''
        }}
      />

      {photos.length > 0 && (
        <ul
          className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8"
          aria-label="Selected photos"
        >
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="bg-muted relative aspect-[3/4] overflow-hidden rounded-md border"
            >
              {photo.url ? (
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Loader2
                    className="text-muted-foreground size-5 animate-spin"
                    aria-label="Preparing photo"
                  />
                </div>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(photo.id)}
                  className="bg-background/90 hover:bg-background absolute top-1 right-1 rounded-full border p-1 shadow-sm"
                  aria-label={`Remove ${photo.name}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
