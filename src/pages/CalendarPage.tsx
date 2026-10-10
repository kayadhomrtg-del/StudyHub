import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanel";
import { moduleService } from "../features/modules/ModuleService";
import type { ModuleRecord } from "../features/modules/module";
import { taskService } from "../features/tasks/TaskService";
import type { TaskRecord } from "../features/tasks/task";
import { studySessionService } from "../features/studySessions/StudySessionService";
import { getMonthGrid, localDateKey, startOfLocalDay } from "../features/studySessions/localDateTime";
import type { StudySessionRecord } from "../features/studySessions/studySession";

type CalendarView = "month" | "agenda";
type CalendarFilter = "all" | "tasks" | "sessions";
type CalendarItem =
  | { kind: "task"; id: string; title: string; start: string; record: TaskRecord }
  | { kind: "session"; id: string; title: string; start: string; record: StudySessionRecord };

function monthTitle(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function dateTitle(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function CalendarPage() {
  const [month, setMonth] = useState(() => startOfLocalDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(new Date()));
  const [view, setView] = useState<CalendarView>("month");
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [allModules, allTasks, allSessions] = await Promise.all([
        moduleService.getAll(),
        taskService.getAll(),
        studySessionService.getAll(),
      ]);
      setModules(allModules);
      setTasks(allTasks);
      setSessions(allSessions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Calendar data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const items = useMemo<CalendarItem[]>(() => {
    const taskItems: CalendarItem[] = filter === "sessions" ? [] : tasks
      .filter((task) => task.dueAt)
      .filter((task) => moduleFilter === "all" || task.moduleId === moduleFilter)
      .map((record) => ({ kind: "task", id: record.id, title: record.title, start: record.dueAt!, record }));
    const sessionItems: CalendarItem[] = filter === "tasks" ? [] : sessions
      .filter((session) => moduleFilter === "all" || session.moduleId === moduleFilter)
      .map((record) => ({ kind: "session", id: record.id, title: record.title, start: record.plannedStart, record }));
    return [...taskItems, ...sessionItems].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  }, [filter, moduleFilter, sessions, tasks]);

  const monthDays = useMemo(() => getMonthGrid(month), [month]);
  const selectedKey = localDateKey(selectedDate);
  const agendaItems = items.filter((item) => localDateKey(new Date(item.start)) === selectedKey);

  function moveMonth(amount: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    setMonth(next);
    setSelectedDate(next);
  }

  if (loading) return <LoadingState label="Loading calendar" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(2024, 0, 1 + index)),
  );

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">YOUR TIME</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">Calendar</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">View task deadlines and planned study sessions by date. Manage sessions in your <Link className="font-semibold text-brand hover:text-brand-strong" to="/planner">study planner</Link>.</p>
        </div>
      </header>
      <section aria-label="Calendar" className="rounded-[22px] border border-line bg-surface p-3 shadow-panel sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button aria-label="Previous month" className="grid size-9 place-items-center rounded-lg border border-line text-ink hover:bg-subtle" onClick={() => moveMonth(-1)} type="button"><ChevronLeft aria-hidden="true" size={16} /></button>
            <h2 aria-live="polite" className="min-w-36 text-center text-[15px] font-semibold text-ink">{monthTitle(month)}</h2>
            <button aria-label="Next month" className="grid size-9 place-items-center rounded-lg border border-line text-ink hover:bg-subtle" onClick={() => moveMonth(1)} type="button"><ChevronRight aria-hidden="true" size={16} /></button>
            <button className="rounded-lg px-2 py-2 text-[10px] font-medium text-brand hover:bg-brand-soft" onClick={() => { const today = startOfLocalDay(new Date()); setMonth(today); setSelectedDate(today); }} type="button">Today</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="calendar-module-filter">Filter by module</label>
            <select className="rounded-lg border border-line bg-canvas px-2.5 py-2 text-[10px] text-ink" id="calendar-module-filter" onChange={(event) => setModuleFilter(event.target.value)} value={moduleFilter}>
              <option value="all">All modules</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
            </select>
            <label className="sr-only" htmlFor="calendar-item-filter">Filter by item type</label>
            <select className="rounded-lg border border-line bg-canvas px-2.5 py-2 text-[10px] text-ink" id="calendar-item-filter" onChange={(event) => setFilter(event.target.value as CalendarFilter)} value={filter}>
              <option value="all">Tasks & sessions</option><option value="tasks">Tasks only</option><option value="sessions">Sessions only</option>
            </select>
            <div aria-label="Calendar view" className="flex rounded-lg border border-line bg-canvas p-1" role="group">
              <button aria-pressed={view === "month"} className="rounded-md px-2.5 py-1.5 text-[10px] text-ink aria-pressed:bg-surface aria-pressed:shadow-soft" onClick={() => setView("month")} type="button">Month</button>
              <button aria-pressed={view === "agenda"} className="rounded-md px-2.5 py-1.5 text-[10px] text-ink aria-pressed:bg-surface aria-pressed:shadow-soft" onClick={() => setView("agenda")} type="button">Agenda</button>
            </div>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-4 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-amber-500" />Task due date</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-brand" />Study session (managed in Planner)</span>
        </div>
        {view === "month" ? (
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line">
            {weekDays.map((day) => <div className="border-b border-line bg-canvas px-1 py-2 text-center text-[9px] font-semibold uppercase tracking-wide text-muted sm:py-2.5 sm:text-[10px]" key={day}>{day}</div>)}
            {monthDays.map((day) => {
              const key = localDateKey(day);
              const dayItems = items.filter((item) => localDateKey(new Date(item.start)) === key);
              const inMonth = day.getMonth() === month.getMonth();
              return (
                <div
                  aria-label={`${dateTitle(day)}, ${dayItems.length} calendar items`}
                  className={`min-h-20 min-w-0 border-b border-r border-line p-1 text-left align-top sm:min-h-28 sm:p-2 ${inMonth ? "bg-surface" : "bg-canvas/60 text-muted"} ${key === selectedKey ? "ring-1 ring-inset ring-brand" : ""}`}
                  key={key}
                >
                  <button
                    aria-label={`Select ${dateTitle(day)}, ${dayItems.length} calendar items`}
                    aria-pressed={key === selectedKey}
                    className={`mb-1 grid size-6 place-items-center rounded-full text-[10px] ${key === localDateKey(new Date()) ? "bg-brand text-white" : "text-ink"}`}
                    onClick={() => { setSelectedDate(day); setView("agenda"); }}
                    type="button"
                  >{day.getDate()}</button>
                  <div className="space-y-1">
                    {dayItems.slice(0, 2).map((item) => item.kind === "task"
                      ? <Link className="block truncate rounded-md border-l-2 border-amber-500 bg-amber-50 px-1.5 py-1 text-left text-[10px] text-amber-950 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-100" key={`task-${item.id}`} title={`${timeLabel(item.start)} · ${item.title} (task due)`} to={`/tasks?taskId=${encodeURIComponent(item.id)}`}>{timeLabel(item.start)} · {item.title}</Link>
                      : <Link className="block truncate rounded-md border-l-2 border-brand bg-brand-soft px-1.5 py-1 text-left text-[10px] text-ink hover:text-brand" key={`session-${item.id}`} title={`${timeLabel(item.start)} · ${item.title} (open in study planner)`} to={`/planner?sessionId=${encodeURIComponent(item.id)}`}>{timeLabel(item.start)} · {item.title}</Link>)}
                    {dayItems.length > 2 && <span className="block px-1 text-[9px] text-muted">+{dayItems.length - 2} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <section aria-labelledby="agenda-heading" className="min-h-52 rounded-xl border border-line bg-canvas p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">{monthTitle(month)}</p>
                <h3 className="mt-1 text-[14px] font-semibold text-ink" id="agenda-heading">{dateTitle(selectedDate)}</h3>
              </div>
              <button aria-label="Return to month view" className="rounded-lg px-3 py-2 text-[10px] font-medium text-brand hover:bg-brand-soft" onClick={() => setView("month")} type="button">Month view</button>
            </div>
            {agendaItems.length ? <ul className="space-y-2">{agendaItems.map((item) => (
              <li className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3" key={`${item.kind}-${item.id}`}>
                <time className="w-16 shrink-0 pt-1 text-[10px] font-medium text-muted" dateTime={item.start}>{timeLabel(item.start)}</time>
                <div className="min-w-0 flex-1">
                  {item.kind === "task"
                    ? <Link className="text-[12px] font-semibold text-ink hover:text-brand" to={`/tasks?taskId=${encodeURIComponent(item.id)}`}>{item.title}</Link>
                    : <Link className="text-[12px] font-semibold text-ink hover:text-brand" to={`/planner?sessionId=${encodeURIComponent(item.id)}`}>{item.title}</Link>}
                  <p className="mt-1 text-[10px] text-muted">{item.kind === "task" ? "Task due" : `${item.record.plannedDurationMinutes} min study session · ${modules.find((module) => module.id === item.record.moduleId)?.name ?? "Unlinked module"} · ${item.record.status}`}</p>
                  {item.kind === "session" && item.record.goal && <p className="mt-1 text-[10px] text-muted">{item.record.goal}</p>}
                </div>
                {item.kind === "task" && <Clock3 aria-hidden="true" className="mt-1 shrink-0 text-amber-600" size={14} />}
              </li>
            ))}</ul> : <EmptyState compact description="No tasks or study sessions match this date and the selected filters." icon={<CalendarDays aria-hidden="true" size={18} />} title="Nothing planned for this day" />}
          </section>
        )}
      </section>
    </div>
  );
}
