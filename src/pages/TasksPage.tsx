import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarClock, Check, Circle, FilePlus2, Pencil, Search, Trash2, X } from "lucide-react";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanel";
import { materialService } from "../features/materials/MaterialService";
import type { MaterialRecord } from "../features/materials/material";
import { moduleService } from "../features/modules/ModuleService";
import type { ModuleRecord } from "../features/modules/module";
import { topicService } from "../features/topics/TopicService";
import type { TopicRecord } from "../features/topics/topic";
import { emptyTaskInput, taskPriorities, taskStatuses, taskTypes, taskService, type TaskInput } from "../features/tasks/TaskService";
import { getTaskDateState, type TaskRecord } from "../features/tasks/task";
import { filterTasks, type TaskDateFilter, type TaskSortMode } from "../features/tasks/taskFilters";

const statusLabels: Record<TaskInput["status"], string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
  submitted: "Submitted",
};
const typeLabels: Record<TaskInput["type"], string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  exam: "Exam",
  reading: "Reading",
  revision: "Revision",
  project: "Project",
  personal: "Personal",
};

function formatDue(dueAt: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(dueAt));
}

function toLocalDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function TaskForm({
  initial,
  modules,
  topics,
  materials,
  onCancel,
  onSave,
}: {
  initial: TaskRecord | null;
  modules: ModuleRecord[];
  topics: TopicRecord[];
  materials: MaterialRecord[];
  onCancel: () => void;
  onSave: (input: TaskInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<TaskInput>(() => initial ? {
    title: initial.title,
    description: initial.description,
    moduleId: initial.moduleId ?? "",
    topicId: initial.topicId ?? "",
    dueAt: toLocalDateTime(initial.dueAt),
    priority: initial.priority,
    status: initial.status,
    type: initial.type,
    linkedMaterialIds: initial.linkedMaterialIds,
    tags: initial.tags,
  } : emptyTaskInput());
  const [tagText, setTagText] = useState(() => initial?.tags.join(", ") ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const moduleTopics = topics.filter((topic) => topic.moduleId === draft.moduleId);

  function patch(values: Partial<TaskInput>) {
    setDraft((current) => ({ ...current, ...values }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({
        ...draft,
        dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : "",
        tags: tagText.split(","),
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The task could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="task-form-heading" className="rounded-[22px] border border-line bg-surface p-4 shadow-panel sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink" id="task-form-heading">{initial ? "Edit task" : "New task"}</h2>
        <button aria-label="Close task form" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-subtle" onClick={onCancel} type="button"><X aria-hidden="true" size={16} /></button>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">{error}</p>}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <label className="text-[11px] font-medium text-muted sm:col-span-2">Title
          <input autoFocus className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] text-ink" maxLength={200} onChange={(event) => patch({ title: event.target.value })} required value={draft.title} />
        </label>
        <label className="text-[11px] font-medium text-muted sm:col-span-2">Description
          <textarea className="mt-1.5 min-h-20 w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" maxLength={10000} onChange={(event) => patch({ description: event.target.value })} value={draft.description} />
        </label>
        <label className="text-[11px] font-medium text-muted">Type
          <select className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" onChange={(event) => patch({ type: event.target.value as TaskInput["type"] })} value={draft.type}>
            {taskTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Due date and time (optional)
          <input aria-label="Due date and time" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" onChange={(event) => patch({ dueAt: event.target.value })} type="datetime-local" value={draft.dueAt} />
        </label>
        <label className="text-[11px] font-medium text-muted">Priority
          <select aria-label="Task priority" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" onChange={(event) => patch({ priority: event.target.value as TaskInput["priority"] })} value={draft.priority}>
            {taskPriorities.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Status
          <select aria-label="Task status" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" onChange={(event) => patch({ status: event.target.value as TaskInput["status"] })} value={draft.status}>
            {taskStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Module (optional)
          <select aria-label="Task module" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" onChange={(event) => patch({ moduleId: event.target.value, topicId: "" })} value={draft.moduleId}>
            <option value="">No module</option>
            {modules.map((module) => <option key={module.id} value={module.id}>{module.name} ({module.code})</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Topic (optional)
          <select aria-label="Task topic" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink disabled:opacity-60" disabled={!draft.moduleId} onChange={(event) => patch({ topicId: event.target.value })} value={draft.topicId}>
            <option value="">No topic</option>
            {moduleTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Linked materials (optional)
          <select aria-label="Linked materials" className="mt-1.5 min-h-24 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-ink" multiple onChange={(event) => patch({ linkedMaterialIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })} value={draft.linkedMaterialIds}>
            {materials.map((material) => <option key={material.id} value={material.id}>{material.originalFileName}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Tags (comma separated)
          <input aria-label="Task tags" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" onChange={(event) => setTagText(event.target.value)} placeholder="lab, exam prep" value={tagText} />
        </label>
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <button className="rounded-lg border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-subtle" onClick={onCancel} type="button">Cancel</button>
          <button className="rounded-lg bg-brand px-4 py-2 text-[11px] font-semibold text-white hover:bg-brand-strong disabled:opacity-60" disabled={saving} type="submit">{saving ? "Saving…" : initial ? "Save changes" : "Create task"}</button>
        </div>
      </form>
    </section>
  );
}

export function TasksPage() {
  const [searchParams] = useSearchParams();
  const handledTaskQuery = useRef("");
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<TaskDateFilter>("all");
  const [sortMode, setSortMode] = useState<TaskSortMode>("due");
  const [editing, setEditing] = useState<TaskRecord | null | false>(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [allTasks, allModules, allMaterials] = await Promise.all([
        taskService.getAll(), moduleService.getAll(), materialService.getAll(),
      ]);
      const allTopics = (await Promise.all(allModules.map((module) => topicService.getByModule(module.id)))).flat();
      setTasks(allTasks);
      setModules(allModules);
      setMaterials(allMaterials);
      setTopics(allTopics);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Your tasks could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const requestedTaskId = searchParams.get("taskId");
    if (!loading && requestedTaskId && handledTaskQuery.current !== requestedTaskId) {
      handledTaskQuery.current = requestedTaskId;
      const task = tasks.find((item) => item.id === requestedTaskId);
      if (task) setEditing(task);
    }
  }, [loading, searchParams, tasks]);

  const labels = useMemo(() => Object.fromEntries([
    ...modules.map((module) => [module.id, module.name] as const),
    ...materials.map((material) => [material.id, material.originalFileName] as const),
  ]), [materials, modules]);
  const filteredTasks = useMemo(() => filterTasks(tasks, {
    search, status: statusFilter, type: typeFilter, moduleId: moduleFilter, date: dateFilter, sort: sortMode,
  }, labels), [dateFilter, labels, moduleFilter, search, sortMode, statusFilter, tasks, typeFilter]);

  async function saveTask(input: TaskInput) {
    const saved = editing ? await taskService.update(editing.id, input) : await taskService.create(input);
    setTasks((current) => editing
      ? current.map((task) => task.id === saved.id ? saved : task)
      : [saved, ...current]);
    setEditing(false);
  }

  async function changeTask(action: () => Promise<TaskRecord>) {
    setOperationError("");
    try {
      const updated = await action();
      setTasks((current) => current.map((task) => task.id === updated.id ? updated : task));
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "The task could not be updated.");
    }
  }

  async function deleteTask() {
    if (!deleteTarget) return;
    try {
      await taskService.delete(deleteTarget.id);
      setTasks((current) => current.filter((task) => task.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "The task could not be deleted.");
    }
  }

  if (loading) return <LoadingState label="Loading tasks" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />;

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">YOUR COMMITMENTS</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">Tasks</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">Keep assignments and study goals organized on this device.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong" onClick={() => setEditing(null)} type="button"><FilePlus2 aria-hidden="true" size={15} />New task</button>
      </header>
      {operationError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">{operationError}</p>}
      {editing !== false && <TaskForm initial={editing} materials={materials} modules={modules} onCancel={() => setEditing(false)} onSave={saveTask} topics={topics} />}
      <section aria-label="Task list" className="rounded-[22px] border border-line bg-surface p-3 shadow-panel sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-muted xl:col-span-2">
            <Search aria-hidden="true" size={14} /><span className="sr-only">Search tasks</span>
            <input aria-label="Search tasks" className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none" onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" type="search" value={search} />
          </label>
          <select aria-label="Filter by status" className="rounded-lg border border-line bg-canvas px-2 py-2 text-[11px] text-ink" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value="all">All statuses</option>{taskStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
          <select aria-label="Filter by type" className="rounded-lg border border-line bg-canvas px-2 py-2 text-[11px] text-ink" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}><option value="all">All types</option>{taskTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select>
          <select aria-label="Filter by module" className="rounded-lg border border-line bg-canvas px-2 py-2 text-[11px] text-ink" onChange={(event) => setModuleFilter(event.target.value)} value={moduleFilter}><option value="all">All modules</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}</select>
          <select aria-label="Filter by due date" className="rounded-lg border border-line bg-canvas px-2 py-2 text-[11px] text-ink" onChange={(event) => setDateFilter(event.target.value as TaskDateFilter)} value={dateFilter}><option value="all">Any due date</option><option value="overdue">Overdue</option><option value="upcoming">Upcoming</option><option value="undated">No due date</option></select>
          <label className="text-[10px] text-muted xl:col-start-6">Sort by
            <select aria-label="Sort tasks" className="mt-1 w-full rounded-lg border border-line bg-canvas px-2 py-2 text-[11px] text-ink" onChange={(event) => setSortMode(event.target.value as TaskSortMode)} value={sortMode}><option value="due">Due date</option><option value="priority">Priority</option><option value="updated">Recently updated</option></select>
          </label>
        </div>
        <div className="mt-3 space-y-2">
          {filteredTasks.map((task) => {
            const dateState = getTaskDateState(task);
            return (
              <article className="rounded-xl border border-line bg-canvas p-3 sm:p-4" key={task.id}>
                <div className="flex flex-wrap items-start gap-3">
                  <button aria-label={task.status === "completed" ? `Reopen ${task.title}` : `Mark ${task.title} complete`} className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border ${task.status === "completed" ? "border-brand bg-brand text-white" : "border-line text-muted hover:border-brand hover:text-brand"}`} onClick={() => void changeTask(() => taskService.setStatus(task.id, task.status === "completed" ? "not-started" : "completed"))} type="button">{task.status === "completed" ? <Check aria-hidden="true" size={15} /> : <Circle aria-hidden="true" size={15} />}</button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className={`text-[13px] font-semibold text-ink ${task.status === "completed" ? "line-through opacity-65" : ""}`}>{task.title}</h2>
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[9px] font-medium text-brand">{typeLabels[task.type]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${task.priority === "high" ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200" : task.priority === "medium" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" : "bg-subtle text-muted"}`}>{task.priority} priority</span>
                    </div>
                    {task.description && <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-muted">{task.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                      <span className="capitalize">{statusLabels[task.status]}</span>
                      {task.moduleId && <span>{modules.find((module) => module.id === task.moduleId)?.name ?? "Unlinked module"}{task.topicId ? ` · ${topics.find((topic) => topic.id === task.topicId)?.title ?? "Unlinked topic"}` : ""}</span>}
                      {task.dueAt && <span className={`inline-flex items-center gap-1 ${dateState === "overdue" ? "font-semibold text-red-700 dark:text-red-300" : dateState === "upcoming" ? "text-brand" : ""}`}><CalendarClock aria-hidden="true" size={12} />{dateState === "overdue" ? "Overdue · " : dateState === "upcoming" ? "Upcoming · " : ""}{formatDue(task.dueAt)}</span>}
                      {task.linkedMaterialIds.map((id) => <span key={id}>File: {materials.find((material) => material.id === id)?.originalFileName ?? "Missing material"}</span>)}
                      {task.tags.map((tag) => <span className="text-brand" key={tag}>#{tag}</span>)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <label className="sr-only" htmlFor={`status-${task.id}`}>Status for {task.title}</label>
                    <select className="max-w-32 rounded-lg border border-line bg-surface px-2 py-2 text-[10px] text-ink" id={`status-${task.id}`} onChange={(event) => void changeTask(() => taskService.setStatus(task.id, event.target.value as TaskInput["status"]))} value={task.status}>{taskStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
                    <label className="sr-only" htmlFor={`priority-${task.id}`}>Priority for {task.title}</label>
                    <select className="max-w-24 rounded-lg border border-line bg-surface px-2 py-2 text-[10px] text-ink" id={`priority-${task.id}`} onChange={(event) => void changeTask(() => taskService.setPriority(task.id, event.target.value as TaskInput["priority"]))} value={task.priority}>{taskPriorities.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select>
                    <button aria-label={`Edit ${task.title}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-brand" onClick={() => setEditing(task)} type="button"><Pencil aria-hidden="true" size={14} /></button>
                    <button aria-label={`Delete ${task.title}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300" onClick={() => setDeleteTarget(task)} type="button"><Trash2 aria-hidden="true" size={14} /></button>
                  </div>
                </div>
              </article>
            );
          })}
          {filteredTasks.length === 0 && <EmptyState compact description={tasks.length ? "Try changing the filters or search terms." : "Add assignments, exams, readings, and personal study tasks. Dates are optional."} icon={tasks.length ? <AlertTriangle aria-hidden="true" size={18} /> : <CalendarClock aria-hidden="true" size={18} />} title={tasks.length ? "No matching tasks" : "Nothing on your list"} />}
        </div>
      </section>
      <ConfirmationDialog cancelLabel="Keep task" confirmLabel="Delete task" description={`“${deleteTarget?.title ?? "This task"}” will be deleted from this device.`} onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteTask()} open={Boolean(deleteTarget)} title="Delete this task?" />
    </div>
  );
}
