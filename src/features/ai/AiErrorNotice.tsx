/**
 * Distinct presentation for Class A, Class B, and unknown send outcomes.
 *
 * There is deliberately no retry action here. A new request needs a new
 * preparation, a new token, and a fresh approval.
 */

import { AlertCircle, AlertTriangle } from "lucide-react";

import { presentAiError } from "./errorPresentation";
import type { AiClientFailure } from "./aiTypes";

interface AiErrorNoticeProps {
  failure: AiClientFailure;
}

export function AiErrorNotice({ failure }: AiErrorNoticeProps) {
  const presentation = presentAiError(failure);
  const warning = presentation.tone === "warning";
  const Icon = warning ? AlertTriangle : AlertCircle;

  return (
    <section
      aria-label={presentation.outcomeLabel}
      className={`rounded-xl border p-3.5 ${
        warning
          ? "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30"
          : "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
      }`}
      data-outcome={presentation.outcome}
      role="alert"
    >
      <div className="flex gap-3">
        <Icon
          aria-hidden="true"
          className={`mt-0.5 shrink-0 ${
            warning
              ? "text-amber-700 dark:text-amber-300"
              : "text-red-600 dark:text-red-400"
          }`}
          size={17}
        />
        <div className="min-w-0">
          <h3
            className={`text-[12px] font-semibold ${
              warning
                ? "text-amber-950 dark:text-amber-100"
                : "text-red-900 dark:text-red-200"
            }`}
          >
            {presentation.heading}
          </h3>
          <p
            className={`mt-1 text-[11px] leading-5 ${
              warning
                ? "text-amber-900 dark:text-amber-100"
                : "text-red-800 dark:text-red-200"
            }`}
          >
            <strong>{presentation.outcomeLabel}</strong> — {presentation.detail}
          </p>
          <p
            className={`mt-2 break-words text-[10px] leading-5 ${
              warning
                ? "text-amber-800 dark:text-amber-200"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            Local proxy message: {presentation.proxyMessage}
          </p>
          <p
            className={`mt-2 text-[10px] leading-5 ${
              warning
                ? "text-amber-800 dark:text-amber-200"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            The local fallback remains available and makes no network request.
            A new AI request would need a new preparation and a fresh approval.
          </p>
        </div>
      </div>
    </section>
  );
}
