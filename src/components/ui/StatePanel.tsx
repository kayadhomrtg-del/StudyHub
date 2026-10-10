import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading your workspace" }: LoadingStateProps) {
  return (
    <div
      aria-label={label}
      className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-line bg-surface text-sm text-muted"
      role="status"
    >
      <LoaderCircle aria-hidden="true" className="animate-spin text-brand" size={18} />
      {label}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center text-center ${
        compact ? "px-4 py-8" : "px-6 py-12 sm:py-16"
      }`}
    >
      {icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
          {icon}
        </span>
      )}
      <h3 className="text-[14px] font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-[12px] leading-6 text-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/60 dark:bg-red-950/30"
      role="alert"
    >
      <div className="flex gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" size={18} />
        <div>
          <h3 className="text-[13px] font-semibold text-red-900 dark:text-red-200">
            {title}
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-red-800 dark:text-red-300">
            {message}
          </p>
          {onRetry && (
            <button
              className="mt-3 text-[12px] font-semibold text-red-800 underline decoration-red-300 underline-offset-4 hover:text-red-950 dark:text-red-200"
              onClick={onRetry}
              type="button"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
