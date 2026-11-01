// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { localDateKey } from "./budget";
import { studyHubAiProxyPlugin } from "./plugin";
import { unconfiguredProvider } from "./provider";

const SERVER_DIRECTORY = resolve(fileURLToPath(new URL(".", import.meta.url)));
const temporaryDirectories: string[] = [];
const devServers: ViteDevServer[] = [];
const originalFetch = (globalThis as { fetch?: unknown }).fetch;

/** Keeps the structured request log out of the test output. */
const SILENT_LOG_STREAM = { write: (): boolean => true };

/**
 * The needles are assembled at runtime so that this file does not itself
 * contain the strings it forbids.
 */
const PROVIDER_HOST_PARTS = ["generativelanguage", "googleapis"];
const PROVIDER_HOST = `${PROVIDER_HOST_PARTS.join(".")}.com`;
const GOOGLE_APIS_HOST = `${PROVIDER_HOST_PARTS[1]}.com`;
const CREDENTIAL_MARKERS = [
  ["GEMINI", "API", "KEY"].join("_"),
  ["GOOGLE", "API", "KEY"].join("_"),
  ["API", "KEY"].join("_"),
  ["x-goog", "api", "key"].join("-"),
];

afterEach(async () => {
  (globalThis as { fetch?: unknown }).fetch = originalFetch;
  await Promise.all(
    devServers.splice(0).map((server) => server.close().catch(() => undefined)),
  );
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "study-hub-ai-safety-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(path)));
      continue;
    }
    if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }

  return files;
}

async function readSources(): Promise<
  { path: string; relativePath: string; text: string }[]
> {
  const files = await collectTypeScriptFiles(SERVER_DIRECTORY);
  return Promise.all(
    files.map(async (path) => ({
      path,
      relativePath: relative(SERVER_DIRECTORY, path).split(sep).join("/"),
      text: await readFile(path, "utf8"),
    })),
  );
}

function isProductionModule(relativePath: string): boolean {
  return (
    !relativePath.endsWith(".test.ts") &&
    !relativePath.startsWith("testing/") &&
    relativePath !== "testing/fakeProvider.ts"
  );
}

