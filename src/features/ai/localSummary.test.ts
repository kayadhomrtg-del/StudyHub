import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_SUMMARY_NOTICE,
  summarizeLocally,
} from "./localSummary";
import { summaryContentToText } from "./summaryOutput";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("summarizeLocally", () => {
  it("is deterministic for the same in-memory text", () => {
    const text =
      "The water cycle moves water through evaporation and condensation. " +
      "Precipitation returns water to the surface. " +
      "Runoff collects water in rivers and lakes.";

    expect(summarizeLocally(text)).toEqual(summarizeLocally(text));
  });

  it("uses the first sentences and keeps later sentences as key points", () => {
    const summary = summarizeLocally(
      "Photosynthesis converts light into chemical energy. " +
        "Chlorophyll absorbs light. " +
        "Oxygen is released as a by-product. " +
        "Carbon dioxide is taken in through stomata.",
    );

    expect(summary.summary).toContain("Photosynthesis");
    expect(summary.keyPoints.length).toBeGreaterThan(0);
    expect(summary.keyPoints.join(" ")).toContain("Carbon dioxide");
    expect(summary.sourceCharacters).toBeGreaterThan(0);
  });

  it("makes no fetch call of any kind", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is not permitted");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const summary = summarizeLocally("A short note about local-only study.");

    expect(summary.summary).toContain("local-only study");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("handles empty or whitespace-only text without inventing content", () => {
    const result = summarizeLocally(" \n\t ");
    expect(result.summary).toContain("No extractable text");
    expect(result.keyPoints).toEqual([]);
  });

  it("is clearly labelled as a local fallback", () => {
    expect(LOCAL_SUMMARY_NOTICE).toContain("local fallback");
    expect(LOCAL_SUMMARY_NOTICE).toContain("no network request");
  });

  it("can be rendered as plain text without a second transformation", () => {
    const result = summarizeLocally(
      "One sentence. Two sentences. Three sentences. Four sentences.",
    );
    const text = summaryContentToText(result);

    expect(text).toContain("One sentence.");
    expect(text).toContain("- ");
  });
});
