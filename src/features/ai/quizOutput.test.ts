import { describe, expect, it } from "vitest";

import {
  parseQuizOutput,
  QUIZ_MAX_OPTIONS,
  QUIZ_MAX_QUESTIONS,
} from "./quizOutput";

function validQuestion(overrides: Record<string, unknown> = {}) {
  return {
    question: "Which term is defined?",
    options: ["Term A", "Term B"],
    correctIndex: 0,
    explanation: "The material defines Term A.",
    ...overrides,
  };
}

describe("parseQuizOutput", () => {
  it("parses a valid multiple-choice quiz and trims text", () => {
    const parsed = parseQuizOutput(
      JSON.stringify({
        questions: [validQuestion({ question: "  Which term?  " })],
      }),
    );

    expect(parsed).toEqual({
      ok: true,
      content: {
        questions: [
          {
            question: "Which term?",
            options: ["Term A", "Term B"],
            correctIndex: 0,
            explanation: "The material defines Term A.",
          },
        ],
      },
    });
  });

  it("returns raw output for invalid JSON and empty quizzes", () => {
    expect(parseQuizOutput("not JSON")).toMatchObject({
      ok: false,
      rawText: "not JSON",
    });
    expect(parseQuizOutput('{"questions":[]}')).toMatchObject({
      ok: false,
      message: expect.stringContaining("1–10"),
    });
  });

  it("rejects question counts over the configured bound", () => {
    const parsed = parseQuizOutput(
      JSON.stringify({
        questions: Array.from({ length: QUIZ_MAX_QUESTIONS + 1 }, () =>
          validQuestion(),
        ),
      }),
    );

    expect(parsed.ok).toBe(false);
  });

  it.each([
    ["too few options", { options: ["Only one"] }],
    [
      "too many options",
      { options: Array.from({ length: QUIZ_MAX_OPTIONS + 1 }, (_, i) => `Option ${i}`) },
    ],
    ["non-string options", { options: ["Valid", 2] }],
    ["empty question", { question: "  " }],
    ["non-integer correct index", { correctIndex: 0.5 }],
    ["negative correct index", { correctIndex: -1 }],
    ["out-of-range correct index", { correctIndex: 2 }],
    ["missing explanation", { explanation: "" }],
    ["unexpected field", { prompt: "unexpected" }],
  ])("rejects a question with %s", (_label, overrides) => {
    const parsed = parseQuizOutput(
      JSON.stringify({ questions: [validQuestion(overrides)] }),
    );
    expect(parsed).toMatchObject({
      ok: false,
      message: expect.stringContaining("invalid"),
    });
  });

  it("rejects unexpected top-level fields", () => {
    expect(
      parseQuizOutput(
        JSON.stringify({ questions: [validQuestion()], score: 1 }),
      ),
    ).toMatchObject({ ok: false });
  });
});
