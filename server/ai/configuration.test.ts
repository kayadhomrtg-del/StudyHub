// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { AiConfigurationService } from "./configuration";
import { AiBudget } from "./budget";
import { AiSecretStore, type SecretProtector } from "./secretStore";
import { createFakeProvider } from "./testing/fakeProvider";
import { evaluateGates, readGateArtifact } from "./gates";

const directories: string[] = [];
const KEY = "test-gemini-secret-key-value-123456";
const NOW = new Date("2026-11-02T12:00:00.000Z");

function memoryProtector(): SecretProtector {
  return {
    protect: async (value) => Buffer.from(`protected:${value.toString("base64")}`),
    unprotect: async (value) =>
      Buffer.from(value.toString("utf8").replace(/^protected:/, ""), "base64"),
  };
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "studyhub-config-"));
  directories.push(root);
  const secrets = new AiSecretStore(
    resolve(root, ".study-hub", "ai-provider-secret.bin"),
    memoryProtector(),
  );
  const provider = createFakeProvider();
  const service = new AiConfigurationService(
    root,
    provider,
    secrets,
    () => NOW,
  );
  return { root, service, provider, secrets };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    apiKey: KEY,
    region: "non-eea-uk-ch",
    tier: "free",
    ageConfirmed: true,
    billingConfirmed: false,
    exposureAcknowledged: true,
    limitsConfirmed: true,
    effectiveDailyCap: 20,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("local AI configuration", () => {
  it("stores no plaintext key and activates only after the explicit model check succeeds", async () => {
    const { root, service, provider } = await setup();
    const result = await service.activateFromExplicitConnectionTest(input());

    expect(result.ok).toBe(true);
    expect(provider.connectionTestCount).toBe(1);
    const status = await service.status();
    expect(status).toMatchObject({
      hasKey: true,
      activated: true,
      gateCode: null,
      region: "non-eea-uk-ch",
      tier: "free",
    });

    const secretPath = resolve(root, ".study-hub", "ai-provider-secret.bin");
    const runtimePath = resolve(root, ".study-hub", "ai-runtime-state.json");
    const gate = await readGateArtifact(
      resolve(root, ".study-hub", "ai-launch-gate.json"),
    );
    expect((await readFile(secretPath)).toString("utf8")).not.toContain(KEY);
    expect(await readFile(runtimePath, "utf8")).not.toContain(KEY);
    expect(JSON.stringify(gate)).not.toContain(KEY);
    expect(gate.status).toBe("ok");
    if (gate.status === "ok") {
      expect(gate.artifact.termsEligibility).toMatchObject({
        basis: "owner_reported_confirmation",
        sourceQuote: null,
      });
      expect(evaluateGates(gate.artifact, NOW).ok).toBe(true);
    }
  });

  it("does not activate after an unsuccessful connection test", async () => {
    const { root, provider } = await setup();
    const failedProvider = createFakeProvider({ connectionOk: false });
    const serviceWithFailure = new AiConfigurationService(
      root,
      failedProvider,
      new AiSecretStore(
        resolve(root, ".study-hub", "failure-key.bin"),
        memoryProtector(),
      ),
      () => NOW,
    );

    const result = await serviceWithFailure.activateFromExplicitConnectionTest(input());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected connection failure.");
    expect(failedProvider.connectionTestCount).toBe(1);
    expect(result.message).toContain("The key was saved, but the connection test failed.");
    expect(await serviceWithFailure.secretStore.read()).toBe(KEY);
    expect(await serviceWithFailure.status()).toMatchObject({
      hasKey: true,
      activated: false,
    });
    expect(provider.connectionTestCount).toBe(0);
    const gate = await readGateArtifact(
      resolve(root, ".study-hub", "ai-launch-gate.json"),
    );
    expect(gate.status).toBe("ok");
    if (gate.status === "ok") {
      expect(gate.artifact.modelsConfirmed).toBe(false);
    }
  });

  it("rejects an empty key when no saved key exists", async () => {
    const { service, provider, secrets } = await setup();
    const result = await service.activateFromExplicitConnectionTest(input({ apiKey: "" }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected empty-key rejection.");
    expect(result.message).toContain("Enter a Gemini key");
    expect(provider.connectionTestCount).toBe(0);
    expect(await secrets.hasSecret()).toBe(false);
  });

  it("reports secure-storage failure without testing or exposing the submitted key", async () => {
    const { root, provider } = await setup();
    const failingStore = new AiSecretStore(
      resolve(root, ".study-hub", "failed-key.bin"),
      {
        protect: async () => {
          throw new Error("sensitive underlying DPAPI detail");
        },
        unprotect: async () => {
          throw new Error("unavailable");
        },
      },
    );
    const service = new AiConfigurationService(root, provider, failingStore, () => NOW);
    const result = await service.activateFromExplicitConnectionTest(input());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected secure-storage failure.");
    expect(result.message).toContain("could not be saved securely");
    expect(result.message).not.toContain(KEY);
    expect(result.message).not.toContain("sensitive underlying");
    expect(provider.connectionTestCount).toBe(0);
    expect(await failingStore.hasSecret()).toBe(false);
  });

  it("rejects malformed configuration before saving or testing", async () => {
    const { service, provider, secrets } = await setup();
    const result = await service.activateFromExplicitConnectionTest(
      input({ effectiveDailyCap: 0 }),
    );

    expect(result.ok).toBe(false);
    expect(provider.connectionTestCount).toBe(0);
    expect(await secrets.hasSecret()).toBe(false);
  });

  it("blocks restricted regions without paid billing before contacting Google", async () => {
    const { service, provider, secrets } = await setup();
    const result = await service.activateFromExplicitConnectionTest(
      input({ region: "eea", tier: "free" }),
    );

    expect(result.ok).toBe(false);
    expect(provider.connectionTestCount).toBe(0);
    expect(await secrets.hasSecret()).toBe(false);
  });

  it("remembers Continue without AI and removes a key without exposing it in status", async () => {
    const { service } = await setup();
    await service.continueWithoutAi();
    expect(await service.status()).toMatchObject({
      hasKey: false,
      setupSkipped: true,
      activated: false,
    });

    await service.activateFromExplicitConnectionTest(input());
    const removed = await service.removeKey();
    expect(removed).toMatchObject({
      hasKey: false,
      setupSkipped: true,
      activated: false,
    });
    expect(JSON.stringify(removed)).not.toContain(KEY);
  });

  it("initializes a new budget without overwriting an existing count", async () => {
    const { root } = await setup();
    const path = resolve(root, ".study-hub", "budget.json");
    const budget = new AiBudget(path, () => NOW);
    await budget.initialize();
    const initial = await readFile(path, "utf8");
    await budget.initialize();
    expect(await readFile(path, "utf8")).toBe(initial);
    expect(JSON.parse(initial).used).toBe(0);
  });
});
