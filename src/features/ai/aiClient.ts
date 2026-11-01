/**
 * The browser client for the optional AI summary proxy.
 *
 * Only same-origin, relative `/api/ai/*` routes are used. There is no retry
 * and no fallback network path here: a failed send is reported exactly once,
 * and a lost or malformed send response is reported as an unknown outcome
 * rather than as "not sent".
 */

import type { AiErrorCode, AiProviderPayload } from "../../../server/ai/types";
import {
  AI_PREPARE_ROUTE,
  AI_SEND_ROUTE,
  type AiClientFailure,
  type AiFeature,
  type AiPrepareRequest,
  type AiPreparedPayload,
  type AiPrepareResult,
  type AiSendRequest,
  type AiSendResult,
  type AiFeatureSuccess,
} from "./aiTypes";

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface AiClientOptions {
  /** Injectable for tests; production uses the browser's same-origin fetch. */
  fetch?: FetchImplementation;
}

const KNOWN_AI_ERROR_CODES: ReadonlySet<string> = new Set<AiErrorCode>([
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
  "terms_not_eligible",
  "terms_check_stale",
  "upstream_auth",
  "quota_exceeded",
  "rate_limit_exceeded",
  "upstream_error",
  "blocked",
  "incomplete",
]);

const browserFetch: FetchImplementation = (input, init) =>
  globalThis.fetch(input, init);

interface PostResult {
  response: Response;
  value: unknown;
}

type PostOutcome =
  | { ok: true; result: PostResult }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function thrownMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "The local request could not be completed.";
}

function notSentFailure(
  code: "invalid_response" | "network_error" | "not_approved",
  message: string,
): AiClientFailure {
  return { code, message, upstreamAttempted: false, outcome: "not_sent" };
}

function unknownFailure(
  code: "invalid_response" | "network_error" | "outcome_unknown",
  message: string,
): AiClientFailure {
  return { code, message, upstreamAttempted: null, outcome: "unknown" };
}

async function postJson(
  route: string,
  body: unknown,
  fetchImplementation: FetchImplementation,
): Promise<PostOutcome> {
  let response: Response;
  try {
    response = await fetchImplementation(route, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return { ok: false, message: thrownMessage(error) };
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    value = undefined;
  }

  return { ok: true, result: { response, value } };
}

function serverFailure(value: unknown): AiClientFailure | null {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error)) {
    return null;
  }

  const { code, message, upstreamAttempted } = value.error;
  if (
    typeof code !== "string" ||
    !KNOWN_AI_ERROR_CODES.has(code) ||
    typeof message !== "string" ||
    typeof upstreamAttempted !== "boolean"
  ) {
    return null;
  }

  return {
    code: code as AiErrorCode,
    message,
    upstreamAttempted,
    outcome: upstreamAttempted ? "failed_after_sending" : "not_sent",
  };
}

function isProviderPayload(value: unknown): value is AiProviderPayload {
  if (!isRecord(value) || !isRecord(value.generation_config)) {
    return false;
  }

  const generation = value.generation_config;
  return (
    typeof value.model === "string" &&
    value.model.length > 0 &&
    typeof value.input === "string" &&
    typeof value.system_instruction === "string" &&
    (generation.thinking_level === "low" ||
      generation.thinking_level === "medium" ||
      generation.thinking_level === "high") &&
    typeof generation.max_output_tokens === "number" &&
    Number.isInteger(generation.max_output_tokens) &&
    generation.max_output_tokens > 0 &&
    value.store === false
  );
}

function parsePrepared(value: unknown): AiPreparedPayload | null {
  if (!isRecord(value) || value.ok !== true) {
    return null;
  }

  const { token, digest, expiresAt, payload, payloadText, payloadBytes } = value;
  if (
    typeof token !== "string" ||
    token.trim() === "" ||
    typeof digest !== "string" ||
    digest.trim() === "" ||
    typeof expiresAt !== "string" ||
    expiresAt.trim() === "" ||
    !isProviderPayload(payload) ||
    typeof payloadText !== "string" ||
    typeof payloadBytes !== "number" ||
    !Number.isInteger(payloadBytes) ||
    payloadBytes <= 0
  ) {
    return null;
  }

  // The preview and the stored payload must describe the same bytes. The
  // server also holds the authoritative digest; this check catches a broken
  // response before the UI can ever ask for approval.
  if (JSON.stringify(payload) !== payloadText) {
    return null;
  }

  if (new TextEncoder().encode(payloadText).byteLength !== payloadBytes) {
    return null;
  }

  return { token, digest, expiresAt, payload, payloadText, payloadBytes };
}

