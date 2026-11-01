import { useState } from "react";

import type { AiClientOptions } from "./aiClient";
import { AiErrorNotice } from "./AiErrorNotice";
import { DisclosurePanel } from "./DisclosurePanel";
import { LOCAL_QUIZ_NOTICE, createLocalQuiz } from "./localQuiz";
import { PayloadPreview } from "./PayloadPreview";
import {
  parseQuizOutput,
  type QuizContent,
  type QuizQuestion,
} from "./quizOutput";
import type { AiMaterialSource } from "./useMaterialAiSource";
import { useAiFeatureRequest } from "./useAiFeatureRequest";

export interface AiQuizPageProps {
  source: AiMaterialSource;
  fetch?: AiClientOptions["fetch"];
  now?: () => number;
}

const primaryButton =
  "inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-[12px] font-semibold text-ink hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

function QuizAssessment({ content }: { content: QuizContent }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const complete = Object.keys(answers).length === content.questions.length;
  const score = content.questions.reduce(
    (total, question, index) =>
      total + (answers[index] === question.correctIndex ? 1 : 0),
    0,
  );

  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {content.questions.map((question, questionIndex) => (
          <li key={`${questionIndex}-${question.question}`}>
            <QuestionCard
              checked={checked}
              index={questionIndex}
              onAnswer={(optionIndex) =>
                setAnswers((current) => ({
                  ...current,
                  [questionIndex]: optionIndex,
                }))
              }
              question={question}
              selected={answers[questionIndex]}
            />
          </li>
        ))}
      </ol>
      <button
        className={primaryButton}
        disabled={!complete || checked}
        onClick={() => setChecked(true)}
        type="button"
      >
        Check answers
      </button>
      {checked && (
        <p aria-live="polite" className="rounded-xl border border-line bg-canvas p-3.5 text-[12px] font-semibold text-ink" role="status">
          Score: {score} of {content.questions.length} correct.
        </p>
      )}
    </div>
  );
}

