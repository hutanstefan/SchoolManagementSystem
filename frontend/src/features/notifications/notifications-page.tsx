import { CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMarkAllRead, useNotifications, useUnreadCount } from './api'
import { NotificationItem } from './notification-item'
import { useOpenNotification } from './use-open-notification'

type Filter = 'all' | 'unread'

/** Every notification of the user, newest first. */
export function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const notifications = useNotifications({
    page,
    pageSize: 20,
    ...(filter === 'unread' && { unread: true }),
  })
  const unread = useUnreadCount()
  const markAllRead = useMarkAllRead()
  const openNotification = useOpenNotification()
  const count = unread.data ?? 0

  return (
    <>
      <PageHeader
        title="Notifications"
        description="New grades, timetable changes and everything else that concerns you."
        actions={
          <Button
            variant="outline"
            disabled={count === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck aria-hidden /> Mark all as read
          </Button>
        }
      />
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as Filter)
          setPage(1)
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread{count > 0 ? ` (${count})` : ''}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="gap-0 overflow-hidden py-0">
        {notifications.isPending ? (
          <LoadingBlock />
        ) : notifications.error ? (
          <ErrorState
            error={notifications.error}
            onRetry={() => void notifications.refetch()}
          />
        ) : notifications.data.data.length === 0 ? (
          <EmptyState
            title={
              filter === 'unread' ? 'Nothing unread' : 'No notifications yet'
            }
            description="New grades and timetable changes will show up here."
          />
        ) : (
          <>
            <div className="divide-y">
              {notifications.data.data.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onOpen={openNotification}
                />
              ))}
            </div>
            <PaginationBar
              meta={notifications.data.meta}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  )
}
