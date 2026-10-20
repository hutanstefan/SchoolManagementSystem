import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, errorMessage } from '@/api/client'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Message shown in a toast when the mutation succeeds. */
      successMessage?: string
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
      onError: (error) => toast.error(errorMessage(error)),
      onSuccess: (_data, _variables, _context, mutation) => {
        if (mutation.meta?.successMessage) {
          toast.success(mutation.meta.successMessage)
        }
      },
    }),
  })
}
