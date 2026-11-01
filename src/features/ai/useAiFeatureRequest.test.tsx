import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createLocalQuiz } from "./localQuiz";
import { parseQuizOutput, type QuizContent } from "./quizOutput";
import { createStubAiFetch, type StubAiFetchOptions } from "./testing/stubAiFetch";
import {
  useAiFeatureRequest,
  type UseAiFeatureRequestResult,
} from "./useAiFeatureRequest";

const SOURCE_TEXT =
  "Evaporation changes liquid water into vapor. Condensation forms clouds.";
const FIXED_NOW = Date.parse("2026-10-31T12:00:00.000Z");

function renderRequest(
  options: StubAiFetchOptions = {},
  overrides: { text?: string; now?: () => number } = {},
) {
  const stub = createStubAiFetch(options);
  const hook = renderHook(() =>
    useAiFeatureRequest<QuizContent, string[]>({
      feature: "quiz",
      text: overrides.text ?? SOURCE_TEXT,
      parseOutput: parseQuizOutput,
      createFallback: createLocalQuiz,
      fetch: stub.fetch,
      now: overrides.now ?? (() => FIXED_NOW),
    }),
  );
  return { stub, ...hook };
}

function currentState(
  result: { current: UseAiFeatureRequestResult<QuizContent, string[]> },
) {
  return result.current.state;
}

async function prepare(
  result: { current: UseAiFeatureRequestResult<QuizContent, string[]> },
) {
  await act(async () => result.current.prepare());
}

async function approveAndSend(
  result: { current: UseAiFeatureRequestResult<QuizContent, string[]> },
) {
  act(() => result.current.approve(true));
  await act(async () => result.current.send());
}

describe("useAiFeatureRequest", () => {
  it("prepares a quiz review and never sends without fresh approval", async () => {
    const { result, stub } = renderRequest();

    expect(result.current.state.status).toBe("idle");
    await prepare(result);

    const newReview = currentState(result);
    expect(newReview.status).toBe("review");
    if (newReview.status !== "review") return;
    expect(newReview.approved).toBe(false);
    expect(newReview.prepared.payload.input).toBe(SOURCE_TEXT);
    expect(stub.calls).toHaveLength(1);

    await act(async () => result.current.send());
    expect(result.current.state.status).toBe("review");
    expect(stub.calls).toHaveLength(1);
  });

  it("requires a fresh approval for every send and parses a complete response", async () => {
    const { result, stub } = renderRequest();
    await prepare(result);
    await approveAndSend(result);

    expect(result.current.state.status).toBe("complete");
    if (result.current.state.status !== "complete") return;
    expect(result.current.state.parsed.ok).toBe(true);
    expect(stub.calls).toHaveLength(2);
    expect(stub.dispatched).toHaveLength(1);

    await prepare(result);
    const newReview = currentState(result);
    expect(newReview.status).toBe("review");
    if (newReview.status !== "review") return;
    expect(newReview.approved).toBe(false);
    expect(stub.calls).toHaveLength(3);
  });

  it("rejects a tampered preview before sending", async () => {
    const { result, stub } = renderRequest();
    await prepare(result);
    if (result.current.state.status !== "review") return;

    act(() => {
      if (result.current.state.status === "review") {
        result.current.state.prepared.payloadText += "tampered";
        result.current.approve(true);
      }
    });
    await act(async () => result.current.send());

    const settledState = currentState(result);
    expect(settledState.status).toBe("error");
    if (settledState.status !== "error") return;
    expect(settledState.failure.code).toBe("integrity_mismatch");
    expect(settledState.failure.outcome).toBe("not_sent");
    expect(stub.calls).toHaveLength(1);
  });

  it("refuses an expired review without sending", async () => {
    const { result, stub } = renderRequest(
      { expiresAt: "2026-10-31T11:59:59.000Z" },
    );
    await prepare(result);
    await approveAndSend(result);

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") return;
    expect(result.current.state.failure.code).toBe("not_approved");
    expect(result.current.state.failure.outcome).toBe("not_sent");
    expect(stub.calls).toHaveLength(1);
  });

  it("keeps incomplete output distinct and offers the local fallback without fetching", async () => {
    const { result, stub } = renderRequest({
      send: { kind: "incomplete", outputText: '{"questions":' },
    });
    await prepare(result);
    await approveAndSend(result);

    expect(result.current.state.status).toBe("incomplete");
    expect(stub.calls).toHaveLength(2);
    act(() => result.current.showFallback());

    expect(result.current.state.status).toBe("fallback");
    if (result.current.state.status !== "fallback") return;
    expect(result.current.state.localResult).toEqual(
      createLocalQuiz(SOURCE_TEXT),
    );
    expect(stub.calls).toHaveLength(2);
  });

  it("runs the local fallback from idle with zero fetch calls", () => {
    const { result, stub } = renderRequest();

    act(() => result.current.showFallback());

    expect(result.current.state.status).toBe("fallback");
    expect(stub.calls).toHaveLength(0);
    expect(stub.dispatched).toHaveLength(0);
  });

  it("does not prepare a blank source", async () => {
    const { result, stub } = renderRequest({}, { text: " \n " });

    await prepare(result);

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") return;
    expect(result.current.state.failure.code).toBe("invalid_request");
    expect(stub.calls).toHaveLength(0);
  });
});
