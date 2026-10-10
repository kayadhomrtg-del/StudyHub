import { getTaskDateState, type TaskRecord } from "./task";

export type TaskDateFilter = "all" | "overdue" | "upcoming" | "undated";
export type TaskSortMode = "due" | "priority" | "updated";

export interface TaskFilters {
  search: string;
  status: string;
  type: string;
  moduleId: string;
  date: TaskDateFilter;
  sort: TaskSortMode;
}

export function filterTasks(
  tasks: TaskRecord[],
  filters: TaskFilters,
  labels: Record<string, string>,
  now = Date.now(),
): TaskRecord[] {
  const needle = filters.search.trim().toLocaleLowerCase();
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return tasks.filter((task) => {
    const matchesText = !needle ||
      [task.title, task.description, ...task.tags, labels[task.moduleId ?? ""] ?? "",
        ...task.linkedMaterialIds.map((id) => labels[id] ?? "")]
        .some((value) => value.toLocaleLowerCase().includes(needle));
    return matchesText &&
      (filters.status === "all" || task.status === filters.status) &&
      (filters.type === "all" || task.type === filters.type) &&
      (filters.moduleId === "all" || task.moduleId === filters.moduleId) &&
      (filters.date === "all" ||
        (filters.date === "undated" && !task.dueAt) ||
        (filters.date === "overdue" && getTaskDateState(task, now) === "overdue") ||
        (filters.date === "upcoming" && getTaskDateState(task, now) === "upcoming"));
  }).sort((left, right) => {
    if (filters.sort === "priority") {
      return priorityOrder[left.priority] - priorityOrder[right.priority] || left.title.localeCompare(right.title);
    }
    if (filters.sort === "updated") return right.updatedAt.localeCompare(left.updatedAt);
    return (left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY) -
      (right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY);
  });
}
