import { describe, expect, it, vi } from "vitest";

import {
  fetchAiConfiguration,
  saveAndTestAiConfiguration,
  type AiConfigurationInput,
} from "./aiConfigurationClient";

const TEST_KEY = "test-gemini-secret-key-value-123456";
const CONFIGURATION = {
  hasKey: true,
  setupSkipped: false,
  activated: true,
  gateCode: null,
  gateReason: null,
  region: "non-eea-uk-ch",
  tier: "free",
};

const INPUT: AiConfigurationInput = {
  apiKey: TEST_KEY,
  region: "non-eea-uk-ch",
  tier: "free",
  ageConfirmed: true,
  billingConfirmed: false,
  exposureAcknowledged: true,
  limitsConfirmed: true,
  effectiveDailyCap: 20,
};

describe("AI configuration client", () => {
  it("parses the server's configuration response and never needs the key back", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          configuration: CONFIGURATION,
          models: ["gemini-3.5-flash-lite"],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(saveAndTestAiConfiguration(INPUT, fetcher)).resolves.toEqual({
      ok: true,
      configuration: CONFIGURATION,
      models: ["gemini-3.5-flash-lite"],
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).apiKey).toBe(TEST_KEY);
  });

  it("preserves server failure details and the saved-key status", async () => {
    const message = "The key was saved, but the quota or rate limit was reached.";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          configuration: { ...CONFIGURATION, activated: false },
          message,
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(saveAndTestAiConfiguration(INPUT, fetcher)).resolves.toEqual({
      ok: false,
      configuration: { ...CONFIGURATION, activated: false },
      message,
    });
  });

  it("rejects malformed configuration responses without echoing request data", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: CONFIGURATION }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(saveAndTestAiConfiguration(INPUT, fetcher)).rejects.toThrow(
      "invalid response",
    );
    await expect(fetchAiConfiguration(async () =>
      new Response(
        JSON.stringify({ ok: true, configuration: CONFIGURATION }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )).resolves.toEqual(CONFIGURATION);
  });
});
