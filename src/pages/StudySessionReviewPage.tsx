import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpLeft, BookOpenCheck, Eye, EyeOff, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { ErrorState, LoadingState } from "../components/ui/StatePanel";
import { noteService } from "../features/notes/NoteService";
import type { NoteDraft, NoteRecord } from "../features/notes/note";
import { studySessionService } from "../features/studySessions/StudySessionService";
import { loadStudySessionSource, type StudySessionSource } from "../features/studySessions/studySessionSource";

type SaveState = "empty" | "unsaved" | "saved";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function StudySessionReviewPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const requestId = useRef(0);
  const actionInProgress = useRef(false);
  const attemptRef = useRef("");
  const savedAttempt = useRef<string | null>(null);
  const [source, setSource] = useState<StudySessionSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState("");
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("empty");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sourceVisible, setSourceVisible] = useState(false);
  const [actualDuration, setActualDuration] = useState("");
  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setLoadError("");
    setSource(null);
    setAttempt("");
    attemptRef.current = "";
    setSavedNoteId(null);
    savedAttempt.current = null;
    setSaveState("empty");
    setSaveError("");
    setSourceVisible(false);
    setActualDuration("");
    setFinishConfirmationOpen(false);
    setFinishError("");

    try {
      const loadedSource = await loadStudySessionSource(sessionId);
      if (currentRequest !== requestId.current) return;
      setSource(loadedSource);
      setActualDuration(
        loadedSource.session.actualDurationMinutes === null
          ? ""
          : String(loadedSource.session.actualDurationMinutes),
      );
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setLoadError(getErrorMessage(error, "The guided recall workspace could not be loaded."));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  function updateAttempt(value: string) {
    attemptRef.current = value;
    setAttempt(value);
    setSaveState(savedAttempt.current === value && savedAttempt.current !== null
      ? "saved"
      : "unsaved");
    setSaveError("");
  }

  function makeNoteDraft(currentSource: StudySessionSource, markdown: string): NoteDraft {
    return {
      title: `Recall — ${currentSource.session.title}`.slice(0, 200),
      markdown,
      tags: ["recall"],
      isPinned: false,
      link: {
        type: "material",
        id: currentSource.material.id,
        label: currentSource.material.title,
      },
    };
  }

  async function saveCurrentAttempt(): Promise<boolean> {
    if (!source) return false;
    const currentAttempt = attemptRef.current;
    const hasSavedNote = savedNoteId !== null;
    if (!currentAttempt.trim() && !hasSavedNote) return true;
    if (hasSavedNote && savedAttempt.current === currentAttempt) return true;

    setSaving(true);
    setSaveError("");
    try {
      const draft = makeNoteDraft(source, currentAttempt);
      const savedNote: NoteRecord = savedNoteId
        ? await noteService.saveDraft(savedNoteId, draft)
        : await noteService.createDraft(draft);
      savedAttempt.current = currentAttempt;
      setSavedNoteId(savedNote.id);
      setSaveState(attemptRef.current === currentAttempt ? "saved" : "unsaved");
      return true;
    } catch (error) {
      setSaveState("unsaved");
      setSaveError(getErrorMessage(error, "The recall attempt could not be saved."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAttempt() {
    if (actionInProgress.current || !source) return;
    actionInProgress.current = true;
    try {
      await saveCurrentAttempt();
    } finally {
      actionInProgress.current = false;
    }
  }

  async function handleFinishSession() {
    if (actionInProgress.current || !source) return;
    actionInProgress.current = true;
    setFinishing(true);
    setFinishError("");
    try {
      const currentSession = await studySessionService.getById(source.session.id);
      if (!currentSession) {
        throw new Error("This study session no longer exists.");
      }
      if (currentSession.status !== "planned") {
        throw new Error("This study session is no longer planned and was not changed.");
      }

      if (actualDuration.trim() && (!Number.isSafeInteger(Number(actualDuration)) || Number(actualDuration) < 0)) {
        throw new Error("Actual duration must be zero or more whole minutes.");
      }
      if (!await saveCurrentAttempt()) {
        setFinishConfirmationOpen(false);
        setFinishError("The session was not completed because the recall note could not be saved.");
        return;
      }

      const duration = actualDuration.trim() ? Number(actualDuration) : null;
      await studySessionService.setStatus(source.session.id, "completed", duration);
      navigate("/planner", { replace: true });
    } catch (error) {
      setFinishConfirmationOpen(false);
      setFinishError(getErrorMessage(error, "The study session could not be completed."));
    } finally {
      setFinishing(false);
      actionInProgress.current = false;
    }
  }

  if (loading) return <LoadingState label="Loading guided recall" />;

  if (loadError || !source) {
    return (
      <div className="space-y-4">
        <ErrorState
          message={loadError || "The guided recall source is unavailable."}
          onRetry={() => void load()}
          title="Guided recall unavailable"
        />
        <Link className="inline-flex items-center gap-2 text-[12px] font-medium text-brand hover:underline" to="/planner">
          <ArrowUpLeft aria-hidden="true" size={14} />
          Back to study planner
        </Link>
      </div>
    );
  }

  const hasUnsavedContent = attempt.trim().length > 0;
  const saveDisabled = saving || (!hasUnsavedContent && !savedNoteId) || saveState === "saved";

  return (
    <div className="animate-fade-in space-y-5">
      <Link className="inline-flex items-center gap-2 text-[12px] font-medium text-muted hover:text-brand" to="/planner">
        <ArrowUpLeft aria-hidden="true" size={15} />
        Study planner
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">GUIDED STUDY</p>
        <h1 className="mt-1 break-words text-[22px] font-semibold tracking-[-0.04em] text-ink sm:text-[26px]">
          {source.session.title}
        </h1>
        <p className="mt-2 text-[12px] leading-5 text-muted">
          {source.material.title} · {source.session.plannedDurationMinutes} planned minutes
        </p>
        {source.session.goal && <p className="mt-2 max-w-3xl text-[12px] leading-6 text-ink">{source.session.goal}</p>}
        <p className="mt-3 text-[11px] leading-5 text-muted">
          This is a local active-recall exercise. Write what you remember before revealing the source; compare it yourself. It does not score or assess mastery.
        </p>
      </header>

      {finishError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">{finishError}</p>}

      <section aria-labelledby="recall-attempt-heading" className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-ink" id="recall-attempt-heading">What can you recall?</h2>
            <p className="mt-1 text-[11px] leading-5 text-muted">Try to write from memory without opening the source. Your attempt is not saved until you choose to save it or finish this session.</p>
          </div>
          <p aria-live="polite" className="text-[11px] text-muted" role="status">
            {saving ? "Saving recall note…" : saveState === "saved" ? "Saved to Notes" : saveState === "unsaved" ? "Unsaved changes" : "Not saved"}
          </p>
        </div>
        <label className="mt-4 block text-[11px] font-medium text-muted" htmlFor="recall-attempt">
          Recall attempt
          <textarea
            aria-describedby="recall-save-guidance"
            className="mt-1.5 min-h-48 w-full resize-y rounded-xl border border-line bg-canvas p-4 text-[13px] leading-6 text-ink focus:border-brand focus:ring-brand"
            id="recall-attempt"
            maxLength={1_000_000}
            onChange={(event) => updateAttempt(event.target.value)}
            placeholder="Write the ideas, steps, or explanations you remember…"
            value={attempt}
          />
        </label>
        <p className="mt-1 text-[10px] text-muted" id="recall-save-guidance">
          Recall attempts are saved as ordinary personal notes linked to this material. They are never sent to AI.
        </p>
        {saveError && <p className="mt-3 text-[11px] text-red-700 dark:text-red-300" role="alert">The recall attempt was not saved. {saveError}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saveDisabled}
            onClick={() => void handleSaveAttempt()}
            type="button"
          >
            <Save aria-hidden="true" size={14} />
            {saving ? "Saving…" : savedNoteId ? "Save changes to note" : "Save recall note"}
          </button>
          {savedNoteId && <Link className="text-[11px] font-medium text-brand hover:underline" to={`/notes/${savedNoteId}`}>Open saved note</Link>}
        </div>
      </section>

      <section aria-labelledby="recall-source-heading" className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-ink" id="recall-source-heading">Study source</h2>
            <p className="mt-1 text-[11px] text-muted">The source stays hidden until you reveal it. Your recall attempt remains above for comparison.</p>
          </div>
          <button
            aria-expanded={sourceVisible}
            aria-controls="recall-source-content"
            className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-ink hover:bg-subtle"
            onClick={() => setSourceVisible((visible) => !visible)}
            type="button"
          >
            {sourceVisible ? <EyeOff aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
            {sourceVisible ? "Hide full source" : "Reveal full source"}
          </button>
        </div>
        {source.notes.length > 0 && (
          <ul className="mt-3 space-y-1 text-[10px] leading-5 text-muted">
            {source.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        )}
        <div
          className={sourceVisible ? "mt-4 max-h-[70vh] overflow-auto rounded-xl border border-line bg-canvas p-4 sm:p-5" : "hidden"}
          id="recall-source-content"
        >
          {sourceVisible && <>
            <h3 className="mb-3 text-[12px] font-semibold text-ink">{source.material.originalFileName} — full locally extracted text</h3>
            <pre aria-label="Full extracted source text" className="whitespace-pre-wrap break-words font-sans text-[12px] leading-6 text-ink">{source.text}</pre>
          </>}
        </div>
      </section>

      <section aria-labelledby="finish-session-heading" className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink" id="finish-session-heading">Finish this study session</h2>
          <p className="mt-1 text-[11px] leading-5 text-muted">Finishing is explicit. Revealing the source, saving a note, navigating away, or elapsed time does not complete the session.</p>
          <label className="mt-3 block max-w-xs text-[10px] font-medium text-muted" htmlFor="actual-duration">
            Actual duration (minutes, optional)
            <input
              className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink"
              id="actual-duration"
              min={0}
              onChange={(event) => setActualDuration(event.target.value)}
              step={1}
              type="number"
              value={actualDuration}
            />
          </label>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
          disabled={finishing}
          onClick={() => { setFinishError(""); setFinishConfirmationOpen(true); }}
          type="button"
        >
          <BookOpenCheck aria-hidden="true" size={15} />
          Finish session
        </button>
      </section>

      <ConfirmationDialog
        cancelLabel="Keep studying"
        confirmLabel={finishing ? "Finishing…" : "Finish session"}
        description="Any unsaved recall attempt will first be saved as a note linked to this material. Then this planned study session will be marked completed. No completion happens unless you confirm."
        onCancel={() => setFinishConfirmationOpen(false)}
        onConfirm={() => void handleFinishSession()}
        open={finishConfirmationOpen}
        title="Finish this study session?"
      />
    </div>
  );
}
