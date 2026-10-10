import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Clock3,
  Download,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { ErrorState, LoadingState } from "../components/ui/StatePanel";
import { ModuleFormDialog } from "../features/modules/ModuleFormDialog";
import type { ModuleRecord } from "../features/modules/module";
import { moduleService } from "../features/modules/ModuleService";
import { ModuleTopics } from "../features/topics/ModuleTopics";
import { BackupService, maxBackupBytes } from "../features/backup/BackupService";
import { moduleDatabase } from "../features/modules/moduleDatabase";

const backupService = new BackupService(moduleDatabase);

export function ModuleDetailPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState<ModuleRecord>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [operationSuccess, setOperationSuccess] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function exportModule() {
    if (!module) return;
    setOperationError("");
    setOperationSuccess("");
    try {
      const backup = await backupService.createModuleBackup(module.id);
      const url = URL.createObjectURL(new Blob([backup], { type: "application/zip" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `college-study-hub-${module.code.replace(/[^\w-]+/g, "-")}.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "The module backup could not be created.");
    }
  }

  async function importModule(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setOperationError("");
    setOperationSuccess("");
    try {
      if (file.size > maxBackupBytes) {
        throw new Error("This backup exceeds the 512 MiB restore limit.");
      }
      const bytes = await file.arrayBuffer();
      const backup = await backupService.inspect(bytes);
      if (backup.kind !== "module") {
        throw new Error("Choose a module backup exported from a module detail page.");
      }
      const summary = await backupService.restore(bytes, "merge");
      setOperationSuccess(
        `Restored ${summary.modules} module, ${summary.topics} topics, and ${summary.materials} materials from the backup.`,
      );
      await loadModule();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "The module backup could not be restored.");
    }
  }

  const loadModule = useCallback(async () => {
    if (!moduleId) {
      setLoadError("This module link is missing its ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const result = await moduleService.getById(moduleId);
      if (!result) {
        setLoadError("This module may have been deleted or is no longer available.");
      } else {
        setModule(result);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? `This module could not be loaded: ${error.message}`
          : "This module could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    void loadModule();
  }, [loadModule]);

  async function handleArchive(isArchived: boolean) {
    if (!module) return;
    setOperationError("");
    try {
      await moduleService.setArchived(module.id, isArchived);
      await loadModule();
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : "The module status could not be changed. Please try again.",
      );
    }
  }

  async function handleDelete() {
    if (!module) return;
    setOperationError("");
    try {
      await moduleService.delete(module.id);
      navigate("/modules");
    } catch (error) {
      setOperationError(
        error instanceof Error
          ? error.message
          : "The module could not be deleted. Please try again.",
      );
      setConfirmDelete(false);
    }
  }

  if (loading) return <LoadingState label="Loading module" />;
  if (loadError) {
    return (
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-[12px] font-medium text-muted hover:text-brand"
          to="/modules"
        >
          <ArrowLeft aria-hidden="true" size={15} />
          Back to modules
        </Link>
        <ErrorState message={loadError} onRetry={() => void loadModule()} />
      </div>
    );
  }
  if (!module) return null;

  return (
    <div className="animate-fade-in">
      <Link
        className="mb-6 inline-flex items-center gap-2 text-[12px] font-medium text-muted hover:text-brand"
        to="/modules"
      >
        <ArrowLeft aria-hidden="true" size={15} />
        All modules
      </Link>

      {operationError && (
        <div className="mb-4">
          <ErrorState message={operationError} onRetry={() => setOperationError("")} />
        </div>
      )}
      {operationSuccess && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200" role="status">{operationSuccess}</p>}

      <section className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-panel">
        <div
          className="h-1.5"
          style={{ backgroundColor: module.color || "rgb(var(--palette-brand))" }}
        />
        <div className="p-5 sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
                {module.isArchived ? "ARCHIVED MODULE" : "YOUR MODULE"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[34px]">
                  {module.name}
                </h1>
                {module.isArchived && (
                  <span className="rounded-full bg-subtle px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
                    Archived
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] font-medium tracking-wide text-muted">
                {module.code}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-subtle"
                onClick={() => void exportModule()}
                type="button"
              >
                <Download aria-hidden="true" size={14} />
                Export backup
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-subtle"
                onClick={() => setEditing(true)}
                type="button"
              >
                <Pencil aria-hidden="true" size={14} />
                Edit
              </button>
              {module.isArchived ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-medium text-brand hover:bg-brand-soft"
                  onClick={() => void handleArchive(false)}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" size={14} />
                  Restore
                </button>
              ) : (
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-subtle"
                  onClick={() => void handleArchive(true)}
                  type="button"
                >
                  <Archive aria-hidden="true" size={14} />
                  Archive
                </button>
              )}
              <button
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                onClick={() => setConfirmDelete(true)}
                type="button"
              >
                <Trash2 aria-hidden="true" size={14} />
                Delete
              </button>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem
              icon={<CalendarDays aria-hidden="true" size={15} />}
              label="Semester"
              value={module.semester || "Not set"}
            />
            <DetailItem
              icon={<CalendarDays aria-hidden="true" size={15} />}
              label="Academic year"
              value={module.academicYear || "Not set"}
            />
            <DetailItem
              icon={<Pencil aria-hidden="true" size={15} />}
              label="Lecturer"
              value={module.lecturer || "Not set"}
            />
            <DetailItem
              icon={<Clock3 aria-hidden="true" size={15} />}
              label="Last updated"
              value={new Date(module.updatedAt).toLocaleDateString()}
            />
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <h2 className="text-[13px] font-semibold text-ink">About this module</h2>
            <p className="mt-2 whitespace-pre-wrap text-[12px] leading-6 text-muted">
              {module.description || "No description added."}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[11px] font-medium text-ink hover:bg-subtle">
              <Upload aria-hidden="true" size={14} />
              Restore module backup
              <input accept=".zip,application/zip" className="sr-only" onChange={(event) => void importModule(event)} type="file" />
            </label>
            <p className="text-[10px] text-muted">Restores as a merge. Existing matching IDs or module codes are reported without overwriting.</p>
          </div>

          <ModuleTopics moduleId={module.id} />
        </div>
      </section>

      {editing && (
        <ModuleFormDialog
          key={module.id}
          module={module}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void loadModule();
          }}
        />
      )}

      <ConfirmationDialog
        cancelLabel="Keep module"
        confirmLabel="Delete module"
        description={`“${module.name}” will be removed. Its topics will be deleted, but associated materials and original files will remain on this device as unassigned items.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
        open={confirmDelete}
        title="Delete this module?"
      />
    </div>
  );
}

interface DetailItemProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function DetailItem({ icon, label, value }: DetailItemProps) {
  return (
    <div className="rounded-xl border border-line bg-canvas px-3 py-3">
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <p className="text-[10px] font-medium">{label}</p>
      </div>
      <p className="mt-1.5 truncate text-[12px] font-medium text-ink">{value}</p>
    </div>
  );
}
