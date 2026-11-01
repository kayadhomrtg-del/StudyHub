// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, preview, type PreviewServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { missingBuildMessage, studyHubAiProxyPlugin } from "./plugin";

const temporaryDirectories: string[] = [];
const devServers: ViteDevServer[] = [];
const previewServers: PreviewServer[] = [];

/** Keeps the structured request log out of the test output. */
const SILENT_LOG_STREAM = { write: (): boolean => true };

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "study-hub-ai-plugin-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    devServers.splice(0).map((server) => server.close().catch(() => undefined)),
  );
  await Promise.all(
    previewServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.httpServer.close(() => resolve());
        }),
    ),
  );
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

interface TestResponse {
  status: number;
  body: string;
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

function serverPort(server: { httpServer: { address(): unknown } | null }): number {
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("The test server has no address.");
  }
  return (address as { port: number }).port;
}

describe("AI proxy Vite plugin", () => {
  it("mounts the AI routes on the development server", async () => {
    const root = await temporaryDirectory();
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true },
      plugins: [
        studyHubAiProxyPlugin({
          env: { STUDY_HUB_AI_ENABLED: "1" },
          logStream: SILENT_LOG_STREAM,
        }),
      ],
      server: { port: 0, host: "127.0.0.1" },
    });
    devServers.push(server);
    await server.listen();

    const port = serverPort(server);
    const response = await call({
      port,
      method: "GET",
      path: "/api/ai/status",
      headers: { host: `127.0.0.1:${port}` },
    });

    expect(response.status).toBe(200);
    const parsed = JSON.parse(response.body) as {
      providerConfigured: boolean;
      dispatchPossible: boolean;
    };
    expect(parsed.providerConfigured).toBe(false);
    expect(parsed.dispatchPossible).toBe(false);
  });

  it("binds the development server to loopback only", async () => {
    const root = await temporaryDirectory();
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true },
      plugins: [studyHubAiProxyPlugin({ logStream: SILENT_LOG_STREAM })],
      server: { port: 0, host: "127.0.0.1" },
    });
    devServers.push(server);
    await server.listen();

    const address = server.httpServer?.address();
    expect(address && typeof address !== "string" ? address.address : null).toBe(
      "127.0.0.1",
    );
  });

  it("mounts the AI routes on the preview server", async () => {
    const root = await temporaryDirectory();
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(
      join(root, "dist", "index.html"),
      "<!doctype html><html><head><title>Study Hub</title></head><body>ready</body></html>",
      "utf8",
    );

    const server = await preview({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [
        studyHubAiProxyPlugin({
          env: { STUDY_HUB_AI_ENABLED: "1" },
          logStream: SILENT_LOG_STREAM,
        }),
      ],
      preview: { port: 0, host: "127.0.0.1" },
    });
    previewServers.push(server);

    const port = serverPort(server);

    const aiResponse = await call({
      port,
      method: "GET",
      path: "/api/ai/status",
      headers: { host: `127.0.0.1:${port}` },
    });
    expect(aiResponse.status).toBe(200);
    const aiStatus = JSON.parse(aiResponse.body) as {
      providerConfigured: boolean;
      dispatchPossible: boolean;
    };
    expect(aiStatus.providerConfigured).toBe(false);
    expect(aiStatus.dispatchPossible).toBe(false);

    const pageResponse = await call({
      port,
      method: "GET",
      path: "/",
      headers: { host: `127.0.0.1:${port}` },
    });
    expect(pageResponse.status).toBe(200);
    expect(pageResponse.body).toContain("Study Hub");
  });

  it("keeps generation disabled without the explicit feature flag", async () => {
    const root = await temporaryDirectory();
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true },
      plugins: [studyHubAiProxyPlugin({ env: {}, logStream: SILENT_LOG_STREAM })],
      server: { port: 0, host: "127.0.0.1" },
    });
    devServers.push(server);
    await server.listen();

    const port = serverPort(server);
    const response = await call({
      port,
      method: "GET",
      path: "/api/ai/status",
      headers: { host: `127.0.0.1:${port}` },
    });

    expect(response.status).toBe(503);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: { code: "not_configured" },
    });
  });

  it("restores Vite's missing-build error on the preview server", async () => {
    const root = await temporaryDirectory();

    await expect(
      preview({
        configFile: false,
        root,
        logLevel: "silent",
        plugins: [studyHubAiProxyPlugin({ logStream: SILENT_LOG_STREAM })],
        preview: { port: 0, host: "127.0.0.1" },
      }),
    ).rejects.toThrow(missingBuildMessage("dist"));
  });

  it("uses the exact wording of Vite's missing-build error", () => {
    expect(missingBuildMessage("dist")).toBe(
      'The directory "dist" does not exist. Did you build your project?',
    );
  });
});
