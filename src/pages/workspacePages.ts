import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  FileText,
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
    path: "/modules",
    title: "Your modules",
    eyebrow: "YOUR COURSEWORK",
    description: "Keep every course and its learning materials in one calm space.",
    emptyTitle: "Your modules will live here",
    emptyDescription:
      "When you are ready for the next milestone, you will be able to organize courses and topics right here.",
    icon: BookOpen,
  },
  {
    path: "/materials",
    title: "Materials",
    eyebrow: "YOUR LIBRARY",
    description: "A home for the readings, slides, and resources you study from.",
    emptyTitle: "Your library is ready",
    emptyDescription:
      "Course materials will appear here once local organization is introduced in a later milestone.",
    icon: FileText,
  },
  {
    path: "/notes",
    title: "Notes",
    eyebrow: "YOUR THINKING",
    description: "A quiet place for the ideas and connections you make while learning.",
    emptyTitle: "No notes just yet",
    emptyDescription:
      "This space is ready for your study notes. Note creation and saving are not part of this foundation milestone.",
    icon: StickyNote,
  },
  {
    path: "/tasks",
    title: "Tasks",
    eyebrow: "YOUR COMMITMENTS",
    description: "Keep assignments and study goals visible as your term takes shape.",
    emptyTitle: "Nothing on your list",
    emptyDescription:
      "Assignments and tasks will be introduced in a later milestone. For now, this is your place to find them.",
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
    description: "Find your way back to the course content that matters.",
    emptyTitle: "Your study hub is ready to search",
    emptyDescription:
      "Search will become useful as your local library fills with materials and notes in future milestones.",
    icon: Search,
  },
  {
    path: "/settings",
    title: "Settings",
    eyebrow: "YOUR PREFERENCES",
    description: "A few thoughtful controls for the way your study space feels.",
    emptyTitle: "Your settings, your space",
    emptyDescription:
      "Appearance can be adjusted from the top bar. Data and storage preferences will be added alongside local persistence.",
    icon: Settings2,
  },
];
