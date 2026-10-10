import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileUp, LoaderCircle, UploadCloud, XCircle } from "lucide-react";
import { ErrorState } from "../../components/ui/StatePanel";
import { moduleService } from "../modules/ModuleService";
import type { ModuleRecord } from "../modules/module";
import type { TopicRecord } from "../topics/topic";
import { topicService } from "../topics/TopicService";
import type { MaterialImportResult } from "./material";
import { materialService } from "./MaterialService";

interface FileImportPanelProps {
  onImported?: () => void;
}

export function FileImportPanel({ onImported }: FileImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [tags, setTags] = useState("");
  const [results, setResults] = useState<MaterialImportResult[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void moduleService
      .getAll()
      .then((records) => {
        if (mounted) setModules(records.filter((module) => !module.isArchived));
      })
      .catch((loadError: unknown) => {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? `Modules could not be loaded: ${loadError.message}`
              : "Modules could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (mounted) setLoadingModules(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setTopicId("");
    if (!moduleId) {
      setTopics([]);
      return () => {
        mounted = false;
      };
    }
    void topicService
      .getByModule(moduleId)
      .then((records) => {
        if (mounted) setTopics(records);
      })
      .catch((loadError: unknown) => {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? `Topics could not be loaded: ${loadError.message}`
              : "Topics could not be loaded.",
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, [moduleId]);

  async function importFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const outcomes = await materialService.importFiles(files, {
        assignment: moduleId
          ? { moduleId, ...(topicId ? { topicId } : {}) }
          : {},
        tags: tags.split(","),
      });
      setResults((previous) => [...outcomes, ...previous]);
      if (outcomes.some((outcome) => outcome.status === "success")) {
        onImported?.();
      }
    } catch (importError) {
      setError(
        importError instanceof Error
          ? `Files could not be imported: ${importError.message}`
          : "Files could not be imported. Please try again.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section
      aria-labelledby="import-materials-heading"
      className="rounded-[22px] border border-line bg-surface p-4 shadow-soft sm:p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <FileUp aria-hidden="true" size={17} />
        </span>
        <div>
          <h2
            className="text-[14px] font-semibold tracking-[-0.02em] text-ink"
            id="import-materials-heading"
          >
            Add course materials
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            Files and details are saved in this browser on your device. Imported
            files are never executed or uploaded.
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label
            className="mb-1.5 block text-[11px] font-medium text-ink"
            htmlFor="import-module"
          >
            Module (optional)
          </label>
          <select
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[11px] text-ink focus:border-brand focus:ring-brand"
            disabled={loadingModules}
            id="import-module"
            onChange={(event) => setModuleId(event.target.value)}
            value={moduleId}
          >
            <option value="">Keep unassigned</option>
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
            htmlFor="import-topic"
          >
            Topic (optional)
          </label>
          <select
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[11px] text-ink focus:border-brand focus:ring-brand disabled:opacity-60"
            disabled={!moduleId || topics.length === 0}
            id="import-topic"
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
            htmlFor="import-tags"
          >
            Tags (comma separated)
          </label>
          <input
            className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[11px] text-ink placeholder:text-muted/70 focus:border-brand focus:ring-brand"
            id="import-tags"
            onChange={(event) => setTags(event.target.value)}
            placeholder="lecture, revision"
            value={tags}
          />
        </div>
      </div>

      <input
        accept="*/*"
        className="sr-only"
        multiple
        onChange={(event) => {
          if (event.currentTarget.files) void importFiles(event.currentTarget.files);
        }}
        ref={inputRef}
        type="file"
      />
      <div
        className={`rounded-2xl border border-dashed p-5 text-center transition-colors sm:p-7 ${
          dragging
            ? "border-brand bg-brand-soft/70"
            : "border-line bg-canvas/70"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          const relatedTarget =
            event.relatedTarget instanceof Node ? event.relatedTarget : null;
          if (!event.currentTarget.contains(relatedTarget)) {
            setDragging(false);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void importFiles(event.dataTransfer.files);
        }}
      >
        {busy ? (
          <LoaderCircle
            aria-label="Importing files"
            className="mx-auto animate-spin text-brand"
            role="status"
            size={24}
          />
        ) : (
          <UploadCloud
            aria-hidden="true"
            className="mx-auto text-brand"
            size={25}
            strokeWidth={1.7}
          />
        )}
        <p className="mt-2 text-[12px] font-medium text-ink">
          {busy ? "Saving files locally…" : "Drag files here to add them"}
        </p>
        <p className="mt-1 text-[10px] text-muted">
          Keep them unassigned now, or choose a module and topic above.
        </p>
        <button
          className="mt-3 rounded-xl border border-line bg-surface px-3.5 py-2 text-[11px] font-semibold text-ink hover:bg-subtle disabled:opacity-50"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Choose files
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorState message={error} onRetry={() => setError("")} />
        </div>
      )}

      {results.length > 0 && (
        <div aria-live="polite" className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-ink">Import results</h3>
            <button
              className="text-[10px] font-medium text-muted hover:text-ink"
              onClick={() => setResults([])}
              type="button"
            >
              Clear results
            </button>
          </div>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {results.map((result, index) => (
              <li
                className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-[10px] ${
                  result.status === "success"
                    ? "bg-brand-soft/70 text-brand-strong"
                    : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200"
                }`}
                key={`${result.fileName}-${index}`}
              >
                {result.status === "success" ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
                ) : (
                  <XCircle aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
                )}
                <span className="min-w-0 flex-1 break-all">
                  <span className="font-medium">{result.fileName}</span>
                  {result.status === "failure" && (
                    <span className="mt-0.5 block opacity-90">{result.message}</span>
                  )}
                </span>
                <span className="shrink-0 font-semibold">
                  {result.status === "success" ? "Saved" : "Failed"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
