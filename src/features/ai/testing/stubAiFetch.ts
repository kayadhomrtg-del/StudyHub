/**
 * Test-only same-origin proxy stub for the shared AI request flow.
 *
 * This module must never be imported by production code. It handles only the
 * two relative routes the browser client uses, rejects every unexpected
 * request loudly, and records the exact payload that the simulated proxy would
 * dispatch.
 */

import type {
  AiErrorCode,
  AiProviderPayload,
} from "../../../../server/ai/types";
import type {
  AiFeature,
  AiPrepareRequest,
  AiPreparedPayload,
  AiSendRequest,
} from "../aiTypes";

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface StubPreparedRecord extends AiPreparedPayload {
  request: AiPrepareRequest;
}

export interface StubCall {
  route: string;
  body: unknown;
}

export type StubPrepareResolution =
  | { kind: "success" }
  | {
      kind: "error";
      code: AiErrorCode;
      message: string;
      status?: number;
    }
  | { kind: "network_error"; message?: string }
  | { kind: "malformed"; status?: number; body?: string }
  /** Returns a preview whose text does not match the payload. */
  | { kind: "mismatch" };

export type StubSendResolution =
  | { kind: "success"; outputText?: string; model?: string }
  | {
      kind: "incomplete";
      outputText: string;
      message?: string;
      status?: number;
    }
  | {
      kind: "error";
      code: AiErrorCode;
      message: string;
      upstreamAttempted: boolean;
      status?: number;
      outputText?: string;
    }
  | { kind: "network_error"; message?: string }
  | { kind: "malformed"; status?: number; body?: string };

export interface StubAiFetchOptions {
  model?: string;
  expiresAt?: string;
  prepare?:
    | StubPrepareResolution
    | ((
        request: AiPrepareRequest,
      ) => StubPrepareResolution | Promise<StubPrepareResolution>);
  send?:
    | StubSendResolution
    | ((
        request: AiSendRequest,
        prepared: StubPreparedRecord,
      ) => StubSendResolution | Promise<StubSendResolution>);
}

export interface StubAiFetch {
  fetch: FetchImplementation;
  calls: StubCall[];
  prepared: StubPreparedRecord[];
  dispatched: StubPreparedRecord[];
}

const DEFAULT_MODEL = "gemini-stub-model";
const DEFAULT_EXPIRY = "2099-01-01T00:00:00.000Z";
const DEFAULT_OUTPUTS: Record<AiFeature, string> = {
  summary: JSON.stringify({
    summary: "A deterministic stub summary.",
    keyPoints: ["A deterministic stub key point."],
  }),
  quiz: JSON.stringify({
    questions: [
      {
        question: "Which concept appears in the supplied study material?",
        options: ["A supplied concept", "An unsupported concept"],
        correctIndex: 0,
        explanation: "The first option is included in the supplied text.",
      },
    ],
  }),
  qa: JSON.stringify({
    answer: "A deterministic answer based only on the supplied study text.",
    references: ["A deterministic provider-reported reference."],
  }),
};

const STUB_INSTRUCTIONS: Record<AiFeature, string> = {
  summary: "Test-only summary instruction.",
  quiz: "Test-only quiz instruction.",
  qa: "Test-only Q&A instruction.",
};

