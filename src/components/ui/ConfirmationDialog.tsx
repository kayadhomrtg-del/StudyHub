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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="confirmation-title"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl"
        role="alertdialog"
      >
        <h2
          className="text-base font-semibold tracking-[-0.02em] text-ink"
          id="confirmation-title"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle"
            onClick={onCancel}
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
