/**
 * The request pipeline.
 *
 * The order of the checks is fixed and fail-closed: the first failing check
 * wins, and no failure path dispatches a provider request or charges a budget
 * unit.
 *
 * `prepare`: gates -> input validation -> build payload -> store payload.
 * `send`:    gates -> activation -> input validation -> budget availability ->
 *            token and digest -> charge budget -> dispatch.
 */

import type { AiActivationReader } from "./activation";
import type { AiBudget } from "./budget";
import type { AiFeature, AiFeatureConfig } from "./config";
import { AI_FEATURE_CONFIGS } from "./config";
import { readAndEvaluateGates } from "./gates";
import type { AiPreparedPayloadResult, AiPayloadStore } from "./payloadStore";
import type { AiProvider } from "./provider";
import {
  buildPreparedPayload,
  validatePrepareRequest,
  validateSendRequest,
  type AiRawBody,
} from "./requestValidation";
import type { AiErrorCode, AiProviderDiagnostic } from "./types";

export interface AiPipelineDependencies {
  provider: AiProvider;
  activation: AiActivationReader;
  budget: AiBudget;
  payloadStore: AiPayloadStore;
  gateArtifactPath: string;
  now: () => Date;
  featureConfigs?: Record<AiFeature, AiFeatureConfig>;
}

export type AiPipelineOutcome<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: AiErrorCode;
      message: string;
      upstreamAttempted: boolean;
      upstreamStatus: number | null;
      /** True when a launch gate refused the request. */
      gateBlocked: boolean;
      /** Present only for `incomplete`, which carries the truncated output. */
      outputText?: string;
      /** Bounded provider response structure; never contains response content. */
      diagnostic?: AiProviderDiagnostic;
      /** The configured model, when a dispatch was attempted. */
      model?: string;
    };

function failure(
  code: AiErrorCode,
  message: string,
  upstreamAttempted = false,
  upstreamStatus: number | null = null,
  outputText?: string,
  gateBlocked = false,
  details?: { diagnostic?: AiProviderDiagnostic; model?: string },
): AiPipelineOutcome<never> {
  return {
    ok: false,
    code,
    message,
    upstreamAttempted,
    upstreamStatus,
    gateBlocked,
    ...(outputText === undefined ? {} : { outputText }),
    ...(details?.diagnostic === undefined
      ? {}
      : { diagnostic: details.diagnostic }),
    ...(details?.model === undefined ? {} : { model: details.model }),
  };
}

/** Fails closed because a launch gate refused the request. */
function gateFailure(
  code: AiErrorCode,
  message: string,
): AiPipelineOutcome<never> {
  return failure(code, message, false, null, undefined, true);
}

/**
 * Prepares a payload for review. Nothing is dispatched and no budget unit is
 * charged.
 */
export async function runPreparePipeline(
  deps: AiPipelineDependencies,
  body: AiRawBody,
): Promise<AiPipelineOutcome<AiPreparedPayloadResult>> {
  const configs = deps.featureConfigs ?? AI_FEATURE_CONFIGS;

  const gates = await readAndEvaluateGates(deps.gateArtifactPath, deps.now());
  if (!gates.ok) {
    return gateFailure(gates.code, gates.reason);
  }

  if (body.tooLarge) {
    return failure(
      "payload_too_large",
      `The request body exceeded the accepted size of ${body.bytes} bytes.`,
    );
  }

  if (body.parseError) {
    return failure("invalid_request", "The request body is not valid JSON.");
  }

  const validated = validatePrepareRequest(body.value, configs);
  if (!validated.ok) {
    return failure(validated.code, validated.message);
  }

  const built = buildPreparedPayload(validated.value, configs);
  if (!built.ok) {
    return failure(built.code, built.message);
  }

  return { ok: true, value: deps.payloadStore.create(built.value) };
}

/**
 * Dispatches an approved payload.
 *
 * The budget unit is charged before the provider call, so a dispatched
 * request that fails still consumes exactly one unit, and exactly one unit.
 */
export async function runSendPipeline(
  deps: AiPipelineDependencies,
  body: AiRawBody,
): Promise<
  AiPipelineOutcome<{
    model: string;
    outputText: string;
    status: "complete" | "incomplete";
    upstreamStatus: number | null;
    diagnostic?: AiProviderDiagnostic;
  }>
> {
  const gates = await readAndEvaluateGates(deps.gateArtifactPath, deps.now());
  if (!gates.ok) {
    return gateFailure(gates.code, gates.reason);
  }

  const cap = gates.artifact.effectiveDailyCap;

  const activation = await deps.activation.read();
  if (!activation.activated) {
    return failure("not_configured", activation.reason);
  }

  if (body.tooLarge) {
    return failure(
      "payload_too_large",
      `The request body exceeded the accepted size of ${body.bytes} bytes.`,
    );
  }

  if (body.parseError) {
    return failure("invalid_request", "The request body is not valid JSON.");
  }

  const validated = validateSendRequest(body.value);
  if (!validated.ok) {
    return failure(validated.code, validated.message);
  }

  const budget = await deps.budget.read(cap);
  if (budget.status !== "ok") {
    return failure("local_limit", budget.reason);
  }

  if (budget.remaining <= 0) {
    return failure(
      "local_limit",
      `The local daily cap of ${cap} request(s) has been reached for ${budget.windowStart}.`,
    );
  }

  const lookup = deps.payloadStore.consume(validated.value.token, validated.value.digest);
  if (!lookup.ok) {
    return failure(lookup.code, lookup.message);
  }

  const charged = await deps.budget.charge(cap);
  if (!charged.ok) {
    return failure(charged.code, charged.reason);
  }

  const model = lookup.entry.payload.model;
  const result = await deps.provider.send(lookup.entry.payload);

  if (!result.dispatched) {
    return failure(
      result.code ?? "not_configured",
      result.message ?? "The provider did not dispatch a request.",
      false,
      result.upstreamStatus,
    );
  }

  if (result.status === "failed") {
    return failure(
      result.code ?? "upstream_error",
      result.message ?? "The provider request failed.",
      true,
      result.upstreamStatus,
      undefined,
      false,
      { model, diagnostic: result.diagnostic },
    );
  }

  if (result.status === "incomplete") {
    return failure(
      "incomplete",
      result.message ?? "The provider response was truncated.",
      true,
      result.upstreamStatus,
      result.outputText ?? "",
      false,
      { model, diagnostic: result.diagnostic },
    );
  }

  return {
    ok: true,
    value: {
      model,
      outputText: result.outputText ?? "",
      status: "complete",
      upstreamStatus: result.upstreamStatus,
      ...(result.diagnostic === undefined
        ? {}
        : { diagnostic: result.diagnostic }),
    },
  };
}
