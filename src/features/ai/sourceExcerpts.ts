const MAX_EXCERPT_CHARACTERS = 500;

function normalizeSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function excerptKey(value: string): string {
  return normalizeSentence(value).toLowerCase();
}

export function sourceExcerpts(text: string): string[] {
  const sentences = text
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.match(/[^.!?]+[.!?]*/g) ?? [])
    .map(normalizeSentence)
    .filter(Boolean);

  const seen = new Set<string>();
  return sentences.flatMap((sentence) => {
    const key = excerptKey(sentence);
    if (seen.has(key)) return [];
    seen.add(key);
    if (sentence.length <= MAX_EXCERPT_CHARACTERS) return [sentence];
    return [`${sentence.slice(0, MAX_EXCERPT_CHARACTERS - 1).trimEnd()}…`];
  });
}
