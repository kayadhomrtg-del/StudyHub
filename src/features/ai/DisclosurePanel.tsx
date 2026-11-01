/**
 * Required M1–M8 disclosures, rendered verbatim and without a dismiss action.
 *
 * The loopback preparation explanation is intentionally outside the immutable
 * disclosure list: it describes StudyHub's local preview path rather than the
 * provider's handling.
 */

import {
  AI_DISCLOSURES,
  AI_PREPARE_DISCLOSURE,
} from "./disclosures";

export function DisclosurePanel({
  surfaceLabel = "AI summaries",
}: {
  surfaceLabel?: string;
}) {
  return (
    <section
      aria-labelledby="ai-disclosures-heading"
      className="rounded-[22px] border border-line bg-surface p-4 shadow-panel sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
            REQUIRED DISCLOSURES
          </p>
          <h2
            className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-ink"
            id="ai-disclosures-heading"
          >
            Read these before using {surfaceLabel}
          </h2>
        </div>
        <span className="rounded-full border border-line bg-canvas px-3 py-1 text-[10px] font-semibold text-muted">
          M1–M8 · fixed
        </span>
      </div>

      <p className="mt-3 max-w-3xl text-[12px] leading-6 text-muted">
        These disclosures are shown verbatim and cannot be edited or dismissed.
        They apply before the first provider request and remain visible for
        every request.
      </p>

      <ol className="mt-4 grid gap-3">
        {AI_DISCLOSURES.map((disclosure) => (
          <li key={disclosure.id}>
            <article className="rounded-xl border border-line bg-canvas p-3.5">
              <h3
                className="text-[12px] font-semibold text-ink"
                id={`ai-disclosure-${disclosure.id}`}
              >
                <span className="mr-2 text-brand">{disclosure.id}</span>
                {disclosure.title}
              </h3>
              <p className="mt-1.5 text-[11px] leading-5 text-muted">
                {disclosure.text}
              </p>
            </article>
          </li>
        ))}
      </ol>

      <aside
        aria-label="Local preparation disclosure"
        className="mt-4 rounded-xl border border-brand/30 bg-brand-soft p-3.5"
      >
        <h3 className="text-[12px] font-semibold text-ink">
          How preparation works on this computer
        </h3>
        <p className="mt-1.5 text-[11px] leading-5 text-muted">
          {AI_PREPARE_DISCLOSURE}
        </p>
      </aside>
    </section>
  );
}
