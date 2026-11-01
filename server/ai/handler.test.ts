// @vitest-environment node
import { createServer, request as httpRequest, type Server } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { AiBudget, localDateKey } from "./budget";
import { createAiHandler } from "./handler";
import { AiPayloadStore } from "./payloadStore";
import { createFakeProvider } from "./testing/fakeProvider";
import type { AiActivationReader } from "./activation";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const TODAY = localDateKey(NOW);
const temporaryDirectories: string[] = [];
const servers: Server[] = [];

/**
 * A test double for the explicit activation step. It exists so the handshake
 * can be exercised over HTTP. The production activation reader is permanently
 * disabled, and the production route is covered separately.
 */
const ACTIVATED: AiActivationReader = {
  read: () => ({ activated: true, reason: "activated by the test double" }),
};

interface TestResponse {
  status: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

function call(options: {
  port: number;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port: options.port,
        method: options.method,
        path: options.path,
        headers: options.headers,
        setHost: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            headers: res.headers,
          }),
        );
      },
    );
    req.on("error", reject);
    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

async function startServer(
  handler: ReturnType<typeof createAiHandler>,
): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    handler(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    });
  });
  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const port = address && typeof address !== "string" ? address.port : 0;
  return { server, port };
}

function artifact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    region: "non-eea-uk-ch",
    tier: "free",
    modelsConfirmed: true,
    limitsConfirmed: true,
    effectiveDailyCap: 20,
    exposureAcknowledged: true,
    termsEligibility: {
      status: "established",
      determinedAt: "2026-10-01T09:00:00.000Z",
      termsCheckedAt: "2026-10-20T09:00:00.000Z",
      basis: "authoritative_source",
      sourceUrl: "https://example.invalid/terms",
      sourceQuote: "A verbatim quote from the official document.",
      intendedUse: "Personal study summaries over material imported on this machine.",
    },
    ...overrides,
  };
}

interface Harness {
  port: number;
  usagePath: string;
  provider: ReturnType<typeof createFakeProvider>;
  logLines: string[];
}

