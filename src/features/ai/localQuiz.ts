import { sourceExcerpts } from "./sourceExcerpts";

export const LOCAL_QUIZ_NOTICE =
  "Local study fallback — not a generated quiz. These source excerpts do not include fabricated questions or answers.";

export function createLocalQuiz(text: string): string[] {
  return sourceExcerpts(text).slice(0, 5);
}
