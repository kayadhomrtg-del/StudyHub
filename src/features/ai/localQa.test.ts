import { afterEach, describe, expect, it, vi } from "vitest";

import { createLocalQa, LOCAL_QA_NOTICE } from "./localQa";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLocalQa", () => {
  it("returns up to three deterministic excerpts with keyword overlap", () => {
    const text = [
      "Condensation forms clouds when water vapor cools.",
      "Evaporation changes liquid water into vapor.",
      "Clouds release precipitation as rain.",
      "Clouds gather over rivers.",
    ].join("\n");
    const expected = [
      "Condensation forms clouds when water vapor cools.",
      "Clouds release precipitation as rain.",
      "Clouds gather over rivers.",
    ];

    expect(createLocalQa(text, "How do clouds form?")).toEqual(expected);
    expect(createLocalQa(text, "How do clouds form?")).toEqual(expected);
    expect(LOCAL_QA_NOTICE).toContain("not an AI answer");
  });

  it("uses the first excerpts when there is no keyword overlap and makes no fetch calls", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const text = "First source fact. Second source fact. Third source fact. Fourth fact.";

    expect(createLocalQa(text, "unrelated query")).toEqual([
      "First source fact.",
      "Second source fact.",
      "Third source fact.",
    ]);
    expect(createLocalQa(" \n ", "question")).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
