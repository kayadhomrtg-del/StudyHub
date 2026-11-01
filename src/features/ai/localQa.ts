import { sourceExcerpts } from "./sourceExcerpts";

export const LOCAL_QA_NOTICE =
  "Local source excerpts — not an AI answer. These passages are selected from the material and do not claim to answer the question.";

const MAX_EXCERPTS = 3;
const QUESTION_STOP_WORDS = new Set([
  "about",
  "are",
  "can",
  "did",
  "does",
  "for",
  "from",
  "how",
  "into",
  "that",
  "the",
  "this",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

function keywords(value: string): Set<string> {
  return new Set(
    (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (word) => word.length > 2 && !QUESTION_STOP_WORDS.has(word),
    ),
  );
}

export function createLocalQa(text: string, question: string): string[] {
  const excerpts = sourceExcerpts(text);
  if (excerpts.length === 0) return [];

  const questionKeywords = keywords(question);
  const scored = excerpts
    .map((excerpt, index) => ({
      excerpt,
      index,
      score: [...keywords(excerpt)].filter((word) => questionKeywords.has(word))
        .length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (scored.length > 0) {
    return scored.slice(0, MAX_EXCERPTS).map((entry) => entry.excerpt);
  }
  return excerpts.slice(0, MAX_EXCERPTS);
}
