import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { AiBudget, resolveUsageFilePath } from "./budget";
import {
  AI_FEATURE_CONFIGS,
  AI_LOCAL_STATE_DIRECTORY,
} from "./config";
import {
  evaluateGates,
  readGateArtifact,
  resolveGateArtifactPath,
  type AiGateArtifact,
  type AiRegion,
  type AiTier,
} from "./gates";
import type { AiProvider } from "./provider";
import { AiSecretStore, resolveSecretFilePath } from "./secretStore";

const OWNER_REPORT_DATE = "2026-11-02T00:16:36.532+02:00";
const TERMS_URL = "https://ai.google.dev/gemini-api/terms";
const STATE_FILENAME = "ai-runtime-state.json";
const REGIONS: readonly AiRegion[] = [
  "non-eea-uk-ch",
  "eea",
  "switzerland",
  "united-kingdom",
];
const TIERS: readonly AiTier[] = ["free", "paid"];

interface RuntimeState {
  schemaVersion: 1;
  setupSkipped: boolean;
  activated: boolean;
}

export interface AiConfigurationStatus {
  hasKey: boolean;
  setupSkipped: boolean;
  activated: boolean;
  gateCode: string | null;
  gateReason: string | null;
  region: AiRegion | null;
  tier: AiTier | null;
}

export interface AiConfigurationInput {
  apiKey: string;
  region: AiRegion;
  tier: AiTier;
  ageConfirmed: boolean;
  billingConfirmed: boolean;
  exposureAcknowledged: boolean;
  limitsConfirmed: boolean;
  effectiveDailyCap: number;
}

export type AiConfigurationResult =
  | {
      ok: true;
      status: AiConfigurationStatus;
      models: string[];
    }
  | {
      ok: false;
      status: AiConfigurationStatus;
      message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRuntimeStatePath(root: string): string {
  return resolve(root, AI_LOCAL_STATE_DIRECTORY, STATE_FILENAME);
}

async function writeAtomic(path: string, value: string | Buffer): Promise<void> {
  const temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporary, value, { flag: "wx" });
    await rename(temporary, path);
  } catch {
    throw new Error("Local AI configuration could not be saved.");
  }
}

function validateInput(value: unknown): AiConfigurationInput | null {
  if (!isRecord(value)) return null;
  if (typeof value.apiKey !== "string" || value.apiKey.length > 512) return null;
  if (typeof value.region !== "string" || !REGIONS.includes(value.region as AiRegion)) {
    return null;
  }
  if (typeof value.tier !== "string" || !TIERS.includes(value.tier as AiTier)) {
    return null;
  }
  if (typeof value.ageConfirmed !== "boolean") return null;
  if (typeof value.billingConfirmed !== "boolean") return null;
  if (typeof value.exposureAcknowledged !== "boolean") return null;
  if (typeof value.limitsConfirmed !== "boolean") return null;
  if (
    typeof value.effectiveDailyCap !== "number" ||
    !Number.isInteger(value.effectiveDailyCap) ||
    value.effectiveDailyCap < 1 ||
    value.effectiveDailyCap > 100
  ) {
    return null;
  }
  return {
    apiKey: value.apiKey,
    region: value.region as AiRegion,
    tier: value.tier as AiTier,
    ageConfirmed: value.ageConfirmed,
    billingConfirmed: value.billingConfirmed,
    exposureAcknowledged: value.exposureAcknowledged,
    limitsConfirmed: value.limitsConfirmed,
    effectiveDailyCap: value.effectiveDailyCap,
  };
}

function buildArtifact(
  input: AiConfigurationInput,
  modelsConfirmed: boolean,
  now: Date,
): AiGateArtifact {
  return {
    schemaVersion: 2,
    region: input.region,
    tier: input.tier,
    modelsConfirmed,
    limitsConfirmed: input.limitsConfirmed,
    ageConfirmed: input.ageConfirmed,
    billingConfirmed: input.billingConfirmed,
    effectiveDailyCap: input.effectiveDailyCap,
    exposureAcknowledged: input.exposureAcknowledged,
    termsEligibility: {
      status: "established",
      determinedAt: OWNER_REPORT_DATE,
      termsCheckedAt: now.toISOString(),
      basis: "owner_reported_confirmation",
      sourceUrl: TERMS_URL,
      sourceQuote: null,
      intendedUse:
        "Personal coursework in the owner's single-user local StudyHub application; the owner reports that Google confirmed this intended use.",
    },
    recordedAt: now.toISOString(),
    recordedBy: "owner-reported confirmation and local settings",
    checklistReference: "docs/AI_LAUNCH_CHECKLIST.md",
    notes:
      "The owner reported Google's confirmation on 2026-11-02. The written response was not supplied in the project files; its exact scope is not independently verified.",
  };
}

function parseRuntimeState(value: unknown): RuntimeState {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("Local AI runtime settings are invalid.");
  }
  if (
    typeof value.setupSkipped !== "boolean" ||
    typeof value.activated !== "boolean"
  ) {
    throw new Error("Local AI runtime settings are invalid.");
  }
  return {
    schemaVersion: 1,
    setupSkipped: value.setupSkipped,
    activated: value.activated,
  };
}

export class AiConfigurationService {
  readonly secretStore: AiSecretStore;

  private readonly runtimeStatePath: string;
  private readonly gateArtifactPath: string;

