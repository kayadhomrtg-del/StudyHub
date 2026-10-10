import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from "lucide-react";
import { ErrorState, LoadingState } from "../../components/ui/StatePanel";
import type { TopicRecord } from "./topic";
import { topicService } from "./TopicService";

interface ModuleTopicsProps {
  moduleId: string;
  refreshKey?: number;
}

export function ModuleTopics({ moduleId, refreshKey = 0 }: ModuleTopicsProps) {
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTopics(await topicService.getByModule(moduleId));
    } catch (loadFailure) {
      setError(
        loadFailure instanceof Error
          ? `Topics could not be loaded: ${loadFailure.message}`
          : "Topics could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics, refreshKey]);

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await topicService.create(moduleId, { title: newTitle });
      setNewTitle("");
      await loadTopics();
    } catch (saveFailure) {
      setError(
        saveFailure instanceof Error
          ? saveFailure.message
          : "The topic could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function renameTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await topicService.rename(editingId, { title: editingTitle });
      setEditingId("");
      await loadTopics();
    } catch (saveFailure) {
      setError(
        saveFailure instanceof Error
          ? saveFailure.message
          : "The topic could not be updated. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveTopic(id: string, direction: -1 | 1) {
    setError("");
    try {
      await topicService.move(id, direction);
      await loadTopics();
    } catch (moveFailure) {
      setError(
        moveFailure instanceof Error
          ? moveFailure.message
          : "The topic order could not be updated. Please try again.",
      );
    }
  }

  return (
    <section aria-labelledby="topics-heading" className="mt-6 border-t border-line pt-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-[13px] font-semibold text-ink" id="topics-heading">
            Topics & weeks
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            Arrange this module into the topics or weeks that work for you.
          </p>
        </div>
        <form className="flex gap-2" onSubmit={(event) => void createTopic(event)}>
          <label className="sr-only" htmlFor="new-topic-title">
            New topic name
          </label>
          <input
            className="min-w-0 rounded-xl border border-line bg-canvas px-3 py-2 text-[11px] text-ink placeholder:text-muted/70 focus:border-brand focus:ring-brand sm:w-52"
            id="new-topic-title"
            maxLength={100}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="e.g. Week 1: Introduction"
            value={newTitle}
          />
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[11px] font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            <Plus aria-hidden="true" size={14} />
            Add topic
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorState message={error} onRetry={() => void loadTopics()} />
        </div>
      )}

      {loading ? (
        <div className="mt-4">
          <LoadingState label="Loading topics" />
        </div>
      ) : topics.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-canvas px-4 py-5 text-center text-[11px] text-muted">
          No topics yet. Add a topic or week above.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {topics.map((topic, index) => (
            <li
              className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2"
              key={topic.id}
            >
              {editingId === topic.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(event) => void renameTopic(event)}
                >
                  <label className="sr-only" htmlFor={`rename-topic-${topic.id}`}>
                    Rename topic
                  </label>
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink focus:border-brand focus:ring-brand"
                    id={`rename-topic-${topic.id}`}
                    maxLength={100}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    value={editingTitle}
                  />
                  <button
                    aria-label={`Save topic ${topic.title}`}
                    className="grid size-8 place-items-center rounded-lg text-brand hover:bg-brand-soft"
                    disabled={saving}
                    type="submit"
                  >
                    <Check aria-hidden="true" size={15} />
                  </button>
                  <button
                    aria-label="Cancel topic rename"
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle"
                    onClick={() => setEditingId("")}
                    type="button"
                  >
                    <X aria-hidden="true" size={15} />
                  </button>
                </form>
              ) : (
                <>
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-[10px] font-semibold text-brand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                    {topic.title}
                  </span>
                  <button
                    aria-label={`Rename ${topic.title}`}
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
                    onClick={() => {
                      setEditingId(topic.id);
                      setEditingTitle(topic.title);
                    }}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </button>
                  <button
                    aria-label={`Move ${topic.title} up`}
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={index === 0}
                    onClick={() => void moveTopic(topic.id, -1)}
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" size={14} />
                  </button>
                  <button
                    aria-label={`Move ${topic.title} down`}
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={index === topics.length - 1}
                    onClick={() => void moveTopic(topic.id, 1)}
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
