# StudyHub Phase 3 — AI quiz and grounded Q&A plan

**Status:** Owner-approved scope; all six implementation steps and final
verification are complete. Owner acceptance of the final diff remains pending.
Phase 3 has not changed the production AI server, provider eligibility,
dispatch, database schema, backup formats, or dependencies.

**Owner-reported Google clarification (2026-11-02):** the owner reports that
Google confirmed the intended personal coursework use. No written response
was available in the project files. Record this narrowly; do not claim broader
approval or quote unseen correspondence. This historical Phase 3 plan does not
authorize provider changes; the current AI plan and explicit owner
authorization govern later work.

**Scope:** one person, one browser profile, one machine, personal study use.

**Source of truth:** [`docs/AI_PLAN.md`](AI_PLAN.md) wins for AI behaviour. This
document elaborates Phase 3 only; it does not replace, relax, or reinterpret the
AI plan. Related records are [`docs/TEST_PLAN.md`](TEST_PLAN.md),
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md),
[`docs/AI_LAUNCH_CHECKLIST.md`](AI_LAUNCH_CHECKLIST.md), and
[`docs/COPILOT_HANDOVER.md`](COPILOT_HANDOVER.md).

**Approval rule:** the owner explicitly authorized implementation of all six
steps in one instruction, approved the documented defaults, and selected
showing the provider model name. That authorization waived routine approval
pauses between those six steps. It does not authorize work outside this plan;
final owner acceptance remains pending.

---

## 1. Goals and scope

### 1.1 Goals

Phase 3 adds two optional AI study surfaces over one already-imported material:

1. **Quiz generation** — produce multiple-choice practice questions from the
   selected material, let the learner answer them locally, and show a local
   score with explanations.
2. **Grounded question and answer** — accept one question about the selected
   material, send the question together with that material's extracted text,
   and show an answer with any provider-reported references.

Both surfaces must:

- work from text extracted locally by the existing Phase 2 path;
- reuse the single Phase 1 prepare/review/send pipeline and the Phase 2 browser
  UI primitives;
- show the immutable M1–M8 disclosures before the first request;
- keep all AI state in memory;
- remain fully usable through a deterministic local fallback that makes zero
  `fetch` calls;
- leave real provider dispatch impossible, blocked, and unchanged.

### 1.2 In scope

- New quiz and Q&A routes reachable from a supported material.
- Surface-specific request controls, output parsers, validation, and
  presentation.
- Answer checking for generated multiple-choice questions, performed locally.
- A fresh privacy review of the new surfaces.
- Focused tests, plus the existing Phase 1 and Phase 2 suites.
- Documentation and status updates after implementation is verified.

### 1.3 Out of scope

- Flashcards, spaced repetition, lecture transcription, study plans, or any
  additional AI feature.
- Batch processing, multi-material context, cross-module context, or retrieval
  over the whole library.
- Multi-turn Q&A, saved conversation history, or saved quiz attempts.
- OCR, image understanding, audio/video understanding, or provider-side file
  uploads.
- A new provider, a local model, a backend, accounts, cloud sync, telemetry, or
  analytics.
- Any change to provider eligibility, region rules, launch gates, activation,
  API-key handling, or real-dispatch behaviour.
- Any Dexie schema change, new store, backup format change, or new dependency.
- Any change to the frozen M1–M8 wording.

### 1.4 What "grounded" means here

"Grounded" means the request contains only:

- the extracted text of the one selected material; and
- for Q&A, the learner's question, clearly delimited inside that request.

The provider is instructed to use only the supplied material. StudyHub does not
add web search, source retrieval, embeddings, personal notes, module metadata, or
other materials. This reduces unsupported answers; it does **not** guarantee
that a provider answer, explanation, or reference is correct. The UI must say so.

### 1.5 Definition of done

Phase 3 is done only when:

- both surfaces are reachable and tested;
- every new surface satisfies the acceptance criteria in section 9;
- all Phase 2 privacy and persistence acceptance criteria still hold;
- the full verification suite passes;
- the owner has reviewed the final diff and accepted the result; and
- no provider activation or real dispatch was added.

---

## 2. Existing architecture and completed work

### 2.1 Project baseline

StudyHub is a local-first React 19 + TypeScript + Vite 6 + Tailwind 4
application using Dexie/IndexedDB. It has no backend, accounts, cloud sync,
analytics, telemetry, or runtime CDNs. Data lives in the browser profile for the
current origin.

Authoritative project rules and commands are in
[`AGENTS.md`](../AGENTS.md); the current Copilot rules are in
[`.github/copilot-instructions.md`](../.github/copilot-instructions.md).

### 2.2 Completed phases

