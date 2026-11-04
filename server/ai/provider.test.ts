// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_FEATURE_CONFIGS } from "./config";
import { GeminiProvider } from "./provider";
import { AiSecretStore, type SecretProtector } from "./secretStore";
import type { AiProviderPayload } from "./types";

const directories: string[] = [];
const SECRET = "test-gemini-secret-key-value-123456";

function secretStore(path: string): AiSecretStore {
  const protector: SecretProtector = {
    protect: async (value) => Buffer.from(`protected:${value.toString("base64")}`),
    unprotect: async (value) =>
      Buffer.from(value.toString("utf8").replace(/^protected:/, ""), "base64"),
  };
  return new AiSecretStore(path, protector);
}

function payload(): AiProviderPayload {
  return {
    model: AI_FEATURE_CONFIGS.summary.model,
    input: "Approved material text.",
    system_instruction: AI_FEATURE_CONFIGS.summary.systemInstruction,
    generation_config: { thinking_level: "low", max_output_tokens: 1024 },
    response_format: AI_FEATURE_CONFIGS.summary.responseFormat,
    store: false,
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createProvider(fetcher: typeof fetch) {
  const directory = await mkdtemp(join(tmpdir(), "studyhub-provider-"));
  directories.push(directory);
  const store = secretStore(join(directory, "secret.bin"));
  await store.save(SECRET);
  return new GeminiProvider(store, fetcher);
}

async function createProviderForResponse(value: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  return { fetcher, provider: await createProvider(fetcher) };
}

describe("Gemini provider", () => {
  it("checks model access only after an explicit call and returns no provider body", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 200 }),
    );
    const provider = await createProvider(fetcher);

    const result = await provider.testConnection();

    expect(result.ok).toBe(true);
    expect(result.models).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [input, init] of fetcher.mock.calls) {
      expect(String(input)).toMatch(
        /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\//,
      );
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("error");
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(SECRET);
      expect(init?.body).toBeUndefined();
    }
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it.each([
    [401, "rejected the Gemini API key"],
    [403, "denied access"],
    [429, "quota or rate limit"],
  ])("returns an actionable safe message for HTTP %i", async (status, messagePart) => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response("provider body must stay private", { status }),
    );
    const provider = await createProvider(fetcher);

    const result = await provider.testConnection();

    expect(result.ok).toBe(false);
    expect(result.status).toBe(status);
    expect(result.message).toContain(messagePart);
    expect(result.message).not.toContain(SECRET);
    expect(result.message).not.toContain("provider body");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("reports catalogue network failure without exposing the key", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error(SECRET);
    });
    const provider = await createProvider(fetcher);

    const result = await provider.testConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toContain("could not reach");
    expect(result.message).not.toContain(SECRET);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("sends the exact approved payload once and parses the Interactions response", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
        JSON.stringify({ status: "completed", output_text: '{"summary":"ok"}' }),
        { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const provider = await createProvider(fetcher);
    const outbound = payload();

    const result = await provider.send(outbound);

    expect(result).toMatchObject({
      dispatched: true,
      upstreamStatus: 200,
      status: "complete",
      outputText: '{"summary":"ok"}',
      diagnostic: {
        jsonParsed: true,
        rootIsObject: true,
        statusPresent: true,
        statusRecognized: true,
        statusValue: "completed",
        generatedTextFieldPresent: true,
        generatedOutputEmpty: false,
        providerErrorObjectPresent: false,
        classification: "completed",
      },
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
    );
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(SECRET);
    expect(JSON.parse(String(init?.body))).toEqual(outbound);
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("maps provider errors to safe messages without echoing response bodies or retrying", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ error: { message: SECRET } }), {
          status: 401,
        }),
    );
    const provider = await createProvider(fetcher);

    const result = await provider.send(payload());

    expect(result.code).toBe("upstream_auth");
    expect(result.message).not.toContain(SECRET);
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps incomplete responses distinct and does not retry", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ status: "incomplete", output_text: "partial" }),
          { status: 200 },
        ),
    );
    const provider = await createProvider(fetcher);

    const result = await provider.send(payload());

    expect(result.status).toBe("incomplete");
    expect(result.outputText).toBe("partial");
    expect(result.diagnostic).toMatchObject({
      statusPresent: true,
      statusRecognized: true,
      statusValue: "incomplete",
      generatedTextFieldPresent: true,
      generatedOutputEmpty: false,
      classification: "incomplete",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(["in_progress", "requires_action", "requires_continuation"])(
    "reports %s as a non-final interaction without continuing or retrying",
    async (status) => {
      const fetcher = vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({ status, output_text: "unreturned partial text" }),
            { status: 200 },
          ),
      );
      const provider = await createProvider(fetcher);

      const result = await provider.send(payload());

      expect(result).toMatchObject({
        dispatched: true,
        upstreamStatus: 200,
        status: "failed",
        code: "upstream_error",
        message:
          "Gemini returned a non-final interaction status that StudyHub does not continue.",
        diagnostic: {
          jsonParsed: true,
          rootIsObject: true,
          statusPresent: true,
          statusRecognized: true,
          statusValue: status,
          generatedTextFieldPresent: true,
          generatedOutputEmpty: false,
          providerErrorObjectPresent: false,
          classification: "failed",
        },
      });
      expect(result.outputText).toBeUndefined();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it("reports a completed outputs[] text response", async () => {
    const { fetcher, provider } = await createProviderForResponse({
      status: "completed",
      outputs: [
        { type: "text", text: "alpha" },
        { type: "tool_call", id: "ignored" },
        { type: "text", text: "beta" },
      ],
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      dispatched: true,
      upstreamStatus: 200,
      status: "complete",
      outputText: "alphabeta",
      diagnostic: {
        statusValue: "completed",
        generatedTextFieldPresent: true,
        generatedOutputEmpty: false,
        classification: "completed",
      },
    });
    expect(result.diagnostic).not.toHaveProperty("outputs");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("reports a completed steps[] model_output response", async () => {
    const text = '{"summary":"ok","keyPoints":["one"]}';
    const { fetcher, provider } = await createProviderForResponse({
      status: "completed",
      steps: [{ type: "model_output", content: [{ type: "text", text }] }],
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      dispatched: true,
      upstreamStatus: 200,
      status: "complete",
      outputText: text,
      diagnostic: {
        jsonParsed: true,
        rootIsObject: true,
        statusPresent: true,
        statusRecognized: true,
        statusValue: "completed",
        generatedTextFieldPresent: true,
        generatedOutputEmpty: false,
        providerErrorObjectPresent: false,
        classification: "completed",
      },
    });
    expect(result.diagnostic).not.toHaveProperty("steps");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("ignores thought, search, and other non-model-output steps", async () => {
    const { provider } = await createProviderForResponse({
      status: "completed",
      steps: [
        {
          type: "thought",
          summary: [{ type: "text", text: "private reasoning" }],
        },
        { type: "google_search_call", arguments: { queries: ["ignored"] } },
        { type: "model_output", content: [{ type: "text", text: "answer" }] },
        { type: "function_call", name: "ignored", arguments: {} },
      ],
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({ status: "complete", outputText: "answer" });
    expect(JSON.stringify(result.diagnostic)).not.toContain("private reasoning");
    expect(JSON.stringify(result.diagnostic)).not.toContain("answer");
  });

  it("concatenates text from multiple model_output steps and content items", async () => {
    const { provider } = await createProviderForResponse({
      status: "completed",
      steps: [
        {
          type: "model_output",
          content: [
            { type: "text", text: "alpha" },
            { type: "image", uri: "https://example.com/ignored.png" },
          ],
        },
        { type: "function_call", name: "ignored", arguments: {} },
        {
          type: "model_output",
          content: [
            { type: "text", text: "beta" },
            { type: "text", text: "gamma" },
          ],
        },
      ],
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "complete",
      outputText: "alphabetagamma",
      diagnostic: {
        generatedTextFieldPresent: true,
        generatedOutputEmpty: false,
        classification: "completed",
      },
    });
  });

  it("prefers steps[] text over legacy output_text and outputs[]", async () => {
    const { provider } = await createProviderForResponse({
      status: "completed",
      steps: [{ type: "model_output", content: [{ type: "text", text: "from steps" }] }],
      output_text: "from legacy field",
      outputs: [{ type: "text", text: "from legacy array" }],
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({ status: "complete", outputText: "from steps" });
  });

  it.each([
    { label: "missing content", step: { type: "model_output" } },
    { label: "non-array content", step: { type: "model_output", content: "text" } },
    { label: "empty content", step: { type: "model_output", content: [] } },
    {
      label: "non-text content",
      step: {
        type: "model_output",
        content: [{ type: "image", uri: "https://example.com/ignored.png" }],
      },
    },
  ])("rejects model_output with $label as unexpected", async ({ step }) => {
    const { provider } = await createProviderForResponse({
      status: "completed",
      steps: [step],
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      message: "Google returned an invalid Gemini response.",
      diagnostic: {
        statusValue: "completed",
        generatedTextFieldPresent: false,
        generatedOutputEmpty: null,
        classification: "unexpected",
      },
    });
    expect(result.outputText).toBeUndefined();
  });

  it.each([
    { label: "non-array", steps: "not-an-array" },
    { label: "mixed invalid entries", steps: [null, 42, "text"] },
  ])("tolerates $label steps without exposing content", async ({ steps }) => {
    const { provider } = await createProviderForResponse({
      status: "completed",
      steps,
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      diagnostic: {
        generatedTextFieldPresent: false,
        generatedOutputEmpty: null,
        classification: "unexpected",
      },
    });
  });

  it("never places steps content in diagnostics", async () => {
    const { provider } = await createProviderForResponse({
      status: "completed",
      steps: [
        {
          type: "thought",
          summary: [{ type: "text", text: SECRET }],
        },
        {
          type: "model_output",
          content: [
            {
              type: "text",
              text: `{"summary":"${SECRET}"}`,
              annotations: [
                { type: "url_citation", url: `https://example.com/${SECRET}` },
              ],
            },
          ],
        },
      ],
    });

    const result = await provider.send(payload());

    expect(result.status).toBe("complete");
    expect(JSON.stringify(result.diagnostic)).not.toContain(SECRET);
    expect(Object.keys(result.diagnostic ?? {}).sort()).toEqual(
      [
        "classification",
        "generatedOutputEmpty",
        "generatedTextFieldPresent",
        "jsonParsed",
        "providerErrorObjectPresent",
        "rootIsObject",
        "statusPresent",
        "statusRecognized",
        "statusValue",
      ].sort(),
    );
  });

  it("reports a failed interaction status as a blocked response", async () => {
    const { provider } = await createProviderForResponse({
      status: "failed",
      output_text: "provider refused",
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "blocked",
      message: "Gemini did not return an answer for this request.",
      diagnostic: {
        statusValue: "failed",
        generatedTextFieldPresent: true,
        generatedOutputEmpty: false,
        classification: "failed",
      },
    });
  });

  it("reports a cancelled interaction status as a failed response", async () => {
    const { provider } = await createProviderForResponse({
      status: "cancelled",
      steps: [{ type: "model_output", content: [{ type: "text", text: "partial" }] }],
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      message: "Google returned an invalid Gemini response.",
      diagnostic: {
        statusPresent: true,
        statusRecognized: true,
        statusValue: "cancelled",
        generatedTextFieldPresent: true,
        generatedOutputEmpty: false,
        providerErrorObjectPresent: false,
        classification: "failed",
      },
    });
    expect(result.outputText).toBeUndefined();
  });

  it("reports an HTTP-200 provider error object without logging its content", async () => {
    const { provider } = await createProviderForResponse({
      error: { code: "INVALID_ARGUMENT", message: SECRET },
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      message: "Google returned an invalid Gemini response.",
      diagnostic: {
        jsonParsed: true,
        rootIsObject: true,
        statusPresent: false,
        statusRecognized: false,
        statusValue: null,
        generatedTextFieldPresent: false,
        generatedOutputEmpty: null,
        providerErrorObjectPresent: true,
        classification: "unexpected",
      },
    });
    expect(JSON.stringify(result.diagnostic)).not.toContain(SECRET);
  });

  it.each([
    { label: "array", value: [] as unknown },
    { label: "null", value: null },
    { label: "string", value: "text" },
    { label: "number", value: 42 },
  ])("reports a non-object $label root as unexpected", async ({ value }) => {
    const { provider } = await createProviderForResponse(value);

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      message: "Google returned an invalid Gemini response.",
      diagnostic: {
        jsonParsed: true,
        rootIsObject: false,
        statusPresent: false,
        statusRecognized: false,
        statusValue: null,
        generatedTextFieldPresent: false,
        generatedOutputEmpty: null,
        providerErrorObjectPresent: false,
        classification: "unexpected",
      },
    });
  });

  it("reports a missing status as unexpected", async () => {
    const { provider } = await createProviderForResponse({
      output_text: "text without status",
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      diagnostic: {
        statusPresent: false,
        statusRecognized: false,
        statusValue: null,
        generatedTextFieldPresent: true,
        generatedOutputEmpty: false,
        classification: "unexpected",
      },
    });
  });

  it("reduces an unknown status to other without logging its value", async () => {
    const { provider } = await createProviderForResponse({
      status: SECRET,
      output_text: "text with an unknown status",
    });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      diagnostic: {
        statusPresent: true,
        statusRecognized: false,
        statusValue: "other",
        generatedTextFieldPresent: true,
        generatedOutputEmpty: false,
        classification: "unexpected",
      },
    });
    expect(JSON.stringify(result.diagnostic)).not.toContain(SECRET);
  });

  it("reports a completed response without recognized text as unexpected", async () => {
    const { provider } = await createProviderForResponse({ status: "completed" });

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      diagnostic: {
        statusValue: "completed",
        generatedTextFieldPresent: false,
        generatedOutputEmpty: null,
        classification: "unexpected",
      },
    });
  });

  it.each([
    {
      label: "top-level empty text",
      value: { status: "completed", output_text: "" },
    },
    {
      label: "top-level whitespace text",
      value: { status: "completed", output_text: "   " },
    },
    {
      label: "empty outputs[] text",
      value: { status: "completed", outputs: [{ type: "text", text: "" }] },
    },
    {
      label: "whitespace outputs[] text",
      value: {
        status: "completed",
        outputs: [{ type: "text", text: " \n\t " }],
      },
    },
    {
      label: "empty steps[] text",
      value: {
        status: "completed",
        steps: [{ type: "model_output", content: [{ type: "text", text: "" }] }],
      },
    },
    {
      label: "whitespace steps[] text",
      value: {
        status: "completed",
        steps: [
          { type: "model_output", content: [{ type: "text", text: " \n\t " }] },
        ],
      },
    },
  ])("rejects $label as empty completed output", async ({ value }) => {
    const { provider } = await createProviderForResponse(value);

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      message: "Google returned an invalid Gemini response.",
      diagnostic: {
        statusValue: "completed",
        generatedTextFieldPresent: true,
        generatedOutputEmpty: true,
        classification: "unexpected",
      },
    });
    expect(result.outputText).toBeUndefined();
  });

  it("reports malformed JSON as an unreadable response", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response("{not-json", { status: 200 }),
    );
    const provider = await createProvider(fetcher);

    const result = await provider.send(payload());

    expect(result).toMatchObject({
      status: "failed",
      code: "upstream_error",
      message: "Google returned an unreadable Gemini response.",
      diagnostic: {
        jsonParsed: false,
        rootIsObject: false,
        statusPresent: false,
        statusRecognized: false,
        statusValue: null,
        generatedTextFieldPresent: false,
        generatedOutputEmpty: null,
        providerErrorObjectPresent: false,
        classification: "unexpected",
      },
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
