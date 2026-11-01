// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { AiActivationReader } from "./activation";
import { AiBudget, localDateKey } from "./budget";
import { AiPayloadStore } from "./payloadStore";
import { runPreparePipeline, runSendPipeline } from "./pipeline";
import type { AiPipelineDependencies } from "./pipeline";
import { createFakeProvider } from "./testing/fakeProvider";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const TODAY = localDateKey(NOW);
const temporaryDirectories: string[] = [];

const ACTIVATED: AiActivationReader = {
  read: () => ({ activated: true, reason: "activated for the test" }),
};

const DISABLED: AiActivationReader = {
  read: () => ({ activated: false, reason: "not activated" }),
};

function artifact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    region: "non-eea-uk-ch",
    tier: "free",
    modelsConfirmed: true,
    limitsConfirmed: true,
    ageConfirmed: true,
    billingConfirmed: false,
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
  deps: AiPipelineDependencies;
  usagePath: string;
  provider: ReturnType<typeof createFakeProvider>;
}

async function harness(
  options: {
    activation?: AiActivationReader;
    artifactOverrides?: Record<string, unknown>;
    usage?: Record<string, unknown>;
    provider?: ReturnType<typeof createFakeProvider>;
  } = {},
): Promise<Harness> {
  const directory = await mkdtemp(join(tmpdir(), "study-hub-ai-pipeline-"));
  temporaryDirectories.push(directory);

  const gateArtifactPath = join(directory, "ai-launch-gate.json");
  const usagePath = join(directory, "ai-usage.json");

  await writeFile(
    gateArtifactPath,
    JSON.stringify(artifact(options.artifactOverrides)),
    "utf8",
  );
  await writeFile(
    usagePath,
    JSON.stringify(
      options.usage ?? {
        schemaVersion: 1,
        windowStart: TODAY,
        used: 0,
        updatedAt: NOW.toISOString(),
      },
    ),
    "utf8",
  );

  const provider = options.provider ?? createFakeProvider();

  return {
    provider,
    usagePath,
    deps: {
      provider,
      activation: options.activation ?? ACTIVATED,
      budget: new AiBudget(usagePath, () => NOW),
      payloadStore: new AiPayloadStore(),
      gateArtifactPath,
      now: () => NOW,
    },
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("dispatch mechanics", () => {
  it("dispatches exactly once and charges the budget exactly once", async () => {
    const { deps, provider, usagePath } = await harness();

    const prepared = await runPreparePipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { feature: "summary", text: "Chapter one." },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    const sent = await runSendPipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { token: prepared.value.token, digest: prepared.value.digest },
    });

    expect(sent.ok).toBe(true);
    expect(provider.callCount).toBe(1);
    expect(provider.calls[0].store).toBe(false);

    const budget = new AiBudget(usagePath, () => NOW);
    const state = await budget.read(20);
    expect(state.status).toBe("ok");
    if (state.status === "ok") {
      expect(state.used).toBe(1);
    }
  });

  it("dispatches the stored payload, not the one the caller sent", async () => {
    const { deps, provider } = await harness();

    const prepared = await runPreparePipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { feature: "summary", text: "Chapter one." },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    await runSendPipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { token: prepared.value.token, digest: prepared.value.digest },
    });

    expect(provider.callCount).toBe(1);
    expect(provider.calls[0].input).toBe("Chapter one.");
    expect(JSON.stringify(provider.calls[0])).toBe(prepared.value.payloadText);
  });

  it("does not retry after a provider failure", async () => {
    const provider = createFakeProvider({
      status: "failed",
      code: "upstream_error",
      message: "boom",
    });
    const { deps } = await harness({ provider });

    const prepared = await runPreparePipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { feature: "summary", text: "Chapter one." },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    const sent = await runSendPipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { token: prepared.value.token, digest: prepared.value.digest },
    });

    expect(sent.ok).toBe(false);
    if (!sent.ok) {
      expect(sent.code).toBe("upstream_error");
      expect(sent.upstreamAttempted).toBe(true);
    }
    expect(provider.callCount).toBe(1);
  });

  it("reports a truncated provider response with its partial output", async () => {
    const provider = createFakeProvider({
      status: "incomplete",
      outputText: "half an answer",
    });
    const { deps } = await harness({ provider });

    const prepared = await runPreparePipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { feature: "summary", text: "Chapter one." },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    const sent = await runSendPipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { token: prepared.value.token, digest: prepared.value.digest },
    });

    expect(sent.ok).toBe(false);
    if (!sent.ok) {
      expect(sent.code).toBe("incomplete");
      expect(sent.upstreamAttempted).toBe(true);
      expect(sent.outputText).toBe("half an answer");
    }
  });

  it("refuses an unknown token without dispatching or charging", async () => {
    const { deps, provider, usagePath } = await harness();

    const sent = await runSendPipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { token: "f".repeat(64), digest: `sha256:${"0".repeat(64)}` },
    });

    expect(sent.ok).toBe(false);
    if (!sent.ok) {
      expect(sent.code).toBe("not_approved");
      expect(sent.upstreamAttempted).toBe(false);
    }
    expect(provider.callCount).toBe(0);

    const budget = new AiBudget(usagePath, () => NOW);
    const state = await budget.read(20);
    expect(state.status === "ok" ? state.used : -1).toBe(0);
  });

  it("refuses a mismatched digest without dispatching or charging", async () => {
    const { deps, provider, usagePath } = await harness();

    const prepared = await runPreparePipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { feature: "summary", text: "Chapter one." },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    const sent = await runSendPipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: {
        token: prepared.value.token,
        digest: `sha256:${"a".repeat(64)}`,
      },
    });

    expect(sent.ok).toBe(false);
    if (!sent.ok) {
      expect(sent.code).toBe("integrity_mismatch");
      expect(sent.upstreamAttempted).toBe(false);
    }
    expect(provider.callCount).toBe(0);

    const budget = new AiBudget(usagePath, () => NOW);
    const state = await budget.read(20);
    expect(state.status === "ok" ? state.used : -1).toBe(0);
  });

  it("refuses when the local cap is exhausted", async () => {
    const { deps, provider } = await harness({
      usage: {
        schemaVersion: 1,
        windowStart: TODAY,
        used: 20,
        updatedAt: NOW.toISOString(),
      },
    });

    const prepared = await runPreparePipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { feature: "summary", text: "Chapter one." },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    const sent = await runSendPipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { token: prepared.value.token, digest: prepared.value.digest },
    });

    expect(sent.ok).toBe(false);
    if (!sent.ok) {
      expect(sent.code).toBe("local_limit");
      expect(sent.upstreamAttempted).toBe(false);
    }
    expect(provider.callCount).toBe(0);
  });

  it("refuses when the explicit activation step was not completed", async () => {
    const { deps, provider } = await harness({ activation: DISABLED });

    const prepared = await runPreparePipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { feature: "summary", text: "Chapter one." },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }

    const sent = await runSendPipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { token: prepared.value.token, digest: prepared.value.digest },
    });

    expect(sent.ok).toBe(false);
    if (!sent.ok) {
      expect(sent.code).toBe("not_configured");
      expect(sent.upstreamAttempted).toBe(false);
    }
    expect(provider.callCount).toBe(0);
  });

  it("refuses when a launch gate blocks, without dispatching", async () => {
    const { deps, provider } = await harness({
      artifactOverrides: { exposureAcknowledged: false },
    });

    const prepared = await runPreparePipeline(deps, {
      tooLarge: false,
      bytes: 10,
      value: { feature: "summary", text: "Chapter one." },
    });

    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.code).toBe("gates_exposure_not_acknowledged");
      expect(prepared.gateBlocked).toBe(true);
    }
    expect(provider.callCount).toBe(0);
  });

  it("refuses an oversized request body", async () => {
    const { deps, provider } = await harness();

    const sent = await runSendPipeline(deps, {
      tooLarge: true,
      bytes: 5_000_000,
      value: undefined,
    });

    expect(sent.ok).toBe(false);
    if (!sent.ok) {
      expect(sent.code).toBe("payload_too_large");
    }
    expect(provider.callCount).toBe(0);
  });
});