| Phase | Status | What exists |
| --- | --- | --- |
| Phase 0 | Complete | AI requirements and privacy records: [`AI_PLAN.md`](AI_PLAN.md), [`AI_LAUNCH_CHECKLIST.md`](AI_LAUNCH_CHECKLIST.md), and the related product, architecture, test, README, and instruction updates. No AI runtime code. |
| Phase 1 | Implemented | `server/ai/` loopback proxy skeleton: request validation, launch-gate evaluation, local daily budget, payload store, error taxonomy, structured logging, and dev/preview Vite mounting. The provider is permanently unconfigured and the activation reader is permanently disabled. No AI UI. |
| Phase 2 | Implemented; Steps 1–4 approved by the owner; Step 5 documentation | Summary route, material loading and bounded local extraction, exact-payload preview, fresh approval, prepare/send state machine, M1–M8 disclosure panel, distinct error and fallback presentation, optional personal notes, and focused tests. |
| Phase 3 | Implemented; final owner acceptance pending | Shared feature-aware client and test stub, generic request hook, quiz and Q&A core/surfaces/routes, source loader, material-viewer actions, tests, and documentation updates. |

The current checkout contains uncommitted work, including existing Phase 1/2
changes and Phase 3 implementation. That work must not be mistaken for
committed history or discarded. See
[`COPILOT_HANDOVER.md`](COPILOT_HANDOVER.md) for the inspection rule.

### 2.3 Existing request pipeline

The only AI network boundary is the same-origin loopback proxy:

```text
selected material
  -> local text extraction
  -> POST /api/ai/prepare { feature, text }
  -> launch gates + validation + payload construction + single-use token
  -> exact payload review + fresh approval
  -> POST /api/ai/send { token, digest }
  -> Phase 1 budget check and, only if every gate passes, one provider call
  -> output text returned to the browser
```

Preparation never dispatches and charges no budget. Sending is possible only
after a fresh approval for the current payload, makes at most one provider
attempt, and never retries. The fallback is a pure local function and makes zero
`fetch` calls.

### 2.4 What already exists for quiz and Q&A

`server/ai/config.ts` already declares provisional `quiz` and `qa` feature
configurations, models, limits, system instructions, and JSON schemas. The
prepare validator already accepts the `summary`, `quiz`, and `qa` feature names.
The browser now has quiz and Q&A routes, pages, parsing, deterministic local
fallbacks, and focused tests. Both use the shared client and request hook,
reuse the exact-payload preview and disclosures, and load only the selected
material through local extraction.

Phase 3 is expected to use that existing server configuration without changing
the production provider, gates, activation, or dispatch behaviour. If a
production server change appears necessary, stop and ask the owner; do not make
it as an incidental part of a UI step.

### 2.5 What remains intentionally absent

- Real provider dispatch, API key lookup, provider endpoint, HTTP client, and
  activation path remain absent.
- Quiz/Q&A state is memory-only; there is no saved attempt, score, answer,
  reference, or conversation history.
- At Phase 3 completion, the provider terms classification was unresolved and
  dispatch remained blocked. The owner's 2026-11-02 clarification corrected
  the former categorical claim; see `AI_PLAN.md` §3 for current status.

---

## 3. Approved product decisions

### 3.1 Binding decisions (approved; do not change)

These come from [`AI_PLAN.md`](AI_PLAN.md) and the approved Phase 1/Phase 2
records:

1. Phase 3 is **quiz generation plus Q&A**, not another feature family.
2. Each new surface shows the immutable M1–M8 disclosures before the first
   request.
3. Every Phase 2 accept criterion still applies to the new surfaces.
4. Both surfaces reuse the **single** Phase 1 prepare/review/approve/send
   pipeline. Do not add a second AI protocol, route, or provider path.
5. The exact outbound payload is shown in full before sending.
6. A request requires a fresh, explicit approval; an earlier approval is never
   reused.
7. The payload digest is an integrity check only, never proof of approval,
   authorization, or eligibility.
8. Personal notes, if present anywhere, are never included in an AI payload.
9. No AI prompt, output, history, quiz attempt, score, or Q&A transcript is
   written to IndexedDB, a backup, or any StudyHub application storage.
10. The local fallback makes zero `fetch` calls.
11. At Phase 3 completion, real provider dispatch was structurally impossible
    and blocked: the terms classification was unresolved, the mounted provider
    was unconfigured, and the activation reader was disabled. The owner
    clarification dated 2026-11-02 corrects the former categorical
    ineligibility statement; it does not establish Google approval.
12. No backend, accounts, cloud sync, telemetry, analytics, external AI service,
    new dependency, Dexie schema change (v7, eight stores), or backup format
    change (v2 full, v1 module).
13. Phase 3 includes a fresh privacy review and tests for quiz validation,
    answer checking, and fallback behaviour.
14. Rollback removes the Phase 3 routes and components; it does not require a
    data migration.
15. The owner authorized all six implementation steps together. Routine
    between-step approval was waived for this implementation; final acceptance
    remains with the owner.

### 3.2 Owner-approved implementation defaults

The owner approved the following defaults before implementation. They are
binding for this Phase 3 scope.

