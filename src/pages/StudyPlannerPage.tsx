import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, Clock3, FileText, Plus, SkipForward, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanel";
import { materialService } from "../features/materials/MaterialService";
import type { MaterialRecord } from "../features/materials/material";
import { moduleService } from "../features/modules/ModuleService";
import type { ModuleRecord } from "../features/modules/module";
import { topicService } from "../features/topics/TopicService";
import type { TopicRecord } from "../features/topics/topic";
import { StudySessionForm } from "../features/studySessions/StudySessionForm";
import { studySessionService } from "../features/studySessions/StudySessionService";
import type { StudySessionInput, StudySessionRecord, StudySessionStatus } from "../features/studySessions/studySession";

function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export function StudyPlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSessionId = searchParams.get("sessionId");
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [editing, setEditing] = useState<StudySessionRecord | null | false>(false);
  const [deleteTarget, setDeleteTarget] = useState<StudySessionRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [allSessions, allModules, allMaterials] = await Promise.all([
        studySessionService.getAll(),
        moduleService.getAll(),
        materialService.getAll(),
      ]);
      const allTopics = (await Promise.all(allModules.map((module) => topicService.getByModule(module.id)))).flat();
      setSessions(allSessions);
      setModules(allModules);
      setMaterials(allMaterials);
      setTopics(allTopics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Study sessions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedSessionId || loading || error) return;
    const match = sessions.find((session) => session.id === selectedSessionId);
    if (match) {
      setEditing(match);
      setOperationError("");
    } else {
      setEditing(false);
      setOperationError("That study session could not be found. It may have been deleted.");
    }
  }, [error, loading, searchParams, selectedSessionId, sessions]);

  function closeEditor() {
    setEditing(false);
    if (selectedSessionId) setSearchParams({}, { replace: true });
  }

  async function saveSession(input: StudySessionInput) {
    const saved = editing
      ? await studySessionService.update(editing.id, input)
      : await studySessionService.create(input);
    setSessions((current) => editing
      ? current.map((session) => session.id === saved.id ? saved : session)
      : [...current, saved]);
    setOperationError("");
    setEditing(false);
    if (selectedSessionId) setSearchParams({}, { replace: true });
  }

  async function setStatus(session: StudySessionRecord, status: StudySessionStatus) {
    setOperationError("");
    try {
      const updated = await studySessionService.setStatus(session.id, status);
      setSessions((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (statusError) {
      setOperationError(statusError instanceof Error ? statusError.message : "The session status could not be changed.");
    }
  }

  async function deleteSession() {
    if (!deleteTarget) return;
    try {
      await studySessionService.delete(deleteTarget.id);
      setSessions((current) => current.filter((session) => session.id !== deleteTarget.id));
      if (selectedSessionId === deleteTarget.id) closeEditor();
      setDeleteTarget(null);
      setOperationError("");
    } catch (deleteError) {
      setOperationError(deleteError instanceof Error ? deleteError.message : "The study session could not be deleted.");
    }
  }

  if (loading) return <LoadingState label="Loading study planner" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  const orderedSessions = [...sessions].sort((left, right) =>
    Date.parse(left.plannedStart) - Date.parse(right.plannedStart),
  );

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">YOUR ROUTINE</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">Study planner</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">Plan and manage study sessions. Your planned times use this device’s local timezone.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong" onClick={() => { setEditing(null); setOperationError(""); }} type="button">
          <Plus aria-hidden="true" size={15} />Plan session
        </button>
      </header>

      {operationError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">{operationError}</p>}
      {editing !== false && <StudySessionForm
        initial={editing}
        materials={materials}
        modules={modules}
        onCancel={closeEditor}
        onSave={saveSession}
        topics={topics}
      />}

      <section aria-labelledby="planner-sessions-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">YOUR SCHEDULE</p>
            <h2 className="mt-1 text-[16px] font-semibold text-ink" id="planner-sessions-heading">Study sessions</h2>
          </div>
          <Link className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand hover:text-brand-strong" to="/calendar">
            <CalendarDays aria-hidden="true" size={14} />Open calendar
          </Link>
        </div>
        {orderedSessions.length ? <ul className="space-y-3">
          {orderedSessions.map((session) => {
            const module = modules.find((item) => item.id === session.moduleId);
            return (
              <li className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5" key={session.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => {
                    setSearchParams({ sessionId: session.id });
                    setEditing(session);
                  }} type="button">
                    <span className="block truncate text-[13px] font-semibold text-ink hover:text-brand">{session.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                      <span className="inline-flex items-center gap-1"><Clock3 aria-hidden="true" size={12} />{formatSessionDate(session.plannedStart)} · {session.plannedDurationMinutes} min</span>
                      <span>{module?.name ?? "Unlinked module"}</span>
                      <span className="capitalize">{session.status}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {session.status !== "completed" && <button className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-medium text-brand hover:bg-brand-soft" onClick={() => void setStatus(session, "completed")} type="button"><Check aria-hidden="true" size={12} />Complete</button>}
                    {session.status !== "skipped" && <button className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-medium text-muted hover:bg-subtle" onClick={() => void setStatus(session, "skipped")} type="button"><SkipForward aria-hidden="true" size={12} />Skip</button>}
                    <button aria-label={`Delete ${session.title}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" onClick={() => setDeleteTarget(session)} type="button"><Trash2 aria-hidden="true" size={14} /></button>
                  </div>
                </div>
                {(session.goal || session.materialId) && <div className="mt-3 flex flex-wrap items-start justify-between gap-2 border-t border-line pt-3">
                  {session.goal && <p className="max-w-2xl text-[11px] leading-5 text-muted">{session.goal}</p>}
                  {session.materialId && <Link className="inline-flex items-center gap-1 text-[10px] font-medium text-brand hover:text-brand-strong" to={`/materials/${session.materialId}`}><FileText aria-hidden="true" size={12} />Open material</Link>}
                </div>}
              </li>
            );
          })}
        </ul> : <EmptyState
          description="Plan a session to reserve time for a module, topic, or material. It will also appear on your calendar."
          icon={<CalendarDays aria-hidden="true" size={19} />}
          title="No study sessions planned"
          action={<button className="rounded-lg bg-brand px-3 py-2 text-[11px] font-semibold text-white hover:bg-brand-strong" onClick={() => setEditing(null)} type="button">Plan your first session</button>}
        />}
      </section>

      <ConfirmationDialog cancelLabel="Keep session" confirmLabel="Delete session" description={`“${deleteTarget?.title ?? "This session"}” will be removed from this device.`} onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteSession()} open={Boolean(deleteTarget)} title="Delete this study session?" />
    </div>
  );
}
