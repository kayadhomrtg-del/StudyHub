export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizContent {
  questions: QuizQuestion[];
}

export type QuizOutputParse =
  | { ok: true; content: QuizContent }
  | { ok: false; rawText: string; message: string };

export const QUIZ_MIN_QUESTIONS = 1;
export const QUIZ_MAX_QUESTIONS = 10;
export const QUIZ_MIN_OPTIONS = 2;
export const QUIZ_MAX_OPTIONS = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function invalid(rawText: string, message: string): QuizOutputParse {
  return { ok: false, rawText, message };
}

export function parseQuizOutput(outputText: string): QuizOutputParse {
  const rawText = outputText.trim();
  if (rawText === "") {
    return invalid(rawText, "The AI response did not contain any quiz text.");
  }

  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch {
    return invalid(
      rawText,
      "The AI response was not valid JSON, so it is shown as raw text.",
    );
  }

  if (!isRecord(value) || !hasExactKeys(value, ["questions"])) {
    return invalid(
      rawText,
      "The AI response did not match the expected quiz shape, so it is shown as raw text.",
    );
  }

  if (
    !Array.isArray(value.questions) ||
    value.questions.length < QUIZ_MIN_QUESTIONS ||
    value.questions.length > QUIZ_MAX_QUESTIONS
  ) {
    return invalid(
      rawText,
      `The quiz must contain ${QUIZ_MIN_QUESTIONS}–${QUIZ_MAX_QUESTIONS} questions.`,
    );
  }

  const questions: QuizQuestion[] = [];
  for (const candidate of value.questions) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, [
        "question",
        "options",
        "correctIndex",
        "explanation",
      ]) ||
      typeof candidate.question !== "string" ||
      candidate.question.trim() === "" ||
      !Array.isArray(candidate.options) ||
      candidate.options.length < QUIZ_MIN_OPTIONS ||
      candidate.options.length > QUIZ_MAX_OPTIONS ||
      !candidate.options.every(
        (option) => typeof option === "string" && option.trim() !== "",
      ) ||
      !Number.isInteger(candidate.correctIndex) ||
      (candidate.correctIndex as number) < 0 ||
      (candidate.correctIndex as number) >= candidate.options.length ||
      typeof candidate.explanation !== "string" ||
      candidate.explanation.trim() === ""
    ) {
      return invalid(
        rawText,
        "At least one quiz question was invalid. The response is shown as raw text and cannot be graded.",
      );
    }

    questions.push({
      question: candidate.question.trim(),
      options: candidate.options.map((option) => option.trim()),
      correctIndex: candidate.correctIndex as number,
      explanation: candidate.explanation.trim(),
    });
  }

  return { ok: true, content: { questions } };
}