function QuestionCard({
  checked,
  index,
  onAnswer,
  question,
  selected,
}: {
  checked: boolean;
  index: number;
  onAnswer: (optionIndex: number) => void;
  question: QuizQuestion;
  selected: number | undefined;
}) {
  return (
    <fieldset className="rounded-xl border border-line bg-canvas p-3.5">
      <legend className="max-w-full px-1 text-[12px] font-semibold leading-5 text-ink">
        {index + 1}. {question.question}
      </legend>
      <div className="space-y-2 pt-2">
        {question.options.map((option, optionIndex) => (
          <label
            className="flex items-start gap-2.5 rounded-lg border border-line bg-surface p-2.5 text-[11px] leading-5 text-ink"
            key={`${optionIndex}-${option}`}
          >
            <input
              checked={selected === optionIndex}
              className="mt-1 size-4 shrink-0 accent-brand"
              disabled={checked}
              name={`quiz-question-${index}`}
              onChange={() => onAnswer(optionIndex)}
              type="radio"
              value={optionIndex}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {checked && (
        <p className="mt-3 border-t border-line pt-3 text-[11px] leading-5 text-muted">
          {selected === question.correctIndex ? "Correct. " : "Not correct. "}
          {question.explanation}
        </p>
      )}
    </fieldset>
  );
}

function RawOutput({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-ink">{label}</h3>
      <pre
        aria-label={label}
        className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-canvas p-3.5 font-mono text-[11px] leading-5 text-ink"
      >
        {text || "No output text was returned."}
      </pre>
    </div>
  );
}

export function AiQuizPage({ source, fetch, now }: AiQuizPageProps) {
  const request = useAiFeatureRequest<QuizContent, string[]>({
    feature: "quiz",
    text: source.text,
    parseOutput: parseQuizOutput,
    createFallback: createLocalQuiz,
    fetch,
    now,
  });
  const { state } = request;

  let requestBody;
  switch (state.status) {
    case "idle":
      requestBody = (
        <div className="space-y-3">
          <p className="text-[11px] leading-5 text-muted">
            Preparing creates a reviewable payload on this computer only. No
            provider is contacted during preparation.
          </p>
          {source.text.trim() === "" && (
            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              No extractable text is available. The local excerpt fallback
              remains available.
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
        <p aria-live="polite" className="text-[11px] leading-5 text-muted" role="status">
          Preparing the exact quiz payload on this computer. No provider is
          being contacted and no quiz request has been sent.
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
            requestLabel="quiz"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className={primaryButton}
              disabled={!request.canSend}
              onClick={() => void request.send()}
              type="button"
            >
              Send approved quiz request
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
            requestLabel="quiz"
          />
          <p aria-live="polite" className="text-[11px] leading-5 text-muted" role="status">
            Sending exactly one approved quiz request. There is no automatic
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
            <QuizAssessment
              content={state.parsed.content}
              key={state.prepared.token}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] leading-5 text-muted">{state.parsed.message}</p>
              <RawOutput label="Raw AI output" text={state.parsed.rawText} />
            </div>
          )}
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
    case "incomplete":
      requestBody = (
        <div className="space-y-4">
          <AiErrorNotice failure={state.failure} />
          <p className="text-[11px] leading-5 text-muted">
            This partial response is not a complete quiz and cannot be graded.
          </p>
          <RawOutput label="Raw partial output" text={state.outputText} />
          <div className="flex flex-wrap gap-2">
            <button className={secondaryButton} onClick={request.showFallback} type="button">
              Use local fallback
            </button>
            <button className={secondaryButton} disabled={!request.canPrepare} onClick={() => void request.prepare()} type="button">
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
            <RawOutput label="Returned partial output" text={state.outputText} />
          )}
          <div className="flex flex-wrap gap-2">
            <button className={secondaryButton} disabled={!request.canShowFallback} onClick={request.showFallback} type="button">
              Use local fallback
            </button>
            <button className={secondaryButton} disabled={!request.canPrepare} onClick={() => void request.prepare()} type="button">
              Prepare a new exact payload
            </button>
          </div>
        </div>
      );
      break;
    case "fallback":
      requestBody = (
        <div className="space-y-4">
          <section aria-label="Local quiz fallback" className="rounded-xl border border-line bg-canvas p-3.5">
            <h3 className="text-[12px] font-semibold text-ink">Local source excerpts</h3>
            <p className="mt-1 text-[11px] leading-5 text-muted">{LOCAL_QUIZ_NOTICE}</p>
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
          OPTIONAL AI QUIZ
        </p>
        <h1 className="max-w-3xl break-words text-[28px] font-semibold tracking-[-0.045em] text-ink sm:text-[32px]">
          Quiz yourself on “{source.title}”
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-muted">
          Review the exact outbound payload before anything can be sent. Answer
          every question before checking; your answers and score stay in memory
          only.
        </p>
      </header>

      <section aria-labelledby="ai-quiz-provider-state-heading" className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 sm:p-5">
        <h2 className="text-[13px] font-semibold text-amber-950 dark:text-amber-100" id="ai-quiz-provider-state-heading">
          Provider dispatch is currently blocked
        </h2>
        <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-amber-900 dark:text-amber-100">
          Provider eligibility is unresolved, so the local proxy refuses AI
          preparation in normal production. No provider is contacted from this
          page. The local fallback makes zero network requests.
        </p>
      </section>

      <DisclosurePanel surfaceLabel="AI quizzes" />

      <section aria-labelledby="ai-quiz-request-heading" className="min-w-0 rounded-[22px] border border-line bg-surface p-4 shadow-panel sm:p-5">
        <div className="border-b border-line pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">REQUEST</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-ink" id="ai-quiz-request-heading">
            Review before sending
          </h2>
        </div>
        <div className="pt-4">{requestBody}</div>
      </section>
    </div>
  );
}
