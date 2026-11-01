/**
 * The provider boundary.
 *
 * Phase 1 ships no provider client. The only provider that production code
 * can reach is `unconfiguredProvider`, which performs no network activity at
 * all and always reports `not_configured`.
 *
 * A real client is added in a later phase, behind the same interface, and it
 * must never be reachable before provider eligibility is resolved.
 */

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
  /** False for a provider that cannot reach a real upstream endpoint. */
  readonly configured: boolean;
  send(payload: AiProviderPayload): Promise<AiProviderResult>;
}

/**
 * The production provider. It is intentionally inert: it cannot reach the
 * network, it never reads an API key, and it never returns provider output.
 */
export const unconfiguredProvider: AiProvider = {
  name: "unconfigured",
  configured: false,
  async send(): Promise<AiProviderResult> {
    return {
      dispatched: false,
      upstreamStatus: null,
      status: "failed",
      code: "not_configured",
      message:
        "No AI provider is configured. Real dispatch is unavailable until provider eligibility is resolved.",
    };
  },
};
