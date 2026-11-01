import { describe, expect, it, vi } from "vitest";

import type { AiProviderPayload } from "../../../server/ai/types";
import {
  prepareAiFeature,
  prepareSummary,
  sendApprovedAiFeature,
  sendApprovedSummary,
} from "./aiClient";
import { presentAiError } from "./errorPresentation";
import type { AiClientFailure } from "./aiTypes";

const payload: AiProviderPayload = {
  model: "gemini-3.5-flash-lite",
  input: "Chapter one explains the water cycle.",
  system_instruction: "Summarise the supplied study material.",
  generation_config: {
    thinking_level: "low",
    max_output_tokens: 1024,
  },
  response_format: {
    type: "json_schema",
    mime_type: "application/json",
  },
  store: false,
};

const payloadText = JSON.stringify(payload);
const preparedBody = {
  ok: true,
  token: "prepared-token",
  digest: "sha256:abcdef",
  expiresAt: "2026-10-31T12:05:00.000Z",
  payload,
  payloadText,
  payloadBytes: new TextEncoder().encode(payloadText).byteLength,
};

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchReturning(body: unknown, status = 200) {
  return vi.fn<FetchImplementation>(async () => jsonResponse(body, status));
}

describe("AI summary client", () => {
  it("prepares a summary with the exact same-origin request body", async () => {
    const fetchMock = fetchReturning(preparedBody);

    const result = await prepareSummary("Chapter one explains the water cycle.", {
      fetch: fetchMock,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.token).toBe("prepared-token");
    expect(result.value.digest).toBe("sha256:abcdef");
    expect(result.value.payloadText).toBe(payloadText);
    expect(result.value.payload).toEqual(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [route, init] = fetchMock.mock.calls[0];
    expect(route).toBe("/api/ai/prepare");
    expect(String(route).startsWith("/")).toBe(true);
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        feature: "summary",
        text: "Chapter one explains the water cycle.",
      }),
    });
  });

  describe("feature-aware AI client", () => {
    it.each(["quiz", "qa"] as const)(
      "prepares %s using the shared route and exact feature/text body",
      async (feature) => {
        const fetchMock = fetchReturning(preparedBody);
        const text = "Caller-supplied feature input.";

        const result = await prepareAiFeature(feature, text, {
          fetch: fetchMock,
        });

        expect(result.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [route, init] = fetchMock.mock.calls[0];
        expect(route).toBe("/api/ai/prepare");
        expect(String(route)).toMatch(/^\/api\/ai\/prepare$/);
        expect(JSON.parse(String(init?.body))).toEqual({ feature, text });
        expect(Object.keys(JSON.parse(String(init?.body))).sort()).toEqual([
          "feature",
          "text",
        ]);
      },
    );

    it.each(["quiz", "qa"] as const)(
      "sends an approved %s with only the token and digest",
      async (feature) => {
        const fetchMock = fetchReturning({
          ok: true,
          status: "complete",
          model: "gemini-stub-model",
          outputText: "{}",
        });

        const result = await sendApprovedAiFeature(
          { token: "prepared-token", digest: "sha256:abcdef" },
          feature,
          { fetch: fetchMock },
        );

        expect(result.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [route, init] = fetchMock.mock.calls[0];
        expect(route).toBe("/api/ai/send");
        expect(JSON.parse(String(init?.body))).toEqual({
          token: "prepared-token",
          digest: "sha256:abcdef",
        });
        expect(Object.keys(JSON.parse(String(init?.body))).sort()).toEqual([
          "digest",
          "token",
        ]);
      },
    );
  });

  it("rejects a preview whose bytes do not match the payload", async () => {
    const fetchMock = fetchReturning({
      ...preparedBody,
      payloadText: JSON.stringify({ ...payload, input: "different text" }),
    });

    const result = await prepareSummary("Chapter one.", { fetch: fetchMock });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_response");
    expect(result.error.outcome).toBe("not_sent");
    expect(result.error.upstreamAttempted).toBe(false);
  });

  it("reports a failed preview as not sent, because prepare cannot dispatch", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("connection refused");
    });

    const result = await prepareSummary("Chapter one.", { fetch: fetchMock });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("network_error");
    expect(result.error.outcome).toBe("not_sent");
    expect(result.error.message).toContain("No summary request was sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a proxy pre-dispatch rejection to Not sent", async () => {
    const fetchMock = fetchReturning(
      {
        ok: false,
        error: {
          code: "terms_not_eligible",
          message: "Provider eligibility is unresolved.",
          upstreamAttempted: false,
        },
      },
      403,
    );

    const result = await prepareSummary("Chapter one.", { fetch: fetchMock });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("terms_not_eligible");
    expect(result.error.outcome).toBe("not_sent");
    expect(presentAiError(result.error).outcomeLabel).toBe("Not sent");
  });

  it("sends exactly one approved token and digest, with no extra fields", async () => {
    const fetchMock = fetchReturning({
      ok: true,
      status: "complete",
      model: "gemini-3.5-flash-lite",
      outputText: JSON.stringify({
        summary: "A summary.",
        keyPoints: ["A point."],
      }),
    });

    const result = await sendApprovedSummary(
      { token: "prepared-token", digest: "sha256:abcdef" },
      { fetch: fetchMock },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outputText).toContain("A summary.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [route, init] = fetchMock.mock.calls[0];
    expect(route).toBe("/api/ai/send");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        token: "prepared-token",
        digest: "sha256:abcdef",
      }),
    });
  });

  it("does not send without a token and digest", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(preparedBody));

    const result = await sendApprovedSummary(
      { token: " ", digest: "sha256:abcdef" },
      { fetch: fetchMock },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_approved");
    expect(result.error.outcome).toBe("not_sent");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns incomplete output as a post-dispatch warning, not an error before sending", async () => {
    const fetchMock = fetchReturning(
      {
        ok: false,
        error: {
          code: "incomplete",
          message: "The provider response was truncated.",
          upstreamAttempted: true,
        },
        outputText: "{\"summary\":\"Partial",
      },
      200,
    );

    const result = await sendApprovedSummary(
      { token: "prepared-token", digest: "sha256:abcdef" },
      { fetch: fetchMock },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("incomplete");
    expect(result.error.outcome).toBe("failed_after_sending");
    expect(result.error.upstreamAttempted).toBe(true);
    expect(result.outputText).toBe("{\"summary\":\"Partial");
    expect(presentAiError(result.error).outcomeLabel).toBe(
      "Request failed after sending",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps rate limiting and quota exhaustion distinct", async () => {
    const rateLimit = await sendApprovedSummary(
      { token: "prepared-token", digest: "sha256:abcdef" },
      {
        fetch: fetchReturning(
          {
            ok: false,
            error: {
              code: "rate_limit_exceeded",
              message: "Too many requests.",
              upstreamAttempted: true,
            },
          },
          429,
        ),
      },
    );
    const quota = await sendApprovedSummary(
      { token: "prepared-token", digest: "sha256:abcdef" },
      {
        fetch: fetchReturning(
          {
            ok: false,
            error: {
              code: "quota_exceeded",
              message: "Daily quota is exhausted.",
              upstreamAttempted: true,
            },
          },
          429,
        ),
      },
    );

    expect(rateLimit.ok).toBe(false);
    expect(quota.ok).toBe(false);
    if (rateLimit.ok || quota.ok) return;
    expect(rateLimit.error.code).toBe("rate_limit_exceeded");
    expect(quota.error.code).toBe("quota_exceeded");
    expect(presentAiError(rateLimit.error).detail).toContain(
      "not assumed to mean the daily quota",
    );
  });

  it("reports a lost send response as unknown and never retries", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("socket closed");
    });

    const result = await sendApprovedSummary(
      { token: "prepared-token", digest: "sha256:abcdef" },
      { fetch: fetchMock },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.outcome).toBe("unknown");
    expect(result.error.upstreamAttempted).toBeNull();
    expect(result.error.message).toContain("may have been sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const presentation = presentAiError(result.error);
    expect(presentation.outcomeLabel).toBe("Request outcome unknown");
    expect(presentation.outcomeLabel).not.toContain("Not sent");
    expect(presentation.detail).toContain("not a confirmed pre-send refusal");
  });

  it("reports a malformed send response as unknown", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("not json at all", {
        status: 502,
        headers: { "Content-Type": "text/plain" },
      }),
    );

    const result = await sendApprovedSummary(
      { token: "prepared-token", digest: "sha256:abcdef" },
      { fetch: fetchMock },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.outcome).toBe("unknown");
    expect(result.error.code).toBe("outcome_unknown");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a malformed success body as unknown after the send", async () => {
    const fetchMock = fetchReturning({
      ok: true,
      status: "complete",
      model: 7,
    });

    const result = await sendApprovedSummary(
      { token: "prepared-token", digest: "sha256:abcdef" },
      { fetch: fetchMock },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.outcome).toBe("unknown");
    expect(result.error.upstreamAttempted).toBeNull();
  });

  it("presents unknown outcomes without claiming the request was not sent", () => {
    const failure: AiClientFailure = {
      code: "outcome_unknown",
      message: "No usable response.",
      upstreamAttempted: null,
      outcome: "unknown",
    };

    const presentation = presentAiError(failure);

    expect(presentation.outcome).toBe("unknown");
    expect(presentation.outcomeLabel).toBe("Request outcome unknown");
    expect(presentation.fallbackAvailable).toBe(true);
    expect(presentation.heading).not.toMatch(/not sent/i);
    expect(presentation.outcomeLabel).not.toMatch(/not sent/i);
  });
});
