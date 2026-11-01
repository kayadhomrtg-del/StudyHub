/**
 * User-facing wording for every client or proxy failure.
 *
 * The three outcomes are deliberately distinct:
 *
 * - `not_sent`: refused before any provider request (Class A).
 * - `failed_after_sending`: exactly one provider request was attempted
 *   (Class B).
 * - `unknown`: a send was attempted but its result could not be established.
 *   It must never be described as "not sent".
 */

import type {
  AiClientErrorCode,
  AiClientOutcome,
  AiClientFailure,
} from "./aiTypes";

export interface AiErrorPresentation {
  outcome: AiClientOutcome;
  outcomeLabel: string;
  heading: string;
  detail: string;
  /** The proxy's own message, shown separately from the client wording. */
  proxyMessage: string;
  tone: "error" | "warning";
  /** The local fallback is always available, including after a failure. */
  fallbackAvailable: true;
}

function reasonForCode(code: AiClientErrorCode): string {
  switch (code) {
    case "invalid_request":
      return "The request was rejected before sending because it was not valid.";
    case "forbidden_origin":
      return "The local proxy refused a request that did not come from this application.";
    case "payload_too_large":
      return "The extracted text is larger than the configured request limit.";
    case "not_approved":
      return "No fresh approval was available for this payload.";
    case "integrity_mismatch":
      return "The approved payload did not match the prepared payload.";
    case "paused":
      return "The AI feature is paused.";
    case "not_configured":
      return "The local AI proxy is not enabled or configured.";
    case "local_limit":
      return "The local daily request ceiling has been reached. It is a local ceiling, not a provider quota.";
    case "gates_not_recorded":
      return "The local launch-gate record has not been written.";
    case "gates_invalid":
      return "The local launch-gate record is invalid.";
    case "gates_exposure_not_acknowledged":
      return "The exposure acknowledgement is not recorded.";
    case "model_not_confirmed":
      return "The model has not been confirmed for this project.";
    case "region_not_permitted":
      return "This region is not permitted for the selected service.";
    case "age_not_confirmed":
      return "The required 18+ age confirmation is not recorded.";
    case "terms_not_eligible":
      return "Provider eligibility is unresolved, so no provider request can be made.";
    case "terms_check_stale":
      return "The terms-eligibility check is older than 30 days.";
    case "upstream_auth":
      return "The provider rejected the request's credentials.";
    case "quota_exceeded":
      return "The provider reported that its daily quota is exhausted.";
    case "rate_limit_exceeded":
      return "The provider reported a rate limit. This is not assumed to mean the daily quota is exhausted.";
    case "upstream_error":
      return "The provider returned an error.";
    case "blocked":
      return "The provider blocked the request.";
    case "incomplete":
      return "The provider response was truncated by the output token cap.";
    case "invalid_response":
      return "The local proxy returned a response that could not be read.";
    case "network_error":
      return "A network or local connection error occurred.";
    case "outcome_unknown":
      return "No usable response was received, so the result could not be confirmed.";
  }
}

export function presentAiError(
  failure: AiClientFailure,
): AiErrorPresentation {
  const detail = reasonForCode(failure.code);

  if (failure.outcome === "unknown") {
    return {
      outcome: "unknown",
      outcomeLabel: "Request outcome unknown",
      heading: "The request outcome is unknown",
      detail: `${detail} The request may have reached the AI service, so this is not a confirmed pre-send refusal. Check the local request log before trying again.`,
      proxyMessage: failure.message,
      tone: "warning",
      fallbackAvailable: true,
    };
  }

  if (failure.outcome === "failed_after_sending") {
    return {
      outcome: "failed_after_sending",
      outcomeLabel: "Request failed after sending",
      heading: "The request failed after it was sent",
      detail,
      proxyMessage: failure.message,
      tone: failure.code === "incomplete" ? "warning" : "error",
      fallbackAvailable: true,
    };
  }

  return {
    outcome: "not_sent",
    outcomeLabel: "Not sent",
    heading: "The request was not sent",
    detail,
    proxyMessage: failure.message,
    tone: "error",
    fallbackAvailable: true,
  };
}
