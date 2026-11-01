/**
 * The launch-gate artifact and its evaluator.
 *
 * The evaluator is a pure function of the artifact and the clock. It never
 * consults the environment, the network, or a test fixture, and no failure
 * path degrades into a permissive default.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  AI_GATE_ARTIFACT_FILENAME,
  AI_LOCAL_STATE_DIRECTORY,
  AI_TERMS_CHECK_STALENESS_DAYS,
} from "./config";
import type { AiErrorCode } from "./types";

export type AiRegion =
  | "non-eea-uk-ch"
  | "eea"
  | "switzerland"
  | "united-kingdom";

export type AiTier = "free" | "paid";

export type AiTermsBasis =
  | "authoritative_source"
  | "owner_decision"
  | "owner_reported_confirmation";

export interface AiTermsEligibility {
  status: "unresolved" | "established";
  determinedAt: string | null;
  termsCheckedAt: string | null;
  basis: AiTermsBasis | null;
  sourceUrl: string | null;
  sourceQuote: string | null;
  intendedUse: string | null;
}

export interface AiGateArtifact {
  schemaVersion: 2;
  region: AiRegion;
  tier: AiTier;
  modelsConfirmed: boolean;
  limitsConfirmed: boolean;
  ageConfirmed: boolean;
  billingConfirmed: boolean;
  /** The single source of truth for the local daily request ceiling. */
  effectiveDailyCap: number;
  exposureAcknowledged: boolean;
  termsEligibility: AiTermsEligibility;
  recordedAt?: string;
  recordedBy?: string;
  checklistReference?: string;
  notes?: string;
}

export type AiGateRead =
  | { status: "ok"; artifact: AiGateArtifact }
  | { status: "missing"; reason: string }
  | { status: "invalid"; reason: string };

export type AiGateVerdict =
  | { ok: true; artifact: AiGateArtifact }
  | { ok: false; code: AiErrorCode; reason: string };

const REGIONS: readonly AiRegion[] = [
  "non-eea-uk-ch",
  "eea",
  "switzerland",
  "united-kingdom",
];

const TIERS: readonly AiTier[] = ["free", "paid"];

const TERMS_BASES: readonly AiTermsBasis[] = [
  "authoritative_source",
  "owner_decision",
  "owner_reported_confirmation",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

/**
 * Validates the artifact shape. Unknown or missing fields are rejected; the
 * evaluator never repairs an artifact.
 */
export function parseGateArtifact(value: unknown): AiGateRead {
  if (!isPlainObject(value)) {
    return { status: "invalid", reason: "The launch artifact is not a JSON object." };
  }

  if (value.schemaVersion !== 2) {
    return {
      status: "invalid",
      reason: `Unsupported launch artifact schemaVersion: ${JSON.stringify(value.schemaVersion)}.`,
    };
  }

  if (typeof value.region !== "string" || !REGIONS.includes(value.region as AiRegion)) {
    return { status: "invalid", reason: "The launch artifact has an unknown region." };
  }

  if (typeof value.tier !== "string" || !TIERS.includes(value.tier as AiTier)) {
    return { status: "invalid", reason: "The launch artifact has an unknown tier." };
  }

  if (typeof value.modelsConfirmed !== "boolean") {
    return { status: "invalid", reason: "modelsConfirmed must be a boolean." };
  }

  if (typeof value.limitsConfirmed !== "boolean") {
    return { status: "invalid", reason: "limitsConfirmed must be a boolean." };
  }

  if (typeof value.exposureAcknowledged !== "boolean") {
    return { status: "invalid", reason: "exposureAcknowledged must be a boolean." };
  }

  if (typeof value.ageConfirmed !== "boolean") {
    return { status: "invalid", reason: "ageConfirmed must be a boolean." };
  }

  if (typeof value.billingConfirmed !== "boolean") {
    return { status: "invalid", reason: "billingConfirmed must be a boolean." };
  }

  if (
    typeof value.effectiveDailyCap !== "number" ||
    !Number.isInteger(value.effectiveDailyCap) ||
    value.effectiveDailyCap <= 0
  ) {
    return {
      status: "invalid",
      reason: "effectiveDailyCap must be a positive whole number.",
    };
  }

  const terms = value.termsEligibility;
  if (!isPlainObject(terms)) {
    return { status: "invalid", reason: "termsEligibility must be an object." };
  }

  if (terms.status !== "unresolved" && terms.status !== "established") {
    return {
      status: "invalid",
      reason: "termsEligibility.status must be unresolved or established.",
    };
  }

  for (const field of [
    "determinedAt",
    "termsCheckedAt",
    "sourceUrl",
    "sourceQuote",
    "intendedUse",
  ] as const) {
    if (!isNullableString(terms[field])) {
      return {
        status: "invalid",
        reason: `termsEligibility.${field} must be a string or null.`,
      };
    }
  }

  if (
    terms.basis !== null &&
    (typeof terms.basis !== "string" ||
      !TERMS_BASES.includes(terms.basis as AiTermsBasis))
  ) {
    return {
      status: "invalid",
      reason:
        "termsEligibility.basis must be null, authoritative_source, owner_decision, or owner_reported_confirmation.",
    };
  }

  for (const field of [
    "recordedAt",
    "recordedBy",
    "checklistReference",
    "notes",
  ] as const) {
    if (!isOptionalString(value[field])) {
      return { status: "invalid", reason: `${field} must be a string when present.` };
    }
  }

  const artifact: AiGateArtifact = {
    schemaVersion: 2,
    region: value.region as AiRegion,
    tier: value.tier as AiTier,
    modelsConfirmed: value.modelsConfirmed,
    limitsConfirmed: value.limitsConfirmed,
    ageConfirmed: value.ageConfirmed,
    billingConfirmed: value.billingConfirmed,
    effectiveDailyCap: value.effectiveDailyCap,
    exposureAcknowledged: value.exposureAcknowledged,
    termsEligibility: {
      status: terms.status,
      determinedAt: terms.determinedAt as string | null,
      termsCheckedAt: terms.termsCheckedAt as string | null,
      basis: terms.basis as AiTermsBasis | null,
      sourceUrl: terms.sourceUrl as string | null,
      sourceQuote: terms.sourceQuote as string | null,
      intendedUse: terms.intendedUse as string | null,
    },
  };

  if (typeof value.recordedAt === "string") artifact.recordedAt = value.recordedAt;
  if (typeof value.recordedBy === "string") artifact.recordedBy = value.recordedBy;
  if (typeof value.checklistReference === "string") {
    artifact.checklistReference = value.checklistReference;
  }
  if (typeof value.notes === "string") artifact.notes = value.notes;

  return { status: "ok", artifact };
}

/** Resolves the launch artifact path for a project root. */
export function resolveGateArtifactPath(root: string): string {
  return resolve(root, AI_LOCAL_STATE_DIRECTORY, AI_GATE_ARTIFACT_FILENAME);
}

/** Reads and validates the launch artifact from disk. */
export async function readGateArtifact(path: string): Promise<AiGateRead> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return {
        status: "missing",
        reason: `No launch artifact was found at ${path}.`,
      };
    }
    return {
      status: "invalid",
      reason: `The launch artifact at ${path} could not be read (${code ?? "unknown error"}).`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: "invalid",
      reason: `The launch artifact at ${path} is not valid JSON.`,
    };
  }

  return parseGateArtifact(parsed);
}