| ID | Owner-approved default | Why |
| --- | --- | --- |
| P1 | Routes are `/materials/:materialId/quiz` and `/materials/:materialId/qa`. | Mirrors the existing summary route and keeps one material as the context. |
| P2 | Q&A is single-turn. A new question is a new request, with a new preview, fresh approval, and new budget unit. | `store=false` already forbids provider-side multi-turn; keeping history would require local AI persistence, which is prohibited. |
| P3 | Keep the prepare contract `{ feature, text }`. The Q&A page builds a deterministic `buildQaInput(materialText, question)` string, and the preview shows the full result. | Avoids a server contract change and keeps one pipeline. |
| P4 | Quiz output is single-select multiple choice only: `question`, `options`, `correctIndex`, `explanation`. No count, difficulty, or question-type controls. | The existing server quiz schema defines only these fields. |
| P5 | Validate quiz output with 1–10 questions and 2–6 options per question. | Prevents unbounded or degenerate provider output without pretending to control generation. |
| P6 | Answer checking is local: require one selection per question, check with one button, show a score and each explanation. Each question is all-or-nothing; no partial credit. | Uses `correctIndex`; makes no extra AI call; keeps the feature inspectable. |
| P7 | Q&A references are displayed as "provider-reported, not verified" strings. No reference is fetched or treated as proof. | The schema returns strings, not verified citations. |
| P8 | Both fallbacks are user-triggered and deterministic: quiz shows up to five source excerpts as a local study fallback; Q&A shows up to three keyword-matched source excerpts as local source excerpts, not an AI answer. | Preserves the zero-fetch fallback without inventing verified quiz questions or answers. |
| P9 | Do not add the personal-notes panel to the new surfaces. Reuse it only if the owner explicitly asks. | Notes are a Phase 2 summary option; omitting them reduces new privacy surface. |
| P10 | Quiz answers, score, Q&A question, answer, and references are memory-only and disappear on refresh, navigation, or reset. | Matches the existing no-AI-persistence rule. |
| P11 | Reuse the Phase 2 source-extraction functions and shared UI primitives. Do not duplicate the disclosure text, payload preview, error taxonomy, or integrity checks. | Keeps one privacy implementation. |
| P12 | Reject an empty or whitespace-only Q&A question locally with no request; cap question length at 2,000 characters without truncation. | Prevents a pointless request and keeps the input explainable. |
| P13 | Do not change production `server/ai/` code. Quiz/QA configs and validation already exist; changes are client-side plus test-double and test coverage. | Keeps the security boundary untouched. |
| P14 | Keep `useAiSummaryRequest.ts` and `pages/MaterialSummaryPage.tsx` unchanged. Add a generic request hook for the new surfaces and a small shared source loader for the new pages. | Avoids destabilising the approved Phase 2 flow; a later refactor can unify the summary path separately. |

### 3.3 Decisions resolved for this implementation

The owner approved the defaults in section 3.2 and selected **show the provider
model name**. The previously listed product choices are therefore resolved for
this implementation:

1. No quiz controls; validate 1–10 questions and 2–6 options.
2. Require all answers, score all-or-nothing, and lock the checked attempt.
3. Q&A is single-turn with no history.
4. Display reference strings as provider-reported and unverified; never fetch
   or claim to verify them.
5. Use deterministic source-excerpt fallbacks; do not fabricate questions or
   answers.
6. Keep all AI outputs and study results in memory only.
7. Omit personal notes from quiz and Q&A.
8. Embed the question in the `text` field using `buildQaInput`; do not change the
   prepare/send contract.
9. Show the provider model name on completed quiz and Q&A outputs.

At Phase 3 completion, the provider terms classification and regional
conditions remained unresolved and real dispatch was blocked. The owner
clarified intended personal use on 2026-11-02; this records intent, not
provider approval. No product decision in this historical section authorizes
dispatch.

---

## 4. Quiz requirements

### 4.1 Question format

Use only the existing quiz schema:

```json
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}
```

- Single-select multiple choice only. No true/false, short-answer, matching, or
  free-text grading in Phase 3.
- `correctIndex` is zero-based and must be an integer inside `options`.
- A question needs a non-empty stem, at least two non-empty options, a valid
  index, and a non-empty explanation. The proposed upper bounds are in P5.
- Render all provider text as text, never as HTML.
- Do not change `server/ai/config.ts` or the quiz schema.

### 4.2 Generation input

- The input is the selected material's extracted text only.
- Use the existing `summary`-style material loading and extraction path; do not
  add OCR or file upload.
- If extraction fails or produces no text, do not prepare a request. Show the
  same kind of local source error as the summary route and offer the local
  fallback where the proposed default allows it.
- Do not let the user choose question count or difficulty unless the owner
  approves a schema/instruction change.

### 4.3 Generation flow

Approved flow:

1. The learner opens the quiz route from a supported material.
2. The page loads the material and extracts text locally.
3. M1–M8 are visible; the page states that provider dispatch is currently
   blocked.
