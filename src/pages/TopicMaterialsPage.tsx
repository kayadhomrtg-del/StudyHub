import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanel";
import { MaterialCard } from "../features/materials/MaterialCard";
import { materialService } from "../features/materials/MaterialService";
import type { MaterialRecord } from "../features/materials/material";
import { moduleService } from "../features/modules/ModuleService";
import type { ModuleRecord } from "../features/modules/module";
import { topicService } from "../features/topics/TopicService";
import type { TopicRecord } from "../features/topics/topic";

export function TopicMaterialsPage() {
  const { moduleId, topicId } = useParams();
  const [topic, setTopic] = useState<TopicRecord>();
  const [module, setModule] = useState<ModuleRecord>();
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setTopic(undefined);
    setModule(undefined);
    setMaterials([]);

    if (!moduleId || !topicId) {
      setError("This topic link is missing its module or topic.");
      setLoading(false);
      return;
    }

    try {
      const [topicResult, moduleResult] = await Promise.all([
        topicService.getById(topicId),
        moduleService.getById(moduleId),
      ]);

      if (!topicResult) {
        setError("This topic may have been deleted or is no longer available.");
        setLoading(false);
        return;
      }

      if (topicResult.moduleId !== moduleId) {
        setError("This topic does not belong to the selected module.");
        setLoading(false);
        return;
      }

      if (!moduleResult) {
        setError("This module may have been deleted or is no longer available.");
        setLoading(false);
        return;
      }

      setTopic(topicResult);
      setModule(moduleResult);

      const topicMaterials = await materialService.getMaterialsByTopic(topicId);
      setMaterials(topicMaterials);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? `The topic materials could not be loaded: ${loadError.message}`
          : "The topic materials could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [moduleId, topicId]);

  useEffect(() => {
    void load();
  }, [load]);

  const backToModule = moduleId ? `/modules/${moduleId}` : "/modules";

  if (loading) return <LoadingState label="Loading topic materials" />;
  if (error) {
    return (
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-[12px] font-medium text-muted hover:text-brand"
          to={backToModule}
        >
          <ArrowLeft aria-hidden="true" size={15} />
          Back to module
        </Link>
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }
  if (!topic || !module) return null;

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            className="mb-2 inline-flex items-center gap-2 text-[12px] font-medium text-muted hover:text-brand"
            to={backToModule}
          >
            <ArrowLeft aria-hidden="true" size={15} />
            Back to {module.name}
          </Link>
          <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
            Topic materials
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">
            {topic.title}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Materials assigned to “{topic.title}” in {module.name} ({module.code}). All materials
            stay on this device.
          </p>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      <section aria-labelledby="topic-materials-heading">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              STORED ON THIS DEVICE
            </p>
            <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.025em] text-ink" id="topic-materials-heading">
              Materials in {topic.title}
            </h2>
          </div>
        </div>

        {materials.length === 0 ? (
          <section className="rounded-[22px] border border-line bg-surface shadow-panel">
            <EmptyState
              icon={<FileText aria-hidden="true" size={20} strokeWidth={1.8} />}
              title="No materials in this topic yet"
              description={
                "Import a file and assign it to this topic, or move an existing material to this topic " +
                "from its organization menu."
              }
              action={
                <Link
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong"
                  to={backToModule}
                >
                  Back to module
                </Link>
              }
            />
          </section>
        ) : (
          <>
            <p aria-live="polite" className="mb-3 text-[10px] text-muted">
              {materials.length}{" "}
              {materials.length === 1 ? "material" : "materials"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {materials.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  modules={[module]}
                  onChanged={() => void load()}
                  onError={setError}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
