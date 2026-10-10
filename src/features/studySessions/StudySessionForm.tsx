import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { localDateTimeToIso, toLocalDateTimeInput } from "./localDateTime";
import { emptyStudySessionInput, type StudySessionInput, type StudySessionRecord } from "./studySession";
import type { MaterialRecord } from "../materials/material";
import type { ModuleRecord } from "../modules/module";
import type { TopicRecord } from "../topics/topic";

export function StudySessionForm({
  initial,
  modules,
  topics,
  materials,
  onCancel,
  onSave,
}: {
  initial: StudySessionRecord | null;
  modules: ModuleRecord[];
  topics: TopicRecord[];
  materials: MaterialRecord[];
  onCancel: () => void;
  onSave: (input: StudySessionInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<StudySessionInput>(() => initial ? {
    moduleId: initial.moduleId ?? "",
    topicId: initial.topicId ?? "",
    materialId: initial.materialId ?? "",
    title: initial.title,
    plannedStart: toLocalDateTimeInput(initial.plannedStart),
    plannedDurationMinutes: initial.plannedDurationMinutes,
    goal: initial.goal ?? "",
    status: initial.status,
    actualDurationMinutes: initial.actualDurationMinutes,
  } : {
    ...emptyStudySessionInput(),
    plannedStart: toLocalDateTimeInput(new Date().toISOString()),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const sessionTopics = topics.filter((topic) => topic.moduleId === draft.moduleId);
  const sessionMaterials = materials.filter((material) => !material.moduleId || material.moduleId === draft.moduleId);

  function patch(values: Partial<StudySessionInput>) {
    setDraft((current) => ({ ...current, ...values }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      localDateTimeToIso(draft.plannedStart);
      await onSave(draft);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The study session could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="session-form-heading" className="rounded-[22px] border border-line bg-surface p-4 shadow-panel sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink" id="session-form-heading">{initial ? "Edit study session" : "Plan a study session"}</h2>
        <button aria-label="Close session form" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-subtle" onClick={onCancel} type="button"><X aria-hidden="true" size={16} /></button>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">{error}</p>}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <label className="text-[11px] font-medium text-muted sm:col-span-2">Title
          <input autoFocus className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] text-ink" maxLength={200} onChange={(event) => patch({ title: event.target.value })} required value={draft.title} />
        </label>
        <label className="text-[11px] font-medium text-muted">Module
          <select aria-label="Session module" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" onChange={(event) => patch({ moduleId: event.target.value, topicId: "", materialId: "" })} required={!initial || Boolean(initial.moduleId)} value={draft.moduleId}>
            <option value="">{initial && !initial.moduleId ? "No module (unlinked)" : "Choose a module"}</option>
            {modules.map((module) => <option key={module.id} value={module.id}>{module.name} ({module.code})</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Planned start (your local time)
          <input aria-label="Planned start" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" onChange={(event) => patch({ plannedStart: event.target.value })} required type="datetime-local" value={draft.plannedStart} />
        </label>
        <label className="text-[11px] font-medium text-muted">Planned duration (minutes)
          <input aria-label="Planned duration" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" min={1} onChange={(event) => patch({ plannedDurationMinutes: Number(event.target.value) })} required type="number" value={draft.plannedDurationMinutes} />
        </label>
        <label className="text-[11px] font-medium text-muted">Status
          <select aria-label="Session status" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" onChange={(event) => patch({ status: event.target.value as StudySessionInput["status"] })} value={draft.status}>
            <option value="planned">Planned</option><option value="completed">Completed</option><option value="skipped">Skipped</option>
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Topic (optional)
          <select aria-label="Session topic" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink disabled:opacity-60" disabled={!draft.moduleId} onChange={(event) => patch({ topicId: event.target.value })} value={draft.topicId}>
            <option value="">No topic</option>{sessionTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Material (optional)
          <select aria-label="Session material" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink disabled:opacity-60" disabled={!draft.moduleId} onChange={(event) => patch({ materialId: event.target.value })} value={draft.materialId}>
            <option value="">No material</option>{sessionMaterials.map((material) => <option key={material.id} value={material.id}>{material.originalFileName}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-medium text-muted">Goal (optional)
          <input className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" maxLength={2000} onChange={(event) => patch({ goal: event.target.value })} value={draft.goal} />
        </label>
        <label className="text-[11px] font-medium text-muted">Actual duration (minutes, optional)
          <input aria-label="Actual duration" className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink" min={0} onChange={(event) => patch({ actualDurationMinutes: event.target.value === "" ? null : Number(event.target.value) })} type="number" value={draft.actualDurationMinutes ?? ""} />
        </label>
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <button className="rounded-lg border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-subtle" onClick={onCancel} type="button">Cancel</button>
          <button className="rounded-lg bg-brand px-4 py-2 text-[11px] font-semibold text-white hover:bg-brand-strong disabled:opacity-60" disabled={saving} type="submit">{saving ? "Saving…" : initial ? "Save session" : "Plan session"}</button>
        </div>
      </form>
    </section>
  );
}