4. The learner chooses **Prepare quiz payload**.
5. The exact payload is displayed, including the material text, the model, and
   the quiz instructions.
6. The learner checks the fresh approval box and chooses **Send approved
   request**.
7. If a response arrives, parse and validate it. If it is invalid or incomplete,
   show the raw output and do not offer answer checking for invalid questions.
8. Answer checking happens locally in the browser.

### 4.4 Answer checking

Approved default:

- Render one question at a time or all questions in a list, each with accessible
  radio inputs and a fieldset/legend.
- The learner makes one selection per question.
- **Check answers** is disabled until every question has a selection.
- On check, compare each selection with `correctIndex`, show correct/incorrect,
  show the explanation, and show a score such as "3 of 5 correct".
- No answer is submitted anywhere; no network call is made by the checker.
- The checked attempt is memory-only. A refresh or route change loses it.
- A new generated quiz requires a new prepare, a new approval, and a new budget
  unit.

This strictness was approved for Phase 3 and is implemented locally.

### 4.5 Output states

| State | Required behaviour |
| --- | --- |
| Idle | Explain that preparation is local; offer prepare and local fallback. |
| Preparing | Say no provider is contacted during preparation. |
| Review | Show the exact payload, fresh approval, and send control. |
| Sending | Show that exactly one request is being attempted; no retry. |
| Complete, valid | Render questions, options, answer checking, score, explanations. |
| Complete, invalid JSON/shape | Show the raw output, a clear parse message, no answer checking, and the next-action controls. |
| Incomplete | Show the partial output and state that it may be truncated; do not grade it. |
| Error | Use the shared distinct error presentation; offer fallback and a new preparation, never automatic retry. |
| Fallback | Show local source excerpts, labelled clearly as not a generated quiz. |

### 4.6 Quiz fallback

Approved default: a pure function over the in-memory text returns up to five
deduplicated source excerpts. It is labelled "Local study fallback — not a
generated quiz" and makes zero `fetch` calls. It does not fabricate correct
answers and does not offer scoring. The exact excerpt-selection rule must be
deterministic and covered by tests.

---

## 5. Q&A requirements

### 5.1 Turn model

Approved default: single-turn.

- One question per request.
- No previous question, previous answer, or chat transcript is included.
- No `previous_interaction_id` is sent; StudyHub already sends `store=false`.
- After an answer, the learner may ask another question, which starts a new
  prepare/review/send cycle with a new token, fresh approval, and new budget
  unit.
- No conversation history is saved locally.

Multi-turn is out of scope; do not add it without separate owner approval.

### 5.2 Question input and exact payload

Approved default:

- The page shows a labelled question field and a short notice that the question
  and material text will both be visible in the exact payload.
- An empty or whitespace-only question is rejected locally and makes no request.
- The proposed question cap is 2,000 characters; over-limit input is rejected
  locally, not silently truncated.
- `buildQaInput(materialText, question)` produces a deterministic string with
  clear material and question delimiters. The question is part of that string.
- The UI sends `{ feature: "qa", text: buildQaInput(...) }` to the existing
  prepare route. The server contract remains unchanged.
- The exact preview shows the full template, including both the material text
  and the question. No hidden system prompt, note, or metadata is included in
  the text field beyond the configured system instruction that the preview
  already shows.

### 5.3 Answer and references

The existing `qa` schema is:

```json
{
  "answer": "string",
  "references": ["string"]
}
```

- Require a non-empty `answer` after parsing. `references` may be absent or
  empty; if present, render only string entries.
- Label references as **provider-reported, not verified**. Do not claim they
  were checked against the material.
- Do not fetch, open, or resolve a reference.
- Do not treat a reference as a citation guarantee or as proof of grounding.
- If the answer is valid but references are absent, show the answer without a
  references section.
- If the output is invalid JSON or the wrong shape, show the raw output and a
  parse message. Do not present it as a structured answer.

### 5.4 Grounding and limitations copy

The Q&A page must state, before the request:

- the answer is generated only from the selected material;
- the model can still be wrong, omit context, or produce an unsupported
  explanation or reference;
- no web search or external retrieval is used;
- personal notes and other materials are not included; and
- provider dispatch is currently blocked in this repository.

### 5.5 Q&A fallback

Approved default: a pure function over the in-memory text returns up to three
source excerpts selected by deterministic keyword overlap with the question,
falling back to the first suitable excerpts when there is no overlap. It is
labelled "Local source excerpts — not an AI answer", makes zero `fetch` calls,
and never claims to answer the question.

---

## 6. Shared request pipeline and privacy requirements

### 6.1 One pipeline, two feature names

Both surfaces use the existing routes and payload shape:

```text
POST /api/ai/prepare  { feature: "quiz" | "qa", text: string }
POST /api/ai/send     { token: string, digest: string }
```

No new API route, proxy handler, provider, network client, or retry path is
allowed. `feature` selects the existing server configuration. The browser sends
only the token and digest on send; it never reconstructs or resends the payload.

