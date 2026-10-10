import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpLeft, Heart } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/ui/StatePanel";
import { DownloadOriginal, MaterialFileViewer } from "../features/materials/MaterialFileViewer";
import type { MaterialRecord } from "../features/materials/material";
import { materialService } from "../features/materials/MaterialService";
import { studyStatusLabels, studyStatuses, type StudyStatus } from "../features/studyStatus";
import { moduleService } from "../features/modules/ModuleService";
import type { ModuleRecord } from "../features/modules/module";
import { topicService } from "../features/topics/TopicService";
import type { TopicRecord } from "../features/topics/topic";

interface LoadedMaterial {
  material: MaterialRecord;
  bytes: ArrayBuffer;
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MaterialViewerPage() {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const requestId = useRef(0);
  const [loaded, setLoaded] = useState<LoadedMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [related, setRelated] = useState<MaterialRecord[]>([]);
  const [module, setModule] = useState<ModuleRecord | undefined>();
  const [topic, setTopic] = useState<TopicRecord | undefined>();

  const loadMaterial = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!materialId) {
      setError("This material link is missing its ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setActionError("");
    setLoaded(null);
    try {
      const [material, file] = await Promise.all([
        materialService.getById(materialId),
        materialService.getFile(materialId),
      ]);
      if (currentRequest !== requestId.current) return;
      if (!material) throw new Error("This material could not be found in local storage.");
      if (!file) throw new Error("The original file bytes are missing from local storage.");
      setLoaded({ material, bytes: file.bytes });
      try {
        const openedMaterial = await materialService.markOpened(materialId);
        if (currentRequest !== requestId.current) return;
        setLoaded({ material: openedMaterial, bytes: file.bytes });
      } catch (timestampError) {
        if (currentRequest !== requestId.current) return;
        setActionError(
          timestampError instanceof Error
            ? `The file opened, but its last-opened time could not be saved: ${timestampError.message}`
            : "The file opened, but its last-opened time could not be saved.",
        );
      }
      const [allMaterials, modules, topics] = await Promise.all([
        materialService.getAll(),
        moduleService.getAll(),
        material.moduleId ? topicService.getByModule(material.moduleId) : Promise.resolve([]),
      ]);
      if (currentRequest !== requestId.current) return;
      setRelated(
        material.topicId
          ? allMaterials
              .filter(
                (item) =>
                  item.moduleId === material.moduleId &&
                  item.topicId === material.topicId,
              )
              .sort((left, right) =>
                left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
              )
          : [],
      );
      setModule(modules.find((item) => item.id === material.moduleId));
      setTopic(topics.find((item) => item.id === material.topicId));
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "This material could not be loaded from local storage.",
      );
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    void loadMaterial();
    return () => {
      requestId.current += 1;
    };
  }, [loadMaterial]);

  const material = loaded?.material;
  const currentIndex = material
    ? related.findIndex((item) => item.id === material.id)
    : -1;
  const previous = currentIndex > 0 ? related[currentIndex - 1] : undefined;
  const next =
    currentIndex >= 0 && currentIndex < related.length - 1
      ? related[currentIndex + 1]
      : undefined;

  async function updateFavorite() {
    if (!material || !loaded) return;
    try {
      const updated = await materialService.setFavorite(material.id, !material.isFavorite);
      setLoaded({ ...loaded, material: updated });
    } catch (updateError) {
      setActionError(
        updateError instanceof Error ? updateError.message : "Favorite status could not be updated.",
      );
    }
  }

  async function updateStatus(status: StudyStatus) {
    if (!material || !loaded) return;
    try {
      const updated = await materialService.setStatus(material.id, status);
      setLoaded({ ...loaded, material: updated });
    } catch (updateError) {
      setActionError(
        updateError instanceof Error ? updateError.message : "Study status could not be updated.",
      );
    }
  }

