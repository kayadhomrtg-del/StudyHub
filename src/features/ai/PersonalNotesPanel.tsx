/**
 * Optional personal notes for the material being summarized.
 *
 * These are ordinary StudyHub notes written through the existing note service,
 * linked to the material. They are not AI records, are never added to the
 * payload, and remain editable regardless of the request status.
 */

import { useEffect, useRef, useState } from "react";

import { noteService } from "../notes/NoteService";
import type { NoteDraft, NoteLink, NoteRecord } from "../notes/note";

export interface PersonalNotesStore {
  getAll(): Promise<NoteRecord[]>;
  create(): Promise<NoteRecord>;
  saveDraft(id: string, draft: NoteDraft): Promise<NoteRecord>;
}

interface PersonalNotesPanelProps {
  link: NoteLink;
  /** Injectable for tests; production uses the singleton note service. */
  store?: PersonalNotesStore;
}

type SaveState = "idle" | "saving" | "saved" | "failed";

function defaultNoteTitle(id: string, label?: string): string {
  // Mirror the note service's title limit; material titles can be longer.
  return `Summary notes — ${label ?? id}`.slice(0, 200);
}

export function PersonalNotesPanel({
  link,
  store = noteService,
}: PersonalNotesPanelProps) {
  const textareaId = "ai-personal-notes";
  const linkId = link.id;
  const linkLabel = link.label;
  const linkType = link.type;
  const [noteId, setNoteId] = useState<string>();
  const [markdown, setMarkdown] = useState("");
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [noteMeta, setNoteMeta] = useState<
    Pick<NoteDraft, "title" | "tags" | "isPinned">
  >(() => ({
    title: defaultNoteTitle(linkId, linkLabel),
    tags: [],
    isPinned: false,
  }));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  const noteIdRef = useRef<string | undefined>(undefined);
  const markdownRef = useRef("");
  const savingRef = useRef(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setSaveState("idle");
    setSaveError("");

    void store
      .getAll()
      .then((notes) => {
        if (cancelled) return;
        const match = notes
          .filter(
            (note) =>
              note.link?.type === linkType && note.link.id === linkId,
          )
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

        if (match) {
          noteIdRef.current = match.id;
          markdownRef.current = match.markdown;
          setNoteId(match.id);
          setMarkdown(match.markdown);
          setSavedMarkdown(match.markdown);
          setNoteMeta({
            title: match.title || defaultNoteTitle(linkId, linkLabel),
            tags: match.tags,
            isPinned: match.isPinned,
          });
          return;
        }

        noteIdRef.current = undefined;
        markdownRef.current = "";
        setNoteId(undefined);
        setMarkdown("");
        setSavedMarkdown("");
        setNoteMeta({
          title: defaultNoteTitle(linkId, linkLabel),
          tags: [],
          isPinned: false,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Personal notes could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [linkId, linkLabel, linkType, store]);

  const dirty = markdown !== savedMarkdown;
  const status =
    loading
      ? "Loading personal notes…"
      : saveState === "saving"
        ? "Saving locally…"
        : saveState === "failed"
          ? "Save failed"
          : saveState === "saved"
            ? "Saved locally"
            : dirty
              ? "Unsaved changes"
              : noteId
                ? "Saved locally"
                : "Not saved yet";

  async function saveNotes() {
    if (savingRef.current || loading) return;
    savingRef.current = true;
    setSaveState("saving");
    setSaveError("");

    try {
      let id = noteIdRef.current;
      if (!id) {
        const created = await store.create();
        id = created.id;
        noteIdRef.current = id;
        if (activeRef.current) setNoteId(id);
      }

      const saved = await store.saveDraft(id, {
        title: noteMeta.title.trim() || defaultNoteTitle(linkId, linkLabel),
        markdown: markdownRef.current,
        tags: noteMeta.tags,
        isPinned: noteMeta.isPinned,
        link,
      });

      if (!activeRef.current) return;
      setSavedMarkdown(saved.markdown);
      setNoteMeta({
        title: saved.title,
        tags: saved.tags,
        isPinned: saved.isPinned,
      });
      setSaveState("saved");
    } catch (error) {
      if (!activeRef.current) return;
      setSaveError(
        error instanceof Error
          ? error.message
          : "Your notes could not be saved.",
      );
      setSaveState("failed");
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <section
      aria-labelledby="ai-personal-notes-heading"
      className="rounded-[22px] border border-line bg-surface p-4 shadow-panel sm:p-5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
        OPTIONAL · NEVER SENT
      </p>
      <h2
        className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-ink"
        id="ai-personal-notes-heading"
      >
        Personal notes
      </h2>
      <p className="mt-2 text-[11px] leading-5 text-muted">
        These are ordinary StudyHub notes linked to this material. They are
        stored locally, are never included in the AI payload, and may appear in
        normal StudyHub backups as user-authored content.
      </p>

      <label
        className="mt-3 block text-[10px] font-medium text-muted"
        htmlFor={textareaId}
      >
        Personal notes (stored locally)
      </label>
      <textarea
        className="mt-1.5 min-h-40 w-full resize-y rounded-xl border border-line bg-canvas p-3 text-[12px] leading-6 text-ink placeholder:text-muted/70 focus:border-brand focus:ring-brand disabled:cursor-wait disabled:opacity-60"
        disabled={loading}
        id={textareaId}
        maxLength={1_000_000}
        onChange={(event) => {
          markdownRef.current = event.target.value;
          setMarkdown(event.target.value);
          if (saveState === "saved") setSaveState("idle");
        }}
        placeholder="Add a private note for yourself. It will not be sent."
        value={markdown}
      />

      {loadError && (
        <p
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          {loadError}
        </p>
      )}
      {saveState === "failed" && saveError && (
        <p
          className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          {saveError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p
          aria-live="polite"
          className="text-[10px] text-muted"
          role="status"
        >
          {status}
        </p>
        <button
          className="rounded-xl border border-line px-3.5 py-2 text-[11px] font-semibold text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || saveState === "saving" || !dirty}
          onClick={() => void saveNotes()}
          type="button"
        >
          Save notes locally
        </button>
      </div>
    </section>
  );
}
