/**
 * The in-process fake provider.
 *
 * This module is a test double. It performs no network activity, it never
 * reads an API key, and it is never imported by production code: the safety
 * test asserts that no module outside `server/ai/testing/` imports it.
 */

import type { AiProvider, AiProviderResult } from "../provider";
import type {
  AiErrorCode,
  AiProviderDiagnostic,
  AiProviderPayload,
} from "../types";

export interface FakeProviderOptions {
  outputText?: string;
  upstreamStatus?: number | null;
  status?: "complete" | "incomplete" | "failed";
  code?: AiErrorCode;
  message?: string;
  dispatched?: boolean;
  connectionOk?: boolean;
  diagnostic?: AiProviderDiagnostic;
}

export interface FakeProvider extends AiProvider {
  /** Every payload the provider was asked to send. */
  readonly calls: AiProviderPayload[];
  readonly callCount: number;
  readonly connectionTestCount: number;
}

export function createFakeProvider(
  options: FakeProviderOptions = {},
): FakeProvider {
  const calls: AiProviderPayload[] = [];
  let connectionTestCount = 0;

  return {
    name: "fake",
    configured: true,
    calls,
    get callCount(): number {
      return calls.length;
    },
    get connectionTestCount(): number {
      return connectionTestCount;
    },
    async testConnection() {
      connectionTestCount += 1;
      return options.connectionOk === false
        ? {
            ok: false,
            status: 401,
            models: [],
            message: "The fake connection test failed.",
          }
        : {
            ok: true,
            status: 200,
            models: ["gemini-3.5-flash-lite", "gemini-3.8-flash"],
            message: "The fake connection test passed.",
          };
    },
    async send(payload: AiProviderPayload): Promise<AiProviderResult> {
      calls.push(payload);
      const dispatched = options.dispatched ?? true;

      if (!dispatched) {
        return {
          dispatched: false,
          upstreamStatus: options.upstreamStatus ?? null,
          status: "failed",
          code: options.code ?? "not_configured",
          message: options.message ?? "The fake provider did not dispatch.",
        };
      }

      const status = options.status ?? "complete";
      if (status === "failed") {
        return {
          dispatched: true,
          upstreamStatus: options.upstreamStatus ?? 500,
          status: "failed",
          code: options.code ?? "upstream_error",
          message: options.message ?? "The fake provider failed.",
          ...(options.diagnostic === undefined
            ? {}
            : { diagnostic: options.diagnostic }),
        };
      }

      return {
        dispatched: true,
        upstreamStatus: options.upstreamStatus ?? 200,
        status,
        outputText: options.outputText ?? "Fake provider output.",
        ...(status === "incomplete"
          ? {
              code: options.code ?? ("incomplete" as AiErrorCode),
              message:
                options.message ?? "The fake provider returned a truncated response.",
            }
          : {}),
        ...(options.diagnostic === undefined
          ? {}
          : { diagnostic: options.diagnostic }),
      };
    },
  };
}
