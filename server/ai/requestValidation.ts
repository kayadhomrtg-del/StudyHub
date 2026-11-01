/**
 * Request validation for the AI proxy.
 *
 * Everything here runs before a payload is stored and before a provider call
 * is attempted. The handler also validates the socket peer and listener
 * addresses before applying the Host and Origin checks.
 */

import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";

import {
  AI_FEATURE_CONFIGS,
  AI_MAX_PAYLOAD_BYTES,
  buildProviderPayload,
  type AiFeature,
  type AiFeatureConfig,
  type AiThinkingLevel,
} from "./config";
import type { AiErrorCode, AiProviderPayload } from "./types";

export type AiCheckResult = { ok: true } | { ok: false; reason: string };

export interface AiRawBody {
  /** True when the request body exceeded the accepted size. */
  tooLarge: boolean;
  bytes: number;
  /** Parsed JSON body, when the body was small enough and valid JSON. */
  value?: unknown;
  /** True when the body was not valid JSON. */
  parseError?: boolean;
}

export interface AiPrepareInput {
  feature: AiFeature;
  text: string;
  thinkingLevel: AiThinkingLevel;
  maxOutputTokens: number;
}

export type AiValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: AiErrorCode; message: string };

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);

const THINKING_LEVELS: readonly AiThinkingLevel[] = ["low", "medium", "high"];

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase();

  if (isIP(normalized) === 4) {
    return normalized.startsWith("127.");
  }

  if (isIP(normalized) === 6) {
    return (
      normalized === "::1" ||
      normalized === "0:0:0:0:0:0:0:1" ||
      /^::ffff:127(?:\.\d{1,3}){3}$/.test(normalized)
    );
  }

  return false;
}

export function validateLoopbackAddress(
  address: string | undefined,
  source: "request" | "listener",
): AiCheckResult {
  if (isLoopbackAddress(address)) return { ok: true };

  return {
    ok: false,
    reason: source === "request"
      ? "The request did not originate from a loopback address."
      : "The AI proxy listener is not bound to a loopback address.",
  };
}

function parseAuthority(
  value: string,
): { hostname: string; port: number | null } | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    if (end === -1) {
      return null;
    }
    const hostname = trimmed.slice(1, end).toLowerCase();
    const rest = trimmed.slice(end + 1);
    if (rest === "") {
      return { hostname, port: null };
    }
    if (!rest.startsWith(":")) {
      return null;
    }
    const port = Number(rest.slice(1));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return null;
    }
    return { hostname, port };
  }

  const colon = trimmed.indexOf(":");
  if (colon === -1) {
    return { hostname: trimmed.toLowerCase(), port: null };
  }

  const hostname = trimmed.slice(0, colon).toLowerCase();
  const portText = trimmed.slice(colon + 1);
  if (portText.includes(":")) {
    return null;
  }

  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return { hostname, port };
}

/**
 * Validates the Host header. Only loopback hosts are accepted, and the port
 * must be the one this server is actually listening on.
 */
export function validateHostHeader(
  host: string | undefined,
  expectedPort: number | null,
): AiCheckResult {
  if (host === undefined || host.trim() === "") {
    return { ok: false, reason: "The request has no Host header." };
  }

  const authority = parseAuthority(host);
  if (!authority) {
    return { ok: false, reason: "The Host header is malformed." };
  }

  if (!LOOPBACK_HOSTNAMES.has(authority.hostname)) {
    return {
      ok: false,
      reason: `The Host header "${authority.hostname}" is not a loopback host.`,
    };
  }

  if (expectedPort !== null) {
    if (authority.port === null || authority.port !== expectedPort) {
      return {
        ok: false,
        reason:
          "The Host header does not name the port this server is listening on.",
      };
    }
  }

  return { ok: true };
}

/**
 * Validates the Origin header. A mutating request must carry an Origin that
 * names this exact loopback server.
 */
export function validateOriginHeader(
  origin: string | undefined,
  expectedPort: number | null,
  requireOrigin: boolean,
): AiCheckResult {
  if (origin === undefined || origin.trim() === "") {
    if (requireOrigin) {
      return { ok: false, reason: "The request has no Origin header." };
    }
    return { ok: true };
  }

  let url: URL;
  try {
    url = new URL(origin.trim());
  } catch {
    return { ok: false, reason: "The Origin header is malformed." };
  }

  if (url.protocol !== "http:") {
    return {
      ok: false,
      reason: `The Origin header uses an unexpected scheme "${url.protocol}".`,
    };
  }

  const hostname = url.hostname.toLowerCase();
  if (!LOOPBACK_HOSTNAMES.has(hostname)) {
    return {
      ok: false,
      reason: `The Origin header "${hostname}" is not a loopback host.`,
    };
  }

  if (expectedPort !== null) {
    const port = url.port === "" ? null : Number(url.port);
    if (port === null || port !== expectedPort) {
      return {
        ok: false,
        reason:
          "The Origin header does not name the port this server is listening on.",
      };
    }
  }

  return { ok: true };
}

