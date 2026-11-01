import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  createStubAiFetch,
  type StubAiFetchOptions,
} from "./testing/stubAiFetch";
import {
  useAiSummaryRequest,
  type UseAiSummaryRequestResult,
} from "./useAiSummaryRequest";

const SOURCE_TEXT =
  "The water cycle moves water through evaporation, condensation, and precipitation.";

const FIXED_NOW = Date.parse("2026-10-31T12:00:00.000Z");

function renderRequest(
  stubOptions: StubAiFetchOptions = {},
  overrides: { text?: string; now?: () => number } = {},
) {
  const stub = createStubAiFetch(stubOptions);
  const hook = renderHook(() =>
    useAiSummaryRequest({
      text: overrides.text ?? SOURCE_TEXT,
      fetch: stub.fetch,
      now: overrides.now ?? (() => FIXED_NOW),
    }),
  );
  return { stub, ...hook };
}

async function prepare(result: { current: UseAiSummaryRequestResult }) {
  await act(async () => {
    await result.current.prepare();
  });
}

async function approveAndSend(result: {
  current: UseAiSummaryRequestResult;
}) {
  act(() => result.current.approve(true));
  await act(async () => {
    await result.current.send();
  });
}

/** Reads the latest state without keeping an earlier TypeScript narrowing. */
function readState(result: { current: UseAiSummaryRequestResult }) {
  return result.current.state;
}

