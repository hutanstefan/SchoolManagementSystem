import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, errorMessage } from '@/api/client'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Message shown in a toast when the mutation succeeds. */
      successMessage?: string
      /**
       * The page shows conflicts (409 with details) itself, e.g. in a dialog
       * offering to resolve them, so no error toast for those.
       */
      handlesConflicts?: boolean
      /** Background calls (e.g. "mark as read"): no error toast. */
      silent?: boolean
    }
  }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry network glitches and server errors, never 4xx answers.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ),
        refetchOnWindowFocus: false,
      },
    },
    // Every failed or successful change shows a toast, so pages don't repeat this logic.
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silent) return
        const handled =
          mutation.meta?.handlesConflicts &&
          error instanceof ApiError &&
          error.status === 409 &&
          error.conflict !== undefined
        if (!handled) toast.error(errorMessage(error))
      },
      onSuccess: (_data, _variables, _context, mutation) => {
        if (mutation.meta?.successMessage) {
          toast.success(mutation.meta.successMessage)
        }
      },
    }),
  })
}
