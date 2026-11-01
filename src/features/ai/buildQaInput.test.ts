import { describe, expect, it } from "vitest";

import {
  buildQaInput,
  getQaQuestionError,
  QA_MAX_QUESTION_CHARACTERS,
} from "./buildQaInput";

describe("buildQaInput", () => {
  it("uses a deterministic template containing only the selected source and question", () => {
    expect(
      buildQaInput("SOURCE TEXT", "Why does condensation form clouds?"),
    ).toBe(
      [
        "STUDY MATERIAL",
        "<<<STUDYHUB_MATERIAL>>>",
        "SOURCE TEXT",
        "<<<END_STUDYHUB_MATERIAL>>>",
        "",
        "QUESTION",
        "<<<STUDYHUB_QUESTION>>>",
        "Why does condensation form clouds?",
        "<<<END_STUDYHUB_QUESTION>>>",
      ].join("\n"),
    );
  });

  it("rejects empty and over-limit questions without truncating them", () => {
    expect(getQaQuestionError(" \n\t")).toBe("empty");
    const overLimit = "q".repeat(QA_MAX_QUESTION_CHARACTERS + 1);
    expect(getQaQuestionError(overLimit)).toBe("too_long");
    expect(getQaQuestionError("q".repeat(QA_MAX_QUESTION_CHARACTERS))).toBeNull();
    expect(buildQaInput("material", overLimit)).toContain(overLimit);
  });
});
