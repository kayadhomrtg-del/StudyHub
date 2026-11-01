/**
 * The optional AI summary surface.
 *
 * The route-level wrapper supplies already-extracted material text. This
 * component never loads file bytes and never contacts a provider itself; real
 * provider dispatch remains behind the Phase 1 gates.
 */

import { useMemo, type ReactNode } from "react";

import type { AiClientOptions } from "./aiClient";
import { AiErrorNotice } from "./AiErrorNotice";
import { DisclosurePanel } from "./DisclosurePanel";
import { LocalSummaryPanel } from "./LocalSummaryPanel";
import { PayloadPreview } from "./PayloadPreview";
import { PersonalNotesPanel, type PersonalNotesStore } from "./PersonalNotesPanel";
import type { NoteLink } from "../notes/note";
import type { SummaryContent, SummaryOutputParse } from "./summaryOutput";
import {
  useAiSummaryRequest,
  type AiSummaryRequestStatus,
} from "./useAiSummaryRequest";

export interface AiSummarySource {
  /** The linked material ID. The summary route supplies the selected material. */
  id: string;
  title: string;
  /** Text already extracted in memory. The page never loads file bytes. */
  text: string;
}

export interface AiSummaryPageProps {
  source: AiSummarySource;
  /** Injectable for tests; production uses the browser's same-origin fetch. */
  fetch?: AiClientOptions["fetch"];
  /** Injectable clock for deterministic expiry checks. */
  now?: () => number;
  /** Injectable for tests; production uses the singleton note service. */
  notesStore?: PersonalNotesStore;
}

const primaryButton =
  "inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-[12px] font-semibold text-ink hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

const statusCopy: Record<AiSummaryRequestStatus, string> = {
  idle: "Nothing prepared",
  preparing: "Preparing exact payload",
  review: "Awaiting your approval",
  sending: "Sending once",
  complete: "Summary complete",
  incomplete: "Partial output received",
  error: "Request settled with an error",
  fallback: "Local fallback shown",
};

