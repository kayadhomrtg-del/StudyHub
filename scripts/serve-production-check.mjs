import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createProductionPreview, parsePort } from "./serve-production.mjs";

let projectRoot;
const previewServers = [];

before(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "study-hub-server-test-"));
  await mkdir(join(projectRoot, "dist"));
  await writeFile(
    join(projectRoot, "dist", "index.html"),
    "<!doctype html><html><head><title>Test Study Hub</title></head><body>ready</body></html>",
  );
});

after(async () => {
  await Promise.all(previewServers.map((server) => server.close()));
  await rm(projectRoot, { recursive: true, force: true });
});

function remember(server) {
  previewServers.push(server);
  return server;
}

test("accepts a valid configurable port and rejects invalid values", () => {
  assert.equal(parsePort("4300"), 4300);
  assert.equal(parsePort(""), 4173);
  for (const value of ["abc", "0", "1023", "65536", "4173.5"]) {
    assert.throws(() => parsePort(value), /STUDY_HUB_PORT/);
  }
});

test("requires a built app and serves the SPA on loopback", async () => {
  await assert.rejects(
    createProductionPreview({ root: join(projectRoot, "missing") }),
    /Run "npm run build" first/,
  );

  const server = remember(
    await createProductionPreview({ root: projectRoot, port: 0 }),
  );
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  assert.equal(address.address, "127.0.0.1");

  const response = await fetch(`http://127.0.0.1:${address.port}/materials`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Test Study Hub/);
});

test("moves to another port when the preferred port is already in use", async () => {
  const blocker = createServer();
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", resolve);
  });
  const blockerAddress = blocker.address();
  assert.ok(blockerAddress && typeof blockerAddress !== "string");

  try {
    const server = remember(
      await createProductionPreview({
        root: projectRoot,
        port: blockerAddress.port,
      }),
    );
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== "string");
    assert.notEqual(address.port, blockerAddress.port);
    assert.equal(address.address, "127.0.0.1");
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(response.status, 200);
  } finally {
    await new Promise((resolve, reject) => {
      blocker.close((error) => error ? reject(error) : resolve());
    });
  }
});
