import {
  Bell,
  BookOpen,
  BookOpenText,
  CalendarRange,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  MessagesSquare,
  School,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/auth/roles'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Only active on an exact match (used for dashboards). */
  end?: boolean
  /** Shows a live counter next to the label. */
  badge?: 'chat' | 'notifications'
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: Record<Role, NavSection[]> = {
  ADMIN: [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
      ],
    },
    {
      title: 'School',
      items: [
        { label: 'Students', to: '/admin/students', icon: GraduationCap },
        { label: 'Teachers', to: '/admin/teachers', icon: Users },
        { label: 'Classes', to: '/admin/classes', icon: School },
        { label: 'Subjects', to: '/admin/subjects', icon: BookOpen },
      ],
    },
    {
      title: 'Academics',
      items: [
        { label: 'Grades', to: '/admin/grades', icon: ClipboardList },
        { label: 'Lectures', to: '/admin/lectures', icon: BookOpenText },
        {
          label: 'School years',
          to: '/admin/school-years',
          icon: CalendarRange,
        },
      ],
    },
    {
      title: 'System',
      items: [{ label: 'Activity log', to: '/admin/activity', icon: History }],
    },
  ],
  TEACHER: [
    {
      title: 'Overview',
      items: [
        {
          label: 'Dashboard',
          to: '/teacher',
          icon: LayoutDashboard,
          end: true,
        },
      ],
    },
    {
      title: 'Teaching',
      items: [
        { label: 'My classes', to: '/teacher/classes', icon: School },
        { label: 'Lectures', to: '/teacher/lectures', icon: BookOpenText },
        { label: 'My timetable', to: '/teacher/timetable', icon: CalendarDays },
      ],
    },
    {
      title: 'Communication',
      items: [
        {
          label: 'Messages',
          to: '/teacher/messages',
          icon: MessagesSquare,
          badge: 'chat',
        },
        {
          label: 'Notifications',
          to: '/teacher/notifications',
          icon: Bell,
          badge: 'notifications',
        },
      ],
    },
  ],
  STUDENT: [
    {
      title: 'Overview',
      items: [
        {
          label: 'Dashboard',
          to: '/student',
          icon: LayoutDashboard,
          end: true,
        },
      ],
    },
    {
      title: 'Learning',
      items: [
        { label: 'My grades', to: '/student/grades', icon: ClipboardList },
        { label: 'Lectures', to: '/student/lectures', icon: BookOpenText },
        { label: 'My class', to: '/student/class', icon: School },
        { label: 'My timetable', to: '/student/timetable', icon: CalendarDays },
      ],
    },
    {
      title: 'Communication',
      items: [
        {
          label: 'Messages',
          to: '/student/messages',
          icon: MessagesSquare,
          badge: 'chat',
        },
        {
          label: 'Notifications',
          to: '/student/notifications',
          icon: Bell,
          badge: 'notifications',
        },
      ],
    },
  ],
}

/** The nav item a path belongs to (the longest matching one). */
export function navItemFor(role: Role, pathname: string): NavItem | undefined {
  return NAV_SECTIONS[role]
    .flatMap((section) => section.items)
    .filter((item) =>
      item.end
        ? pathname === item.to
        : pathname === item.to || pathname.startsWith(`${item.to}/`),
    )
    .sort((a, b) => b.to.length - a.to.length)[0]
}
