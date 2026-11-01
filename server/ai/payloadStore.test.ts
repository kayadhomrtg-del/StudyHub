// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { AiPayloadStore, computePayloadDigest } from "./payloadStore";
import type { AiProviderPayload } from "./types";

const PAYLOAD: AiProviderPayload = {
  model: "gemini-3.5-flash-lite",
  input: "Chapter one: local-first storage.",
  system_instruction: "Summarise the supplied study material.",
  generation_config: {
    thinking_level: "low",
    max_output_tokens: 1024,
  },
  store: false,
};

describe("prepared payload store", () => {
  it("returns a single-use token and an integrity digest", () => {
    const store = new AiPayloadStore();
    const prepared = store.create(PAYLOAD);

    expect(prepared.token).toMatch(/^[0-9a-f]{64}$/);
    expect(prepared.digest).toBe(
      `sha256:${createHash("sha256")
        .update(JSON.stringify(PAYLOAD), "utf8")
        .digest("hex")}`,
    );
    expect(prepared.digest).toBe(computePayloadDigest(JSON.stringify(PAYLOAD)));
    expect(prepared.payloadBytes).toBe(
      Buffer.byteLength(JSON.stringify(PAYLOAD), "utf8"),
    );
    expect(prepared.payload).toEqual(PAYLOAD);
  });

  it("consumes a token exactly once", () => {
    const store = new AiPayloadStore();
    const prepared = store.create(PAYLOAD);

    const first = store.consume(prepared.token, prepared.digest);
    expect(first.ok).toBe(true);

    const second = store.consume(prepared.token, prepared.digest);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("not_approved");
    }
  });

  it("rejects a mismatched digest without dispatching anything", () => {
    const store = new AiPayloadStore();
    const prepared = store.create(PAYLOAD);

    const mismatch = store.consume(prepared.token, `sha256:${"0".repeat(64)}`);
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.code).toBe("integrity_mismatch");
    }

    // The rejection did not burn the token, so the correct digest still works.
    const retry = store.consume(prepared.token, prepared.digest);
    expect(retry.ok).toBe(true);
  });

  it("rejects an unknown token", () => {
    const store = new AiPayloadStore();
    const result = store.consume("f".repeat(64), "sha256:anything");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_approved");
    }
  });

  it("rejects a missing token and a missing digest", () => {
    const store = new AiPayloadStore();
    const prepared = store.create(PAYLOAD);

    const noToken = store.consume(null, prepared.digest);
    expect(noToken.ok).toBe(false);
    if (!noToken.ok) {
      expect(noToken.code).toBe("not_approved");
    }

    const noDigest = store.consume(prepared.token, null);
    expect(noDigest.ok).toBe(false);
    if (!noDigest.ok) {
      expect(noDigest.code).toBe("integrity_mismatch");
    }
  });

  it("expires a prepared payload after five minutes", () => {
    let now = 1_000_000;
    const store = new AiPayloadStore(5 * 60 * 1000, () => now);
    const prepared = store.create(PAYLOAD);

    now += 5 * 60 * 1000 - 1;
    expect(store.consume(prepared.token, prepared.digest).ok).toBe(true);

    now += 10_000;
    const second = store.create(PAYLOAD);
    now += 5 * 60 * 1000 + 1;
    const expired = store.consume(second.token, second.digest);
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.code).toBe("not_approved");
    }
  });

  it("issues a distinct token for every prepared payload", () => {
    const store = new AiPayloadStore();
    const first = store.create(PAYLOAD);
    const second = store.create({ ...PAYLOAD, input: "Chapter two." });

    expect(first.token).not.toBe(second.token);
    expect(first.digest).not.toBe(second.digest);
    expect(store.size).toBe(2);
  });
});
