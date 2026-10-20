import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
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
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Students', to: '/admin/students', icon: GraduationCap },
    { label: 'Teachers', to: '/admin/teachers', icon: Users },
    { label: 'Classes', to: '/admin/classes', icon: School },
    { label: 'Subjects', to: '/admin/subjects', icon: BookOpen },
    { label: 'Grades', to: '/admin/grades', icon: ClipboardList },
  ],
  TEACHER: [
    { label: 'Dashboard', to: '/teacher', icon: LayoutDashboard, end: true },
    { label: 'My classes', to: '/teacher/classes', icon: School },
    { label: 'My timetable', to: '/teacher/timetable', icon: CalendarDays },
  ],
  STUDENT: [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'My grades', to: '/student/grades', icon: ClipboardList },
    { label: 'My class', to: '/student/class', icon: School },
    { label: 'My timetable', to: '/student/timetable', icon: CalendarDays },
  ],
}
