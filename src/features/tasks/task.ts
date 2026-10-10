export const taskPriorities = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof taskPriorities)[number];

export const taskStatuses = [
  "not-started",
  "in-progress",
  "blocked",
  "completed",
  "submitted",
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskTypes = [
  "assignment",
  "quiz",
  "exam",
  "reading",
  "revision",
  "project",
  "personal",
] as const;
export type TaskType = (typeof taskTypes)[number];

export interface TaskInput {
  title: string;
  description: string;
  moduleId: string;
  topicId: string;
  dueAt: string;
  priority: TaskPriority;
  status: TaskStatus;
  type: TaskType;
  linkedMaterialIds: string[];
  tags: string[];
}

export interface TaskRecord extends Omit<TaskInput, "moduleId" | "topicId" | "dueAt"> {
  id: string;
  moduleId?: string;
  topicId?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type TaskDateState = "overdue" | "upcoming" | "none" | "closed";

export function getTaskDateState(task: TaskRecord, now = Date.now()): TaskDateState {
  if (task.status === "completed" || task.status === "submitted") return "closed";
  if (!task.dueAt) return "none";
  return Date.parse(task.dueAt) < now ? "overdue" : "upcoming";
}
