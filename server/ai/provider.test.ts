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
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
