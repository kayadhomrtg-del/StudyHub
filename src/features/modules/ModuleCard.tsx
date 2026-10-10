import { Archive, BookOpen, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { ModuleRecord } from "./module";

interface ModuleCardProps {
  module: ModuleRecord;
  onEdit: (module: ModuleRecord) => void;
  onArchive: (module: ModuleRecord) => void;
  onRestore: (module: ModuleRecord) => void;
  onDelete: (module: ModuleRecord) => void;
}

export function ModuleCard({
  module,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: ModuleCardProps) {
  const term = [module.semester, module.academicYear].filter(Boolean).join(" · ");

  return (
    <article
      className={`group overflow-hidden rounded-2xl border border-line bg-surface shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel ${
        module.isArchived ? "opacity-80" : ""
      }`}
    >
      <div
        aria-hidden="true"
        className="h-1"
        style={{ backgroundColor: module.color || "rgb(var(--palette-brand))" }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            className="min-w-0 flex-1 rounded-md focus-visible:outline"
            to={`/modules/${encodeURIComponent(module.id)}`}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
              <BookOpen aria-hidden="true" size={17} strokeWidth={1.8} />
            </span>
            <h2 className="mt-4 truncate text-[16px] font-semibold tracking-[-0.03em] text-ink group-hover:text-brand-strong">
              {module.name}
            </h2>
            <p className="mt-1 text-[11px] font-medium tracking-wide text-muted">
              {module.code}
            </p>
          </Link>
          {module.isArchived && (
            <span className="rounded-full bg-subtle px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted">
              Archived
            </span>
          )}
        </div>

        <div className="mt-4 min-h-[52px] border-t border-line pt-3">
          {term && <p className="text-[11px] font-medium text-ink">{term}</p>}
          {module.lecturer && (
            <p className="mt-1 truncate text-[10px] text-muted">{module.lecturer}</p>
          )}
          {!term && !module.lecturer && (
            <p className="text-[10px] text-muted">No term details yet</p>
          )}
        </div>

        {module.description && (
          <p className="mb-4 line-clamp-2 min-h-8 text-[11px] leading-5 text-muted">
            {module.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button
            aria-label={`Edit ${module.name}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-muted hover:bg-subtle hover:text-ink"
            onClick={() => onEdit(module)}
            type="button"
          >
            <Pencil aria-hidden="true" size={13} />
            Edit
          </button>
          {module.isArchived ? (
            <button
              aria-label={`Restore ${module.name}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-brand hover:bg-brand-soft"
              onClick={() => onRestore(module)}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={13} />
              Restore
            </button>
          ) : (
            <button
              aria-label={`Archive ${module.name}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-muted hover:bg-subtle hover:text-ink"
              onClick={() => onArchive(module)}
              type="button"
            >
              <Archive aria-hidden="true" size={13} />
              Archive
            </button>
          )}
          <button
            aria-label={`Delete ${module.name}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-muted hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            onClick={() => onDelete(module)}
            type="button"
          >
            <Trash2 aria-hidden="true" size={13} />
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
