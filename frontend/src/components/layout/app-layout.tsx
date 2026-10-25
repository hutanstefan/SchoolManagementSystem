import { GraduationCap, Menu } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useChatUnreadCount } from '@/features/chat/api'
import { useChatSocket } from '@/features/chat/use-chat-socket'
import { useUnreadCount } from '@/features/notifications/api'
import { NotificationBell } from '@/features/notifications/notification-bell'
import { useNotificationsSocket } from '@/features/notifications/use-notifications-socket'
import { cn } from '@/lib/utils'
import { PeriodBanner } from '@/periods/period-banner'
import { usePeriod } from '@/periods/period-context'
import { PeriodProvider } from '@/periods/period-provider'
import { PeriodSwitcher } from '@/periods/period-switcher'
import { periodLabel } from '@/periods/resolve'
import { NAV_SECTIONS, navItemFor } from './nav'
import { UserMenu } from './user-menu'

export function Brand({ className }: { className?: string }) {
  const { activeYear } = usePeriod()
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="bg-brand shadow-lifted flex size-9 items-center justify-center rounded-xl text-white">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">
          School Management
        </span>
        <span className="text-muted-foreground block text-xs">
          {activeYear
            ? periodLabel(activeYear, activeYear.currentSemester)
            : 'School year'}
        </span>
      </span>
    </div>
  )
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  if (!user) return null

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV_SECTIONS[user.role].map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          <p className="text-muted-foreground/80 px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">
            {section.title}
          </p>
          {section.items.map(({ label, to, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive &&
                    'bg-sidebar-accent text-sidebar-accent-foreground before:bg-primary before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'size-[18px] transition-colors',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-sidebar-accent-foreground',
                    )}
                    aria-hidden
                  />
                  <span className="flex-1">{label}</span>
                  {badge === 'chat' && <ChatUnreadBadge />}
                  {badge === 'notifications' && <NotificationsBadge />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function CountBadge({ count, label }: { count: number; label: string }) {
  if (count === 0) return null
  return (
    <span className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> {label}</span>
    </span>
  )
}

function ChatUnreadBadge() {
  const unread = useChatUnreadCount()
  return <CountBadge count={unread.data ?? 0} label="unread messages" />
}

function NotificationsBadge() {
  const unread = useUnreadCount()
  return <CountBadge count={unread.data ?? 0} label="unread notifications" />
}

/**
 * Sidebar on desktop, slide-out menu on mobile, page content on the right.
 * Every page shows the school year and semester picked in the sidebar.
 */
export function AppLayout() {
  return (
    <PeriodProvider>
      <Layout />
    </PeriodProvider>
  )
}

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { year } = usePeriod()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const current = user ? navItemFor(user.role, pathname) : undefined
  // Live notifications and chat messages.
  useNotificationsSocket()
  useChatSocket()

  return (
    <div className="flex min-h-svh">
      <aside className="bg-sidebar sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Navigation />
        </div>
        <PeriodSwitcher className="m-3" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md md:px-8">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar w-72 p-0">
              <SheetHeader className="h-16 justify-center px-5 py-0">
                <SheetTitle asChild>
                  <div>
                    <Brand />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <Navigation onNavigate={() => setMenuOpen(false)} />
              </div>
              <PeriodSwitcher className="m-3" />
            </SheetContent>
          </Sheet>
          {current && (
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <current.icon
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden
              />
              <span className="truncate font-medium">{current.label}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            {user && user.role !== 'ADMIN' && <NotificationBell />}
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
          <PeriodBanner />
          {/* Re-mounted per page and per school year: filters such as a
              class of another year don't carry over. */}
          <div
            key={`${pathname.split('/').slice(0, 3).join('/')}|${year?.id}`}
            className="page-enter"
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
