/**
 * The mandatory M1–M8 disclosures from `docs/AI_PLAN.md` section 8.2.
 *
 * The wording is immutable: it is copied from the plan rather than generated,
 * and the Phase 2 documentation test compares every entry against the plan.
 * Formatting emphasis is omitted here so the text can be rendered as plain
 * user-facing copy; the words themselves are unchanged.
 */

export type AiDisclosureId =
  | "M1"
  | "M2"
  | "M3"
  | "M4"
  | "M5"
  | "M6"
  | "M7"
  | "M8";

export interface AiDisclosure {
  readonly id: AiDisclosureId;
  readonly title: string;
  readonly text: string;
}

const DISCLOSURES = [
  {
    id: "M1",
    title: "Free-tier data use.",
    text:
      "On the Free Tier, submitted content and responses are used to provide, improve, and develop Google's products and machine-learning technologies. The pricing page lists \"Used to improve our products: Yes\" for the Free Tier and \"No\" for the Paid Tier.",
  },
  {
    id: "M2",
    title: "Human review.",
    text:
      "On the Free Tier, human reviewers may read, annotate, and process API input and output, decoupled from your account, API key, and cloud project before review.",
  },
  {
    id: "M3",
    title: "Abuse monitoring.",
    text:
      "Google retains prompts, contextual information, and outputs for 55 days for Prohibited Use Policy enforcement. This is independent of the request's storage flag, and content may be flagged for manual review by authorised Google personnel.",
  },
  {
    id: "M4",
    title: "Interaction storage.",
    text:
      "The Interactions API stores interactions by default (store=true): 55 days on the Paid Tier, 1 day on the Free Tier. StudyHub always sends store=false, so interactions are not stored; store=false also forbids background=true and previous_interaction_id, so there is no server-side multi-turn history.",
  },
  {
    id: "M5",
    title: "Redaction is not anonymisation.",
    text:
      "Google disconnects reviewed data from the account, key, and project before human review; that is a de-linking step, not an anonymisation guarantee.",
  },
  {
    id: "M6",
    title: "Regional terms.",
    text:
      "Paid Services are required to make API clients available to users in the EEA, Switzerland, and the United Kingdom.",
  },
  {
    id: "M7",
    title: "Local non-persistence.",
    text:
      "StudyHub stores no AI prompt, output, or history locally, and sends no study content except a payload you have just approved in full.",
  },
  {
    id: "M8",
    title: "Use restriction.",
    text:
      "The Gemini API and AI Studio are for developers building with Google AI models for professional or business purposes, not for consumer use; access is limited to available regions and to users aged 18 or over.",
  },
] as const satisfies readonly AiDisclosure[];

const FROZEN_DISCLOSURES: readonly AiDisclosure[] = DISCLOSURES.map(
  (disclosure) => Object.freeze(disclosure),
);

export const AI_DISCLOSURES: readonly AiDisclosure[] = Object.freeze(
  FROZEN_DISCLOSURES,
);

/**
 * Kept separate from M1–M8 because it describes StudyHub's own preparation
 * path, not the provider's handling.
 */
export const AI_PREPARE_DISCLOSURE =
  "Preparing a preview sends the extracted text only to the local StudyHub proxy on this computer. No provider is contacted during preparation. Text reaches a provider only after you review the exact payload, approve it, and choose Send. The local fallback makes no network request.";
