import { AI_FEATURE_CONFIGS } from "./config";
import { AiSecretStore } from "./secretStore";
import type {
  AiErrorCode,
  AiProviderDiagnostic,
  AiProviderPayload,
  AiProviderResponseClassification,
  AiProviderStatusValue,
} from "./types";

export interface AiProviderResult {
  /** True only when an upstream request was actually made. */
  dispatched: boolean;
  upstreamStatus: number | null;
  status: "complete" | "incomplete" | "failed";
  outputText?: string;
  code?: AiErrorCode;
  message?: string;
  /** Bounded response structure; never contains response content. */
  diagnostic?: AiProviderDiagnostic;
}

export interface AiProvider {
  readonly name: string;
  /** True when a server-side credential is available. */
  readonly configured: boolean;
  send(payload: AiProviderPayload): Promise<AiProviderResult>;
  testConnection(): Promise<AiConnectionTestResult>;
}

export interface AiConnectionTestResult {
  ok: boolean;
  status: number | null;
  models: string[];
  message: string;
}

export const unconfiguredProvider: AiProvider = {
  name: "unconfigured",
  configured: false,
  async send(): Promise<AiProviderResult> {
    return {
      dispatched: false,
      upstreamStatus: null,
      status: "failed",
      code: "not_configured",
      message: "No server-side Gemini key is configured.",
    };
  },
  async testConnection(): Promise<AiConnectionTestResult> {
    return {
      ok: false,
      status: null,
      models: [],
      message: "No server-side Gemini key is configured.",
    };
  },
};

const API_ORIGIN = "https://generativelanguage.googleapis.com";
const REQUEST_TIMEOUT_MS = 30_000;

const KNOWN_STATUSES = [
  "completed",
  "incomplete",
  "failed",
  "cancelled",
  "in_progress",
  "requires_action",
  "requires_continuation",
] as const;

const NONTERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "in_progress",
  "requires_action",
  "requires_continuation",
]);

function isKnownStatus(
  value: unknown,
): value is (typeof KNOWN_STATUSES)[number] {
  return (
    typeof value === "string" &&
    (KNOWN_STATUSES as readonly string[]).includes(value)
  );
}

function isTextOutputItem(
  output: unknown,
): output is { type: "text"; text: string } {
  return (
    Boolean(output) &&
    typeof output === "object" &&
    !Array.isArray(output) &&
    (output as Record<string, unknown>).type === "text" &&
    typeof (output as Record<string, unknown>).text === "string"
  );
}

/**
 * Collects generated text from the documented `steps[]` response shape.
 *
 * Only `model_output` steps contribute text. Thought summaries, function
 * calls, search results, and every other step type are ignored.
 */
function stepTextItems(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];

  const items: string[] = [];
  for (const step of steps) {
    if (!step || typeof step !== "object" || Array.isArray(step)) continue;
    const record = step as Record<string, unknown>;
    if (record.type !== "model_output" || !Array.isArray(record.content)) {
      continue;
    }
    for (const content of record.content) {
      if (isTextOutputItem(content)) items.push(content.text);
    }
  }
  return items;
}

interface ExtractedText {
  text: string | null;
  fieldPresent: boolean;
  empty: boolean | null;
}

function extractResponseText(value: unknown): ExtractedText {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { text: null, fieldPresent: false, empty: null };
  }

  const record = value as Record<string, unknown>;
  const stepItems = stepTextItems(record.steps);
  if (stepItems.length > 0) {
    const text = stepItems.join("");
    return {
      text,
      fieldPresent: true,
      empty: text.trim().length === 0,
    };
  }

  const outputText = record.output_text;
  const outputTextPresent = typeof outputText === "string";
  const textItems = Array.isArray(record.outputs)
    ? record.outputs.filter(isTextOutputItem)
    : [];
  const fieldPresent = outputTextPresent || textItems.length > 0;

  if (!fieldPresent) {
    return { text: null, fieldPresent: false, empty: null };
  }

  const text =
    typeof outputText === "string"
      ? outputText
      : textItems.map((item) => item.text).join("");

  return {
    text,
    fieldPresent: true,
    empty: text.trim().length === 0,
  };
}

interface InspectedResponse {
  record: Record<string, unknown> | null;
  text: ExtractedText;
  diagnostic: AiProviderDiagnostic;
}

function inspectResponse(value: unknown): InspectedResponse {
  const rootIsObject =
    Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const record = rootIsObject ? (value as Record<string, unknown>) : null;
  const text = extractResponseText(value);
  const rawStatus = record?.status;
  const statusPresent = typeof rawStatus === "string";
  const statusRecognized = isKnownStatus(rawStatus);
  const statusValue: AiProviderStatusValue | null = statusPresent
    ? isKnownStatus(rawStatus)
      ? rawStatus
      : "other"
    : null;
  const providerErrorObjectPresent = Boolean(
    record &&
      record.error &&
      typeof record.error === "object" &&
      !Array.isArray(record.error),
  );

  let classification: AiProviderResponseClassification;
  if (!rootIsObject) {
    classification = "unexpected";
  } else if (rawStatus === "incomplete") {
    classification = "incomplete";
  } else if (
    rawStatus === "failed" ||
    rawStatus === "cancelled" ||
    (typeof rawStatus === "string" && NONTERMINAL_STATUSES.has(rawStatus))
  ) {
    classification = "failed";
  } else if (rawStatus === "completed" && text.fieldPresent && !text.empty) {
    classification = "completed";
  } else {
    classification = "unexpected";
  }

  return {
    record,
    text,
    diagnostic: {
      jsonParsed: true,
      rootIsObject,
      statusPresent,
      statusRecognized,
      statusValue,
      generatedTextFieldPresent: text.fieldPresent,
      generatedOutputEmpty: text.empty,
      providerErrorObjectPresent,
      classification,
    },
  };
}

