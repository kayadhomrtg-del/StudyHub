import { AI_FEATURE_CONFIGS } from "./config";
import { AiSecretStore } from "./secretStore";
import type { AiErrorCode, AiProviderPayload } from "./types";

export interface AiProviderResult {
  /** True only when an upstream request was actually made. */
  dispatched: boolean;
  upstreamStatus: number | null;
  status: "complete" | "incomplete" | "failed";
  outputText?: string;
  code?: AiErrorCode;
  message?: string;
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

function responseText(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.outputs)) return null;
  const text = record.outputs
    .filter(
      (output): output is { type: string; text: string } =>
        Boolean(output) &&
        typeof output === "object" &&
        !Array.isArray(output) &&
        (output as Record<string, unknown>).type === "text" &&
        typeof (output as Record<string, unknown>).text === "string",
    )
    .map((output) => output.text)
    .join("");
  return text || null;
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
      };
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        dispatched: true,
        upstreamStatus: response.status,
        status: "failed",
        code: "upstream_error",
        message: "Google returned an invalid Gemini response.",
      };
    }

    const record = value as Record<string, unknown>;
    const text = responseText(value);
    if (record.status === "incomplete") {
      return {
        dispatched: true,
        upstreamStatus: response.status,
        status: "incomplete",
        outputText: text ?? "",
        message: "Gemini returned an incomplete response.",
      };
    }
    if (record.status !== "completed" || text === null) {
      return {
        dispatched: true,
        upstreamStatus: response.status,
        status: "failed",
        code: record.status === "failed" ? "blocked" : "upstream_error",
        message:
          record.status === "failed"
            ? "Gemini did not return an answer for this request."
            : "Google returned an invalid Gemini response.",
      };
    }

    return {
      dispatched: true,
      upstreamStatus: response.status,
      status: "complete",
      outputText: text,
    };
  }
}
