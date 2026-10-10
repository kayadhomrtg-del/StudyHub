import {
  CalendarDays,
  CheckSquare,
  Search,
  Settings2,
  Sparkles,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

export interface WorkspacePageInfo {
  path: string;
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
}

export const workspacePages: WorkspacePageInfo[] = [
  {
    path: "/notes",
    title: "Notes",
    eyebrow: "YOUR THINKING",
    description: "A quiet place for the ideas and connections you make while learning.",
    emptyTitle: "No notes just yet",
    emptyDescription: "Write and organize private study notes on this device.",
    icon: StickyNote,
  },
  {
    path: "/tasks",
    title: "Tasks",
    eyebrow: "YOUR COMMITMENTS",
    description: "Create, organize, and track assignments and study goals locally.",
    emptyTitle: "Nothing on your list",
    emptyDescription: "Add assignments, exams, readings, and personal study tasks.",
    icon: CheckSquare,
  },
  {
    path: "/calendar",
    title: "Calendar",
    eyebrow: "YOUR TIME",
    description: "See your academic commitments and study sessions in one view.",
    emptyTitle: "Your calendar is clear",
    emptyDescription:
      "Once planning features arrive, dates and study sessions will have a home here.",
    icon: CalendarDays,
  },
  {
    path: "/planner",
    title: "Study planner",
    eyebrow: "YOUR ROUTINE",
    description: "Make a little room for focused, intentional study.",
    emptyTitle: "Your plan starts here",
    emptyDescription:
      "Study sessions are not available yet. This page is the foundation for planning features in a future milestone.",
    icon: Sparkles,
  },
  {
    path: "/search",
    title: "Search",
    eyebrow: "FIND YOUR WAY",
    description: "Search your local modules, topics, materials, notes, and tasks.",
    emptyTitle: "Your study hub is ready to search",
    emptyDescription: "Search local study records without loading file contents or contacting a server.",
    icon: Search,
  },
  {
    path: "/settings",
    title: "Settings",
    eyebrow: "YOUR PREFERENCES",
    description: "Manage local backups, browser storage information, and appearance.",
    emptyTitle: "Settings and backups",
    emptyDescription: "Back up or restore your library and review this browser's storage.",
    icon: Settings2,
  },
];
