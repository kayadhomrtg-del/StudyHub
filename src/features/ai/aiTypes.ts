/**
 * Client-side types for the optional AI request flow.
 *
 * These types mirror the small part of the proxy contract the browser uses.
 * Server-only modules such as `server/ai/config.ts` and
 * `server/ai/payloadStore.ts` are never imported at runtime.
 */

import type {
  AiErrorBody,
  AiErrorCode,
  AiProviderPayload,
  AiSuccessBody,
} from "../../../server/ai/types";

/** Same-origin routes only. The client never builds an absolute URL. */
export const AI_PREPARE_ROUTE = "/api/ai/prepare" as const;
export const AI_SEND_ROUTE = "/api/ai/send" as const;
export const AI_SUMMARY_PREPARE_ROUTE = AI_PREPARE_ROUTE;
export const AI_SUMMARY_SEND_ROUTE = AI_SEND_ROUTE;

export type AiFeature = "summary" | "quiz" | "qa";

export interface AiPrepareRequest {
  feature: AiFeature;
  text: string;
}

export interface AiSendRequest {
  token: string;
  digest: string;
}

/** The reviewable payload returned by the shared `prepare` route. */
export interface AiPreparedPayload {
  token: string;
  digest: string;
  expiresAt: string;
  payload: AiProviderPayload;
  /** The exact serialised bytes the proxy stored and would dispatch. */
  payloadText: string;
  payloadBytes: number;
}

/** Retained as an alias for the Phase 2 summary API. */
export type AiPreparedSummary = AiPreparedPayload;

export interface AiFeatureSuccess {
  status: "complete";
  model: string;
  outputText: string;
}

/** Retained as an alias for the Phase 2 summary API. */
export type AiSummarySuccess = AiFeatureSuccess;

/**
 * Codes added by the browser client. They never come from the proxy.
 *
 * `outcome_unknown` is deliberately separate from every server code: it means
 * a `send` was attempted but its result could not be established. It must not
 * be presented as "not sent".
 */
export type AiClientErrorCode =
  | AiErrorCode
  | "invalid_response"
  | "network_error"
  | "outcome_unknown";

export type AiClientOutcome = "not_sent" | "failed_after_sending" | "unknown";

export interface AiClientFailure {
  code: AiClientErrorCode;
  message: string;
  /** `null` only when the outcome is unknown. */
  upstreamAttempted: boolean | null;
  outcome: AiClientOutcome;
}

export type AiPrepareResult =
  | { ok: true; value: AiPreparedPayload }
  | { ok: false; error: AiClientFailure };

export type AiSendResult =
  | { ok: true; value: AiFeatureSuccess }
  | { ok: false; error: AiClientFailure; outputText?: string };

/** The proxy's structured error body, kept for contract-level tests. */
export type AiProxyErrorBody = AiErrorBody;

/** The proxy's successful `send` body, kept for contract-level tests. */
export type AiProxySuccessBody = AiSuccessBody;
