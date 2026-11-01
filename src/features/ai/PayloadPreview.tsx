/**
 * Exact outbound payload preview and the per-request approval checkbox.
 *
 * The preview is the server-returned `payloadText`, rendered without
 * truncation. The digest is presented only as an integrity value; it is not
 * approval evidence, authorization, or provider-eligibility evidence.
 */

import { useId } from "react";

import type { AiPreparedSummary } from "./aiTypes";
import {
  PAYLOAD_INTEGRITY_FAILED,
  PAYLOAD_INTEGRITY_VERIFIED,
  validatePreparedPayload,
} from "./payloadIntegrity";

export const AI_APPROVAL_WORDING =
  "I have reviewed the exact payload above and approve sending it.";

export const AI_DIGEST_EXPLANATION =
  "The digest is an integrity check only. It is not proof of approval, authorization, or provider eligibility.";

interface PayloadPreviewProps {
  prepared: AiPreparedSummary;
  approved: boolean;
  onApprovedChange: (approved: boolean) => void;
  disabled?: boolean;
  requestLabel?: string;
}

export function PayloadPreview({
  prepared,
  approved,
  onApprovedChange,
  disabled = false,
  requestLabel = "summary",
}: PayloadPreviewProps) {
  const approvalId = useId();
  const integrity = validatePreparedPayload(prepared, requestLabel);

  return (
    <section
      aria-labelledby="ai-payload-preview-heading"
      className="space-y-4"
    >
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3
            className="text-[14px] font-semibold tracking-[-0.02em] text-ink"
            id="ai-payload-preview-heading"
          >
            {requestLabel === "summary"
              ? "Exact outbound payload"
              : `Exact outbound ${requestLabel} payload`}
          </h3>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              integrity.ok
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
            }`}
            role="status"
          >
            {integrity.ok ? "Integrity verified" : "Integrity check failed"}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-muted">
          This is the exact text the local proxy stored. The browser sends only
          the token and digest on the next step; it never reconstructs or
          resends this payload.
        </p>
      </div>

      <pre
        aria-label="Exact outbound payload text"
        className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-canvas p-3.5 font-mono text-[11px] leading-5 text-ink"
      >
        {prepared.payloadText}
      </pre>

      <dl
        aria-label="Payload metadata"
        className="grid gap-3 rounded-xl border border-line bg-canvas p-3.5 text-[11px] sm:grid-cols-2"
      >
        <div>
          <dt className="font-medium text-muted">Model</dt>
          <dd className="mt-0.5 break-all font-mono text-ink">
            {prepared.payload.model}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted">Payload size</dt>
          <dd className="mt-0.5 text-ink">{prepared.payloadBytes} bytes</dd>
        </div>
        <div>
          <dt className="font-medium text-muted">Expires</dt>
          <dd className="mt-0.5 break-all font-mono text-ink">
            <time dateTime={prepared.expiresAt}>{prepared.expiresAt}</time>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted">Digest</dt>
          <dd className="mt-0.5 break-all font-mono text-ink">
            {prepared.digest}
          </dd>
        </div>
      </dl>

      <div
        className={`rounded-xl border p-3.5 text-[11px] leading-5 ${
          integrity.ok
            ? "border-line bg-canvas text-muted"
            : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
        }`}
      >
        <p className="font-medium text-ink">
          {integrity.ok ? PAYLOAD_INTEGRITY_VERIFIED : PAYLOAD_INTEGRITY_FAILED}
        </p>
        {!integrity.ok && <p className="mt-1">{integrity.message}</p>}
      </div>

      <div className="rounded-xl border border-line bg-canvas p-3.5">
        <p className="text-[11px] leading-5 text-muted">
          {AI_DIGEST_EXPLANATION}
        </p>
        <label
          className="mt-3 flex cursor-pointer items-start gap-2.5 text-[12px] font-medium leading-5 text-ink"
          htmlFor={approvalId}
        >
          <input
            checked={approved}
            className="mt-0.5 size-4 shrink-0 rounded border-line text-brand focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || !integrity.ok}
            id={approvalId}
            onChange={(event) => onApprovedChange(event.target.checked)}
            type="checkbox"
          />
          <span>{AI_APPROVAL_WORDING}</span>
        </label>
        <p className="mt-2 text-[10px] leading-5 text-muted">
          Approval applies only to this prepared payload. Preparing a new
          payload clears it and creates a new token; an earlier approval cannot
          be reused.
        </p>
      </div>
    </section>
  );
}
