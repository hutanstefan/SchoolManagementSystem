import { GraduationCap, Menu } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
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
import { NotificationBell } from '@/features/notifications/notification-bell'
import { useNotificationsSocket } from '@/features/notifications/use-notifications-socket'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './nav'
import { UserMenu } from './user-menu'

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2 font-semibold">
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      School Management
    </div>
  )
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  if (!user) return null

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS[user.role].map(({ label, to, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive && 'bg-accent text-accent-foreground',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          <span className="flex-1">{label}</span>
          {badge === 'chat' && <ChatUnreadBadge />}
        </NavLink>
      ))}
    </nav>
  )
}

function ChatUnreadBadge() {
  const unread = useChatUnreadCount()
  const count = unread.data ?? 0
  if (count === 0) return null
  return (
    <span className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> unread messages</span>
    </span>
  )
}

/** Sidebar on desktop, slide-out menu on mobile, page content on the right. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  // Live notifications and chat messages.
  useNotificationsSocket()
  useChatSocket()

  return (
    <div className="bg-muted/40 flex min-h-svh">
      <aside className="bg-background hidden w-60 shrink-0 flex-col gap-6 border-r p-4 md:flex">
        <Brand />
        <Navigation />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetHeader className="p-0 pr-8">
                <SheetTitle asChild>
                  <div>
                    <Brand />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <Navigation onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1">
            {user && user.role !== 'ADMIN' && <NotificationBell />}
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
