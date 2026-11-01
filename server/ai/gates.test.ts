// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateGates,
  parseGateArtifact,
  readAndEvaluateGates,
  readGateArtifact,
  type AiGateArtifact,
} from "./gates";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "study-hub-ai-gates-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function validArtifact(overrides: Partial<AiGateArtifact> = {}): AiGateArtifact {
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

/**
 * Extracts the sample artifact straight from the launch checklist document so
 * the test and the document can never drift apart.
 */
async function readChecklistSampleArtifact(): Promise<unknown> {
  const documentPath = fileURLToPath(
    new URL("../../docs/AI_LAUNCH_CHECKLIST.md", import.meta.url),
  );
  const text = await readFile(documentPath, "utf8");
  const blocks = [...text.matchAll(/```json\r?\n([\s\S]*?)```/g)].map(
    (match) => match[1],
  );
  const sample = blocks.find((block) => block.includes('"schemaVersion"'));
  expect(sample).toBeDefined();
  return JSON.parse(sample as string);
}

describe("launch-gate artifact", () => {
  it("treats the sample artifact in the checklist as inert", async () => {
    const sample = await readChecklistSampleArtifact();
    const parsed = parseGateArtifact(sample);

    expect(parsed.status).toBe("ok");
    if (parsed.status !== "ok") {
      return;
    }

    expect(parsed.artifact.termsEligibility.status).toBe("unresolved");
    expect(parsed.artifact.exposureAcknowledged).toBe(false);
    expect(parsed.artifact.modelsConfirmed).toBe(false);
    expect(parsed.artifact.limitsConfirmed).toBe(false);

    const verdict = evaluateGates(parsed.artifact, NOW);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("terms_not_eligible");
    }
  });

  it("reports gates_not_recorded when the artifact is absent", async () => {
    const directory = await temporaryDirectory();
    const verdict = await readAndEvaluateGates(
      join(directory, "ai-launch-gate.json"),
      NOW,
    );

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("gates_not_recorded");
    }
  });

  it("reports gates_invalid for malformed artifacts", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "ai-launch-gate.json");

    await writeFile(path, "not json at all", "utf8");
    const malformed = await readGateArtifact(path);
    expect(malformed.status).toBe("invalid");

    await writeFile(path, JSON.stringify({ schemaVersion: 2 }), "utf8");
    const wrongVersion = await readGateArtifact(path);
    expect(wrongVersion.status).toBe("invalid");

    await writeFile(
      path,
      JSON.stringify({ schemaVersion: 2, region: "non-eea-uk-ch" }),
      "utf8",
    );
    const incomplete = await readGateArtifact(path);
    expect(incomplete.status).toBe("invalid");
  });

  it("rejects an artifact whose effectiveDailyCap is not a positive integer", () => {
    for (const cap of [0, -1, 1.5, "20", null]) {
      const parsed = parseGateArtifact({
        ...validArtifact(),
        effectiveDailyCap: cap,
      });
      expect(parsed.status).toBe("invalid");
    }
  });

  it("accepts a complete artifact", () => {
    const parsed = parseGateArtifact(validArtifact());
    expect(parsed.status).toBe("ok");

    const verdict = evaluateGates(validArtifact(), NOW);
    expect(verdict.ok).toBe(true);
  });
});

describe("gate evaluation order", () => {
  it("blocks unresolved eligibility before anything else", () => {
    const artifact = validArtifact({
      region: "eea",
      exposureAcknowledged: false,
      modelsConfirmed: false,
    });
    artifact.termsEligibility.status = "unresolved";

    const verdict = evaluateGates(artifact, NOW);

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("terms_not_eligible");
    }
  });

  it("blocks an incomplete determination before staleness", () => {
    const artifact = validArtifact();
    artifact.termsEligibility.sourceQuote = "   ";

    const verdict = evaluateGates(artifact, NOW);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("gates_invalid");
    }
  });

  it("blocks a stale determination before the region check", () => {
    const artifact = validArtifact({ region: "united-kingdom" });
    artifact.termsEligibility.termsCheckedAt = "2026-09-01T09:00:00.000Z";

    const verdict = evaluateGates(artifact, NOW);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("terms_check_stale");
    }
  });

  it("keeps a determination inside the thirty day window", () => {
    const artifact = validArtifact();
    artifact.termsEligibility.termsCheckedAt = "2026-09-23T12:00:00.000Z";

    const verdict = evaluateGates(artifact, NOW);
    expect(verdict.ok).toBe(true);
  });

  it("requires paid service and active billing for restricted regions", () => {
    for (const region of ["eea", "switzerland", "united-kingdom"] as const) {
      const verdict = evaluateGates(validArtifact({ region }), NOW);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) {
        expect(verdict.code).toBe("region_not_permitted");
      }
      const paid = evaluateGates(
        validArtifact({ region, tier: "paid", billingConfirmed: true }),
        NOW,
      );
      expect(paid.ok).toBe(true);
    }
  });

  it("blocks an unconfirmed age requirement and owner-reported terms without a source", () => {
    const age = evaluateGates(validArtifact({ ageConfirmed: false }), NOW);
    expect(age.ok).toBe(false);
    if (!age.ok) expect(age.code).toBe("age_not_confirmed");

    const reported = validArtifact();
    reported.termsEligibility.basis = "owner_reported_confirmation";
    reported.termsEligibility.sourceQuote = null;
    reported.termsEligibility.sourceUrl = null;
    const noSource = evaluateGates(reported, NOW);
    expect(noSource.ok).toBe(false);
    if (!noSource.ok) expect(noSource.code).toBe("gates_invalid");
  });

  it("blocks unconfirmed models and limits", () => {
    const withoutModels = evaluateGates(
      validArtifact({ modelsConfirmed: false }),
      NOW,
    );
    expect(withoutModels.ok).toBe(false);
    if (!withoutModels.ok) {
      expect(withoutModels.code).toBe("model_not_confirmed");
    }

    const withoutLimits = evaluateGates(
      validArtifact({ limitsConfirmed: false }),
      NOW,
    );
    expect(withoutLimits.ok).toBe(false);
    if (!withoutLimits.ok) {
      expect(withoutLimits.code).toBe("model_not_confirmed");
    }
  });

  it("blocks an unacknowledged exposure", () => {
    const verdict = evaluateGates(
      validArtifact({ exposureAcknowledged: false }),
      NOW,
    );

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("gates_exposure_not_acknowledged");
    }
  });
});
