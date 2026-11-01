// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { LocalActivationReader } from "./activation";
import { AiConfigurationService } from "./configuration";
import { AiSecretStore, type SecretProtector } from "./secretStore";
import { createFakeProvider } from "./testing/fakeProvider";

const directories: string[] = [];
const NOW = new Date("2026-11-02T12:00:00.000Z");
const SECRET = "test-gemini-secret-key-value-123456";

function memoryProtector(): SecretProtector {
  return {
    protect: async (value) => Buffer.from(`protected:${value.toString("base64")}`),
    unprotect: async (value) =>
      Buffer.from(value.toString("utf8").replace(/^protected:/, ""), "base64"),
  };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("local activation", () => {
  it("rejects activation when the saved key is unreadable", async () => {
    const root = await mkdtemp(join(tmpdir(), "studyhub-activation-"));
    directories.push(root);
    const secretPath = resolve(root, ".study-hub", "ai-provider-secret.bin");
    const secretStore = new AiSecretStore(secretPath, memoryProtector());
    const configuration = new AiConfigurationService(
      root,
      createFakeProvider(),
      secretStore,
      () => NOW,
    );

    const setup = await configuration.activateFromExplicitConnectionTest({
      apiKey: SECRET,
      region: "non-eea-uk-ch",
      tier: "free",
      ageConfirmed: true,
      billingConfirmed: false,
      exposureAcknowledged: true,
      limitsConfirmed: true,
      effectiveDailyCap: 20,
    });
    expect(setup.ok).toBe(true);

    const activation = new LocalActivationReader(configuration, secretStore);
    expect((await activation.read()).activated).toBe(true);

    await writeFile(secretPath, "corrupted");
    expect(await activation.read()).toMatchObject({
      activated: false,
      reason: "The saved Gemini key is unavailable or invalid.",
    });
  });
});
