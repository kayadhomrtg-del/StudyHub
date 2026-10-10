import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Eye, FilePlus2, Pin, PinOff, Search, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanel";
import { moduleService } from "../features/modules/ModuleService";
import { materialService } from "../features/materials/MaterialService";
import { topicService } from "../features/topics/TopicService";
import { noteService } from "../features/notes/NoteService";
import type { NoteDraft, NoteLink, NoteRecord } from "../features/notes/note";
import type { ModuleRecord } from "../features/modules/module";
import type { MaterialRecord } from "../features/materials/material";
import type { TopicRecord } from "../features/topics/topic";

const MarkdownPreviewContent = lazy(() =>
  import("../features/materials/MarkdownPreviewContent").then((module) => ({
    default: module.MarkdownPreviewContent,
  })),
);

type LinkKind = NoteLink["type"] | "";
type SaveState = "saved" | "saving" | "failed";

interface LinkOptions {
  modules: ModuleRecord[];
  topics: TopicRecord[];
  materials: MaterialRecord[];
}

function linkLabel(link: NoteLink | undefined, options: LinkOptions): string {
  if (!link) return "Not linked";
  if (link.label) return link.label;
  if (link.type === "module") return options.modules.find((module) => module.id === link.id)?.name ?? "Missing module";
  if (link.type === "topic") return options.topics.find((topic) => topic.id === link.id)?.title ?? "Missing topic";
  if (link.type === "material") {
    return options.materials.find((material) => material.id === link.id)?.originalFileName ?? "Missing material";
  }
  return link.label || `Task ${link.id}`;
}

function visibleNoteTitle(note: NoteRecord): string {
  return note.title || "Untitled note";
}

interface NoteEditorProps {
  note: NoteRecord;
  options: LinkOptions;
  onSaved: (note: NoteRecord) => void;
  onDelete: () => void;
}