function malformedJsonDiagnostic(): AiProviderDiagnostic {
  return {
    jsonParsed: false,
    rootIsObject: false,
    statusPresent: false,
    statusRecognized: false,
    statusValue: null,
    generatedTextFieldPresent: false,
    generatedOutputEmpty: null,
    providerErrorObjectPresent: false,
    classification: "unexpected",
  };
}

function safeFailure(status: number): AiProviderResult {
  if (status === 401 || status === 403) {
    return {
      dispatched: true,
      upstreamStatus: status,
      status: "failed",
      code: "upstream_auth",
      message: "Google rejected the configured Gemini credential.",
    };
  }
  if (status === 429) {
    return {
      dispatched: true,
      upstreamStatus: status,
      status: "failed",
      code: "rate_limit_exceeded",
      message: "Google's Gemini request limit was reached.",
    };
  }
  return {
    dispatched: true,
    upstreamStatus: status,
    status: "failed",
    code: "upstream_error",
    message: "Google's Gemini service could not complete the request.",
  };
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";

  constructor(
    private readonly secretStore: AiSecretStore,
    private readonly fetcher: typeof fetch = globalThis.fetch,
  ) {}

  get configured(): boolean {
    return true;
  }

  async testConnection(): Promise<AiConnectionTestResult> {
    let key: string;
    try {
      key = await this.secretStore.read();
    } catch {
      return {
        ok: false,
        status: null,
        models: [],
        message: "The saved Gemini key could not be read.",
      };
    }

    const models = [...new Set(
      Object.values(AI_FEATURE_CONFIGS).map(({ model }) => model),
    )];
    let lastStatus: number | null = null;
    for (const model of models) {
      try {
        const response = await this.fetcher(
          `${API_ORIGIN}/v1beta/models/${encodeURIComponent(model)}`,
          {
            method: "GET",
            headers: { "x-goog-api-key": key, Accept: "application/json" },
            redirect: "error",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
        );
        lastStatus = response.status;
        if (!response.ok) {
          const message =
            response.status === 401
              ? "Google rejected the Gemini API key. Verify the key and its Gemini API access."
              : response.status === 403
                ? "Google denied access to a configured model. Check key restrictions, project access, and billing."
                : response.status === 429
                  ? "The project's Gemini quota or rate limit was reached. Check AI Studio quota and billing, then try again later."
                  : "Google could not confirm access to every configured model.";
          return {
            ok: false,
            status: response.status,
            models: [],
            message,
          };
        }
        await response.body?.cancel();
      } catch {
        return {
          ok: false,
          status: lastStatus,
          models: [],
          message: "StudyHub could not reach Google's Gemini model catalogue.",
        };
      }
    }

    return {
      ok: true,
      status: lastStatus,
      models,
      message: "The key can access all configured Gemini models.",
    };
  }

  async send(payload: AiProviderPayload): Promise<AiProviderResult> {
    let key: string;
    try {
      key = await this.secretStore.read();
    } catch {
      return {
        dispatched: false,
        upstreamStatus: null,
        status: "failed",
        code: "not_configured",
        message: "The server-side Gemini key is unavailable.",
      };
    }

    let response: Response;
    try {
      response = await this.fetcher(`${API_ORIGIN}/v1beta/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return {
        dispatched: true,
        upstreamStatus: null,
        status: "failed",
        code: "upstream_error",
        message: "The Gemini request did not complete.",
      };
    }

    if (!response.ok) return safeFailure(response.status);

    let value: unknown;
    try {
      value = await response.json();
    } catch {
      return {
        dispatched: true,
        upstreamStatus: response.status,
        status: "failed",
        code: "upstream_error",
        message: "Google returned an unreadable Gemini response.",
        diagnostic: malformedJsonDiagnostic(),
      };
    }

    const inspected = inspectResponse(value);
    const diagnostic = inspected.diagnostic;
    const record = inspected.record;
    if (!record) {
      return {
        dispatched: true,
        upstreamStatus: response.status,
        status: "failed",
        code: "upstream_error",
        message: "Google returned an invalid Gemini response.",
        diagnostic,
      };
    }

    const text = inspected.text.text;
    if (
      record.status === "in_progress" ||
      record.status === "requires_action" ||
      record.status === "requires_continuation"
    ) {
      return {
        dispatched: true,
        upstreamStatus: response.status,
        status: "failed",
        code: "upstream_error",
        message:
          "Gemini returned a non-final interaction status that StudyHub does not continue.",
        diagnostic,
      };
    }
    if (record.status === "incomplete") {
      return {
        dispatched: true,
        upstreamStatus: response.status,
        status: "incomplete",
        outputText: text ?? "",
        message: "Gemini returned an incomplete response.",
        diagnostic,
      };
    }
    if (
      record.status !== "completed" ||
      !inspected.text.fieldPresent ||
      text === null ||
      inspected.text.empty
    ) {
      return {
        dispatched: true,
        upstreamStatus: response.status,
        status: "failed",
        code: record.status === "failed" ? "blocked" : "upstream_error",
        message:
          record.status === "failed"
            ? "Gemini did not return an answer for this request."
            : "Google returned an invalid Gemini response.",
        diagnostic,
      };
    }

    return {
      dispatched: true,
      upstreamStatus: response.status,
      status: "complete",
      outputText: text,
      diagnostic,
    };
  }
}
