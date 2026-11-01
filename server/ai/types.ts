/**
 * Shared types and constants for the optional StudyHub AI proxy.
 *
 * The server-side provider configuration and output contracts are shared
 * across the local proxy and the browser client. Credentials never cross
 * this module boundary.
 */

/** Route namespace served by the proxy. */
export const AI_ROUTE_PREFIX = "/api/ai";
export const AI_STATUS_ROUTE = `${AI_ROUTE_PREFIX}/status`;
export const AI_PREPARE_ROUTE = `${AI_ROUTE_PREFIX}/prepare`;
export const AI_SEND_ROUTE = `${AI_ROUTE_PREFIX}/send`;
export const AI_CONFIGURATION_ROUTE = `${AI_ROUTE_PREFIX}/configuration`;
export const AI_CONFIGURATION_DISMISS_ROUTE = `${AI_CONFIGURATION_ROUTE}/dismiss`;
export const AI_CONFIGURATION_REMOVE_ROUTE = `${AI_CONFIGURATION_ROUTE}/remove-key`;

/**
 * The complete error taxonomy from `docs/AI_PLAN.md` section 9.3, plus the two
 * codes approved in Phase 1 (`payload_too_large`, `forbidden_origin`).
 */
export type AiErrorCode =
  // Pre-dispatch: no provider call, no budget charge.
  | "invalid_request"
  | "forbidden_origin"
  | "payload_too_large"
  | "not_approved"
  | "integrity_mismatch"
  | "paused"
  | "not_configured"
  | "local_limit"
  | "gates_not_recorded"
  | "gates_invalid"
  | "gates_exposure_not_acknowledged"
  | "model_not_confirmed"
  | "region_not_permitted"
  | "age_not_confirmed"
  | "terms_not_eligible"
  | "terms_check_stale"
  // Post-dispatch: exactly one provider call was made.
  | "upstream_auth"
  | "quota_exceeded"
  | "rate_limit_exceeded"
  | "upstream_error"
  | "blocked"
  | "incomplete";

/** Codes that are produced before any provider call is attempted. */
export const PRE_DISPATCH_ERROR_CODES: readonly AiErrorCode[] = [
  "invalid_request",
  "forbidden_origin",
  "payload_too_large",
  "not_approved",
  "integrity_mismatch",
  "paused",
  "not_configured",
  "local_limit",
  "gates_not_recorded",
  "gates_invalid",
  "gates_exposure_not_acknowledged",
  "model_not_confirmed",
  "region_not_permitted",
  "age_not_confirmed",
  "terms_not_eligible",
  "terms_check_stale",
];

/** Codes that are produced after exactly one provider call was attempted. */
export const POST_DISPATCH_ERROR_CODES: readonly AiErrorCode[] = [
  "upstream_auth",
  "quota_exceeded",
  "rate_limit_exceeded",
  "upstream_error",
  "blocked",
  "incomplete",
];

/**
 * Deterministic HTTP status for every error code.
 *
 * `incomplete` maps to 200 because the provider did answer; only the response
 * body was truncated, so the truncated output is still returned to the caller.
 */
export const AI_ERROR_STATUS: Record<AiErrorCode, number> = {
  invalid_request: 400,
  forbidden_origin: 403,
  not_approved: 403,
  gates_exposure_not_acknowledged: 403,
  model_not_confirmed: 403,
  region_not_permitted: 403,
  age_not_confirmed: 403,
  terms_not_eligible: 403,
  terms_check_stale: 403,
  integrity_mismatch: 409,
  payload_too_large: 413,
  local_limit: 429,
  quota_exceeded: 429,
  rate_limit_exceeded: 429,
  not_configured: 503,
  paused: 503,
  gates_not_recorded: 503,
  gates_invalid: 503,
  upstream_auth: 502,
  upstream_error: 502,
  blocked: 502,
  incomplete: 200,
};

/** Verdict labels written to the structured request log. */
export type AiGateVerdictLabel =
  | "pass"
  | "blocked"
  | "not_evaluated"
  | "disabled";

/** The exact request body that would be sent upstream. */
export interface AiProviderPayload {
  model: string;
  input: string;
  system_instruction: string;
  generation_config: {
    thinking_level: "low" | "medium" | "high";
    max_output_tokens: number;
  };
  response_format?: {
    type: string;
    mime_type: string;
    schema?: Record<string, unknown>;
  };
  /** Always false: StudyHub never asks the provider to store an interaction. */
  store: false;
}

/** Error body returned by every AI route. */
export interface AiErrorBody {
  ok: false;
  error: {
    code: AiErrorCode;
    message: string;
    /** True only when exactly one provider call was attempted. */
    upstreamAttempted: boolean;
  };
  /** Present only for `incomplete`, which carries the truncated output. */
  outputText?: string;
}

/** Success body returned by the `send` route. */
export interface AiSuccessBody {
  ok: true;
  status: "complete";
  model: string;
  outputText: string;
}
