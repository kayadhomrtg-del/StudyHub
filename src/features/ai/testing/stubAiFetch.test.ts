import { describe, expect, it } from "vitest";

import type { AiFeature } from "../aiTypes";
import { createStubAiFetch } from "./stubAiFetch";

describe("shared AI proxy test double", () => {
  it.each([
    ["summary", ["keyPoints", "summary"]],
    ["quiz", ["questions"]],
    ["qa", ["answer", "references"]],
  ] as const)(
    "prepares and returns a deterministic %s response",
    async (feature: AiFeature, expectedOutputKeys: readonly string[]) => {
      const stub = createStubAiFetch();
      const inputText = "Study text supplied by the test.";
      const prepareResponse = await stub.fetch("/api/ai/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, text: inputText }),
      });
      const prepared = (await prepareResponse.json()) as {
        token: string;
        digest: string;
        payload: { input: string; system_instruction: string };
        payloadText: string;
      };

      expect(prepared.payload.input).toBe(inputText);
      expect(prepared.payload.system_instruction).toBe(
        `Test-only ${feature === "qa" ? "Q&A" : feature} instruction.`,
      );
      expect(prepared.payloadText).toContain(inputText);

      const sendResponse = await stub.fetch("/api/ai/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: prepared.token,
          digest: prepared.digest,
        }),
      });
      const sent = (await sendResponse.json()) as {
        outputText: string;
      };
      const output = JSON.parse(sent.outputText) as Record<string, unknown>;

      expect(Object.keys(output).sort()).toEqual(expectedOutputKeys);
      expect(stub.calls).toHaveLength(2);
      expect(stub.calls.map((call) => call.route)).toEqual([
        "/api/ai/prepare",
        "/api/ai/send",
      ]);
      expect(stub.prepared[0].request.feature).toBe(feature);
      expect(stub.dispatched[0].request.feature).toBe(feature);
    },
  );

  it("rejects unsupported routes, absolute URLs and unexpected request fields", async () => {
    const stub = createStubAiFetch();

    await expect(
      stub.fetch("https://example.test/api/ai/prepare", {
        method: "POST",
        body: JSON.stringify({ feature: "quiz", text: "Study text." }),
      }),
    ).rejects.toThrow("unexpected request");

    await expect(
      stub.fetch("/api/ai/prepare", {
        method: "POST",
        body: JSON.stringify({
          feature: "quiz",
          text: "Study text.",
          hiddenContext: "not allowed",
        }),
      }),
    ).rejects.toThrow("unexpected request body keys");

    await expect(
      stub.fetch("/api/ai/prepare", {
        method: "POST",
        body: JSON.stringify({ feature: "flashcards", text: "Study text." }),
      }),
    ).rejects.toThrow("supported feature");

    expect(stub.dispatched).toHaveLength(0);
  });
});