The exact Phase 1 order remains in force: loopback Host and Origin checks, gates,
validation, payload construction/storage, review, fresh approval, budget,
token/digest verification, one dispatch attempt, no retry.

### 6.2 M1–M8 on every new surface

- Reuse the frozen disclosure source in `src/features/ai/disclosures.ts`.
- Render all eight disclosures on each new surface before the first request.
- Do not edit, shorten, reorder, hide behind a dismiss control, or replace the
  M1–M8 text.
- The shared `DisclosurePanel` may gain an optional surface label so its heading
  is not summary-specific, but the M1–M8 entries themselves must keep the same
  wording as the plan (formatting emphasis aside) and continue to satisfy the
  Phase 2 documentation test.
- A new surface must not rely on the summary page having shown the disclosures
  earlier.

### 6.3 Privacy requirements

- The exact payload is always shown in full before approval.
- The Q&A question is visible in that payload; there is no hidden question field.
- Personal notes are excluded by construction, not by a last-minute filter.
  Approved default: do not add notes to the new surfaces.
- No AI prompt, output, answer, reference, quiz attempt, score, or history is
  written to IndexedDB, application storage, a backup, a URL, or a log.
- No telemetry, analytics, third-party script, or external request is added.
- `store=false` remains in every provider payload.
- No provider-side multi-turn field is added.
- The local fallback performs zero `fetch` calls of any kind.
- Tests must use an injected in-process fake provider or the injected proxy stub;
  no test may contact Google or enable a real request.

### 6.4 Fresh privacy review checklist

Both surfaces were reviewed against this list:

- [x] M1–M8 are present before the first prepare action.
- [x] The exact payload is complete and includes the question for Q&A.
- [x] No note, module, topic, or other material is in the payload.
- [x] No AI state is persisted; a refresh clears it.
- [x] No backup record or Dexie store changes.
- [x] No new network destination or absolute URL exists.
- [x] The fallback makes zero `fetch` calls.
- [x] Error wording distinguishes "not sent" from "failed after sending" and
      from an unknown outcome.
- [x] No provider activation, key lookup, endpoint, or dispatch path was added.
- [x] The provider remains impossible to reach in production.

### 6.5 Error and fallback classes

Use the existing taxonomy and wording:

| Class | Meaning | UI wording |
| --- | --- | --- |
| A | Refused before dispatch | "Not sent — <reason>" |
| B | Attempted and failed | "Request failed after sending — <reason>" |
| Unknown | Send result could not be established | "Outcome unknown" wording, never "not sent" |

`incomplete` is a provider answer with truncated output; show the partial text
but do not present it as a complete quiz or answer. There is no automatic retry
on any status, including 429 and 5xx.

---

## 7. Persistence and failure handling

### 7.1 Persistence rules

| Data | Storage | Survives refresh? | In backup? |
| --- | --- | --- | --- |
| Prepared payload / token / digest | Memory only | No | No |
| Quiz questions, selections, score | Memory only | No | No |
| Q&A question, answer, references | Memory only | No | No |
| AI error/outcome state | Memory only | No | No |
| Optional personal notes (if approved) | Existing note service only | Yes, as ordinary notes | Yes, as ordinary notes; never sent to AI |
| Launch artifact / usage counter | `.study-hub/` files, unchanged | Yes | No |

No new Dexie store or index is added. Schema remains **v7** with the existing
eight stores. Full backups remain **v2** and module backups remain **v1**; no AI
record is added to either.

### 7.2 Failure handling

| Situation | Required behaviour |
| --- | --- |
| Unsupported material or no extractable text | Do not prepare; show a local source error; offer fallback only if approved. |
| Empty question | Local validation message; no request; no budget. |
| Question/input over cap | Local message; no request; no silent truncation. |
| Prepare refused by a gate | "Not sent — reason"; no budget; no fallback network call. |
| Prepare network/invalid response | "Not sent — reason"; no budget; no automatic retry. |
| Send network failure / lost response | Unknown outcome; do not claim it was not sent; no retry. |
| Send post-dispatch error | "Request failed after sending — reason"; one budget unit consumed. |
| `incomplete` | Show partial output with a truncation warning; no complete-grading claim. |
| Quiz JSON invalid or shape invalid | Show raw output and parse message; disable answer checking; offer fallback/new prepare. |
| Q&A JSON invalid or empty answer | Show raw output and parse message; do not present a structured answer. |
| References missing/invalid | Show answer without references, or omit invalid entries with a note; never invent references. |
| Local fallback | Pure in-memory result; zero `fetch`; no budget; no persistence. |
| New attempt | New prepare, new token, fresh approval, new budget unit. |

No failure path may degrade into a permissive default, a silent retry, or a
second provider call.

---

## 8. Six implementation steps

The owner authorized all six steps together and waived routine approval pauses
between them. They were implemented in the order below; the checkpoint records
remain useful for scope and verification, but are not additional gates for this
authorized work.