function parseSuccess(value: unknown): AiFeatureSuccess | null {
  if (
    !isRecord(value) ||
    value.ok !== true ||
    value.status !== "complete" ||
    typeof value.model !== "string" ||
    typeof value.outputText !== "string"
  ) {
    return null;
  }

  return {
    status: "complete",
    model: value.model,
    outputText: value.outputText,
  };
}

/**
 * Asks the loopback proxy to prepare a feature-specific payload for review.
 *
 * Preparation never dispatches a provider request, so a lost or malformed
 * response is still safely described as "not sent" at the provider level.
 */
export async function prepareAiFeature(
  feature: AiFeature,
  text: string,
  options: AiClientOptions = {},
): Promise<AiPrepareResult> {
  const body: AiPrepareRequest = { feature, text };
  const posted = await postJson(
    AI_PREPARE_ROUTE,
    body,
    options.fetch ?? browserFetch,
  );

  const label = feature === "qa" ? "Q&A" : feature;

  if (!posted.ok) {
    return {
      ok: false,
      error: notSentFailure(
        "network_error",
        `The preview request did not complete: ${posted.message} No ${label} request was sent.`,
      ),
    };
  }

  const failure = serverFailure(posted.result.value);
  if (failure) {
    return { ok: false, error: failure };
  }

  const prepared = parsePrepared(posted.result.value);
  if (!prepared) {
    return {
      ok: false,
      error: notSentFailure(
        "invalid_response",
        `The local proxy returned an unreadable preview. No ${label} request was sent.`,
      ),
    };
  }

  return { ok: true, value: prepared };
}

/** Phase 2 compatibility wrapper; preserves the existing summary contract. */
export function prepareSummary(
  text: string,
  options: AiClientOptions = {},
): Promise<AiPrepareResult> {
  return prepareAiFeature("summary", text, options);
}

/**
 * Sends exactly one approved feature request.
 *
 * The body is exactly `{ token, digest }`. If the response is lost or
 * malformed, the result is `outcome: "unknown"` because the proxy may already
 * have dispatched the request. This function never retries.
 */
export async function sendApprovedAiFeature(
  request: AiSendRequest,
  feature: AiFeature,
  options: AiClientOptions = {},
): Promise<AiSendResult> {
  const label = feature === "qa" ? "Q&A" : feature;
  if (request.token.trim() === "" || request.digest.trim() === "") {
    return {
      ok: false,
      error: notSentFailure(
        "not_approved",
        `A prepared payload and its approval are required before sending. No ${label} request was sent.`,
      ),
    };
  }

  const body: AiSendRequest = {
    token: request.token,
    digest: request.digest,
  };
  const posted = await postJson(
    AI_SEND_ROUTE,
    body,
    options.fetch ?? browserFetch,
  );

  if (!posted.ok) {
    return {
      ok: false,
      error: unknownFailure(
        "network_error",
        `The ${label} request may have been sent, but no usable response was received: ${posted.message}`,
      ),
    };
  }

  const { response, value } = posted.result;

  if (isRecord(value) && value.ok === false) {
    const failure = serverFailure(value);
    if (!failure) {
      return {
        ok: false,
        error: unknownFailure(
          "outcome_unknown",
          `The ${label} request may have been sent, but the local proxy's response could not be read.`,
        ),
      };
    }

    return {
      ok: false,
      error: failure,
      ...(typeof value.outputText === "string"
        ? { outputText: value.outputText }
        : {}),
    };
  }

  if (response.ok) {
    const success = parseSuccess(value);
    if (success) {
      return { ok: true, value: success };
    }
  }

  return {
    ok: false,
    error: unknownFailure(
      "outcome_unknown",
      `The ${label} request may have been sent, but the local proxy's response could not be confirmed.`,
    ),
  };
}

/** Phase 2 compatibility wrapper; preserves the existing summary wording. */
export function sendApprovedSummary(
  request: AiSendRequest,
  options: AiClientOptions = {},
): Promise<AiSendResult> {
  return sendApprovedAiFeature(request, "summary", options);
}
