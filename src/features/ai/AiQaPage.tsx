import { useState } from "react";

import type { AiClientOptions } from "./aiClient";
import { AiErrorNotice } from "./AiErrorNotice";
import { buildQaInput, getQaQuestionError } from "./buildQaInput";
import { DisclosurePanel } from "./DisclosurePanel";
import { LOCAL_QA_NOTICE, createLocalQa } from "./localQa";
import { PayloadPreview } from "./PayloadPreview";
import { parseQaOutput, type QaContent } from "./qaOutput";
import type { AiMaterialSource } from "./useMaterialAiSource";
import { useAiFeatureRequest } from "./useAiFeatureRequest";

export interface AiQaPageProps {
  source: AiMaterialSource;
  fetch?: AiClientOptions["fetch"];
  now?: () => number;
}

const primaryButton =
  "inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-[12px] font-semibold text-ink hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

function Answer({ content }: { content: QaContent }) {
  return (
    <section aria-label="AI answer" className="space-y-4 rounded-xl border border-line bg-canvas p-3.5">
      <div>
        <h3 className="text-[11px] font-semibold text-ink">Answer</h3>
        <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-6 text-ink">
          {content.answer}
        </p>
      </div>
      {content.references && content.references.length > 0 && (
        <div className="border-t border-line pt-3">
          <h3 className="text-[11px] font-semibold text-ink">
            References — provider-reported, not verified
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[11px] leading-5 text-muted">
            {content.references.map((reference, index) => (
              <li key={`${index}-${reference}`}>{reference}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RawOutput({ text }: { text: string }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-ink">Raw AI output</h3>
      <pre
        aria-label="Raw AI output"
        className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-canvas p-3.5 font-mono text-[11px] leading-5 text-ink"
      >
        {text || "No output text was returned."}
      </pre>
    </div>
  );
}

export function AiQaPage({ source, fetch, now }: AiQaPageProps) {
  const [question, setQuestion] = useState("");
  const questionError = getQaQuestionError(question);
  const requestText =
    questionError === null && source.text.trim() !== ""
      ? buildQaInput(source.text, question)
      : "";
  const request = useAiFeatureRequest<QaContent, string[]>({
    feature: "qa",
    text: requestText,
    parseOutput: parseQaOutput,
    createFallback: () => createLocalQa(source.text, question),
    fetch,
    now,
  });
  const { state } = request;
  const questionField = (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-ink" htmlFor="ai-qa-question">
        Question about this material
      </label>
      <textarea
        aria-describedby={questionError ? "ai-qa-question-error" : undefined}
        aria-invalid={questionError !== null}
        className="min-h-28 w-full resize-y rounded-xl border border-line bg-canvas px-3 py-2.5 text-[12px] leading-5 text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        id="ai-qa-question"
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Ask one question about this material"
        value={question}
      />
      <div className="flex flex-wrap justify-between gap-2 text-[10px] text-muted">
        <span>{question.length} / 2,000 characters</span>
        <span>One question per request; no conversation history.</span>
      </div>
      {questionError && (
        <p
          className="text-[11px] leading-5 text-red-700 dark:text-red-300"
          id="ai-qa-question-error"
          role="alert"
        >
          {questionError === "empty"
            ? "Enter a question before preparing a request."
            : "The question exceeds the 2,000-character limit. Shorten it before preparing a request."}
        </p>
      )}
    </div>
  );

  let requestBody;
  switch (state.status) {
    case "idle":
      requestBody = (
        <div className="space-y-3">
          <p className="text-[11px] leading-5 text-muted">
            The question and selected material text will both appear in full in
            the payload preview. Preparation is local and does not contact a
            provider.
          </p>
          {source.text.trim() === "" && (
            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              No extractable text is available, so an AI answer cannot be
              prepared. Local source excerpts remain available.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className={primaryButton}
              disabled={!request.canPrepare || questionError !== null}
              onClick={() => void request.prepare()}
              type="button"
            >
              Prepare exact Q&amp;A payload
            </button>
            <button
              className={secondaryButton}
              onClick={request.showFallback}
              type="button"
            >
              Show local source excerpts
            </button>
          </div>
        </div>
      );
      break;
    case "preparing":
      requestBody = (
        <p aria-live="polite" className="text-[11px] leading-5 text-muted" role="status">
          Preparing the exact Q&amp;A payload on this computer. No provider is
          being contacted and no Q&amp;A request has been sent.
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
            requestLabel="Q&A"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className={primaryButton}
              disabled={!request.canSend}
              onClick={() => void request.send()}
              type="button"
            >
              Send approved Q&amp;A request
            </button>
            <button
              className={secondaryButton}
              onClick={request.reset}
              type="button"
            >
              Discard preview
            </button>
          </div>
          <p className="text-[10px] leading-5 text-muted">
            Sending makes at most one provider request. There is no automatic
            retry.
          </p>
        </div>
      );
      break;
    case "sending":
      requestBody = (
        <div className="space-y-3">
          <PayloadPreview
            approved
            disabled
            onApprovedChange={() => undefined}
            prepared={state.prepared}
            requestLabel="Q&A"
          />
          <p aria-live="polite" className="text-[11px] leading-5 text-muted" role="status">
            Sending exactly one approved Q&amp;A request. There is no automatic
            retry.
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
          {state.parsed.ok ? (
            <Answer content={state.parsed.content} />
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] leading-5 text-muted">{state.parsed.message}</p>
              <RawOutput text={state.parsed.rawText} />
            </div>
          )}
          <p className="text-[10px] leading-5 text-muted">
            This answer may be wrong, omit context, or include unsupported
            explanations or references. No web search or external retrieval is
            used; personal notes and other materials are not included.
          </p>
          <button
            className={secondaryButton}
            disabled={!request.canPrepare}
            onClick={() => void request.prepare()}
            type="button"
          >
            Prepare a new question
          </button>
        </div>
      );
      break;
    case "incomplete":
      requestBody = (
        <div className="space-y-4">
          <AiErrorNotice failure={state.failure} />
          <p className="text-[11px] leading-5 text-muted">
            This partial response is not a complete answer.
          </p>
          <RawOutput text={state.outputText} />
          <div className="flex flex-wrap gap-2">
            <button className={secondaryButton} onClick={request.showFallback} type="button">
              Show local source excerpts
            </button>
            <button className={secondaryButton} disabled={!request.canPrepare} onClick={() => void request.prepare()} type="button">
              Prepare a new question
            </button>
          </div>
        </div>
      );
      break;
    case "error":
      requestBody = (
        <div className="space-y-4">
          <AiErrorNotice failure={state.failure} />
          {state.outputText !== undefined && <RawOutput text={state.outputText} />}
          <div className="flex flex-wrap gap-2">
            <button className={secondaryButton} disabled={!request.canShowFallback} onClick={request.showFallback} type="button">
              Show local source excerpts
            </button>
            <button className={secondaryButton} disabled={!request.canPrepare} onClick={() => void request.prepare()} type="button">
              Prepare a new question
            </button>
          </div>
        </div>
      );
      break;
    case "fallback":
      requestBody = (
        <div className="space-y-4">
          <section aria-label="Local Q&A fallback" className="rounded-xl border border-line bg-canvas p-3.5">
            <h3 className="text-[12px] font-semibold text-ink">Local source excerpts</h3>
            <p className="mt-1 text-[11px] leading-5 text-muted">{LOCAL_QA_NOTICE}</p>
            {state.localResult.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[11px] leading-5 text-ink">
                {state.localResult.map((excerpt, index) => (
                  <li key={`${index}-${excerpt}`}>{excerpt}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] leading-5 text-muted">No extractable text was found.</p>
            )}
          </section>
          <button className={secondaryButton} disabled={!request.canPrepare} onClick={() => void request.prepare()} type="button">
            Prepare a new question
          </button>
        </div>
      );
      break;
  }

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
          OPTIONAL AI Q&amp;A
        </p>
        <h1 className="max-w-3xl break-words text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">
          Ask about “{source.title}”
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-muted">
          The answer is generated only from this selected material. The model
          can still be wrong or omit context. No web search or external
          retrieval is used, and personal notes or other materials are never
          included.
        </p>
      </header>

      <section aria-labelledby="ai-qa-provider-state-heading" className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 sm:p-5">
        <h2 className="text-[13px] font-semibold text-amber-950 dark:text-amber-100" id="ai-qa-provider-state-heading">
          Provider dispatch is currently blocked
        </h2>
        <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-amber-900 dark:text-amber-100">
          Provider eligibility is unresolved, so the local proxy refuses AI
          preparation in normal production. No provider is contacted from this
          page. The local fallback makes zero network requests.
        </p>
      </section>

      <DisclosurePanel surfaceLabel="AI Q&A" />

      <section aria-labelledby="ai-qa-request-heading" className="min-w-0 rounded-[22px] border border-line bg-surface p-4 shadow-panel sm:p-5">
        <div className="border-b border-line pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">REQUEST</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-ink" id="ai-qa-request-heading">
            Review before sending
          </h2>
        </div>
        <div className="space-y-4 pt-4">
          {questionField}
          {requestBody}
        </div>
      </section>
    </div>
  );
}