### Step 1 — Shared feature contract and test double

**Purpose:** make `quiz` and `qa` first-class client features without changing
the approved summary behaviour or production server.

**Expected files:**

- `src/features/ai/aiTypes.ts` — add the feature union and generic prepared
  payload aliases while preserving `AiPreparedSummary` and existing summary
  exports.
- `src/features/ai/aiClient.ts` — add generic prepare/send internals or wrappers
  for `quiz` and `qa`; keep the existing summary functions and wording intact.
- `src/features/ai/testing/stubAiFetch.ts` — accept `quiz`/`qa`, produce
  deterministic valid outputs, reject unexpected bodies, and keep all requests
  relative and same-origin.
- Focused client/stub tests, including exact body keys and summary regression
  coverage.

**Not in this step:** routes, pages, viewer buttons, or production
`server/ai/` changes.

**Completed:** generic feature client contract and test-double coverage are in
place; summary compatibility tests pass.

### Step 2 — Quiz core

**Purpose:** implement quiz parsing, validation, local fallback, and the shared
request-hook semantics.

**Expected new files:**

- `src/features/ai/quizOutput.ts` — parse and validate the existing quiz schema.
- `src/features/ai/localQuiz.ts` — deterministic, zero-fetch source-excerpt
  fallback.
- `src/features/ai/useAiFeatureRequest.ts` — generic prepare/review/approve/send
  state machine for quiz and Q&A, preserving the Phase 2 state names, expiry
  guard, integrity guard, no-retry rule, and fallback transitions.

**Expected tests:**

- `quizOutput.test.ts` — valid JSON, invalid JSON, empty questions, bad options,
  non-integer/out-of-range `correctIndex`, missing explanation, bounds.
- `localQuiz.test.ts` — deterministic excerpts, empty text, zero-fetch purity.
- `useAiFeatureRequest.test.tsx` — prepare/review/send, fresh approval, expiry,
  integrity mismatch, incomplete, error, fallback, no auto-send.

**Completed:** parser, fallback, shared request hook, and focused tests are in
place.

### Step 3 — Quiz surface and route

**Purpose:** add the quiz route, entry point, disclosures, and answer-checking
UI.

**Expected new files:**

- `src/features/ai/AiQuizPage.tsx` — quiz surface using the generic hook and
  shared Phase 2 components.
- `src/features/ai/useMaterialAiSource.ts` — shared load/extract/error helper for
  the new quiz and Q&A route wrappers (not a replacement for
  `MaterialSummaryPage`).
- `src/pages/MaterialQuizPage.tsx` — route wrapper.
- Quiz component/route tests.

**Expected modified files:**

- `src/features/ai/DisclosurePanel.tsx` — optional surface label only; M1–M8
  text unchanged.
- `src/features/ai/PayloadPreview.tsx` and `payloadIntegrity.ts` — optional
  surface/request noun so quiz messages do not say "summary"; default remains
  summary.
- `src/App.tsx` — lazy `/materials/:materialId/quiz` route.
- `src/pages/MaterialViewerPage.tsx` — supported-material **Quiz** entry.
- Existing viewer/route tests.

**Completed:** quiz route, viewer action, disclosure placement, local grading,
and focused UI/source tests are in place.

### Step 4 — Q&A core

**Purpose:** implement question templating, Q&A parsing, and local fallback.

**Expected new files:**

- `src/features/ai/buildQaInput.ts` — deterministic material/question template
  with clear delimiters and no hidden fields.
- `src/features/ai/qaOutput.ts` — parse `answer` and optional string
  `references`.
- `src/features/ai/localQa.ts` — deterministic, zero-fetch source excerpts.
- Focused tests for template exactness, empty/oversize questions, answer parsing,
  optional references, invalid output, and fallback determinism.

**Not in this step:** Q&A route, page, or viewer entry.

**Completed:** deterministic question template, local validation, answer
parser, fallback, and focused tests are in place.

### Step 5 — Q&A surface and route

**Purpose:** add the Q&A route, entry point, question input, disclosures, exact
preview, answer, and references UI.

**Expected new files:**

- `src/features/ai/AiQaPage.tsx` — Q&A surface using the generic hook, the shared
  source loader, and the shared Phase 2 components.
- `src/pages/MaterialQaPage.tsx` — route wrapper.
- Q&A component/route tests.

**Expected modified files:**

- `src/App.tsx` — lazy `/materials/:materialId/qa` route.
- `src/pages/MaterialViewerPage.tsx` — supported-material **Ask questions** entry.
- Existing viewer/route tests.

**Completed:** Q&A route, viewer action, payload preview, answer/references
presentation, and focused UI/source tests are in place.

### Step 6 — Documentation, full verification, and acceptance

**Purpose:** bring the project records up to date, confirm the privacy review,
and run the complete suite.

**Expected files:**

- Update `docs/AI_PLAN.md` to reflect implementation and verification without
  implying that provider dispatch is authorized.
