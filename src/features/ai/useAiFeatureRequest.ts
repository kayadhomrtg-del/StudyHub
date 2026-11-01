import { useCallback, useEffect, useRef, useState } from "react";

import {
  prepareAiFeature,
  sendApprovedAiFeature,
  type AiClientOptions,
} from "./aiClient";
import type {
  AiClientFailure,
  AiFeature,
  AiFeatureSuccess,
  AiPrepareResult,
  AiPreparedPayload,
  AiSendResult,
} from "./aiTypes";
import {
  PAYLOAD_INTEGRITY_FAILED,
  validatePreparedPayload,
} from "./payloadIntegrity";

export type AiFeatureRequestStatus =
  | "idle"
  | "preparing"
  | "review"
  | "sending"
  | "complete"
  | "incomplete"
  | "error"
  | "fallback";

export type AiFeatureFallbackReason = "user" | "after_error";

export type AiFeatureOutputParse<T> =
  | { ok: true; content: T }
  | { ok: false; rawText: string; message: string };

export type AiFeatureRequestState<T, F> =
  | { status: "idle" }
  | { status: "preparing" }
  | {
      status: "review";
      prepared: AiPreparedPayload;
      approved: boolean;
    }
  | {
      status: "sending";
      prepared: AiPreparedPayload;
    }
  | {
      status: "complete";
      prepared: AiPreparedPayload;
      response: AiFeatureSuccess;
      parsed: AiFeatureOutputParse<T>;
    }
  | {
      status: "incomplete";
      prepared: AiPreparedPayload;
      failure: AiClientFailure;
      outputText: string;
      parsed: AiFeatureOutputParse<T>;
    }
  | {
      status: "error";
      failure: AiClientFailure;
      prepared?: AiPreparedPayload;
      outputText?: string;
    }
  | {
      status: "fallback";
      localResult: F;
      reason: AiFeatureFallbackReason;
      failure?: AiClientFailure;
    };

export interface UseAiFeatureRequestOptions<T, F> {
  feature: Exclude<AiFeature, "summary">;
  /** Request input held in memory; for Q&A this includes its question. */
  text: string;
  parseOutput: (outputText: string) => AiFeatureOutputParse<T>;
  createFallback: (text: string) => F;
  fetch?: AiClientOptions["fetch"];
  now?: () => number;
}

export interface UseAiFeatureRequestResult<T, F> {
  state: AiFeatureRequestState<T, F>;
  prepare: () => Promise<void>;
  approve: (approved: boolean) => void;
  send: () => Promise<void>;
  showFallback: () => void;
  reset: () => void;
  canPrepare: boolean;
  canApprove: boolean;
  canSend: boolean;
  canShowFallback: boolean;
  isBusy: boolean;
}

function featureLabel(feature: AiFeature): string {
  return feature === "qa" ? "Q&A" : "quiz";
}

function notSentFailure(
  code:
    | "integrity_mismatch"
    | "invalid_request"
    | "invalid_response"
    | "not_approved",
  message: string,
): AiClientFailure {
  return { code, message, upstreamAttempted: false, outcome: "not_sent" };
}

function unknownSendFailure(message: string): AiClientFailure {
  return {
    code: "outcome_unknown",
    message,
    upstreamAttempted: null,
    outcome: "unknown",
  };
}