  if (loading) return <LoadingState label="Loading material" />;
  if (error || !loaded || !material) {
    return (
      <div className="space-y-4">
        <ErrorState message={error || "This material could not be loaded."} onRetry={() => void loadMaterial()} />
        <Link className="inline-flex items-center gap-2 text-[12px] font-medium text-brand hover:underline" to="/materials">
          <ArrowUpLeft aria-hidden="true" size={14} />
          Back to materials
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="inline-flex items-center gap-2 text-[12px] font-medium text-muted hover:text-brand" to="/materials">
          <ArrowUpLeft aria-hidden="true" size={15} />
          Materials
        </Link>
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous material in topic"
            className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-ink hover:bg-subtle disabled:opacity-40"
            disabled={!previous}
            onClick={() => previous && navigate(`/materials/${previous.id}`)}
            title={previous?.originalFileName ?? "No previous material in this topic"}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={15} />
          </button>
          <span aria-live="polite" className="text-[10px] text-muted">
            {currentIndex >= 0 ? `${currentIndex + 1} of ${related.length} in topic` : "No topic sequence"}
          </span>
          <button
            aria-label="Next material in topic"
            className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-ink hover:bg-subtle disabled:opacity-40"
            disabled={!next}
            onClick={() => next && navigate(`/materials/${next.id}`)}
            title={next?.originalFileName ?? "No next material in this topic"}
            type="button"
          >
            <ArrowRight aria-hidden="true" size={15} />
          </button>
        </div>
      </div>

      <header className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
              MATERIAL VIEWER
            </p>
            <h1 className="mt-1 break-words text-[22px] font-semibold tracking-[-0.04em] text-ink sm:text-[26px]">
              {material.title}
            </h1>
            <p className="mt-1 break-all text-[11px] text-muted">{material.originalFileName}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="viewer-study-status">Study status</label>
            <select
              className="rounded-xl border border-line bg-canvas px-3 py-2 text-[11px] text-ink"
              id="viewer-study-status"
              onChange={(event) => void updateStatus(event.target.value as StudyStatus)}
              value={material.status}
            >
              {studyStatuses.map((status) => (
                <option key={status} value={status}>{studyStatusLabels[status]}</option>
              ))}
            </select>
            <button
              aria-label={material.isFavorite ? "Remove favorite" : "Add favorite"}
              aria-pressed={material.isFavorite}
              className="grid size-9 place-items-center rounded-xl border border-line text-muted hover:bg-subtle aria-pressed:text-[#b65757]"
              onClick={() => void updateFavorite()}
              type="button"
            >
              <Heart aria-hidden="true" fill={material.isFavorite ? "currentColor" : "none"} size={16} />
            </button>
          </div>
        </div>
        <dl className="mt-4 grid gap-x-5 gap-y-2 border-t border-line pt-3 text-[10px] sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted">Type</dt><dd className="mt-0.5 break-all text-ink">{material.mimeType}</dd></div>
          <div><dt className="text-muted">File size</dt><dd className="mt-0.5 text-ink">{formatFileSize(material.sizeBytes)}</dd></div>
          <div><dt className="text-muted">Module / topic</dt><dd className="mt-0.5 text-ink">{module?.name ?? (material.moduleId ? "Module unavailable" : "Unassigned")}{topic ? ` · ${topic.title}` : ""}</dd></div>
          <div><dt className="text-muted">Last opened</dt><dd className="mt-0.5 text-ink">{material.lastOpenedAt ? new Date(material.lastOpenedAt).toLocaleString() : "Just now"}</dd></div>
        </dl>
        {material.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {material.tags.map((tag) => <span className="rounded-full bg-subtle px-2.5 py-1 text-[10px] text-muted" key={tag}>{tag}</span>)}
          </div>
        )}
      </header>

      {actionError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">{actionError}</p>}
      <DownloadOriginal bytes={loaded.bytes} material={material} />
      <MaterialFileViewer bytes={loaded.bytes} key={material.id} material={material} />
    </div>
  );
}
