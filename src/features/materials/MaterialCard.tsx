import { useState } from "react";
import {
  FileText,
  Heart,
  Eye,
  Trash2,
  Tags,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ConfirmationDialog } from "../../components/ui/ConfirmationDialog";
import { studyStatusLabels, studyStatuses, type StudyStatus } from "../studyStatus";
import type { ModuleRecord } from "../modules/module";
import type { MaterialRecord } from "./material";
import { materialService } from "./MaterialService";
import { MaterialOrganizationDialog } from "./MaterialOrganizationDialog";

interface MaterialCardProps {
  material: MaterialRecord;
  modules: ModuleRecord[];
  onChanged: () => void;
  onError: (message: string) => void;
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MaterialCard({
  material,
  modules,
  onChanged,
  onError,
}: MaterialCardProps) {
  const [organizing, setOrganizing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const module = modules.find((item) => item.id === material.moduleId);

  async function toggleFavorite() {
    try {
      await materialService.setFavorite(material.id, !material.isFavorite);
      onChanged();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Favorite status could not be updated.",
      );
    }
  }

  async function updateStatus(status: StudyStatus) {
    try {
      await materialService.setStatus(material.id, status);
      onChanged();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Study status could not be updated.",
      );
    }
  }

  async function deleteMaterial() {
    try {
      await materialService.delete(material.id);
      setConfirmDelete(false);
      onChanged();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "The material could not be removed.",
      );
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <article className="rounded-2xl border border-line bg-surface p-4 shadow-soft transition-shadow hover:shadow-panel">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <FileText aria-hidden="true" size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-[13px] font-semibold leading-5 text-ink">
              {material.title}
            </h2>
            <p className="mt-0.5 break-all text-[10px] text-muted">
              {material.originalFileName}
            </p>
          </div>
          <button
            aria-label={`${material.isFavorite ? "Remove favorite from" : "Add"} ${material.title}`}
            aria-pressed={material.isFavorite}
            className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
              material.isFavorite
                ? "bg-[#f8ebeb] text-[#b65757] dark:bg-[#422b2b] dark:text-[#e39595]"
                : "text-muted hover:bg-subtle hover:text-ink"
            }`}
            onClick={() => void toggleFavorite()}
            type="button"
          >
            <Heart
              aria-hidden="true"
              fill={material.isFavorite ? "currentColor" : "none"}
              size={16}
            />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted">
          <span>{formatFileSize(material.sizeBytes)}</span>
          <span aria-hidden="true">·</span>
          <span>{module ? `${module.name} (${module.code})` : "Unassigned"}</span>
        </div>

        {material.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {material.tags.map((tag) => (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-1 text-[9px] font-medium text-muted"
                key={tag}
              >
                <Tags aria-hidden="true" size={10} />
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
          <label className="min-w-0">
            <span className="sr-only">Study status for {material.title}</span>
            <select
              aria-label={`Study status for ${material.title}`}
              className="max-w-36 rounded-lg border border-line bg-canvas px-2 py-1.5 text-[10px] text-ink focus:border-brand focus:ring-brand"
              onChange={(event) =>
                void updateStatus(event.target.value as StudyStatus)
              }
              value={material.status}
            >
              {studyStatuses.map((status) => (
                <option key={status} value={status}>
                  {studyStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <Link
              aria-label={`Open ${material.title}`}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-brand hover:bg-brand-soft"
              to={`/materials/${material.id}`}
            >
              <Eye aria-hidden="true" size={13} />
              Open
            </Link>
            <button
              className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-brand hover:bg-brand-soft"
              onClick={() => setOrganizing(true)}
              type="button"
            >
              Organize
            </button>
            <button
              aria-label={`Delete ${material.title}`}
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle"
              onClick={() => setConfirmDelete(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={14} />
            </button>
          </div>
        </div>
      </article>

      {organizing && (
        <MaterialOrganizationDialog
          material={material}
          modules={modules}
          onClose={() => setOrganizing(false)}
          onSaved={() => {
            setOrganizing(false);
            onChanged();
          }}
        />
      )}
      <ConfirmationDialog
        cancelLabel="Keep material"
        confirmLabel="Delete material"
        description={`“${material.originalFileName}” and its locally stored file bytes will be removed from this device.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void deleteMaterial()}
        open={confirmDelete}
        title="Delete this material?"
      />
    </>
  );
}
