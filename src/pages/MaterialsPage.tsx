import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanel";
import { FileImportPanel } from "../features/materials/FileImportPanel";
import { MaterialCard } from "../features/materials/MaterialCard";
import { materialService } from "../features/materials/MaterialService";
import type { MaterialRecord } from "../features/materials/material";
import { moduleService } from "../features/modules/ModuleService";
import type { ModuleRecord } from "../features/modules/module";

type MaterialStatusFilter = "all" | "favorites" | "not-started" | "in-progress" | "completed";

export function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MaterialStatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [allMaterials, allModules] = await Promise.all([
        materialService.getAll(),
        moduleService.getAll(),
      ]);
      setMaterials(allMaterials);
      setModules(allModules);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? `Materials could not be loaded: ${loadError.message}`
          : "Materials could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleMaterials = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return materials.filter((material) => {
      const matchesSearch =
        !query ||
        [
          material.title,
          material.originalFileName,
          material.mimeType,
          ...material.tags,
        ].some((value) => value.toLocaleLowerCase().includes(query));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "favorites"
          ? material.isFavorite
          : material.status === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [materials, search, statusFilter]);

  return (
    <div className="animate-fade-in">
      <div className="mb-7">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
          YOUR LIBRARY
        </p>
        <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">
          Materials
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
          Keep your course files together, locally stored and ready to organize.
        </p>
      </div>

      <div className="space-y-6">
        <FileImportPanel onImported={() => void loadData()} />

        {error && <ErrorState message={error} onRetry={() => void loadData()} />}

        <section aria-labelledby="material-library-heading">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                STORED ON THIS DEVICE
              </p>
              <h2
                className="mt-1 text-[16px] font-semibold tracking-[-0.025em] text-ink"
                id="material-library-heading"
              >
                Your library
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(200px,280px)_160px]">
              <label className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  size={14}
                />
                <span className="sr-only">Search materials</span>
                <input
                  className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-[11px] text-ink placeholder:text-muted/70 focus:border-brand focus:ring-brand"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search materials and tags…"
                  type="search"
                  value={search}
                />
              </label>
              <label className="sr-only" htmlFor="material-status-filter">
                Filter materials
              </label>
              <select
                className="rounded-xl border border-line bg-surface px-3 py-2 text-[11px] text-ink focus:border-brand focus:ring-brand"
                id="material-status-filter"
                onChange={(event) =>
                  setStatusFilter(event.target.value as MaterialStatusFilter)
                }
                value={statusFilter}
              >
                <option value="all">All materials</option>
                <option value="favorites">Favorites</option>
                <option value="not-started">Not started</option>
                <option value="in-progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingState label="Loading materials" />
          ) : visibleMaterials.length === 0 ? (
            <section className="rounded-[22px] border border-line bg-surface shadow-panel">
              <EmptyState
                description={
                  materials.length === 0
                    ? "Imported files will appear here. Choose a file above, or leave it unassigned until you are ready to organize it."
                    : "Try a different search or filter to find the materials you are looking for."
                }
                icon={<FileText aria-hidden="true" size={20} strokeWidth={1.8} />}
                title={materials.length === 0 ? "Your library is ready" : "No materials match"}
              />
            </section>
          ) : (
            <>
              <p aria-live="polite" className="mb-3 text-[10px] text-muted">
                {visibleMaterials.length}{" "}
                {visibleMaterials.length === 1 ? "material" : "materials"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleMaterials.map((material) => (
                  <MaterialCard
                    key={material.id}
                    material={material}
                    modules={modules}
                    onChanged={() => void loadData()}
                    onError={setError}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