function StructuredSummary({ content }: { content: SummaryContent }) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-3.5">
      <h4 className="text-[11px] font-semibold text-ink">Summary</h4>
      <p className="mt-1.5 text-[12px] leading-6 text-ink">
        {content.summary}
      </p>
      {content.keyPoints.length > 0 && (
        <>
          <h4 className="mt-4 text-[11px] font-semibold text-ink">Key points</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[11px] leading-5 text-muted">
            {content.keyPoints.map((point, index) => (
              <li key={`${index}-${point}`}>{point}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SummaryOutput({
  parsed,
  outputText,
  incomplete = false,
}: {
  parsed: SummaryOutputParse;
  outputText: string;
  incomplete?: boolean;
}) {
  if (incomplete) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          The provider response was truncated by its output token cap. This is
          the partial output it returned; it is not a complete summary.
        </p>
        {parsed.ok ? (
          <StructuredSummary content={parsed.content} />
        ) : (
          <p className="text-[11px] leading-5 text-muted">{parsed.message}</p>
        )}
        <div>
          <h4 className="text-[11px] font-semibold text-ink">
            Raw partial output
          </h4>
          <pre
            aria-label="Partial AI output"
            className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-canvas p-3.5 font-mono text-[11px] leading-5 text-ink"
          >
            {outputText || "The provider returned no partial text."}
          </pre>
        </div>
      </div>
    );
  }

  if (parsed.ok) {
    return <StructuredSummary content={parsed.content} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-5 text-muted">{parsed.message}</p>
      <pre
        aria-label="Raw AI output"
        className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-canvas p-3.5 font-mono text-[11px] leading-5 text-ink"
      >
        {outputText}
      </pre>
    </div>
  );
}

export function AiSummaryPage({
  source,
  fetch,
  now,
  notesStore,
}: AiSummaryPageProps) {
  const request = useAiSummaryRequest({ text: source.text, fetch, now });
  const { state } = request;
  const noteLink = useMemo<NoteLink>(
    () => ({
      type: "material",
      id: source.id,
      // The note service limits link labels to 200 characters.
      label: source.title.slice(0, 200),
    }),
    [source.id, source.title],
  );

  let requestBody: ReactNode;
  switch (state.status) {
    case "idle":
      requestBody = (
        <div className="space-y-3">
          <p className="text-[11px] leading-5 text-muted">
            Nothing has been prepared. Preparing creates a reviewable payload
            on this computer only; no provider is contacted during preparation.
          </p>
          {source.text.trim() === "" && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              No extractable text is available for this material. The local
              fallback remains available.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className={primaryButton}
              disabled={!request.canPrepare}
              onClick={() => void request.prepare()}
              type="button"
            >
              Prepare exact payload
            </button>
            <button
              className={secondaryButton}
              onClick={request.showFallback}
              type="button"
            >
              Use local fallback
            </button>
          </div>
        </div>
      );
      break;

    case "preparing":
      requestBody = (
        <p
          aria-live="polite"
          className="rounded-xl border border-line bg-canvas px-3.5 py-3 text-[11px] leading-5 text-muted"
          role="status"
        >
          Preparing the exact payload on this computer. No provider is being
          contacted and no summary request has been sent.
        </p>
      );
      break;

    case "review":
      requestBody = (
        <div className="space-y-4">
          <PayloadPreview
            approved={state.approved}
            onApprovedChange={request.approve}
            prepared={state.prepared}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className={primaryButton}
              disabled={!request.canSend}
              onClick={() => void request.send()}
              type="button"
            >
              Send approved request
            </button>
            <button
              className={secondaryButton}
              onClick={request.reset}
              type="button"
            >
              Discard preview
            </button>
          </div>
          <p aria-live="polite" className="text-[10px] leading-5 text-muted">
            {request.canSend
              ? "The checkbox approval is current for this payload. Sending will make at most one provider request."
              : "Approve the exact payload above to enable sending. Approval is reset when a new payload is prepared."}
          </p>
        </div>
      );
      break;

    case "sending":
      requestBody = (
        <div className="space-y-4">
          <PayloadPreview
            approved
            disabled
            onApprovedChange={() => undefined}
            prepared={state.prepared}
          />
          <button className={primaryButton} disabled type="button">
            Sending approved request…
          </button>
          <p
            aria-live="polite"
            className="text-[11px] leading-5 text-muted"
            role="status"
          >
            Sending exactly one approved request. There is no automatic retry.
          </p>
        </div>
      );
      break;

    case "complete":
      requestBody = (
        <div className="space-y-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
            COMPLETE · {state.response.model}
          </p>
          <SummaryOutput
            outputText={state.response.outputText}
            parsed={state.parsed}
          />
          <button
            className={secondaryButton}
            disabled={!request.canPrepare}
            onClick={() => void request.prepare()}
            type="button"
          >
            Prepare a new exact payload
          </button>
          <p className="text-[10px] leading-5 text-muted">
            A new preparation creates a new token and requires a fresh
            approval. It does not reuse this request's approval.
          </p>
        </div>
      );
      break;

    case "incomplete":
      requestBody = (
        <div className="space-y-4">
          <AiErrorNotice failure={state.failure} />
          <SummaryOutput
            incomplete
            outputText={state.outputText}
            parsed={state.parsed}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className={secondaryButton}
              onClick={request.showFallback}
              type="button"
            >
              Use local fallback
            </button>
            <button
              className={secondaryButton}
              disabled={!request.canPrepare}
              onClick={() => void request.prepare()}
              type="button"
            >
              Prepare a new exact payload
            </button>
          </div>
        </div>
      );
      break;

    case "error":
      requestBody = (
        <div className="space-y-4">
          <AiErrorNotice failure={state.failure} />
          {state.outputText !== undefined && (
            <pre
              aria-label="Returned partial output"
              className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-canvas p-3.5 font-mono text-[11px] leading-5 text-ink"
            >
              {state.outputText}
            </pre>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className={secondaryButton}
              disabled={!request.canShowFallback}
              onClick={request.showFallback}
              type="button"
            >
              Use local fallback
            </button>
            <button
              className={secondaryButton}
              disabled={!request.canPrepare}
              onClick={() => void request.prepare()}
              type="button"
            >
              Prepare a new exact payload
            </button>
          </div>
          <p className="text-[10px] leading-5 text-muted">
            A new preparation is not a retry: it creates a new token and
            requires a fresh approval. The failed request is not resent.
          </p>
        </div>
      );
      break;

    case "fallback":
      requestBody = (
        <div className="space-y-4">
          <LocalSummaryPanel
            failure={state.failure}
            summary={state.localSummary}
          />
          <button
            className={secondaryButton}
            disabled={!request.canPrepare}
            onClick={() => void request.prepare()}
            type="button"
          >
            Prepare a new exact payload
          </button>
        </div>
      );
      break;
  }

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
          OPTIONAL AI SUMMARY
        </p>
        <h1 className="max-w-3xl text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">
          Summarize “{source.title}”
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-muted">
          Review the exact outbound payload before anything can be sent. The
          local fallback is always generated in this browser and makes no
          network request.
        </p>
      </header>

      <section
        aria-labelledby="ai-provider-state-heading"
        className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 sm:p-5"
      >
        <h2
          className="text-[13px] font-semibold text-amber-950 dark:text-amber-100"
          id="ai-provider-state-heading"
        >
          Provider dispatch is currently blocked
        </h2>
        <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-amber-900 dark:text-amber-100">
          Provider eligibility is unresolved, so the local proxy refuses AI
          preparation in normal production. No provider is contacted from this
          page. The local fallback remains available and makes zero network
          requests.
        </p>
      </section>

      <DisclosurePanel />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
        <section
          aria-labelledby="ai-request-heading"
          className="min-w-0 rounded-[22px] border border-line bg-surface p-4 shadow-panel sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                REQUEST
              </p>
              <h2
                className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-ink"
                id="ai-request-heading"
              >
                Review before sending
              </h2>
            </div>
            <span
              aria-live="polite"
              className="rounded-full border border-line bg-canvas px-3 py-1 text-[10px] font-semibold text-muted"
              role="status"
            >
              {statusCopy[state.status]}
            </span>
          </div>
          <div className="pt-4">{requestBody}</div>
        </section>

        <PersonalNotesPanel link={noteLink} store={notesStore} />
      </div>
    </div>
  );
}
