export const QA_MAX_QUESTION_CHARACTERS = 2_000;

export type QaQuestionError = "empty" | "too_long";

export function getQaQuestionError(question: string): QaQuestionError | null {
  if (question.trim() === "") return "empty";
  if (question.length > QA_MAX_QUESTION_CHARACTERS) return "too_long";
  return null;
}

export function buildQaInput(materialText: string, question: string): string {
  return [
    "STUDY MATERIAL",
    "<<<STUDYHUB_MATERIAL>>>",
    materialText,
    "<<<END_STUDYHUB_MATERIAL>>>",
    "",
    "QUESTION",
    "<<<STUDYHUB_QUESTION>>>",
    question,
    "<<<END_STUDYHUB_QUESTION>>>",
  ].join("\n");
}
