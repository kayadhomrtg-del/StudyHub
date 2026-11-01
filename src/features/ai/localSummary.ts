/**
 * Deterministic, entirely local summary fallback.
 *
 * This module is a pure function over text already extracted in memory. It
 * makes no network request of any kind, has no clock or random input, and does
 * not import the client or the proxy.
 */

export const LOCAL_SUMMARY_NOTICE =
  "This is a local fallback summary. It was produced only from text already extracted in this browser and made no network request.";

const MAX_SUMMARY_CHARACTERS = 700;
const MAX_KEY_POINT_CHARACTERS = 280;
const MAX_KEY_POINTS = 5;

export interface LocalSummary {
  summary: string;
  keyPoints: string[];
  sourceCharacters: number;
}

function cleanSentence(sentence: string): string {
  return sentence.replace(/\s+/g, " ").trim();
}

function splitSentences(paragraph: string): string[] {
  const normalized = paragraph.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return (normalized.match(/[^.!?]+[.!?]*/g) ?? [normalized])
    .map(cleanSentence)
    .filter(Boolean);
}

function limitWithEllipsis(text: string, maxCharacters: number): string {
  if (text.length <= maxCharacters) return text;
  return `${text.slice(0, Math.max(0, maxCharacters - 1)).trimEnd()}…`;
}

function dedupeKey(sentence: string): string {
  return sentence.toLowerCase().replace(/\s+/g, " ").trim();
}

export function summarizeLocally(text: string): LocalSummary {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const sentences = paragraphs.flatMap(splitSentences);

  if (sentences.length === 0) {
    return {
      summary: "No extractable text was found in this material.",
      keyPoints: [],
      sourceCharacters: text.length,
    };
  }

  const summarySentences: string[] = [];
  for (const sentence of sentences) {
    if (summarySentences.length >= 3) break;
    const candidate = cleanSentence([...summarySentences, sentence].join(" "));
    if (candidate.length > MAX_SUMMARY_CHARACTERS && summarySentences.length > 0) {
      break;
    }
    summarySentences.push(sentence);
    if (candidate.length >= MAX_SUMMARY_CHARACTERS) break;
  }

  const summary = limitWithEllipsis(
    cleanSentence(summarySentences.join(" ")),
    MAX_SUMMARY_CHARACTERS,
  );
  const summaryKeys = new Set(summarySentences.map(dedupeKey));
  const remaining = sentences.slice(summarySentences.length);
  const candidates = remaining.length > 0 ? remaining : sentences;
  const keyPoints: string[] = [];
  const seen = new Set<string>();

  for (const sentence of candidates) {
    const key = dedupeKey(sentence);
    if (!key || seen.has(key) || summaryKeys.has(key)) continue;
    seen.add(key);
    keyPoints.push(
      limitWithEllipsis(sentence, MAX_KEY_POINT_CHARACTERS),
    );
    if (keyPoints.length >= MAX_KEY_POINTS) break;
  }

  return {
    summary,
    keyPoints,
    sourceCharacters: text.length,
  };
}