function NoteEditor({ note, options, onSaved, onDelete }: NoteEditorProps) {
  const [draft, setDraft] = useState<NoteDraft>(() => ({
    title: note.title,
    markdown: note.markdown,
    tags: note.tags,
    isPinned: note.isPinned,
    ...(note.link ? { link: note.link } : {}),
  }));
  const draftRef = useRef(draft);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [linkKind, setLinkKind] = useState<LinkKind>(note.link?.type ?? "");
  const [selectedLinkId, setSelectedLinkId] = useState(note.link?.id ?? "");
  const [taskLabel, setTaskLabel] = useState(note.link?.type === "task" ? note.link.label ?? "" : "");
  const saveRevision = useRef(0);
  const active = useRef(true);

  useEffect(() => () => { active.current = false; }, []);

  const updateDraft = useCallback((next: NoteDraft) => {
    draftRef.current = next;
    setDraft(next);
    const revision = ++saveRevision.current;
    setSaveState("saving");
    setSaveError("");
    void noteService.saveDraft(note.id, next).then((saved) => {
      onSaved(saved);
      if (active.current && revision === saveRevision.current) setSaveState("saved");
    }).catch((error: unknown) => {
      if (active.current && revision === saveRevision.current) {
        setSaveError(error instanceof Error ? error.message : "Your note could not be saved.");
        setSaveState("failed");
      }
    });
  }, [note.id, onSaved]);

  function patchDraft(values: Partial<NoteDraft>) {
    updateDraft({ ...draftRef.current, ...values });
  }

  function updateLink(kind: LinkKind, id: string, label?: string) {
    setLinkKind(kind);
    setSelectedLinkId(id);
    if (!kind || !id) {
      patchDraft({ link: undefined });
      return;
    }
    const link: NoteLink = kind === "module"
      ? { type: kind, id }
      : kind === "topic"
        ? { type: kind, id }
        : kind === "material"
          ? { type: kind, id }
          : { type: kind, id, ...(label?.trim() ? { label: label.trim() } : {}) };
    patchDraft({ link });
  }

  const linkChoices = linkKind === "module"
    ? options.modules.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` }))
    : linkKind === "topic"
      ? options.topics.map((item) => ({
          id: item.id,
          label: `${options.modules.find((module) => module.id === item.moduleId)?.name ?? "Module"} · ${item.title}`,
        }))
      : linkKind === "material"
        ? options.materials.map((item) => ({ id: item.id, label: item.originalFileName }))
        : [];

  return (
    <article aria-label="Note editor" className="min-w-0 rounded-[22px] border border-line bg-surface shadow-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        <Link
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-subtle lg:hidden"
          to="/notes"
        >
          <ArrowLeft aria-hidden="true" size={14} /> All notes
        </Link>
        <div className="flex items-center gap-1 rounded-xl bg-canvas p-1" role="group" aria-label="Note view mode">
          <button
            aria-pressed={!previewMode}
            className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-ink aria-pressed:bg-surface aria-pressed:shadow-soft"
            onClick={() => setPreviewMode(false)}
            type="button"
          >Edit</button>
          <button
            aria-pressed={previewMode}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-ink aria-pressed:bg-surface aria-pressed:shadow-soft"
            onClick={() => setPreviewMode(true)}
            type="button"
          ><Eye aria-hidden="true" size={13} />Preview</button>
        </div>
        <p aria-live="polite" className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted" role="status">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? <><Check aria-hidden="true" size={13} />Saved</> : "Save failed"}
        </p>
        <button
          aria-label={draft.isPinned ? "Unpin note" : "Pin note"}
          aria-pressed={draft.isPinned}
          className="grid size-9 place-items-center rounded-lg border border-line text-ink hover:bg-subtle"
          onClick={() => patchDraft({ isPinned: !draftRef.current.isPinned })}
          type="button"
        >{draft.isPinned ? <PinOff aria-hidden="true" size={15} /> : <Pin aria-hidden="true" size={15} />}</button>
        <button
          aria-label="Delete note"
          className="grid size-9 place-items-center rounded-lg border border-line text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
          onClick={onDelete}
          type="button"
        ><Trash2 aria-hidden="true" size={15} /></button>
      </div>

      <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5">
        <label className="block min-w-0 text-[10px] font-medium text-muted">
          Title
          <input
            className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] text-ink"
            maxLength={200}
            onChange={(event) => patchDraft({ title: event.target.value })}
            placeholder="Untitled note"
            value={draft.title}
          />
        </label>
        <label className="block min-w-0 text-[10px] font-medium text-muted">
          Tags (comma separated)
          <input
            className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink"
            onChange={(event) => patchDraft({ tags: event.target.value.split(",") })}
            placeholder="lecture, revision"
            value={draft.tags.join(", ")}
          />
        </label>
        <label className="block min-w-0 text-[10px] font-medium text-muted sm:col-span-2">
          Link to
          <select
            aria-label="Link note to"
            className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink"
            onChange={(event) => {
              const kind = event.target.value as LinkKind;
              setTaskLabel("");
              updateLink(kind, "");
            }}
            value={linkKind}
          >
            <option value="">No link (standalone note)</option>
            <option value="module">Module</option>
            <option value="topic">Topic</option>
            <option value="material">Study material</option>
            <option value="task">Task ID</option>
          </select>
        </label>
        {linkKind && linkKind !== "task" && (
          <label className="block min-w-0 text-[10px] font-medium text-muted sm:col-span-2">
            {linkKind === "module" ? "Module" : linkKind === "topic" ? "Topic" : "Study material"}
            <select
              aria-label={`Linked ${linkKind}`}
              className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink"
              onChange={(event) => updateLink(linkKind, event.target.value)}
              value={selectedLinkId}
            >
              <option value="">Choose {linkKind}</option>
              {linkChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
            </select>
          </label>
        )}
        {linkKind === "task" && (
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <label className="block min-w-0 text-[10px] font-medium text-muted">
              Task ID
              <input
                className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink"
                maxLength={128}
                onChange={(event) => updateLink("task", event.target.value, taskLabel)}
                placeholder="Paste a task ID"
                value={selectedLinkId}
              />
            </label>
            <label className="block min-w-0 text-[10px] font-medium text-muted">
              Task label (optional)
              <input
                className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink"
                maxLength={200}
                onChange={(event) => {
                  setTaskLabel(event.target.value);
                  updateLink("task", selectedLinkId, event.target.value);
                }}
                placeholder="Readable task name"
                value={taskLabel}
              />
            </label>
          </div>
        )}
      </div>

      {saveState === "failed" && (
        <div className="mx-4 mt-4 sm:mx-5">
          <ErrorState
            message={`Your latest edits are not saved. ${saveError}`}
            onRetry={() => updateDraft(draftRef.current)}
          />
        </div>
      )}

      {previewMode ? (
        <div aria-label="Markdown preview" className="prose prose-sm min-h-72 max-w-none overflow-auto p-5 text-ink sm:p-8">
          {draft.markdown ? (
            <Suspense fallback={<pre className="whitespace-pre-wrap">{draft.markdown}</pre>}>
              <MarkdownPreviewContent source={draft.markdown} />
            </Suspense>
          ) : <p className="text-muted">Nothing to preview yet.</p>}
        </div>
      ) : (
        <label className="block p-4 sm:p-5">
          <span className="sr-only">Markdown source</span>
          <textarea
            aria-label="Markdown source"
            className="min-h-[45vh] w-full resize-y rounded-xl border border-line bg-canvas p-4 font-mono text-[12px] leading-6 text-ink placeholder:text-muted/70 focus:border-brand focus:ring-brand"
            maxLength={1_000_000}
            onChange={(event) => patchDraft({ markdown: event.target.value })}
            placeholder={"Write your study notes in Markdown…\n\n# Key ideas\n- Add a thought"}
            value={draft.markdown}
          />
        </label>
      )}
    </article>
  );
}

export function NotesPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [options, setOptions] = useState<LinkOptions>({ modules: [], topics: [], materials: [] });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selectedNote = useMemo(() => notes.find((note) => note.id === noteId), [noteId, notes]);
  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return notes
      .filter((note) => !needle || [note.title, note.markdown, ...note.tags, note.link?.label ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(needle)))
      .sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || right.updatedAt.localeCompare(left.updatedAt));
  }, [notes, query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [allNotes, modules, materials] = await Promise.all([
        noteService.getAll(),
        moduleService.getAll(),
        materialService.getAll(),
      ]);
      const allTopics = (await Promise.all(modules.map((module) => topicService.getByModule(module.id)))).flat();
      setNotes(allNotes);
      setOptions({ modules, topics: allTopics, materials });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Your notes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createNote() {
    setOperationError("");
    try {
      const note = await noteService.create();
      setNotes((current) => [note, ...current]);
      navigate(`/notes/${note.id}`);
    } catch (createError) {
      setOperationError(createError instanceof Error ? createError.message : "A new note could not be created.");
    }
  }

  async function togglePin(note: NoteRecord) {
    try {
      const updated = await noteService.setPinned(note.id, !note.isPinned);
      setNotes((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (pinError) {
      setOperationError(pinError instanceof Error ? pinError.message : "The note pin could not be changed.");
    }
  }

  async function deleteNote() {
    if (!selectedNote) return;
    setDeleting(true);
    setOperationError("");
    try {
      await noteService.delete(selectedNote.id);
      setNotes((current) => current.filter((item) => item.id !== selectedNote.id));
      setConfirmDelete(false);
      navigate("/notes");
    } catch (deleteError) {
      setOperationError(deleteError instanceof Error ? deleteError.message : "The note could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <LoadingState label="Loading notes" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">YOUR THINKING</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">Notes</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">Capture ideas in Markdown and keep them on this device.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong"
          onClick={() => void createNote()}
          type="button"
        ><FilePlus2 aria-hidden="true" size={15} />New note</button>
      </header>
      {operationError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">{operationError}</p>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
        <aside aria-label="Notes list" className={`${noteId ? "hidden lg:block" : ""} min-w-0 rounded-[22px] border border-line bg-surface p-3 shadow-panel`}>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-muted">
            <Search aria-hidden="true" size={15} />
            <span className="sr-only">Search notes</span>
            <input
              aria-label="Search notes"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              type="search"
              value={query}
            />
          </label>
          <div className="mt-3 space-y-1">
            {filteredNotes.map((note) => (
              <div
                className={`group flex min-w-0 items-start gap-1 rounded-xl px-2 py-2 ${note.id === noteId ? "bg-brand-soft" : "hover:bg-subtle"}`}
                key={note.id}
              >
                <Link className="min-w-0 flex-1 rounded-md p-1 focus-visible:outline focus-visible:outline-brand" to={`/notes/${note.id}`}>
                  <span className="flex items-center gap-1.5 truncate text-[12px] font-semibold text-ink">
                    {note.isPinned && <Pin aria-label="Pinned" className="shrink-0 text-brand" size={12} />}
                    <span className="truncate">{visibleNoteTitle(note)}</span>
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-muted">
                    {note.markdown.replace(/[#*`>\n]/g, " ").trim() || "No content yet"}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-muted">{linkLabel(note.link, options)}</span>
                  {note.tags.length > 0 && <span className="mt-1 block truncate text-[9px] text-brand">{note.tags.map((tag) => `#${tag}`).join(" ")}</span>}
                </Link>
                <button
                  aria-label={note.isPinned ? `Unpin ${visibleNoteTitle(note)}` : `Pin ${visibleNoteTitle(note)}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface hover:text-brand"
                  onClick={() => void togglePin(note)}
                  type="button"
                ><Pin aria-hidden="true" size={13} /></button>
              </div>
            ))}
          </div>
          {filteredNotes.length === 0 && (
            <div className="py-5 text-center text-[11px] text-muted" role="status">
              {notes.length ? "No notes match your search." : "No notes yet. Create one to get started."}
            </div>
          )}
        </aside>

        <div className={`${noteId ? "" : "hidden lg:block"} min-w-0`}>
          {noteId && selectedNote ? (
            <NoteEditor
              key={selectedNote.id}
              note={selectedNote}
              onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))}
              onDelete={() => setConfirmDelete(true)}
              options={options}
            />
          ) : noteId ? (
            <div className="rounded-[22px] border border-line bg-surface p-5">
              <ErrorState message="This note may have been deleted or is no longer available." onRetry={() => void load()} />
            </div>
          ) : (
            <div className="rounded-[22px] border border-line bg-surface shadow-panel">
              <EmptyState
                description="Create a standalone note or select one from your list. Notes save locally as you type."
                icon={<FilePlus2 aria-hidden="true" size={20} />}
                title={notes.length ? "Choose a note to continue" : "Start a new note"}
              />
            </div>
          )}
        </div>
      </div>
      <ConfirmationDialog
        cancelLabel="Keep note"
        confirmLabel={deleting ? "Deleting…" : "Delete note"}
        description={`“${selectedNote ? visibleNoteTitle(selectedNote) : "This note"}” will be deleted from this device. This cannot be undone.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void deleteNote()}
        open={confirmDelete}
        title="Delete this note?"
      />
    </div>
  );
}
