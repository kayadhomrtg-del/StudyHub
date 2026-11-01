import { afterEach, describe, expect, it, vi } from "vitest";

import { createLocalQuiz, LOCAL_QUIZ_NOTICE } from "./localQuiz";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLocalQuiz", () => {
  it("returns up to five deterministic, deduplicated source excerpts", () => {
    const text = [
      "Water evaporates from lakes. Water evaporates from lakes.",
      "Vapor cools and condenses.",
      "Clouds release precipitation.",
      "The cycle returns water to rivers.",
      "Plants also release water vapor.",
      "The final sentence remains in the source.",
    ].join("\n");

    expect(createLocalQuiz(text)).toEqual([
      "Water evaporates from lakes.",
      "Vapor cools and condenses.",
      "Clouds release precipitation.",
      "The cycle returns water to rivers.",
      "Plants also release water vapor.",
    ]);
    expect(createLocalQuiz(text)).toEqual(createLocalQuiz(text));
    expect(LOCAL_QUIZ_NOTICE).toContain("not a generated quiz");
  });

  it("returns no fabricated quiz content for empty text and makes no fetch calls", () => {
    const fetch = vi.spyOn(globalThis, "fetch");

    expect(createLocalQuiz(" \n\t")).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
