/**
 * The deterministic, zero-fetch local summary fallback.
 *
 * The panel may carry a prior failure so the user keeps the distinction
 * between what happened to the AI request and what this local result is.
 */

import { AiErrorNotice } from "./AiErrorNotice";
import type { AiClientFailure } from "./aiTypes";
import { LOCAL_SUMMARY_NOTICE, type LocalSummary } from "./localSummary";

interface LocalSummaryPanelProps {
  summary: LocalSummary;
  failure?: AiClientFailure;
}

export function LocalSummaryPanel({
  summary,
  failure,
}: LocalSummaryPanelProps) {
  return (
    <section
      aria-labelledby="ai-local-summary-heading"
      className="space-y-4"
    >
      {failure && <AiErrorNotice failure={failure} />}

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-200">
          LOCAL FALLBACK
        </p>
        <h3
          className="mt-1 text-[14px] font-semibold tracking-[-0.02em] text-emerald-950 dark:text-emerald-100"
          id="ai-local-summary-heading"
        >
          Local fallback summary
        </h3>
        <p className="mt-1.5 text-[11px] leading-5 text-emerald-900 dark:text-emerald-100">
          {LOCAL_SUMMARY_NOTICE}
        </p>
      </div>

      <div className="rounded-xl border border-line bg-canvas p-3.5">
        <h4 className="text-[11px] font-semibold text-ink">Summary</h4>
        <p className="mt-1.5 text-[12px] leading-6 text-ink">
          {summary.summary}
        </p>
        {summary.keyPoints.length > 0 && (
          <>
            <h4 className="mt-4 text-[11px] font-semibold text-ink">
              Key points
            </h4>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[11px] leading-5 text-muted">
              {summary.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 text-[10px] leading-5 text-muted">
          Generated from {summary.sourceCharacters.toLocaleString()} characters
          of extracted text already held in this browser. It made zero
          <code className="mx-1 rounded bg-subtle px-1 py-0.5">fetch</code>
          calls.
        </p>
      </div>
    </section>
  );
}