describe("useAiSummaryRequest", () => {
  it("prepares a review state and clears approval", async () => {
    const { result, stub } = renderRequest();

    expect(result.current.state.status).toBe("idle");
    expect(result.current.canSend).toBe(false);

    await prepare(result);

    expect(result.current.state.status).toBe("review");
    if (result.current.state.status !== "review") return;
    expect(result.current.state.approved).toBe(false);
    expect(result.current.canSend).toBe(false);
    expect(result.current.state.prepared.payload.input).toBe(SOURCE_TEXT);
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0].route).toBe("/api/ai/prepare");
  });

  it("does not send without an explicit approval", async () => {
    const { result, stub } = renderRequest();

    await prepare(result);
    await act(async () => {
      await result.current.send();
    });

    expect(result.current.state.status).toBe("review");
    expect(stub.calls.filter((call) => call.route === "/api/ai/send")).toHaveLength(
      0,
    );
  });

  it("sends only the approved token and digest, then completes", async () => {
    const { result, stub } = renderRequest();

    await prepare(result);
    act(() => result.current.approve(true));
    expect(result.current.canSend).toBe(true);

    await act(async () => {
      await result.current.send();
    });

    expect(result.current.state.status).toBe("complete");
    if (result.current.state.status !== "complete") return;
    expect(result.current.state.parsed.ok).toBe(true);
    if (result.current.state.parsed.ok) {
      expect(result.current.state.parsed.content.summary).toBe(
        "A deterministic stub summary.",
      );
    }

    const sendCall = stub.calls.find((call) => call.route === "/api/ai/send");
    expect(sendCall).toBeDefined();
    const body = sendCall?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["digest", "token"]);
    expect(body).toEqual({
      token: result.current.state.prepared.token,
      digest: result.current.state.prepared.digest,
    });
    expect(stub.dispatched).toHaveLength(1);
  });

  it("prevents a duplicate send from the same review", async () => {
    const { result, stub } = renderRequest();

    await prepare(result);
    act(() => result.current.approve(true));

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.send();
      second = result.current.send();
      await Promise.all([first, second]);
    });

    expect(
      stub.calls.filter((call) => call.route === "/api/ai/send"),
    ).toHaveLength(1);
    expect(result.current.state.status).toBe("complete");
  });

  it("requires fresh approval for every new preparation", async () => {
    const { result, stub } = renderRequest();

    await prepare(result);
    if (result.current.state.status !== "review") return;
    const firstToken = result.current.state.prepared.token;
    await approveAndSend(result);
    expect(result.current.state.status).toBe("complete");

    await prepare(result);
    expect(result.current.state.status).toBe("review");
    if (result.current.state.status !== "review") return;
    const secondToken = result.current.state.prepared.token;
    expect(secondToken).not.toBe(firstToken);
    expect(result.current.state.approved).toBe(false);
    expect(result.current.canSend).toBe(false);

    await act(async () => {
      await result.current.send();
    });
    expect(
      stub.calls.filter((call) => call.route === "/api/ai/send"),
    ).toHaveLength(1);
  });

  it("ignores a stale preparation response", async () => {
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let prepareCount = 0;
    const stub = createStubAiFetch({
      prepare: async () => {
        prepareCount += 1;
        if (prepareCount === 1) await firstGate;
        return { kind: "success" };
      },
    });
    const { result } = renderHook(() =>
      useAiSummaryRequest({
        text: SOURCE_TEXT,
        fetch: stub.fetch,
        now: () => FIXED_NOW,
      }),
    );

    let firstPrepare: Promise<void> = Promise.resolve();
    act(() => {
      firstPrepare = result.current.prepare();
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe("preparing");
    });

    act(() => result.current.reset());
    expect(result.current.state.status).toBe("idle");

    await prepare(result);
    expect(result.current.state.status).toBe("review");
    if (result.current.state.status !== "review") return;
    const currentToken = result.current.state.prepared.token;

    releaseFirst();
    await act(async () => {
      await firstPrepare;
    });

    expect(result.current.state.status).toBe("review");
    if (result.current.state.status !== "review") return;
    expect(result.current.state.prepared.token).toBe(currentToken);
  });

  it("returns a deterministic local fallback without any fetch call", () => {
    const { result, stub } = renderRequest();

    act(() => result.current.showFallback());

    expect(result.current.state.status).toBe("fallback");
    if (result.current.state.status !== "fallback") return;
    expect(result.current.state.localSummary.summary).toContain(
      "The water cycle",
    );
    expect(result.current.state.reason).toBe("user");
    expect(stub.calls).toHaveLength(0);
  });

  it("allows the local fallback after an error without another fetch", async () => {
    const { result, stub } = renderRequest({
      prepare: {
        kind: "error",
        code: "terms_not_eligible",
        message: "Provider eligibility is unresolved.",
      },
    });

    await prepare(result);
    const errorState = result.current.state;
    expect(errorState.status).toBe("error");
    if (errorState.status !== "error") return;
    expect(errorState.failure.outcome).toBe("not_sent");
    expect(stub.calls).toHaveLength(1);

    act(() => result.current.showFallback());

    const fallbackState = result.current.state;
    expect(fallbackState.status).toBe("fallback");
    if (fallbackState.status !== "fallback") return;
    expect(fallbackState.reason).toBe("after_error");
    expect(fallbackState.failure?.code).toBe("terms_not_eligible");
    expect(stub.calls).toHaveLength(1);
  });

  it("keeps incomplete output in a distinct incomplete state", async () => {
    const partial = '{"summary":"A partial summary.","keyPoints":[]}';
    const { result } = renderRequest({
      send: { kind: "incomplete", outputText: partial },
    });

    await prepare(result);
    await approveAndSend(result);

    expect(result.current.state.status).toBe("incomplete");
    if (result.current.state.status !== "incomplete") return;
    expect(result.current.state.failure.code).toBe("incomplete");
    expect(result.current.state.failure.outcome).toBe("failed_after_sending");
    expect(result.current.state.outputText).toBe(partial);
    expect(result.current.state.parsed.ok).toBe(true);
  });

  it("reports an unknown send outcome without retrying", async () => {
    const { result, stub } = renderRequest({
      send: { kind: "network_error", message: "socket closed" },
    });

    await prepare(result);
    await approveAndSend(result);

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") return;
    expect(result.current.state.failure.code).toBe("network_error");
    expect(result.current.state.failure.outcome).toBe("unknown");
    expect(result.current.state.failure.upstreamAttempted).toBeNull();
    expect(stub.calls).toHaveLength(2);
    expect(stub.dispatched).toHaveLength(1);
  });

  it("rejects a preview integrity mismatch before any send", async () => {
    const { result, stub } = renderRequest({
      prepare: { kind: "mismatch" },
    });

    await prepare(result);

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") return;
    expect(result.current.state.failure.code).toBe("invalid_response");
    expect(result.current.state.failure.outcome).toBe("not_sent");
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls.some((call) => call.route === "/api/ai/send")).toBe(false);
  });

  it("rejects a payload changed after approval before any send", async () => {
    const { result, stub } = renderRequest();

    await prepare(result);
    act(() => result.current.approve(true));
    if (result.current.state.status !== "review") return;

    result.current.state.prepared.payload.input = "Changed after approval.";
    await act(async () => {
      await result.current.send();
    });

    const settled = readState(result);
    expect(settled.status).toBe("error");
    if (settled.status !== "error") return;
    expect(settled.failure.code).toBe("integrity_mismatch");
    expect(settled.failure.outcome).toBe("not_sent");
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls.some((call) => call.route === "/api/ai/send")).toBe(false);
  });

  it("rejects a byte-count mismatch after approval before any send", async () => {
    const { result, stub } = renderRequest();

    await prepare(result);
    act(() => result.current.approve(true));
    if (result.current.state.status !== "review") return;

    result.current.state.prepared.payloadBytes += 1;
    await act(async () => {
      await result.current.send();
    });

    const settled = readState(result);
    expect(settled.status).toBe("error");
    if (settled.status !== "error") return;
    expect(settled.failure.code).toBe("integrity_mismatch");
    expect(settled.failure.outcome).toBe("not_sent");
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls.some((call) => call.route === "/api/ai/send")).toBe(false);
  });

  it("refuses to send an expired prepared payload", async () => {
    const { result, stub } = renderRequest(
      {},
      { now: () => Date.parse("2100-01-01T00:00:00.000Z") },
    );

    await prepare(result);
    act(() => result.current.approve(true));
    await act(async () => {
      await result.current.send();
    });

    expect(result.current.state.status).toBe("error");
    if (result.current.state.status !== "error") return;
    expect(result.current.state.failure.code).toBe("not_approved");
    expect(result.current.state.failure.outcome).toBe("not_sent");
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls.some((call) => call.route === "/api/ai/send")).toBe(false);
  });
});
