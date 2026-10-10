import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { preview } from "vite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function parsePort(value = process.env.STUDY_HUB_PORT ?? "4173") {
  const port = Number(value || "4173");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("STUDY_HUB_PORT must be a whole number between 1024 and 65535.");
  }
  return port;
}

export async function createProductionPreview({
  root = projectRoot,
  port = 4173,
} = {}) {
  const outputDirectory = resolve(root, "dist");
  if (!existsSync(resolve(outputDirectory, "index.html"))) {
    throw new Error(
      `The production build was not found at ${outputDirectory}. Run "npm run build" first.`,
    );
  }

  return preview({
    configFile: root === projectRoot ? resolve(root, "vite.config.ts") : false,
    root,
    preview: {
      host: "127.0.0.1",
      port,
      strictPort: false,
      open: false,
    },
  });
}

async function main() {
  const port = parsePort(process.argv[2] ?? process.env.STUDY_HUB_PORT ?? "4173");
  const server = await createProductionPreview({ port });
  const address = server.httpServer.address();
  if (!address || typeof address === "string") {
    await server.close();
    throw new Error("The local production server did not expose a TCP address.");
  }

  const url = `http://127.0.0.1:${address.port}/`;
  console.log(`Study Hub production server listening at ${url}`);
  console.log("This server accepts connections from this PC only.");
  if (address.port !== port) {
    console.warn(
      `Preferred port ${port} was occupied. Browser data is origin-specific; keep using ${url} to reach data stored for this port.`,
    );
  }

  const close = () => {
    void server.close();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Study Hub could not start: ${error.message}`);
    process.exitCode = 1;
  });
}