  constructor(
    private readonly root: string,
    private readonly provider: AiProvider,
    secretStore = new AiSecretStore(resolveSecretFilePath(root)),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.secretStore = secretStore;
    this.runtimeStatePath = resolveRuntimeStatePath(root);
    this.gateArtifactPath = resolveGateArtifactPath(root);
  }

  async readRuntimeState(): Promise<RuntimeState> {
    let text: string;
    try {
      text = await readFile(this.runtimeStatePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { schemaVersion: 1, setupSkipped: false, activated: false };
      }
      throw new Error("Local AI runtime settings could not be read.");
    }
    try {
      return parseRuntimeState(JSON.parse(text));
    } catch {
      throw new Error("Local AI runtime settings could not be read.");
    }
  }

  private async writeRuntimeState(state: RuntimeState): Promise<void> {
    await writeAtomic(this.runtimeStatePath, JSON.stringify(state));
  }

  async status(): Promise<AiConfigurationStatus> {
    const [state, hasKey, gate] = await Promise.all([
      this.readRuntimeState(),
      this.secretStore.hasSecret(),
      readGateArtifact(this.gateArtifactPath),
    ]);

    if (gate.status !== "ok") {
      return {
        hasKey,
        setupSkipped: state.setupSkipped,
        activated: state.activated,
        gateCode: gate.status === "missing" ? "gates_not_recorded" : "gates_invalid",
        gateReason: gate.reason,
        region: null,
        tier: null,
      };
    }

    const verdict = evaluateGates(gate.artifact, this.now());
    return {
      hasKey,
      setupSkipped: state.setupSkipped,
      activated: state.activated,
      gateCode: verdict.ok ? null : verdict.code,
      gateReason: verdict.ok ? null : verdict.reason,
      region: gate.artifact.region,
      tier: gate.artifact.tier,
    };
  }

  async activateFromExplicitConnectionTest(
    value: unknown,
  ): Promise<AiConfigurationResult> {
    const input = validateInput(value);
    if (
      !input ||
      !input.ageConfirmed ||
      !input.exposureAcknowledged ||
      !input.limitsConfirmed ||
      (input.tier === "paid" && !input.billingConfirmed) ||
      (input.region !== "non-eea-uk-ch" &&
        (input.tier !== "paid" || !input.billingConfirmed))
    ) {
      const status = await this.status();
      return {
        ok: false,
        status,
        message:
          "Complete the age, region, billing, limit, and M1–M8 confirmations before testing a connection.",
      };
    }

    const key = input.apiKey.trim();
    if (key !== "") {
      if (key.length < 20 || /\s/.test(key)) {
        return {
          ok: false,
          status: await this.status(),
          message: "The Gemini key format is not valid.",
        };
      }
      try {
        await this.secretStore.save(key);
      } catch {
        return {
          ok: false,
          status: await this.status(),
          message:
            "The Gemini key could not be saved securely. Check Windows DPAPI and local directory permissions.",
        };
      }
    } else if (!(await this.secretStore.hasSecret())) {
      return {
        ok: false,
        status: await this.status(),
        message: "Enter a Gemini key before testing the connection.",
      };
    }

    const now = this.now();
    try {
      await writeAtomic(
        this.gateArtifactPath,
        JSON.stringify(buildArtifact(input, false, now)),
      );
      await this.writeRuntimeState({
        schemaVersion: 1,
        setupSkipped: false,
        activated: false,
      });
    } catch {
      return {
        ok: false,
        status: await this.status(),
        message:
          "The key was saved, but local AI setup could not be recorded. Connection testing was not started.",
      };
    }

    let connection: Awaited<ReturnType<AiProvider["testConnection"]>>;
    try {
      connection = await this.provider.testConnection();
    } catch {
      return {
        ok: false,
        status: await this.status(),
        message:
          "The key was saved, but the connection test could not complete. Check the local server and try again.",
      };
    }
    if (!connection.ok) {
      return {
        ok: false,
        status: await this.status(),
        message: `The key was saved, but the connection test failed. ${connection.message}`,
      };
    }

    const confirmedArtifact = buildArtifact(input, true, now);
    await writeAtomic(this.gateArtifactPath, JSON.stringify(confirmedArtifact));
    const usage = new AiBudget(resolveUsageFilePath(this.root), this.now);
    try {
      await usage.initialize();
    } catch {
      return {
        ok: false,
        status: await this.status(),
        message:
          "The models were reachable, but the local AI budget could not be initialized. Dispatch remains disabled.",
      };
    }

    await this.writeRuntimeState({
      schemaVersion: 1,
      setupSkipped: false,
      activated: true,
    });
    return {
      ok: true,
      status: await this.status(),
      models: connection.models,
    };
  }

  async continueWithoutAi(): Promise<AiConfigurationStatus> {
    const current = await this.readRuntimeState();
    await this.writeRuntimeState({
      schemaVersion: 1,
      setupSkipped: true,
      activated: current.activated,
    });
    return this.status();
  }

  async removeKey(): Promise<AiConfigurationStatus> {
    await this.secretStore.remove();
    await this.writeRuntimeState({
      schemaVersion: 1,
      setupSkipped: true,
      activated: false,
    });
    return this.status();
  }
}

export function isAiConfigurationInput(value: unknown): value is AiConfigurationInput {
  return validateInput(value) !== null;
}

export function configuredModelIds(): string[] {
  return [...new Set(Object.values(AI_FEATURE_CONFIGS).map(({ model }) => model))];
}