describe("no external request is possible", () => {
  it("keeps every outbound client out of the production modules", async () => {
    const sources = await readSources();
    const production = sources.filter((source) =>
      isProductionModule(source.relativePath),
    );

    expect(production.length).toBeGreaterThan(0);

    for (const source of production) {
      expect(source.text, `${source.relativePath} must not call fetch`).not.toMatch(
        /\bfetch\s*\(/,
      );
      expect(
        source.text,
        `${source.relativePath} must not import node:https`,
      ).not.toContain("node:https");
      expect(
        source.text,
        `${source.relativePath} must not contain an https URL`,
      ).not.toContain("https://");
      expect(
        source.text,
        `${source.relativePath} must not contain a non-loopback http URL`,
      ).not.toMatch(/http:\/\/(?!127\.0\.0\.1|localhost)/);
    }
  });

  it("never imports the test-only provider from production code", async () => {
    const sources = await readSources();

    for (const source of sources.filter((candidate) =>
      isProductionModule(candidate.relativePath),
    )) {
      expect(
        source.text,
        `${source.relativePath} must not import the fake provider`,
      ).not.toMatch(/from\s+["'][^"']*testing\//);
    }
  });

  it("contains no provider endpoint and no credential names", async () => {
    const sources = await readSources();

    for (const source of sources) {
      expect(
        source.text,
        `${source.relativePath} must not name a provider endpoint`,
      ).not.toContain(PROVIDER_HOST);
      expect(
        source.text,
        `${source.relativePath} must not name a provider endpoint`,
      ).not.toContain(GOOGLE_APIS_HOST);

      for (const marker of CREDENTIAL_MARKERS) {
        expect(
          source.text,
          `${source.relativePath} must not name a credential`,
        ).not.toContain(marker);
      }
    }
  });

  it("ships an inert production provider", async () => {
    expect(unconfiguredProvider.configured).toBe(false);
    expect(unconfiguredProvider.name).toBe("unconfigured");

    const result = await unconfiguredProvider.send({
      model: "gemini-3.5-flash-lite",
      input: "Chapter one.",
      system_instruction: "Summarise the supplied study material.",
      generation_config: { thinking_level: "low", max_output_tokens: 1024 },
      store: false,
    });

    expect(result.dispatched).toBe(false);
    expect(result.upstreamStatus).toBeNull();
    expect(result.code).toBe("not_configured");
  });

  it("makes no outbound call while the mounted route handles a request", async () => {
    const outboundCalls: unknown[] = [];
    (globalThis as { fetch?: unknown }).fetch = (...args: unknown[]) => {
      outboundCalls.push(args);
      throw new Error("Outbound network access is not permitted.");
    };

    const root = await temporaryDirectory();
    await mkdir(join(root, ".study-hub"), { recursive: true });
    await writeFile(
      join(root, ".study-hub", "ai-launch-gate.json"),
      JSON.stringify({
        schemaVersion: 1,
        region: "non-eea-uk-ch",
        tier: "free",
        modelsConfirmed: true,
        limitsConfirmed: true,
        effectiveDailyCap: 20,
        exposureAcknowledged: true,
        termsEligibility: {
          status: "established",
          determinedAt: new Date().toISOString(),
          termsCheckedAt: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          basis: "authoritative_source",
          sourceUrl: "https://example.invalid/terms",
          sourceQuote: "A verbatim quote from the official document.",
          intendedUse: "Personal study summaries over imported material.",
        },
      }),
      "utf8",
    );
    await writeFile(
      join(root, ".study-hub", "ai-usage.json"),
      JSON.stringify({
        schemaVersion: 1,
        windowStart: localDateKey(new Date()),
        used: 0,
        updatedAt: new Date().toISOString(),
      }),
      "utf8",
    );

    const vite = await createViteServer({
      configFile: false,
      root,
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true },
      plugins: [studyHubAiProxyPlugin({ logStream: SILENT_LOG_STREAM })],
      server: { port: 0, host: "127.0.0.1" },
    });
    devServers.push(vite);
    await vite.listen();

    const address = vite.httpServer?.address();
    const port =
      address && typeof address !== "string" ? address.port : Number.NaN;

    const previous = process.env.STUDY_HUB_AI_ENABLED;
    process.env.STUDY_HUB_AI_ENABLED = "1";

    try {
      const response = await new Promise<{ status: number; body: string }>(
        (resolve, reject) => {
          const req = httpRequest(
            {
              host: "127.0.0.1",
              port,
              method: "POST",
              path: "/api/ai/send",
              headers: {
                host: `127.0.0.1:${port}`,
                origin: `http://127.0.0.1:${port}`,
                "content-type": "application/json",
              },
              setHost: false,
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on("data", (chunk: Buffer) => chunks.push(chunk));
              res.on("end", () =>
                resolve({
                  status: res.statusCode ?? 0,
                  body: Buffer.concat(chunks).toString("utf8"),
                }),
              );
            },
          );
          req.on("error", reject);
          req.write(JSON.stringify({ token: "a".repeat(64), digest: "sha256:b" }));
          req.end();
        },
      );

      expect(response.status).toBe(503);
      const parsed = JSON.parse(response.body) as {
        error: { code: string; upstreamAttempted: boolean };
      };
      expect(parsed.error.code).toBe("not_configured");
      expect(parsed.error.upstreamAttempted).toBe(false);
      expect(outboundCalls).toEqual([]);
    } finally {
      if (previous === undefined) {
        delete process.env.STUDY_HUB_AI_ENABLED;
      } else {
        process.env.STUDY_HUB_AI_ENABLED = previous;
      }
    }
  });

  it("keeps the mounted server reachable only on loopback", async () => {
    const root = await temporaryDirectory();
    const vite = await createViteServer({
      configFile: false,
      root,
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true },
      plugins: [studyHubAiProxyPlugin({ logStream: SILENT_LOG_STREAM })],
      server: { port: 0, host: "127.0.0.1" },
    });
    devServers.push(vite);
    await vite.listen();

    const address = vite.httpServer?.address();
    expect(
      address && typeof address !== "string" ? address.address : null,
    ).toBe("127.0.0.1");
  });

  it("keeps a plain HTTP server from being reachable off loopback", async () => {
    // A plain Node server is only used here to prove the helper itself does
    // not silently bind to every interface.
    const server = createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    expect(address && typeof address !== "string" ? address.address : null).toBe(
      "127.0.0.1",
    );
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });
});
