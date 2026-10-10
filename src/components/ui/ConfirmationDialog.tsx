import { useId, useRef } from "react";
import { useModalFocus } from "./useModalFocus";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const ids = useId();
  const titleId = `${ids}-title`;
  const descriptionId = `${ids}-description`;
  const { dialogRef, onKeyDown } = useModalFocus(
    open,
    onCancel,
    () => cancelButtonRef.current,
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl"
        onKeyDown={onKeyDown}
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
      >
        <h2
          className="text-base font-semibold tracking-[-0.02em] text-ink"
          id={titleId}
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted" id={descriptionId}>{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle"
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