- Update `docs/TEST_PLAN.md` with Phase 3 checks and mark only what has actually
  been exercised.
- Update `docs/ARCHITECTURE.md` and `README.md` to describe the implemented
  surfaces and the still-blocked provider.
- Update `docs/AI_LAUNCH_CHECKLIST.md` only if new automated verification gates
  need recording; do not change the then-blocked status as part of Phase 3.
- Add a focused documentation/disclosure test if the project's existing
  `server/ai/phase2Docs.test.ts` pattern warrants a Phase 3 counterpart.
- Run focused tests per touched area, then the full commands in section 9.

**Completed pending owner acceptance:** report every changed file, exact
command outcomes, the privacy review, known limitations, and the final diff.
The owner reviews the result before any further work.

---

## 9. Tests and acceptance criteria

### 9.1 Test matrix

| Area | Required coverage |
| --- | --- |
| Client contract | `quiz`/`qa` prepare bodies are exactly `{ feature, text }`; send bodies are exactly `{ token, digest }`; no absolute URL, retry, or second route. |
| Summary regression | Existing summary prepare/send, preview, errors, fallback, and tests remain unchanged by Step 1. |
| Quiz parser | Valid schema; invalid JSON; empty/oversize arrays; non-string options; too few options; non-integer or out-of-range `correctIndex`; missing/empty explanation. |
| Quiz hook | Prepare → review → approve → send; fresh approval only; expiry; integrity mismatch; no auto-send; incomplete and error paths; zero-fetch fallback. |
| Quiz UI | M1–M8 before first request; provider-blocked notice; exact payload; answer selection; check/score/explanation; invalid output not graded; fallback. |
| Q&A template | Exact delimiter output; material and question both present; no hidden notes/metadata; empty/oversize question rejected. |
| Q&A parser | Valid answer; optional/absent references; empty answer; invalid JSON; non-string reference entries. |
| Q&A UI | M1–M8; question input; exact payload includes question; answer/references display; "not verified" label; single-turn new question; fallback. |
| Routing | Both routes load the correct material; unsupported/missing material errors; viewer entries appear only for supported materials. |
| Privacy | No AI state in IndexedDB; no AI record in backup; no notes in payload; no new network destination; fallback zero `fetch`. |
| Test double | Stub accepts only quiz/qa/summary as intended, rejects unexpected keys/routes, and never contacts a provider. |
| Documentation | M1–M8 text matches the plan; status statements agree across the docs. |

### 9.2 Commands

Run focused tests for the touched area at each step, then run all of these at
Step 6 (including the requested repeated browser suite):

```powershell
npm run test
npm run test
npm run test:server
npm run lint
npm run typecheck
npm run build
git diff --check
```

Use `git diff --check` before reporting. Do not hard-code a future test count in
the documentation; record the actual count from the run.

Final local verification on **2026-11-01**: `npm run test` passed twice
(**54 files / 318 tests** each run), `npm run test:server` passed (**3 tests**),
and `npm run lint`, `npm run typecheck`, `npm run build`, and
`git diff --check` all passed. These are local results, not evidence of live
provider behaviour. `NotesPage` and `OfficePreview` have shown load-related
`findByRole` flakes; rerun focused tests before calling a failure real.

### 9.3 Acceptance criteria

**Functional**

- [x] A supported material exposes Quiz and Ask questions entries.
- [x] Both routes load and extract the selected material locally.
- [x] Quiz generation uses the existing `quiz` config/schema and renders
      validated single-select questions.
- [x] Answer checking is local, shows a score, marks correct/incorrect, and
      shows explanations without a network call.
- [x] Q&A accepts one question, includes it in the exact payload, and renders a
      valid answer with optional provider-reported references.
- [x] Both surfaces offer a deterministic, zero-fetch local fallback.
- [x] Partial/invalid output is shown honestly and is not graded or presented as
      a complete structured answer.

**Privacy and security**

- [x] M1–M8 appear verbatim on each new surface before the first request.
- [x] The exact payload is shown in full and matches the dispatched payload.
- [x] Fresh approval is required; old approval cannot be reused.
- [x] Digest is labelled as an integrity check only.
- [x] No notes, other materials, or hidden metadata are sent.
- [x] No AI prompt, output, quiz attempt, score, answer, or history is persisted
      in IndexedDB or a backup.
- [x] No new network destination, telemetry, analytics, backend, or dependency
      exists.
- [x] The fallback performs zero `fetch` calls.
- [x] Real provider dispatch remains impossible; no key, endpoint, HTTP client,
      activation, gate, region, or eligibility change was made.

**Scope and quality**

- [x] All Phase 2 criteria still hold.
- [x] No Dexie schema v7 or eight-store change; no backup v1/v2 change.
- [x] No production server change was needed; any necessary change was approved
      separately in advance.
- [x] Full test, server-test, lint, typecheck, and build commands pass.
- [ ] The owner has reviewed the final diff and accepted the result.

---

## 10. Risks and rollback instructions