/**
 * Reads a bounded request body. Oversized bodies are reported, not buffered,
 * and the remaining bytes are discarded rather than stored.
 */
export async function readRequestBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<AiRawBody> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  let tooLarge = false;

  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        finish();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", finish);
    request.on("error", finish);
    request.on("aborted", finish);
  });

  if (tooLarge) {
    return { tooLarge: true, bytes };
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") {
    return { tooLarge: false, bytes, value: undefined };
  }

  try {
    return { tooLarge: false, bytes, value: JSON.parse(text) };
  } catch {
    return { tooLarge: false, bytes, parseError: true };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates a `prepare` request body and normalises it into the inputs the
 * payload builder needs.
 */
export function validatePrepareRequest(
  body: unknown,
  configs: Record<AiFeature, AiFeatureConfig> = AI_FEATURE_CONFIGS,
): AiValidationResult<AiPrepareInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      code: "invalid_request",
      message: "The request body must be a JSON object.",
    };
  }

  const feature = body.feature;
  if (typeof feature !== "string" || !(feature in configs)) {
    return {
      ok: false,
      code: "invalid_request",
      message: "The feature must be one of: summary, quiz, qa.",
    };
  }

  const config = configs[feature as AiFeature];

  const text = body.text;
  if (typeof text !== "string") {
    return {
      ok: false,
      code: "invalid_request",
      message: "The text field must be a string.",
    };
  }

  if (text.trim() === "") {
    return {
      ok: false,
      code: "invalid_request",
      message: "The text field must not be empty.",
    };
  }

  if (text.length > config.maxInputCharacters) {
    return {
      ok: false,
      code: "payload_too_large",
      message: `The text is ${text.length} characters; the limit for ${config.feature} is ${config.maxInputCharacters}.`,
    };
  }

  let thinkingLevel = config.thinkingLevel;
  if (body.thinkingLevel !== undefined) {
    if (
      typeof body.thinkingLevel !== "string" ||
      !THINKING_LEVELS.includes(body.thinkingLevel as AiThinkingLevel)
    ) {
      return {
        ok: false,
        code: "invalid_request",
        message:
          "The thinkingLevel field must be one of: low, medium, high. The value \"minimal\" is not supported.",
      };
    }
    thinkingLevel = body.thinkingLevel as AiThinkingLevel;
  }

  let maxOutputTokens = config.maxOutputTokens;
  if (body.maxOutputTokens !== undefined) {
    if (
      typeof body.maxOutputTokens !== "number" ||
      !Number.isInteger(body.maxOutputTokens) ||
      body.maxOutputTokens <= 0 ||
      body.maxOutputTokens > config.maxAllowedOutputTokens
    ) {
      return {
        ok: false,
        code: "invalid_request",
        message: `The maxOutputTokens field must be a whole number between 1 and ${config.maxAllowedOutputTokens}.`,
      };
    }
    maxOutputTokens = body.maxOutputTokens;
  }

  return {
    ok: true,
    value: { feature: config.feature, text, thinkingLevel, maxOutputTokens },
  };
}

/**
 * Builds the exact outbound payload and checks its size.
 */
export function buildPreparedPayload(
  input: AiPrepareInput,
  configs: Record<AiFeature, AiFeatureConfig> = AI_FEATURE_CONFIGS,
): AiValidationResult<AiProviderPayload> {
  const config = configs[input.feature];

  const payload = buildProviderPayload({
    model: config.model,
    text: input.text,
    systemInstruction: config.systemInstruction,
    thinkingLevel: input.thinkingLevel,
    maxOutputTokens: input.maxOutputTokens,
    ...(config.responseFormat ? { responseFormat: config.responseFormat } : {}),
  });

  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (payloadBytes > AI_MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      code: "payload_too_large",
      message: `The prepared payload is ${payloadBytes} bytes; the limit is ${AI_MAX_PAYLOAD_BYTES}.`,
    };
  }

  return { ok: true, value: payload };
}

/**
 * Validates a `send` request body.
 */
export function validateSendRequest(
  body: unknown,
): AiValidationResult<{ token: string; digest: string }> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      code: "invalid_request",
      message: "The request body must be a JSON object.",
    };
  }

  if (typeof body.token !== "string" || body.token.trim() === "") {
    return {
      ok: false,
      code: "invalid_request",
      message: "The token field must be a non-empty string.",
    };
  }

  if (typeof body.digest !== "string" || body.digest.trim() === "") {
    return {
      ok: false,
      code: "invalid_request",
      message: "The digest field must be a non-empty string.",
    };
  }

  return { ok: true, value: { token: body.token, digest: body.digest } };
}
