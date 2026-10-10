import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  NotebookPen,
  Search,
  Settings2,
  Sparkles,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const navigationItems: NavigationItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/modules", label: "Modules", icon: BookOpen },
  { path: "/materials", label: "Materials", icon: NotebookPen },
  { path: "/notes", label: "Notes", icon: StickyNote },
  { path: "/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/planner", label: "Study planner", icon: Sparkles },
  { path: "/search", label: "Search", icon: Search },
  { path: "/settings", label: "Settings", icon: Settings2 },
];
