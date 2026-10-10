import { useEffect, useId, useState } from "react";
import { useModalFocus } from "../../components/ui/useModalFocus";
import type { ModuleRecord } from "../modules/module";
import type { TopicRecord } from "../topics/topic";
import { topicService } from "../topics/TopicService";
import type { MaterialRecord } from "./material";
import { materialService } from "./MaterialService";

interface MaterialOrganizationDialogProps {
  material: MaterialRecord;
  modules: ModuleRecord[];
  onClose: () => void;
  onSaved: () => void;
}

export function MaterialOrganizationDialog({
  material,
  modules,
  onClose,
  onSaved,
}: MaterialOrganizationDialogProps) {
  const [moduleId, setModuleId] = useState(material.moduleId ?? "");
  const [topicId, setTopicId] = useState(material.topicId ?? "");
  const [tags, setTags] = useState(material.tags.join(", "));
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const { dialogRef, onKeyDown } = useModalFocus(
    true,
    onClose,
    () => document.getElementById("organize-module"),
  );

  useEffect(() => {
    let active = true;
    setTopicId("");
    if (!moduleId) {
      setTopics([]);
      return () => {
        active = false;
      };
    }
    void topicService
      .getByModule(moduleId)
      .then((records) => {
        if (active) {
          setTopics(records);
          if (records.some((topic) => topic.id === material.topicId)) {
            setTopicId(material.topicId ?? "");
          }
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Topics could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [material.topicId, moduleId]);

  async function saveChanges() {
    setSaving(true);
    setError("");
    try {
      await materialService.updateDetails(
        material.id,
        {
          ...(moduleId ? { moduleId } : {}),
          ...(topicId ? { topicId } : {}),
        },
        tags.split(","),
      );
      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Material details could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="my-auto w-full max-w-lg rounded-[22px] border border-line bg-surface p-5 shadow-xl sm:p-7"
        onKeyDown={onKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="text-[16px] font-semibold text-ink" id={titleId}>
          Organize material
        </h2>
        <p className="mt-1 truncate text-[11px] text-muted">{material.originalFileName}</p>

        {error && (
          <p
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label
              className="mb-1.5 block text-[11px] font-medium text-ink"
              htmlFor="organize-module"
            >
              Module
            </label>
            <select
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink focus:border-brand focus:ring-brand"
              id="organize-module"
              onChange={(event) => setModuleId(event.target.value)}
              value={moduleId}
            >
              <option value="">Unassigned</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.name} ({module.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1.5 block text-[11px] font-medium text-ink"
              htmlFor="organize-topic"
            >
              Topic
            </label>
            <select
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink focus:border-brand focus:ring-brand disabled:opacity-60"
              disabled={!moduleId || topics.length === 0}
              id="organize-topic"
              onChange={(event) => setTopicId(event.target.value)}
              value={topicId}
            >
              <option value="">No topic</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1.5 block text-[11px] font-medium text-ink"
              htmlFor="organize-tags"
            >
              Tags (comma separated)
            </label>
            <input
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink focus:border-brand focus:ring-brand"
              id="organize-tags"
              onChange={(event) => setTags(event.target.value)}
              value={tags}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <button
            className="rounded-xl border border-line px-4 py-2 text-[11px] font-medium text-ink hover:bg-subtle"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-brand px-4 py-2 text-[11px] font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
            disabled={saving}
            onClick={() => void saveChanges()}
            type="button"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>
    </div>
  );
}
