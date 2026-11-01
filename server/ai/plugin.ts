/**
 * The Vite plugin that mounts the AI proxy.
 *
 * One Node-side plugin registers both Vite lifecycles: `configureServer` for
 * the development server and `configurePreviewServer` for the preview server.
 * The dev server calls only the first and the preview server calls only the
 * second, so both are registered explicitly.
 *
 * Registering `configurePreviewServer` suppresses Vite's own "Did you build
 * your project?" error, because Vite only raises that error when no plugin
 * implements the hook. The plugin therefore restores the identical message.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

import { createAiHandler } from "./handler";

/** The exact message Vite prints when the build output is missing. */
export function missingBuildMessage(outDir: string): string {
  return `The directory "${outDir}" does not exist. Did you build your project?`;
}

/**
 * Restores Vite's missing-build error. Vite raises it only when no plugin
 * implements `configurePreviewServer`, so the plugin raises it itself.
 */
export function assertPreviewBuildExists(config: ResolvedConfig): void {
  const clientEnvironment = config.environments.client;
  const outDir = clientEnvironment?.build?.outDir ?? config.build.outDir;
  const outputDirectory = resolve(config.root, outDir);

  if (!existsSync(outputDirectory)) {
    throw new Error(missingBuildMessage(outDir));
  }
}

function boundPort(
  httpServer: { address(): { port: number } | string | null } | null | undefined,
): number | null {
  const address = httpServer?.address();
  if (!address || typeof address === "string") {
    return null;
  }
  return address.port;
}

/**
 * Options for the AI proxy plugin.
 *
 * The plugin always writes one structured log line per request to standard
 * output. Tests pass a sink instead so that the test output stays readable.
 */
export interface AiProxyPluginOptions {
  logStream?: { write(chunk: string): unknown };
}

/**
 * Creates the plugin that mounts the local, loopback-only AI proxy.
 */
export function studyHubAiProxyPlugin(
  options: AiProxyPluginOptions = {},
): Plugin {
  const handlerOptions = {
    ...(options.logStream ? { logStream: options.logStream } : {}),
  };

  return {
    name: "study-hub-ai-proxy",

    configureServer(server) {
      server.middlewares.use(
        createAiHandler({
          root: server.config.root,
          serverPort: () => boundPort(server.httpServer),
          ...handlerOptions,
        }),
      );
    },

    configurePreviewServer(server) {
      assertPreviewBuildExists(server.config);
      server.middlewares.use(
        createAiHandler({
          root: server.config.root,
          serverPort: () => boundPort(server.httpServer),
          ...handlerOptions,
        }),
      );
    },
  };
}
