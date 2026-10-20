import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <SearchX className="text-muted-foreground size-12" aria-hidden />
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground mt-1">
          The page you are looking for doesn&apos;t exist.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Back to the app</Link>
      </Button>
    </div>
  )
}