### 10.1 Risks

| Risk | Mitigation |
| --- | --- |
| Duplicating the Phase 2 request pipeline or creating a second network path. | Reuse `aiClient`/`useAiFeatureRequest` semantics and the existing prepare/send routes; tests assert no other route. |
| Drifting from the frozen M1–M8 text. | Reuse `disclosures.ts`/`DisclosurePanel`; documentation test compares entries. |
| Invalid provider JSON or an out-of-range `correctIndex` causing a broken quiz. | Strict parser/validator; show raw output and disable grading on failure. |
| Provider answer or references being mistaken for verified facts. | "Grounded only in supplied text" copy; "provider-reported, not verified" references; no external fetch. |
| Q&A question creating an unexpected privacy leak. | Show the full templated payload before approval; no hidden question field or notes. |
| Oversize input or extraction limits causing a failed prepare. | Local validation where possible; explain the limit; no silent truncation; no retry. |
| Phase 2 regression while adding shared props/helpers. | Keep summary functions/files unchanged where proposed; run focused Phase 2 tests at every step. |
| Test-only stub or fixture enabling dispatch. | Stub stays test-only and cannot activate or call the production Gemini provider; the safety test remains in force. |
| Uncommitted baseline being mistaken for Phase 3 work. | Inspect `git status` before and after; report pre-existing changes; never commit without approval. |
| Scope creep into server, schema, backups, or dependencies. | Section 11 prohibitions; stop-and-ask rule. |

### 10.2 Rollback

Phase 3 is designed to be removable without data migration:

1. Remove the two routes from `src/App.tsx`.
2. Remove the Quiz and Ask questions entries from
   `src/pages/MaterialViewerPage.tsx`.
3. Remove the new quiz/Q&A pages, route wrappers, hooks, parsers, fallback
   modules, and their tests.
4. Revert only the shared optional props/helper edits made for Phase 3, restoring
   the Phase 2 default behaviour.
5. Revert the Phase 3 client contract/test-double additions while preserving the
   existing summary functions.
6. Revert the Phase 3 documentation/status edits if they were made.
7. Keep the Phase 1 proxy and Phase 2 summary implementation untouched.

No IndexedDB migration, backup rewrite, provider-key cleanup, or gate reset is
required because Phase 3 adds no persistence and changes no provider path.

Do not use `git reset`, `git checkout --`, `git revert`, or any other destructive
Git operation to perform rollback without explicit owner approval. The working
tree contains user changes.

---

## 11. Explicitly prohibited changes

Do not do any of the following during Phase 3 implementation, even as a
convenience:

- Enable, simulate, or request a real provider dispatch.
- Add or request an API key, credential, project identifier, or provider
  endpoint.
- Change provider eligibility, region restrictions, launch gates, activation,
  `STUDY_HUB_AI_ENABLED`, the budget, the provider, or the activation reader.
- Add a backend, hosted service, external AI API, cloud sync, accounts,
  telemetry, analytics, or a runtime CDN.
- Add a new npm dependency.
- Change Dexie schema version 7, its eight stores, or any index.
- Change backup format v2 (full) or v1 (module), or add an AI record to a backup.
- Change the frozen M1–M8 wording.
- Store AI prompts, outputs, history, quiz attempts, scores, answers, or Q&A
  transcripts in IndexedDB, application storage, backups, logs, or URLs.
- Send personal notes, other materials, module/topic metadata, or hidden context
  to the provider.
- Render imported or provider HTML into the live document; render provider text
  as inert text.
- Add automatic retries, background requests, or a second provider call.
- Commit, push, create a branch, revert, or discard user changes without explicit
  owner approval.

If a requirement appears to require any prohibited change, stop and ask the
owner. Do not reinterpret the prohibition.

---

## 12. Owner approval checkpoints

| Checkpoint | Result |
| --- | --- |
| 0. Plan | Approved with written authorization covering all six steps and the defaults in section 3.2. |
| 1. Shared contract | Completed under the owner's full-scope authorization; summary regression preserved. |
| 2. Quiz core | Completed under the owner's full-scope authorization; focused tests pass. |
| 3. Quiz surface | Completed under the owner's full-scope authorization; route, disclosures, and local grading tested. |
| 4. Q&A core | Completed under the owner's full-scope authorization; template, parser, and fallback tested. |
| 5. Q&A surface | Completed under the owner's full-scope authorization; route, preview, and references tested. |
| 6. Final | Full verification and final diff review are reported; owner acceptance remains pending. |

Additional stop-and-ask triggers:

- any scope outside the resolved decisions in section 3.3;
- any production `server/ai/` change;
- any change to the prepare/send contract;
- any schema, backup, dependency, provider, gate, activation, or region change;
- any test that would need a real provider or network access;
- any request to commit, push, branch, or revert.

The owner's blanket authorization applied only to these six steps. Silence, an
automated test pass, or completion of this work is **not** approval for new
scope. Further work requires an explicit owner message.