async function harness(
  options: {
    enabled?: boolean;
    artifactOverrides?: Record<string, unknown>;
    writeArtifact?: boolean;
    provider?: ReturnType<typeof createFakeProvider>;
    production?: boolean;
  } = {},
): Promise<Harness> {
  const directory = await mkdtemp(join(tmpdir(), "study-hub-ai-handler-"));
  temporaryDirectories.push(directory);

  const gateArtifactPath = join(directory, "ai-launch-gate.json");
  const usagePath = join(directory, "ai-usage.json");

  if (options.writeArtifact !== false) {
    await writeFile(
      gateArtifactPath,
      JSON.stringify(artifact(options.artifactOverrides)),
      "utf8",
    );
  }
  await writeFile(
    usagePath,
    JSON.stringify({
      schemaVersion: 1,
      windowStart: TODAY,
      used: 0,
      updatedAt: NOW.toISOString(),
    }),
    "utf8",
  );

  const provider = options.provider ?? createFakeProvider();
  const logLines: string[] = [];
  let port = 0;

  const handler = createAiHandler({
    root: directory,
    gateArtifactPath,
    usageFilePath: usagePath,
    budget: new AiBudget(usagePath, () => NOW),
    payloadStore: new AiPayloadStore(),
    now: () => NOW,
    env: options.enabled === false ? {} : { STUDY_HUB_AI_ENABLED: "1" },
    logStream: {
      write(chunk: string) {
        logLines.push(chunk);
        return true;
      },
    },
    serverPort: () => port,
    ...(options.production
      ? {}
      : { provider, activation: ACTIVATED }),
  });

  const started = await startServer(handler);
  port = started.port;

  return { port, usagePath, provider, logLines };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
    ),
  );
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("AI proxy routes", () => {
  it("answers with not_configured while the feature is disabled", async () => {
    const { port } = await harness({ enabled: false });

    for (const [method, path] of [
      ["GET", "/api/ai/status"],
      ["POST", "/api/ai/prepare"],
      ["POST", "/api/ai/send"],
    ] as const) {
      const response = await call({
        port,
        method,
        path,
        headers: {
          host: `127.0.0.1:${port}`,
          origin: `http://127.0.0.1:${port}`,
        },
        body: method === "POST" ? "{}" : undefined,
      });

      expect(response.status).toBe(503);
      const parsed = JSON.parse(response.body) as { error: { code: string } };
      expect(parsed.error.code).toBe("not_configured");
    }
  });

  it("rejects a request that does not come from the local application", async () => {
    const { port } = await harness();

    const foreignHost = await call({
      port,
      method: "GET",
      path: "/api/ai/status",
      headers: { host: `example.com:${port}` },
    });
    expect(foreignHost.status).toBe(403);
    expect(
      (JSON.parse(foreignHost.body) as { error: { code: string } }).error.code,
    ).toBe("forbidden_origin");

    const foreignOrigin = await call({
      port,
      method: "POST",
      path: "/api/ai/prepare",
      headers: {
        host: `127.0.0.1:${port}`,
        origin: "http://example.com",
      },
      body: "{}",
    });
    expect(foreignOrigin.status).toBe(403);
    expect(
      (JSON.parse(foreignOrigin.body) as { error: { code: string } }).error.code,
    ).toBe("forbidden_origin");

    const missingOrigin = await call({
      port,
      method: "POST",
      path: "/api/ai/prepare",
      headers: { host: `127.0.0.1:${port}` },
      body: "{}",
    });
    expect(missingOrigin.status).toBe(403);
  });

  it("rejects an unknown route and the wrong method", async () => {
    const { port } = await harness();

    const unknown = await call({
      port,
      method: "GET",
      path: "/api/ai/unknown",
      headers: { host: `127.0.0.1:${port}` },
    });
    expect(unknown.status).toBe(404);

    const wrongMethod = await call({
      port,
      method: "GET",
      path: "/api/ai/prepare",
      headers: { host: `127.0.0.1:${port}` },
    });
    expect(wrongMethod.status).toBe(405);
  });

  it("leaves requests outside the AI namespace alone", async () => {
    const { port } = await harness();

    const response = await call({
      port,
      method: "GET",
      path: "/materials",
      headers: { host: `127.0.0.1:${port}` },
    });
    expect(response.status).toBe(404);
    expect(response.body).toBe("not found");
  });

  it("performs the prepare and send handshake with a single dispatch", async () => {
    const { port, provider, usagePath } = await harness();

    const prepared = await call({
      port,
      method: "POST",
      path: "/api/ai/prepare",
      headers: {
        host: `127.0.0.1:${port}`,
        origin: `http://127.0.0.1:${port}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ feature: "summary", text: "Chapter one." }),
    });

    expect(prepared.status).toBe(200);
    const preparedBody = JSON.parse(prepared.body) as {
      token: string;
      digest: string;
      payload: { store: boolean; input: string };
      payloadText: string;
    };
    expect(preparedBody.payload.store).toBe(false);
    expect(preparedBody.payload.input).toBe("Chapter one.");
    expect(preparedBody.payloadText).toContain("Chapter one.");
    expect(provider.callCount).toBe(0);

    const sent = await call({
      port,
      method: "POST",
      path: "/api/ai/send",
      headers: {
        host: `127.0.0.1:${port}`,
        origin: `http://127.0.0.1:${port}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: preparedBody.token,
        digest: preparedBody.digest,
      }),
    });

    expect(sent.status).toBe(200);
    expect(provider.callCount).toBe(1);

    const budget = new AiBudget(usagePath, () => NOW);
    const state = await budget.read(20);
    expect(state.status === "ok" ? state.used : -1).toBe(1);

    const replay = await call({
      port,
      method: "POST",
      path: "/api/ai/send",
      headers: {
        host: `127.0.0.1:${port}`,
        origin: `http://127.0.0.1:${port}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: preparedBody.token,
        digest: preparedBody.digest,
      }),
    });

    expect(replay.status).toBe(403);
    expect(
      (JSON.parse(replay.body) as { error: { code: string } }).error.code,
    ).toBe("not_approved");
    expect(provider.callCount).toBe(1);
  });

  it("blocks the send route with the production dependencies", async () => {
    const { port, provider } = await harness({ production: true });

    const sent = await call({
      port,
      method: "POST",
      path: "/api/ai/send",
      headers: {
        host: `127.0.0.1:${port}`,
        origin: `http://127.0.0.1:${port}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: "a".repeat(64), digest: "sha256:b" }),
    });

    expect(sent.status).toBe(503);
    const parsed = JSON.parse(sent.body) as {
      error: { code: string; upstreamAttempted: boolean };
    };
    expect(parsed.error.code).toBe("not_configured");
    expect(parsed.error.upstreamAttempted).toBe(false);
    expect(provider.callCount).toBe(0);
  });

  it("reports the production provider on the status route", async () => {
    const { port } = await harness({ production: true });

    const response = await call({
      port,
      method: "GET",
      path: "/api/ai/status",
      headers: { host: `127.0.0.1:${port}` },
    });

    expect(response.status).toBe(200);
    const parsed = JSON.parse(response.body) as {
      provider: string;
      providerConfigured: boolean;
      dispatchPossible: boolean;
    };

    expect(parsed.provider).toBe("unconfigured");
    expect(parsed.providerConfigured).toBe(false);
    expect(parsed.dispatchPossible).toBe(false);
  });

  it("blocks the send route when the launch artifact is absent", async () => {
    const { port, provider } = await harness({ writeArtifact: false });

    const sent = await call({
      port,
      method: "POST",
      path: "/api/ai/send",
      headers: {
        host: `127.0.0.1:${port}`,
        origin: `http://127.0.0.1:${port}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: "a".repeat(64), digest: "sha256:b" }),
    });

    expect(sent.status).toBe(503);
    expect(
      (JSON.parse(sent.body) as { error: { code: string } }).error.code,
    ).toBe("gates_not_recorded");
    expect(provider.callCount).toBe(0);
  });

  it("reports the gate verdict and the budget on the status route", async () => {
    const { port } = await harness({ artifactOverrides: { exposureAcknowledged: false } });

    const response = await call({
      port,
      method: "GET",
      path: "/api/ai/status",
      headers: { host: `127.0.0.1:${port}` },
    });

    expect(response.status).toBe(200);
    const parsed = JSON.parse(response.body) as {
      provider: string;
      dispatchPossible: boolean;
      gates: { verdict: string; code: string | null };
      budget: { status: string; used: number | null; cap: number | null };
    };

    expect(parsed.provider).toBe("fake");
    expect(parsed.dispatchPossible).toBe(false);
    expect(parsed.gates.verdict).toBe("blocked");
    expect(parsed.gates.code).toBe("gates_exposure_not_acknowledged");
    expect(parsed.budget.status).toBe("ok");
    expect(parsed.budget.used).toBe(0);
    expect(parsed.budget.cap).toBe(20);
  });

  it("writes one structured log line per request", async () => {
    const { port, logLines } = await harness({
      artifactOverrides: { exposureAcknowledged: false },
    });

    await call({
      port,
      method: "GET",
      path: "/api/ai/status",
      headers: { host: `127.0.0.1:${port}` },
    });

    expect(logLines).toHaveLength(1);
    const entry = JSON.parse(logLines[0]) as Record<string, unknown>;

    expect(Object.keys(entry).sort()).toEqual(
      [
        "bytesIn",
        "bytesOut",
        "durationMs",
        "errorCode",
        "gateVerdict",
        "method",
        "model",
        "path",
        "status",
        "upstreamAttempted",
        "upstreamStatus",
      ].sort(),
    );
    expect(entry.method).toBe("GET");
    expect(entry.path).toBe("/api/ai/status");
    expect(entry.gateVerdict).toBe("blocked");
    expect(logLines[0]).not.toContain("127.0.0.1");
    expect(logLines[0]).not.toContain("api-key");
  });

  it("logs a passing gate verdict", async () => {
    const { port, logLines } = await harness();

    await call({
      port,
      method: "GET",
      path: "/api/ai/status",
      headers: { host: `127.0.0.1:${port}` },
    });

    expect(logLines).toHaveLength(1);
    const entry = JSON.parse(logLines[0]) as Record<string, unknown>;
    expect(entry.gateVerdict).toBe("pass");
    expect(entry.errorCode).toBeNull();
  });
});