export function useAiFeatureRequest<T, F>({
  feature,
  text,
  parseOutput,
  createFallback,
  fetch,
  now,
}: UseAiFeatureRequestOptions<T, F>): UseAiFeatureRequestResult<T, F> {
  const [state, setState] = useState<AiFeatureRequestState<T, F>>({
    status: "idle",
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const textRef = useRef(text);
  const featureRef = useRef(feature);
  const fetchRef = useRef(fetch);
  const parseOutputRef = useRef(parseOutput);
  const createFallbackRef = useRef(createFallback);
  const nowRef = useRef(now ?? Date.now);
  fetchRef.current = fetch;
  parseOutputRef.current = parseOutput;
  createFallbackRef.current = createFallback;
  nowRef.current = now ?? Date.now;

  const mountedRef = useRef(false);
  const operationRef = useRef(0);
  const prepareGuardRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (textRef.current === text && featureRef.current === feature) return;
    textRef.current = text;
    featureRef.current = feature;
    operationRef.current += 1;
    prepareGuardRef.current = false;
    sendingRef.current = false;
    setState({ status: "idle" });
  }, [feature, text]);

  const prepare = useCallback(async () => {
    const current = stateRef.current;
    if (
      prepareGuardRef.current ||
      current.status === "preparing" ||
      current.status === "sending" ||
      current.status === "review"
    ) {
      return;
    }

    const label = featureLabel(featureRef.current);
    if (textRef.current.trim() === "") {
      setState({
        status: "error",
        failure: notSentFailure(
          "invalid_request",
          `No extractable text is available, so no ${label} request was sent.`,
        ),
      });
      return;
    }

    prepareGuardRef.current = true;
    sendingRef.current = false;
    const operation = ++operationRef.current;
    setState({ status: "preparing" });

    let result: AiPrepareResult;
    try {
      result = await prepareAiFeature(featureRef.current, textRef.current, {
        fetch: fetchRef.current,
      });
    } catch (error) {
      result = {
        ok: false as const,
        error: notSentFailure(
          "invalid_response",
          `The preview could not be prepared: ${
            error instanceof Error ? error.message : "unknown local error"
          }. No ${label} request was sent.`,
        ),
      };
    }

    if (!mountedRef.current || operation !== operationRef.current) return;
    prepareGuardRef.current = false;

    if (result.ok) {
      setState({
        status: "review",
        prepared: result.value,
        approved: false,
      });
      return;
    }
    setState({ status: "error", failure: result.error });
  }, []);

  const approve = useCallback((approved: boolean) => {
    const current = stateRef.current;
    if (current.status !== "review") return;
    setState({
      status: "review",
      prepared: current.prepared,
      approved,
    });
  }, []);

  const send = useCallback(async () => {
    const current = stateRef.current;
    if (
      current.status !== "review" ||
      !current.approved ||
      sendingRef.current
    ) {
      return;
    }

    const label = featureLabel(featureRef.current);
    const integrity = validatePreparedPayload(current.prepared, label);
    if (!integrity.ok) {
      setState({
        status: "error",
        prepared: current.prepared,
        failure: notSentFailure(
          "integrity_mismatch",
          `${PAYLOAD_INTEGRITY_FAILED} ${integrity.message}`,
        ),
      });
      return;
    }

    const expiresAt = Date.parse(current.prepared.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= nowRef.current()) {
      setState({
        status: "error",
        prepared: current.prepared,
        failure: notSentFailure(
          "not_approved",
          `The prepared payload expired, so it cannot be approved or sent. No ${label} request was sent.`,
        ),
      });
      return;
    }

    sendingRef.current = true;
    const operation = ++operationRef.current;
    setState({ status: "sending", prepared: current.prepared });

    let result: AiSendResult;
    try {
      result = await sendApprovedAiFeature(
        {
          token: current.prepared.token,
          digest: current.prepared.digest,
        },
        featureRef.current,
        { fetch: fetchRef.current },
      );
    } catch (error) {
      result = {
        ok: false as const,
        error: unknownSendFailure(
          `The ${label} request may have been sent, but its result could not be confirmed: ${
            error instanceof Error ? error.message : "unknown local error"
          }`,
        ),
      };
    }

    if (!mountedRef.current || operation !== operationRef.current) return;

    if (result.ok) {
      setState({
        status: "complete",
        prepared: current.prepared,
        response: result.value,
        parsed: parseOutputRef.current(result.value.outputText),
      });
      return;
    }

    if (result.error.code === "incomplete") {
      const outputText = result.outputText ?? "";
      setState({
        status: "incomplete",
        prepared: current.prepared,
        failure: result.error,
        outputText,
        parsed: parseOutputRef.current(outputText),
      });
      return;
    }

    setState({
      status: "error",
      prepared: current.prepared,
      failure: result.error,
      ...(result.outputText !== undefined
        ? { outputText: result.outputText }
        : {}),
    });
  }, []);

  const showFallback = useCallback(() => {
    const current = stateRef.current;
    if (
      current.status !== "idle" &&
      current.status !== "error" &&
      current.status !== "incomplete" &&
      (current.status !== "complete" || current.parsed.ok)
    ) {
      return;
    }

    operationRef.current += 1;
    prepareGuardRef.current = false;
    sendingRef.current = false;
    const failure =
      current.status === "error" || current.status === "incomplete"
        ? current.failure
        : undefined;

    setState({
      status: "fallback",
      localResult: createFallbackRef.current(textRef.current),
      reason: current.status === "idle" ? "user" : "after_error",
      ...(failure ? { failure } : {}),
    });
  }, []);

  const reset = useCallback(() => {
    operationRef.current += 1;
    prepareGuardRef.current = false;
    sendingRef.current = false;
    setState({ status: "idle" });
  }, []);

  const canPrepare =
    text.trim() !== "" &&
    (state.status === "idle" ||
      state.status === "error" ||
      state.status === "complete" ||
      state.status === "incomplete" ||
      state.status === "fallback");

  return {
    state,
    prepare,
    approve,
    send,
    showFallback,
    reset,
    canPrepare,
    canApprove: state.status === "review",
    canSend: state.status === "review" && state.approved,
    canShowFallback:
      state.status === "idle" ||
      state.status === "error" ||
      state.status === "incomplete" ||
      (state.status === "complete" && !state.parsed.ok),
    isBusy: state.status === "preparing" || state.status === "sending",
  };
}
