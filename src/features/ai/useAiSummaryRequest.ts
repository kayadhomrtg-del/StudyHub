/**
 * The client-side state machine for one optional AI summary request.
 *
 * Statuses are exactly:
 *   idle, preparing, review, sending, complete, incomplete, error, fallback
 *
 * A send is possible only from `review` after an explicit approval for the
 * current prepared payload. Preparation always creates a new review state with
 * approval cleared. There is no retry path: a settled request stays settled
 * until the user starts a new preparation or chooses the local fallback.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  prepareSummary,
  sendApprovedSummary,
  type AiClientOptions,
} from "./aiClient";
import type {
  AiClientFailure,
  AiPrepareResult,
  AiPreparedSummary,
  AiSendResult,
  AiSummarySuccess,
} from "./aiTypes";
import { summarizeLocally, type LocalSummary } from "./localSummary";
import {
  PAYLOAD_INTEGRITY_FAILED,
  validatePreparedPayload,
} from "./payloadIntegrity";
import {
  parseSummaryOutput,
  type SummaryOutputParse,
} from "./summaryOutput";

export type AiSummaryRequestStatus =
  | "idle"
  | "preparing"
  | "review"
  | "sending"
  | "complete"
  | "incomplete"
  | "error"
  | "fallback";

export type AiSummaryFallbackReason = "user" | "after_error";

export type AiSummaryRequestState =
  | { status: "idle" }
  | { status: "preparing" }
  | {
      status: "review";
      prepared: AiPreparedSummary;
      approved: boolean;
    }
  | {
      status: "sending";
      prepared: AiPreparedSummary;
    }
  | {
      status: "complete";
      prepared: AiPreparedSummary;
      response: AiSummarySuccess;
      parsed: SummaryOutputParse;
    }
  | {
      status: "incomplete";
      prepared: AiPreparedSummary;
      failure: AiClientFailure;
      outputText: string;
      parsed: SummaryOutputParse;
    }
  | {
      status: "error";
      failure: AiClientFailure;
      prepared?: AiPreparedSummary;
      outputText?: string;
    }
  | {
      status: "fallback";
      localSummary: LocalSummary;
      reason: AiSummaryFallbackReason;
      failure?: AiClientFailure;
    };

export interface UseAiSummaryRequestOptions {
  /** Extracted material text already held in memory. */
  text: string;
  /** Injectable for tests; production uses the browser's same-origin fetch. */
  fetch?: AiClientOptions["fetch"];
  /** Injectable clock for deterministic expiry checks. */
  now?: () => number;
}

export interface UseAiSummaryRequestResult {
  state: AiSummaryRequestState;
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

export function useAiSummaryRequest({
  text,
  fetch,
  now,
}: UseAiSummaryRequestOptions): UseAiSummaryRequestResult {
  const [state, setState] = useState<AiSummaryRequestState>({ status: "idle" });

  const stateRef = useRef(state);
  stateRef.current = state;

  const textRef = useRef(text);
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  const nowRef = useRef(now ?? Date.now);
  nowRef.current = now ?? Date.now;

  const mountedRef = useRef(true);
  const operationRef = useRef(0);
  const prepareGuardRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (textRef.current === text) return;
    textRef.current = text;
    operationRef.current += 1;
    prepareGuardRef.current = false;
    sendingRef.current = false;
    setState({ status: "idle" });
  }, [text]);

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

    if (textRef.current.trim() === "") {
      setState({
        status: "error",
        failure: notSentFailure(
          "invalid_request",
          "No extractable text is available, so no summary request was sent.",
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
      result = await prepareSummary(textRef.current, { fetch: fetchRef.current });
    } catch (error) {
      result = {
        ok: false,
        error: notSentFailure(
          "invalid_response",
          `The preview could not be prepared: ${
            error instanceof Error ? error.message : "unknown local error"
          }. No summary request was sent.`,
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

    const integrity = validatePreparedPayload(current.prepared);
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
          "The prepared payload expired, so it cannot be approved or sent. No summary request was sent.",
        ),
      });
      return;
    }

    sendingRef.current = true;
    const operation = ++operationRef.current;
    setState({ status: "sending", prepared: current.prepared });

    let result: AiSendResult;
    try {
      result = await sendApprovedSummary(
        {
          token: current.prepared.token,
          digest: current.prepared.digest,
        },
        { fetch: fetchRef.current },
      );
    } catch (error) {
      result = {
        ok: false,
        error: unknownSendFailure(
          `The summary request may have been sent, but its result could not be confirmed: ${
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
        parsed: parseSummaryOutput(result.value.outputText),
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
        parsed: parseSummaryOutput(outputText),
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
      current.status !== "incomplete"
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
      localSummary: summarizeLocally(textRef.current),
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
      state.status === "incomplete",
    isBusy: state.status === "preparing" || state.status === "sending",
  };
}
