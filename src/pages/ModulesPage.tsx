import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Search, X } from "lucide-react";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/StatePanel";
import { ModuleCard } from "../features/modules/ModuleCard";
import { ModuleFormDialog } from "../features/modules/ModuleFormDialog";
import type { ModuleRecord } from "../features/modules/module";
import { moduleService } from "../features/modules/ModuleService";

type ModuleStatusFilter = "active" | "archived" | "all";

export function ModulesPage() {
  const [modules, setModules] = useState<ModuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState("");
  const [status, setStatus] = useState<ModuleStatusFilter>("active");
  const [formModule, setFormModule] = useState<ModuleRecord | null | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ModuleRecord>();

  const loadModules = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setModules(await moduleService.getAll());
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? `Modules could not be loaded: ${error.message}`
          : "Modules could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  const semesters = useMemo(
    () =>
      [...new Set(modules.map((module) => module.semester).filter(Boolean))].sort(
        (first, second) => first!.localeCompare(second!),
      ) as string[],
    [modules],
  );

  const visibleModules = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return modules.filter((module) => {
      const matchesStatus =
        status === "all" ||
        (status === "archived" ? module.isArchived : !module.isArchived);
      const matchesSemester = !semester || module.semester === semester;
      const matchesSearch =
        !query ||
        [module.name, module.code, module.lecturer, module.semester, module.academicYear]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(query));
      return matchesStatus && matchesSemester && matchesSearch;
    });
  }, [modules, search, semester, status]);

  async function refreshAfterChange() {
    setOperationError("");
    await loadModules();
  }

  async function handleArchive(module: ModuleRecord, isArchived: boolean) {
    setOperationError("");
    try {
      await moduleService.setArchived(module.id, isArchived);
      await refreshAfterChange();
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : "The module status could not be changed. Please try again.",
      );
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setOperationError("");
    try {
      await moduleService.delete(deleteTarget.id);
      setDeleteTarget(undefined);
      await refreshAfterChange();
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : "The module could not be deleted. Please try again.",
      );
      setDeleteTarget(undefined);
    }
  }

  async function handleSaved() {
    setFormModule(undefined);
    await refreshAfterChange();
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
            YOUR COURSEWORK
          </p>
          <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">
            Your modules
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Keep your courses and their details organized in one calm space.
          </p>
        </div>
        <button
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white shadow-soft transition-colors hover:bg-brand-strong"
          onClick={() => setFormModule(null)}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          Add module
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-surface p-3 shadow-soft sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_150px]">
          <label className="relative block">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              size={15}
            />
            <span className="sr-only">Search modules</span>
            <input
              className="w-full rounded-xl border border-line bg-canvas py-2.5 pl-9 pr-9 text-[12px] text-ink placeholder:text-muted/80 focus:border-brand focus:ring-brand"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, code, lecturer…"
              type="search"
              value={search}
            />
            {search && (
              <button
                aria-label="Clear module search"
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-subtle"
                onClick={() => setSearch("")}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            )}
          </label>
          <label className="sr-only" htmlFor="semester-filter">
            Filter by semester
          </label>
          <select
            className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink focus:border-brand focus:ring-brand"
            id="semester-filter"
            onChange={(event) => setSemester(event.target.value)}
            value={semester}
          >
            <option value="">All semesters</option>
            {semesters.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="status-filter">
            Filter by status
          </label>
          <select
            className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink focus:border-brand focus:ring-brand"
            id="status-filter"
            onChange={(event) =>
              setStatus(event.target.value as ModuleStatusFilter)
            }
            value={status}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All modules</option>
          </select>
        </div>
      </div>

      {operationError && (
        <div className="mb-4">
          <ErrorState message={operationError} onRetry={() => setOperationError("")} />
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading modules" />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void loadModules()} />
      ) : modules.length === 0 ? (
        <section className="rounded-[22px] border border-line bg-surface shadow-panel">
          <EmptyState
            description="Add your first module to keep your course details together. You can create any module that fits your studies."
            icon={<BookOpen aria-hidden="true" size={20} strokeWidth={1.8} />}
            title="Your modules start here"
            action={
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong"
                onClick={() => setFormModule(null)}
                type="button"
              >
                <Plus aria-hidden="true" size={15} />
                Add your first module
              </button>
            }
          />
        </section>
      ) : visibleModules.length === 0 ? (
        <section className="rounded-[22px] border border-line bg-surface shadow-panel">
          <EmptyState
            compact
            description="Try another search or adjust the semester and status filters."
            icon={<Search aria-hidden="true" size={19} />}
            title="No modules match"
            action={
              <button
                className="text-[11px] font-semibold text-brand hover:text-brand-strong"
                onClick={() => {
                  setSearch("");
                  setSemester("");
                  setStatus("all");
                }}
                type="button"
              >
                Clear filters
              </button>
            }
          />
        </section>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] text-muted" aria-live="polite">
              {visibleModules.length}{" "}
              {visibleModules.length === 1 ? "module" : "modules"}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                onArchive={(value) => void handleArchive(value, true)}
                onDelete={setDeleteTarget}
                onEdit={setFormModule}
                onRestore={(value) => void handleArchive(value, false)}
              />
            ))}
          </div>
        </>
      )}

      {formModule !== undefined && (
        <ModuleFormDialog
          key={formModule?.id ?? "new-module"}
          module={formModule ?? undefined}
          onClose={() => setFormModule(undefined)}
          onSaved={() => void handleSaved()}
        />
      )}

      <ConfirmationDialog
        cancelLabel="Keep module"
        confirmLabel="Delete module"
        description={`“${deleteTarget?.name ?? "This module"}” will be permanently removed from this device. This cannot be undone.`}
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={() => void handleDelete()}
        open={Boolean(deleteTarget)}
        title="Delete this module?"
      />
    </div>
  );
}
