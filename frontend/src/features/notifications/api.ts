import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api, unwrap, type Schemas } from '@/api/client'
import { queryKeys } from '@/api/query-keys'

export type Notification = Schemas['NotificationDto']
export type NotificationType = Notification['type']

export function useNotifications(params: {
  page: number
  pageSize: number
  unread?: boolean
}) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () =>
      unwrap(api.GET('/api/notifications', { params: { query: params } })),
    placeholderData: keepPreviousData,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => unwrap(api.GET('/api/notifications/unread-count')),
    select: (data) => data.count,
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.PATCH('/api/notifications/{id}/read', {
          params: { path: { id } },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.PATCH('/api/notifications/read-all')),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
}