function isCompleteDetermination(terms: AiTermsEligibility): boolean {
  const sourceIsComplete =
    terms.basis === "owner_reported_confirmation"
      ? terms.sourceUrl !== null && terms.sourceUrl.trim() !== ""
      : terms.sourceQuote !== null && terms.sourceQuote.trim() !== "";
  return (
    terms.determinedAt !== null &&
    terms.determinedAt.trim() !== "" &&
    terms.termsCheckedAt !== null &&
    terms.termsCheckedAt.trim() !== "" &&
    terms.basis !== null &&
    terms.sourceUrl !== null &&
    terms.sourceUrl.trim() !== "" &&
    sourceIsComplete &&
    terms.intendedUse !== null &&
    terms.intendedUse.trim() !== ""
  );
}

function isStale(termsCheckedAt: string, now: Date): boolean {
  const checked = new Date(termsCheckedAt);
  if (Number.isNaN(checked.getTime())) {
    return true;
  }
  const ageMs = now.getTime() - checked.getTime();
  return ageMs > AI_TERMS_CHECK_STALENESS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Evaluates the launch gates in the documented order. The first failing check
 * wins, and every failure is fail-closed with a deterministic reason.
 */
export function evaluateGates(
  artifact: AiGateArtifact,
  now: Date = new Date(),
): AiGateVerdict {
  const terms = artifact.termsEligibility;

  if (terms.status !== "established") {
    return {
      ok: false,
      code: "terms_not_eligible",
      reason:
        "Provider eligibility is unresolved. Real dispatch stays blocked until an authoritative determination is recorded.",
    };
  }

  if (!isCompleteDetermination(terms)) {
    return {
      ok: false,
      code: "gates_invalid",
      reason: "The terms-eligibility determination is incomplete.",
    };
  }

  if (isStale(terms.termsCheckedAt as string, now)) {
    return {
      ok: false,
      code: "terms_check_stale",
      reason: `The terms-eligibility determination was last checked more than ${AI_TERMS_CHECK_STALENESS_DAYS} days ago.`,
    };
  }

  if (!artifact.ageConfirmed) {
    return {
      ok: false,
      code: "age_not_confirmed",
      reason: "The owner has not confirmed the provider's 18+ age requirement.",
    };
  }

  if (
    artifact.region !== "non-eea-uk-ch" &&
    (artifact.tier !== "paid" || !artifact.billingConfirmed)
  ) {
    return {
      ok: false,
      code: "region_not_permitted",
      reason:
        "This region requires an active Paid Services project for the configured use.",
    };
  }

  if (!artifact.modelsConfirmed || !artifact.limitsConfirmed) {
    return {
      ok: false,
      code: "model_not_confirmed",
      reason:
        "The models and limits for this project have not been confirmed in AI Studio.",
    };
  }

  if (!artifact.exposureAcknowledged) {
    return {
      ok: false,
      code: "gates_exposure_not_acknowledged",
      reason: "The mandatory disclosures M1-M8 have not been acknowledged.",
    };
  }

  if (
    !Number.isInteger(artifact.effectiveDailyCap) ||
    artifact.effectiveDailyCap <= 0
  ) {
    return {
      ok: false,
      code: "gates_invalid",
      reason: "effectiveDailyCap must be a positive whole number.",
    };
  }

  return { ok: true, artifact };
}

/**
 * Reads the artifact and evaluates the gates in one step.
 */
export async function readAndEvaluateGates(
  path: string,
  now: Date = new Date(),
): Promise<AiGateVerdict> {
  const read = await readGateArtifact(path);

  if (read.status === "missing") {
    return { ok: false, code: "gates_not_recorded", reason: read.reason };
  }

  if (read.status === "invalid") {
    return { ok: false, code: "gates_invalid", reason: read.reason };
  }

  return evaluateGates(read.artifact, now);
}
