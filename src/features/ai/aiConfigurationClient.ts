import {
  AI_CONFIGURATION_DISMISS_ROUTE,
  AI_CONFIGURATION_REMOVE_ROUTE,
  AI_CONFIGURATION_ROUTE,
} from "../../../server/ai/types";

export type AiConfiguredRegion =
  | "non-eea-uk-ch"
  | "eea"
  | "switzerland"
  | "united-kingdom";
export type AiConfiguredTier = "free" | "paid";

export interface AiConfigurationStatus {
  hasKey: boolean;
  setupSkipped: boolean;
  activated: boolean;
  gateCode: string | null;
  gateReason: string | null;
  region: AiConfiguredRegion | null;
  tier: AiConfiguredTier | null;
}

export interface AiConfigurationInput {
  apiKey: string;
  region: AiConfiguredRegion;
  tier: AiConfiguredTier;
  ageConfirmed: boolean;
  billingConfirmed: boolean;
  exposureAcknowledged: boolean;
  limitsConfirmed: boolean;
  effectiveDailyCap: number;
}

export type AiConfigurationResult =
  | {
      ok: true;
      configuration: AiConfigurationStatus;
      models: string[];
    }
  | {
      ok: false;
      configuration: AiConfigurationStatus;
      message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStatus(value: unknown): AiConfigurationStatus | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.hasKey !== "boolean" ||
    typeof value.setupSkipped !== "boolean" ||
    typeof value.activated !== "boolean" ||
    !(value.gateCode === null || typeof value.gateCode === "string") ||
    !(value.gateReason === null || typeof value.gateReason === "string") ||
    !(
      value.region === null ||
      value.region === "non-eea-uk-ch" ||
      value.region === "eea" ||
      value.region === "switzerland" ||
      value.region === "united-kingdom"
    ) ||
    !(value.tier === null || value.tier === "free" || value.tier === "paid")
  ) {
    return null;
  }
  return value as unknown as AiConfigurationStatus;
}

export async function fetchAiConfiguration(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<AiConfigurationStatus> {
  const response = await fetcher(AI_CONFIGURATION_ROUTE, {
    headers: { Accept: "application/json" },
  });
  const result: unknown = await response.json();
  if (
    !response.ok ||
    !isRecord(result) ||
    result.ok !== true ||
    !parseStatus(result.configuration)
  ) {
    throw new Error("Local AI configuration could not be read.");
  }
  return parseStatus(result.configuration) as AiConfigurationStatus;
}

export async function saveAndTestAiConfiguration(
  input: AiConfigurationInput,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<AiConfigurationResult> {
  const response = await fetcher(AI_CONFIGURATION_ROUTE, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const result: unknown = await response.json();
  if (
    !isRecord(result) ||
    typeof result.ok !== "boolean" ||
    !parseStatus(result.configuration)
  ) {
    throw new Error("The local AI setup returned an invalid response.");
  }
  const configuration = parseStatus(result.configuration) as AiConfigurationStatus;
  if (result.ok) {
    if (
      !Array.isArray(result.models) ||
      result.models.some((model) => typeof model !== "string")
    ) {
      throw new Error("The local AI setup returned an invalid model result.");
    }
    return { ok: true, configuration, models: result.models as string[] };
  }
  if (typeof result.message !== "string") {
    throw new Error("The local AI setup could not be completed.");
  }
  return { ok: false, configuration, message: result.message };
}

async function postEmpty(
  route: string,
  fetcher: typeof fetch,
): Promise<AiConfigurationStatus> {
  const response = await fetcher(route, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const result: unknown = await response.json();
  if (
    !response.ok ||
    !isRecord(result) ||
    result.ok !== true ||
    !parseStatus(result.configuration)
  ) {
    throw new Error("The local AI configuration could not be updated.");
  }
  return parseStatus(result.configuration) as AiConfigurationStatus;
}

export function dismissAiSetup(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<AiConfigurationStatus> {
  return postEmpty(AI_CONFIGURATION_DISMISS_ROUTE, fetcher);
}

export function removeAiKey(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<AiConfigurationStatus> {
  return postEmpty(AI_CONFIGURATION_REMOVE_ROUTE, fetcher);
}
