export interface QaContent {
  answer: string;
  references?: string[];
}

export type QaOutputParse =
  | { ok: true; content: QaContent }
  | { ok: false; rawText: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(rawText: string, message: string): QaOutputParse {
  return { ok: false, rawText, message };
}

export function parseQaOutput(outputText: string): QaOutputParse {
  const rawText = outputText.trim();
  if (rawText === "") {
    return invalid(rawText, "The AI response did not contain an answer.");
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

  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => key !== "answer" && key !== "references") ||
    !("answer" in value) ||
    typeof value.answer !== "string" ||
    value.answer.trim() === ""
  ) {
    return invalid(
      rawText,
      "The AI response did not contain a valid answer, so it is shown as raw text.",
    );
  }

  const references = Array.isArray(value.references)
    ? value.references
        .filter(
          (reference): reference is string =>
            typeof reference === "string" && reference.trim() !== "",
        )
        .map((reference) => reference.trim())
    : [];

  return {
    ok: true,
    content: {
      answer: value.answer.trim(),
      ...(references.length > 0 ? { references } : {}),
    },
  };
}
