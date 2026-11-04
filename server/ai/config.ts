/**
 * Configuration for the optional AI proxy.
 *
 * Every value here is *configuration with validation*, not a hard-coded
 * constant inside the request path. The values are provisional: the model
 * identifiers come from the public catalogue, and the caps are local limits
 * chosen for a single personal study machine.
 */

import type { AiProviderPayload } from "./types";

export type AiFeature = "summary" | "quiz" | "qa";

export type AiThinkingLevel = "low" | "medium" | "high";

export interface AiResponseFormat {
  type: string;
  mime_type: string;
  schema?: Record<string, unknown>;
}

export interface AiFeatureConfig {
  feature: AiFeature;
  /** Provisional model id; see `docs/AI_PLAN.md` section 10.1. */
  model: string;
  thinkingLevel: AiThinkingLevel;
  maxOutputTokens: number;
  /** Hard upper bound for the output cap a caller may request. */
  maxAllowedOutputTokens: number;
  /** Hard upper bound for the input text length, in characters. */
  maxInputCharacters: number;
  systemInstruction: string;
  responseFormat?: AiResponseFormat;
}

const SUMMARY_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: { type: "string" },
    keyPoints: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "keyPoints"],
  additionalProperties: false,
};

const QUIZ_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["question", "options", "correctIndex", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

const QA_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    answer: { type: "string" },
    references: { type: "array", items: { type: "string" } },
  },
  required: ["answer"],
  additionalProperties: false,
};

/**
 * Provisional per-feature configuration.
 *
 * The system instructions are deliberately minimal in Phase 1: the proxy
 * skeleton owns the request shape, and the wording is settled in Phase 2.
 */
export const AI_FEATURE_CONFIGS: Record<AiFeature, AiFeatureConfig> = {
  summary: {
    feature: "summary",
    model: "gemini-3.5-flash-lite",
    thinkingLevel: "low",
    maxOutputTokens: 1024,
    maxAllowedOutputTokens: 4096,
    maxInputCharacters: 100_000,
    systemInstruction:
      "Summarise the supplied study material for a single learner. " +
      "Use only the supplied text. If the text does not answer something, say so.",
    responseFormat: {
      type: "text",
      mime_type: "application/json",
      schema: SUMMARY_SCHEMA,
    },
  },
  quiz: {
    feature: "quiz",
    model: "gemini-3.5-flash-lite",
    thinkingLevel: "low",
    maxOutputTokens: 2048,
    maxAllowedOutputTokens: 8192,
    maxInputCharacters: 100_000,
    systemInstruction:
      "Write practice questions about the supplied study material for a single " +
      "learner. Use only the supplied text.",
    responseFormat: {
      type: "text",
      mime_type: "application/json",
      schema: QUIZ_SCHEMA,
    },
  },
  qa: {
    feature: "qa",
    model: "gemini-3.5-flash-lite",
    thinkingLevel: "low",
    maxOutputTokens: 2048,
    maxAllowedOutputTokens: 8192,
    maxInputCharacters: 50_000,
    systemInstruction:
      "Answer the question using only the supplied study material for a single " +
      "learner. If the text does not answer the question, say so.",
    responseFormat: {
      type: "text",
      mime_type: "application/json",
      schema: QA_SCHEMA,
    },
  },
};

/** Maximum accepted size of a raw request body, in bytes. */
export const AI_MAX_REQUEST_BYTES = 1_048_576;

/** Maximum accepted size of the serialised outbound payload, in bytes. */
export const AI_MAX_PAYLOAD_BYTES = 1_048_576;

/** How long a prepared payload stays usable, in milliseconds. */
export const AI_PAYLOAD_TTL_MS = 5 * 60 * 1000;

/** How long a terms-eligibility determination stays fresh, in days. */
export const AI_TERMS_CHECK_STALENESS_DAYS = 30;

/** Local directory that holds the launch artifact and the usage counter. */
export const AI_LOCAL_STATE_DIRECTORY = ".study-hub";

/** File name of the launch-gate artifact inside the local state directory. */
export const AI_GATE_ARTIFACT_FILENAME = "ai-launch-gate.json";

/** File name of the local usage counter inside the local state directory. */
export const AI_USAGE_FILENAME = "ai-usage.json";

/** Environment variable that enables the local proxy routes. */
export const AI_ENABLED_ENV_VAR = "STUDY_HUB_AI_ENABLED";

/** Generation routes are disabled unless this is set to `1`. */
export function isAiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[AI_ENABLED_ENV_VAR] === "1";
}

/** Builds the outbound payload for a validated request. */
export function buildProviderPayload(input: {
  model: string;
  text: string;
  systemInstruction: string;
  thinkingLevel: AiThinkingLevel;
  maxOutputTokens: number;
  responseFormat?: AiResponseFormat;
}): AiProviderPayload {
  const payload: AiProviderPayload = {
    model: input.model,
    input: input.text,
    system_instruction: input.systemInstruction,
    generation_config: {
      thinking_level: input.thinkingLevel,
      max_output_tokens: input.maxOutputTokens,
    },
    store: false,
  };

  if (input.responseFormat) {
    payload.response_format = {
      type: input.responseFormat.type,
      mime_type: input.responseFormat.mime_type,
      ...(input.responseFormat.schema
        ? { schema: input.responseFormat.schema }
        : {}),
    };
  }

  return payload;
}
