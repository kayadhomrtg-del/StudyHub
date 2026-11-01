/**
 * Parsing for the summary JSON returned by the provider.
 *
 * The schema is `{ summary, keyPoints }`. A truncated (`incomplete`) response
 * can contain valid partial text, valid JSON, or invalid JSON; the caller gets
 * the raw text back in every non-structured case so it can be shown without
 * pretending it is a complete structured answer.
 */

export interface SummaryContent {
  summary: string;
  keyPoints: string[];
}

export type SummaryOutputParse =
  | { ok: true; content: SummaryContent }
  | { ok: false; rawText: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSummaryOutput(outputText: string): SummaryOutputParse {
  const rawText = outputText.trim();
  if (rawText === "") {
    return {
      ok: false,
      rawText,
      message: "The AI response did not contain any summary text.",
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      rawText,
      message:
        "The AI response was not valid JSON, so it is shown as raw text.",
    };
  }

  if (
    !isRecord(value) ||
    typeof value.summary !== "string" ||
    value.summary.trim() === "" ||
    !Array.isArray(value.keyPoints) ||
    !value.keyPoints.every((point) => typeof point === "string")
  ) {
    return {
      ok: false,
      rawText,
      message:
        "The AI response did not match the expected summary shape, so it is shown as raw text.",
    };
  }

  return {
    ok: true,
    content: {
      summary: value.summary.trim(),
      keyPoints: value.keyPoints
        .map((point) => point.trim())
        .filter((point) => point !== ""),
    },
  };
}

/** Formats structured summary content for clipboard or plain-text display. */
export function summaryContentToText(content: SummaryContent): string {
  if (content.keyPoints.length === 0) return content.summary;
  return [
    content.summary,
    ...content.keyPoints.map((point) => `- ${point}`),
  ].join("\n\n");
}