const ERROR_STATUS: Partial<Record<AiErrorCode, number>> = {
  invalid_request: 400,
  forbidden_origin: 403,
  payload_too_large: 413,
  not_approved: 403,
  integrity_mismatch: 409,
  paused: 503,
  not_configured: 503,
  local_limit: 429,
  gates_not_recorded: 503,
  gates_invalid: 503,
  gates_exposure_not_acknowledged: 403,
  model_not_confirmed: 403,
  region_not_permitted: 403,
  terms_not_eligible: 403,
  terms_check_stale: 403,
  upstream_auth: 502,
  quota_exceeded: 429,
  rate_limit_exceeded: 429,
  upstream_error: 502,
  blocked: 502,
  incomplete: 200,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function routeOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function readBody(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== "string") {
    throw new Error("stubAiFetch: expected a JSON string request body.");
  }

  let value: unknown;
  try {
    value = JSON.parse(init.body);
  } catch {
    throw new Error("stubAiFetch: request body was not valid JSON.");
  }

  if (!isRecord(value)) {
    throw new Error("stubAiFetch: request body must be a JSON object.");
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(
      `stubAiFetch: unexpected request body keys ${actual.join(", ")}; expected ${expected.join(", ")}.`,
    );
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

function statusFor(code: AiErrorCode, status?: number): number {
  return status ?? ERROR_STATUS[code] ?? 500;
}

function featureLabel(feature: AiFeature | undefined): string {
  if (feature === "qa") return "Q&A";
  return feature ?? "AI";
}

function isAiFeature(value: string): value is AiFeature {
  return value === "summary" || value === "quiz" || value === "qa";
}

function makePayload(
  model: string,
  request: AiPrepareRequest,
): AiProviderPayload {
  return {
    model,
    input: request.text,
    system_instruction: STUB_INSTRUCTIONS[request.feature],
    generation_config: {
      thinking_level: "low",
      max_output_tokens: 1024,
    },
    response_format: {
      type: "text",
      mime_type: "application/json",
    },
    store: false,
  };
}

export function createStubAiFetch(
  options: StubAiFetchOptions = {},
): StubAiFetch {
  const calls: StubCall[] = [];
  const prepared: StubPreparedRecord[] = [];
  const dispatched: StubPreparedRecord[] = [];
  const tokens = new Map<string, StubPreparedRecord>();
  let nextId = 0;

  const fetchImplementation: FetchImplementation = async (input, init) => {
    const route = routeOf(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (route !== "/api/ai/prepare" && route !== "/api/ai/send") {
      throw new Error(
        `stubAiFetch: unexpected request ${method} ${route}. Only relative /api/ai/prepare and /api/ai/send are supported.`,
      );
    }
    if (method !== "POST") {
      throw new Error(
        `stubAiFetch: unexpected method ${method} for ${route}; expected POST.`,
      );
    }

    const body = readBody(init);
    calls.push({ route, body });

    if (route === "/api/ai/prepare") {
      assertExactKeys(body, ["feature", "text"]);
      if (
        typeof body.feature !== "string" ||
        !isAiFeature(body.feature) ||
        typeof body.text !== "string"
      ) {
        throw new Error(
          "stubAiFetch: prepare body must contain a supported feature and string text.",
        );
      }

      const request: AiPrepareRequest = {
        feature: body.feature,
        text: body.text,
      };
      const resolution =
        typeof options.prepare === "function"
          ? await options.prepare(request)
          : options.prepare ?? { kind: "success" };

      if (resolution.kind === "error") {
        return jsonResponse(
          {
            ok: false,
            error: {
              code: resolution.code,
              message: resolution.message,
              upstreamAttempted: false,
            },
          },
          statusFor(resolution.code, resolution.status),
        );
      }

      if (resolution.kind === "network_error") {
        throw new Error(
          resolution.message ?? "stubAiFetch: simulated prepare network error.",
        );
      }

      if (resolution.kind === "malformed") {
        return textResponse(
          resolution.body ?? "stubAiFetch: prepare response was not JSON.",
          resolution.status ?? 502,
        );
      }

      const model = options.model ?? DEFAULT_MODEL;
      const payload = makePayload(model, request);
      const truePayloadText = JSON.stringify(payload);
      const payloadText =
        resolution.kind === "mismatch"
          ? JSON.stringify({ ...payload, input: "different text" })
          : truePayloadText;
      const payloadBytes = new TextEncoder().encode(payloadText).byteLength;
      const id = ++nextId;
      const record: StubPreparedRecord = {
        token: `stub-token-${id}`,
        digest: `sha256:stub-${id}`,
        expiresAt: options.expiresAt ?? DEFAULT_EXPIRY,
        payload,
        payloadText,
        payloadBytes,
        request,
      };

      prepared.push(record);
      tokens.set(record.token, record);

      return jsonResponse({
        ok: true,
        token: record.token,
        digest: record.digest,
        expiresAt: record.expiresAt,
        payload: record.payload,
        payloadText: record.payloadText,
        payloadBytes: record.payloadBytes,
      });
    }

    assertExactKeys(body, ["token", "digest"]);
    if (typeof body.token !== "string" || typeof body.digest !== "string") {
      throw new Error(
        "stubAiFetch: send body must be { token: string, digest: string }.",
      );
    }

    const request: AiSendRequest = {
      token: body.token,
      digest: body.digest,
    };
    const record = tokens.get(request.token);
    if (!record || record.digest !== request.digest) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: "not_approved",
            message:
              `The prepared payload is unknown, expired, or was already used. No ${featureLabel(record?.request.feature)} request was sent.`,
            upstreamAttempted: false,
          },
        },
        403,
      );
    }

    // Single-use tokens: consume before any asynchronous resolver can yield.
    tokens.delete(request.token);

    const resolution =
      typeof options.send === "function"
        ? await options.send(request, record)
        : options.send ?? { kind: "success" };

    const wasDispatched = !(
      resolution.kind === "error" && !resolution.upstreamAttempted
    );
    if (wasDispatched) dispatched.push(record);

    if (resolution.kind === "network_error") {
      throw new Error(
        resolution.message ?? "stubAiFetch: simulated send network error.",
      );
    }

    if (resolution.kind === "malformed") {
      return textResponse(
        resolution.body ?? "stubAiFetch: send response was not JSON.",
        resolution.status ?? 502,
      );
    }

    if (resolution.kind === "success") {
      return jsonResponse({
        ok: true,
        status: "complete",
        model: resolution.model ?? options.model ?? DEFAULT_MODEL,
        outputText:
          resolution.outputText ?? DEFAULT_OUTPUTS[record.request.feature],
      });
    }

    if (resolution.kind === "incomplete") {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: "incomplete",
            message:
              resolution.message ??
              "The provider response was truncated by the output token cap.",
            upstreamAttempted: true,
          },
          outputText: resolution.outputText,
        },
        statusFor("incomplete", resolution.status),
      );
    }

    return jsonResponse(
      {
        ok: false,
        error: {
          code: resolution.code,
          message: resolution.message,
          upstreamAttempted: resolution.upstreamAttempted,
        },
        ...(resolution.outputText !== undefined
          ? { outputText: resolution.outputText }
          : {}),
      },
      statusFor(resolution.code, resolution.status),
    );
  };

  return {
    fetch: fetchImplementation,
    calls,
    prepared,
    dispatched,
  };
}
