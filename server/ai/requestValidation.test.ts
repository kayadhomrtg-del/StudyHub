// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildPreparedPayload,
  validateHostHeader,
  validateLoopbackAddress,
  validateOriginHeader,
  validatePrepareRequest,
  validateSendRequest,
} from "./requestValidation";

const PORT = 5173;

describe("loopback address validation", () => {
  it("accepts loopback peers and listeners", () => {
    for (const address of [
      "127.0.0.1",
      "127.255.255.255",
      "::1",
      "0:0:0:0:0:0:0:1",
      "::ffff:127.0.0.1",
    ]) {
      expect(validateLoopbackAddress(address, "request").ok).toBe(true);
      expect(validateLoopbackAddress(address, "listener").ok).toBe(true);
    }
  });

  it("rejects non-loopback, missing, and malformed addresses", () => {
    for (const address of [
      "192.168.1.25",
      "10.0.0.1",
      "::",
      "::ffff:192.168.1.25",
      "not-an-address",
    ]) {
      expect(validateLoopbackAddress(address, "request").ok).toBe(false);
    }
    expect(validateLoopbackAddress(undefined, "request").ok).toBe(false);
    expect(validateLoopbackAddress(undefined, "listener").ok).toBe(false);
  });
});

describe("Host header validation", () => {
  it("accepts a loopback host on the port this server listens on", () => {
    expect(validateHostHeader(`127.0.0.1:${PORT}`, PORT).ok).toBe(true);
    expect(validateHostHeader(`localhost:${PORT}`, PORT).ok).toBe(true);
    expect(validateHostHeader(`[::1]:${PORT}`, PORT).ok).toBe(true);
  });

  it("rejects a host that is not loopback", () => {
    const result = validateHostHeader(`example.com:${PORT}`, PORT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("loopback");
    }
  });

  it("rejects a malformed or missing host", () => {
    expect(validateHostHeader(undefined, PORT).ok).toBe(false);
    expect(validateHostHeader("", PORT).ok).toBe(false);
    expect(validateHostHeader(`127.0.0.1:not-a-port`, PORT).ok).toBe(false);
    expect(validateHostHeader(`[::1:${PORT}`, PORT).ok).toBe(false);
    expect(validateHostHeader(`127.0.0.1:${PORT}:9`, PORT).ok).toBe(false);
  });

  it("rejects a loopback host on a different port", () => {
    expect(validateHostHeader(`127.0.0.1:${PORT + 1}`, PORT).ok).toBe(false);
    expect(validateHostHeader("127.0.0.1", PORT).ok).toBe(false);
  });
});

describe("Origin header validation", () => {
  it("accepts an origin that names this exact loopback server", () => {
    expect(validateOriginHeader(`http://127.0.0.1:${PORT}`, PORT, true).ok).toBe(
      true,
    );
    expect(validateOriginHeader(`http://localhost:${PORT}`, PORT, true).ok).toBe(
      true,
    );
  });

  it("requires an origin on mutating requests", () => {
    const result = validateOriginHeader(undefined, PORT, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Origin");
    }
  });

  it("allows a missing origin on a read-only request", () => {
    expect(validateOriginHeader(undefined, PORT, false).ok).toBe(true);
  });

  it("rejects a foreign, opaque, or malformed origin", () => {
    expect(validateOriginHeader("http://example.com", PORT, true).ok).toBe(false);
    expect(validateOriginHeader("null", PORT, true).ok).toBe(false);
    expect(validateOriginHeader("not a url", PORT, true).ok).toBe(false);
    expect(validateOriginHeader(`https://127.0.0.1:${PORT}`, PORT, true).ok).toBe(
      false,
    );
    expect(validateOriginHeader(`http://127.0.0.1:${PORT + 1}`, PORT, true).ok).toBe(
      false,
    );
  });
});

describe("prepare request validation", () => {
  it("rejects a body that is not an object", () => {
    for (const body of [undefined, null, "text", 42, []]) {
      const result = validatePrepareRequest(body);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("invalid_request");
      }
    }
  });

  it("rejects an unknown feature", () => {
    const result = validatePrepareRequest({ feature: "translate", text: "hello" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_request");
    }
  });

  it("rejects missing, empty, or non-string text", () => {
    expect(validatePrepareRequest({ feature: "summary" }).ok).toBe(false);
    expect(validatePrepareRequest({ feature: "summary", text: "   " }).ok).toBe(
      false,
    );
    expect(validatePrepareRequest({ feature: "summary", text: 12 }).ok).toBe(
      false,
    );
  });

  it("rejects text that exceeds the feature character limit", () => {
    const result = validatePrepareRequest({
      feature: "summary",
      text: "a".repeat(100_001),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("payload_too_large");
    }
  });

  it("rejects an unsupported thinking level", () => {
    const result = validatePrepareRequest({
      feature: "summary",
      text: "hello",
      thinkingLevel: "minimal",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_request");
      expect(result.message).toContain("minimal");
    }
  });

  it("rejects an out-of-range output cap", () => {
    for (const maxOutputTokens of [0, -5, 1.5, 999_999, "1024"]) {
      const result = validatePrepareRequest({
        feature: "summary",
        text: "hello",
        maxOutputTokens,
      });
      expect(result.ok).toBe(false);
    }
  });

  it("accepts a valid request and applies the feature defaults", () => {
    const result = validatePrepareRequest({
      feature: "summary",
      text: "Chapter one.",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.feature).toBe("summary");
    expect(result.value.thinkingLevel).toBe("low");
    expect(result.value.maxOutputTokens).toBe(1024);
  });
});

describe("prepared payload", () => {
  it("builds the exact outbound payload without sampling parameters", () => {
    const validated = validatePrepareRequest({
      feature: "summary",
      text: "Chapter one.",
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }

    const built = buildPreparedPayload(validated.value);
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    const payload = built.value as unknown as Record<string, unknown>;
    expect(payload.store).toBe(false);
    expect(payload.model).toBe("gemini-3.5-flash-lite");
    expect(payload).not.toHaveProperty("temperature");
    expect(payload).not.toHaveProperty("top_p");
    expect(payload).not.toHaveProperty("top_k");
    expect(payload).not.toHaveProperty("notes");
    expect(payload).not.toHaveProperty("personalNotes");
  });

  it("uses the question and answer model for the qa feature", () => {
    const validated = validatePrepareRequest({
      feature: "qa",
      text: "What is Dexie?",
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }

    const built = buildPreparedPayload(validated.value);
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.value.model).toBe("gemini-3.8-flash");
  });
});

describe("send request validation", () => {
  it("requires a token and a digest", () => {
    expect(validateSendRequest({}).ok).toBe(false);
    expect(validateSendRequest({ token: "abc" }).ok).toBe(false);
    expect(validateSendRequest({ digest: "abc" }).ok).toBe(false);
    expect(validateSendRequest("nope").ok).toBe(false);
  });

  it("accepts a token and a digest", () => {
    const result = validateSendRequest({
      token: "abc",
      digest: "sha256:abc",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.token).toBe("abc");
      expect(result.value.digest).toBe("sha256:abc");
    }
  });
});
