# StudyHub AI — v5.1 plan

**Status:** Phases 1–4 are implemented; final owner acceptance of Phases 3 and
4 remains pending. Phase 5 Gemini integration is implemented in the working
tree; automated verification is in progress and no live API call has been
made. The owner reports that Google confirmed the intended personal,
single-user coursework use is permitted. No written response was available in
the project files, so this records the owner's report only and does not claim
broader or independently verified Google approval. Phase 4 remains a separate
local guided-recall workflow and never sends recall notes or personal notes to
Gemini.
**Scope:** one person, one browser profile, one machine, personal study use.
**Provider:** Google Gemini API, via a local loopback proxy.
**Real provider dispatch:** available only after explicit local setup, a
successful model-access check, all launch gates, `STUDY_HUB_AI_ENABLED=1`, and
fresh approval of the exact payload.

---

## 1. Purpose and audience

StudyHub is a local-first study workspace used by a single person for personal
coursework. This plan describes an **optional** AI capability — a summary, a
quiz, and a question-and-answer flow over material the user has already
imported — without changing the application's local-first nature.

The plan is written for the owner of the repository. Every phase ends at an
approval checkpoint. Nothing proceeds to the next phase without explicit
written approval from the owner.

This document is the source of truth for the AI design. Where it disagrees
with `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, or `README.md`, this
document wins for AI behaviour only; for everything else those documents win.

## 2. Scope and non-goals

**In scope**

- A single-user, local, loopback-only proxy that can call one Gemini model
  endpoint.
- A summary flow over text the user has already extracted locally from an
  imported material.
- Phase 3 (implemented): quiz generation and single-turn question-and-answer.
- A per-request consent step that shows the exact outbound payload.

**Out of scope, permanently for this plan**

- Authentication, accounts, multi-user support, or any shared deployment.
- A hosted backend, a cloud database, cloud sync, telemetry, analytics, or
  tracking pixels.
- A local-model provider (deferred until the Gemini path is understood).
- Any feature that persists AI prompts, outputs, or history in StudyHub.
- Any change to the Dexie schema version (currently **v7**, 8 stores) or to the
  backup formats (**v2** full, **v1** module).
- New npm dependencies. The proxy uses Node built-ins and `fetch` only; a new
  dependency requires a written justification and owner approval.

**Non-goal that matters most:** this plan does not claim Google's confirmation
extends beyond the owner's reported intended use. Section 3 records both the
official terms and the limited owner-reported clarification.

## 3. Provider terms and intended-use clarification

### 3.1 What Google's current terms say

The Gemini API Additional Terms of Service
(<https://ai.google.dev/terms>, effective **2026-03-23**, page last updated
**2026-04-28**) state under **Use Restrictions**:

> Use of Google AI Studio and Gemini API is for developers building with Google
> AI models for professional or business purposes, not for consumer use. You may
> only access the Services (or make API Clients available to users) within an
> available region. **You may use only Paid Services when making API Clients
> available to users in the European Economic Area, Switzerland, or the United
> Kingdom.**

The same page describes the **Unpaid Services** data use:

> When you use Unpaid Services […] Google uses the content you submit to the
> Services and any generated responses to provide, improve, and develop Google
> products and services and machine learning technologies […] To help with
> quality and improve our products, **human reviewers may read, annotate, and
> process your API input and output**. […] **Do not submit sensitive,
> confidential, or personal information to the Unpaid Services.**

### 3.2 Owner-reported clarification

The owner reports that Google confirmed the intended personal, single-user
StudyHub coursework and study use is permitted under the applicable Gemini API
requirements. The owner gave this clarification on **2026-11-02**; the date of
Google's response was not provided. No written response or other record of
Google's communication was available in the project files. An earlier
documentation statement that this use was categorically ineligible was
incorrect and must not be repeated as a confirmed Google decision.

The official terms reviewed still state that Gemini API/AI Studio use is for
developers building with the models for "professional or business purposes,
not for consumer use." The owner-reported clarification is recorded as limited
to the intended use described above. It is not a quotation, is not
independently verified by this repository, and is not evidence that Google
approved the account, project, other use cases, or any broader deployment.

The project proceeds on the owner's explicit report for this intended use.
This project record does not reinterpret or amend Google's general terms.
Technical requirements remain independently gated, and every provider request
still requires the existing disclosure, exact-payload review, fresh approval,
local activation, and budget checks.

### 3.3 The rule this plan follows

The launch artifact records the limited owner-reported clarification as
`termsEligibility.status: "established"` with
`basis: "owner_reported_confirmation"`, a null source quote, and an audit note
that the written response was not supplied. This project state relies on the
owner's report only and is not an independent legal determination. Specifically:

- A **paid account** does not establish eligibility. It changes data handling
  (see M1) and regional availability; it says nothing about the use
  restriction.
- An **acknowledgement checkbox** does not establish eligibility. It is a user
  declaration, not evidence.
- The owner's report is recorded as a narrow statement about this intended
  personal coursework use, not as approval for other accounts or deployments.
- The general terms and their consumer-use wording remain unchanged and are
  disclosed as relevant provider terms.

The gate evaluator validates artifact shape, age, region, model access, limits,
disclosures, and staleness. It cannot verify Google's communication and does
not make a legal determination. A passing gate reflects the owner's recorded
input and technical checks; it is not independent proof of provider approval.

### 3.4 Regional terms and conservative project gate

The official terms say Paid Services are required when making API Clients
available to users in the European Economic Area, Switzerland, or the United
Kingdom. StudyHub is specified as a local, single-user application and this
record does not establish that the clause applies to the owner's direct use.
The owner's location, account tier, and project configuration have not been
confirmed here.

The current launch-gate implementation conservatively rejects region values
`eea`, `switzerland`, and `united-kingdom` with `region_not_permitted`; that is
a project safeguard, not a finding about the owner's location or a definitive
interpretation of the terms. Do not relax the gate or claim the owner is in a
restricted region without evidence.

### 3.5 What would resolve it

The owner has reported that Google confirmed the intended use. If the owner
later supplies written confirmation, record only its relevant scope and date;
do not paraphrase beyond what it supports. Until then, keep the record clearly
labelled owner-reported and do not claim independent verification.

## 4. Three separated milestones

These are deliberately separate. Finishing one proves nothing about the next.

| Milestone | What it delivers | Provider contact |
| --- | --- | --- |
| **M-A — Local infrastructure** | UI, loopback proxy, validation, limits, launch gates. | **None.** |
| **M-B — Stub verification** | In-process fake provider; the full pipeline exercised end to end. | **None.** Zero external requests. |
| **M-C — Real integration** | Optional server-side Gemini configuration and the existing shared request pipeline. | Only explicit metadata checks and fresh, approved feature requests. |

M-C is owner-authorized for the limited intended use; it does not remove any
technical gate or user approval requirement.

## 5. Phase plan

Each phase lists scope, files, tests, acceptance criteria, rollback, and an
approval checkpoint. **Never start a phase without the owner's explicit
approval of the previous phase's diff.**

### Phase 0 — Documentation only (completed)

- **Scope:** agree the requirements; record them; change no application code.
- **Files changed:** `AGENTS.md`, `.github/copilot-instructions.md`,
  `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/TEST_PLAN.md`,
  `README.md`, `docs/AI_PLAN.md` (new), `docs/AI_LAUNCH_CHECKLIST.md` (new),
  `.gitignore`.
- **Not changed:** anything under `src/`, `scripts/`, `public/`;
  `package.json`; `vite.config.ts`; `tsconfig*.json`; `eslint.config.js`; the
  CI workflow; the Dexie schema; the backup formats.
- **Tests:** `npm run test`, `npm run test:server`, `npm run lint`,
  `npm run typecheck`, `npm run build` — all must pass, and the documentation
  checks in `docs/TEST_PLAN.md` ("Phase 0 documentation checks") are performed
  manually by the owner.
- **Acceptance criteria:** see Section 5.0.
- **Rollback:** `git checkout --` the nine files and delete the two new
  documents. No runtime state, no schema change, no dependency change, so there
  is nothing to migrate.
- **Approval checkpoint:** the owner reviews the full diff and approves before
  Phase 1 begins.

#### 5.0 Phase 0 acceptance criteria

1. `AGENTS.md` invariant 5 and `.github/copilot-instructions.md` rule 2 grant a
   single narrow exception: optional, disabled by default, loopback-only, and
   conditioned on resolved eligibility. The prohibitions on backends, accounts,
   cloud sync, analytics, and telemetry are unchanged.
2. `docs/PRODUCT_SPEC.md` §8 and §15, `docs/ARCHITECTURE.md` "Design and
   privacy"/"Boundaries", and `README.md` no longer contradict one another or
   this plan.
3. `docs/AI_PLAN.md` states the personal-use scope, the official terms and
   limited owner-reported clarification, the three separated milestones, the
   activation conjunction, immutable disclosures M1–M8, the separation of the
   three retention mechanisms, the request/budget/fallback rules, the error
   taxonomy, and model configurability.
4. `docs/AI_LAUNCH_CHECKLIST.md` keeps the two gate categories apart and its
   sample artifact is inert.
5. No artifact field represents automated test evidence, and no checklist
   checkbox represents an eligibility determination.
6. Exactly one field — `effectiveDailyCap` — is named as the source of truth
   for the effective daily request cap, identically in the plan, the
   checklist, and the sample artifact.
7. Every requirement in Sections 6–12 maps to at least one row of the
   requirement-to-verification table in `docs/TEST_PLAN.md`, and each row is
   labelled *automated test* or *manual verification*.
8. No application code, script, build configuration, or dependency changed.
9. `.gitignore` excludes `/.study-hub/`.

### Phase 1 — Local proxy skeleton, validation, limits, stub tests (implemented)

- **Scope:** the Node-side Vite plugin and its request handling, input
  validation, the local request budget, the launch-gate evaluator, and the
  error taxonomy. **No Google requests. No AI UI.**
- **Status:** implemented. Its gates, provider boundary, and activation reader
  are unchanged by Phase 2. The working tree remains uncommitted.
- **Files changed (actual):**
  - New `server/ai/` folder — `types.ts`, `config.ts`, `gates.ts`, `budget.ts`,
    `payloadStore.ts`, `requestValidation.ts`, `provider.ts`, `activation.ts`,
    `pipeline.ts`, `handler.ts`, `logging.ts`, `plugin.ts`, and
    `testing/fakeProvider.ts`.
  - New `server/ai/*.test.ts` — eight Vitest files (see the deviation note in
    Section 5.1).
  - `vite.config.ts` — registers `studyHubAiProxyPlugin()`.
  - `tsconfig.node.json` — `include` now also covers `server`; `noEmit` and the
    node lib settings are unchanged.
  - `docs/AI_PLAN.md`, `docs/AI_LAUNCH_CHECKLIST.md`, `docs/TEST_PLAN.md`,
    `README.md`.
- **Not changed:** anything under `src/`; `package.json`; the Dexie schema;
  the backup formats; `scripts/`; `public/`; the CI workflow.
- **Tests:** unit tests for validation, the gate evaluator, the budget
  counter, the payload store, and the pipeline; HTTP-level tests that start the
  proxy on an assigned loopback port; plugin lifecycle tests for the dev and
  preview servers; and a safety suite that proves no external request is
  reachable from the production modules.
- **Acceptance criteria:**
  - The proxy mounts in both the dev server and the preview server, bound to
    `127.0.0.1` only.
  - Both `configureServer` and `configurePreviewServer` are registered.
  - Every pre-dispatch rejection produces its documented deterministic error
    code, dispatches nothing, and consumes no budget unit.
  - No test contacts Google; the fake provider is injected in-process and is
    imported only by test files.
  - No new dependency; `npm run build` still succeeds.
- **Rollback:** remove the plugin registration and the `server/` folder;
  revert `vite.config.ts` and `tsconfig.node.json`. No persisted data is
  affected, and the Dexie schema is untouched.
- **Approval checkpoint:** owner reviews the diff and the test output before
  Phase 2.

#### 5.1 Phase 1 deviations from the indicative plan

The Phase 1 plan described the location as indicative, not a commitment. Three
things differ from the earliest sketch, and one differs from the approved
architecture:

1. **Location.** The proxy lives in `server/ai/`, not in `src/features/ai/`.
   The proxy is Node-side code that runs in Vite's server process; it has no
   browser code, no React, and no Dexie access. Keeping it out of `src/` keeps
   the browser bundle and the service worker untouched.
2. **Test runner.** The tests are Vitest files under `server/ai/`, not
   `scripts/ai/*.test.mjs`. Vitest is already the project's test runner, so
   the proxy tests run in the same `npm run test` command as the application
   tests, and CI needs no new job.
3. **Settings type.** `src/features/settings/appSetting.ts` was **not**
   changed. Phase 1 stores no setting; the app-setting record keeps its
   existing shape, so the Dexie schema stays at **v7** with no migration.
4. **Test file count.** Eight test files were written instead of the six
   sketched: `gates`, `budget`, `payloadStore`, `requestValidation`,
   `pipeline`, `handler`, `plugin`, and `safety`. The split was made because
   `plugin` needs a real Vite dev/preview server and `safety` needs a
   source scan; neither belongs in a unit-test file.
5. **HTTP-level handshake.** The `handler` test exercises the `prepare` then
   `send` handshake over real HTTP with an **injected** activation double and
   the fake provider, because the HTTP surface is where token and digest
   handling lives. The **mounted production route** is covered separately and
   is proven to answer `not_configured` without any outbound call
   (`server/ai/safety.test.ts`).

#### 5.2 Phase 1 implementation notes

**Fixed check order.** The first failing check wins, and every failure is
fail-closed:

`route and method` → `loopback listener` → `loopback peer` → `loopback Host`
→ `Origin` → `STUDY_HUB_AI_ENABLED` →
`artifact exists` → `schema valid` → `terms established` → `determination
complete` → `not stale` → `region` → `models and limits` → `exposure` → `cap
valid` → `activation` → `input validation` → `budget` → `token and digest` →
`dispatch`.

**The two routes.** `prepare` runs the gates, validates the input, builds the
payload, and stores it — no activation, no dispatch, no budget charge. `send`
runs the gates, checks the activation, validates the input, checks and charges
the budget, verifies the token and digest, and dispatches.

**Local state files.** `.study-hub/ai-launch-gate.json` (the launch artifact)
and `.study-hub/ai-usage.json` (the usage counter). Both are plain local
files under the git-ignored `.study-hub/` directory. No database store is
added.

**Listener, peer, Host, and Origin.** The handler checks that the actual Vite
listener and the request socket's peer address are loopback before trusting
headers. This remains enforced if Vite's host is overridden. The Host header
must name a loopback host on the port the server is actually listening on. A
mutating request must also carry an Origin naming that same loopback authority.
Any boundary failure maps to `forbidden_origin`, before a token or payload is
created.

**Structured log.** One JSON line per request on standard output, with
exactly these fields: `method`, `path`, `status`, `durationMs`, `bytesIn`,
`bytesOut`, `model`, `upstreamStatus`, `upstreamAttempted`, `errorCode`, and
`gateVerdict` (`pass`, `blocked`, `not_evaluated`, or `disabled`).

**Historical Phase 1 state.** At the end of Phase 1 the provider was
unconfigured and activation disabled. Phase 5 adds the provider and local
configuration path; the current request remains gated by explicit setup,
activation, and payload approval.

### Phase 2 — Summary UI and request pipeline against the stub (implemented)

- **Status:** Steps 1–4 are complete and were approved by the owner. Step 5 is
  this documentation and status update. The working tree remains uncommitted.
- **Scope delivered:**
  - Step 1 — the summary entry point, route, material loading, and bounded
    local text extraction.
  - Step 2 — the prepare/review/approve/send client state machine and the exact
    payload preview.
  - Step 3 — error, incomplete, and local-fallback presentation, plus optional
    personal notes.
  - Step 4 — the persistence/contract audit and focused regression coverage.
- **Files changed (actual):**
  - New `src/features/ai/` browser modules: `aiClient.ts`, `aiTypes.ts`,
    `AiSummaryPage.tsx`, `AiErrorNotice.tsx`, `DisclosurePanel.tsx`,
    `disclosures.ts`, `errorPresentation.ts`, `extractMaterialText.ts`,
    `LocalSummaryPanel.tsx`, `localSummary.ts`, `materialTextSupport.ts`,
    `PayloadPreview.tsx`, `payloadIntegrity.ts`, `PersonalNotesPanel.tsx`,
    `summaryOutput.ts`, and `useAiSummaryRequest.ts`, with their focused test
    files.
  - New `src/pages/MaterialSummaryPage.tsx` and its route test.
  - `src/App.tsx` adds `/materials/:materialId/summary`;
    `src/pages/MaterialViewerPage.tsx` adds the **Summarize** entry point for
    supported materials.
  - `server/ai/pipeline.test.ts` and
    `src/features/backup/BackupService.test.ts` gain Phase 2 regression
    coverage; `server/ai/phase2Docs.test.ts` verifies the disclosures against
    this plan.
  - `README.md`, `docs/AI_PLAN.md`, `docs/AI_LAUNCH_CHECKLIST.md`,
    `docs/TEST_PLAN.md`, and `docs/ARCHITECTURE.md` are updated for Phase 2.
- **Not changed:** the Phase 1 gate evaluation, provider/activation modules,
  API-key handling, the Dexie schema (**v7**, 8 stores), the backup formats
  (**v2** full, **v1** module), `public/sw.js`, and `package.json`. No new
  dependency was added.
- **Tests and verification:** component, hook, client, extraction, fallback,
  route, and persistence/backup tests cover the summary workflow. Results
  observed locally on **2026-11-01** in this working copy — not independent
  verification — were:
  - `npm run test`: **43 files, 263 tests passed**
  - `npm run test:server`: **3 tests passed**
  - `npm run lint`, `npm run typecheck`, and `npm run build`: passed
- **Acceptance criteria — verified:**
  - The exact outbound payload is rendered before sending and matches the
    dispatched payload.
  - A request requires a fresh, explicit approval; an earlier approval cannot
    be reused.
  - A payload mismatch is rejected before dispatch.
  - The digest is labelled an integrity check and is never presented as proof
    of approval.
  - Optional personal notes never appear in the dispatched payload.
  - No AI prompt, output, or history is written to IndexedDB; a backup
    contains no AI records.
  - The fallback performs zero provider requests.
  - Phase 2 did not enable real dispatch; it retained the Phase 1 provider
    boundary and gates.
- **Rollback:** remove the summary route and components; the Phase 1 proxy
  remains but is unreachable from the UI.
- **Approval checkpoint:** Steps 1–4 were approved by the owner. Step 5 is a
  documentation-only update and does not start Phase 3 or enable dispatch.

#### 5.3 Phase 2 workflow and current limitations

**Workflow actually implemented.**

1. A supported material's viewer shows **Summarize**; unsupported types do not
   offer the action. `MaterialSummaryPage` loads the material metadata and
   original bytes from local IndexedDB.
2. The page extracts text locally. Supported inputs are text/code, PDF text
   layers, DOCX, PPTX, and XLSX/XLSM. Extraction is bounded to 2,000,000
   characters, 8 MiB for text files, 100 MiB for PDF/Office files, and 1,000
   PDF pages. No OCR, provider, or network request is involved.
3. `AiSummaryPage` shows the immutable M1–M8 disclosures, the request controls,
   and optional personal notes. Notes use the existing `noteService`; they are
   linked to the material and never included in the AI payload.
4. **Prepare** sends only the extracted text to the same-origin
   `/api/ai/prepare` route. The Phase 1 pipeline validates the request, evaluates
   the launch gates, and stores a payload; preparation never dispatches.
5. **Review** renders the server-returned `payloadText` in full, with the model,
   byte count, expiry, digest, and integrity status. The user must check a fresh
   approval box for that prepared payload.
6. **Send** sends only `{ token, digest }` to `/api/ai/send`. The server consumes
   the single-use token, checks the digest, and makes at most one provider call.
   There is no retry and no background request.
7. The result is shown as complete, incomplete, error, or the deterministic
   local fallback. Pre-dispatch refusal, post-dispatch failure, and unknown
   outcome remain visibly distinct. The fallback is a pure function over the
   in-memory text and makes zero `fetch` calls.

**Current limitations.**

- At the time Phase 2 was implemented, real provider dispatch was unavailable:
  no production provider endpoint, HTTP client, or API-key lookup existed.
  Phase 5 later adds these through the existing pipeline.
- In the repository's current state (no launch artifact and no activation),
  preparation fails closed in normal production; the page therefore exposes the
  blocked state and the local fallback. The complete prepare/approve/send path
  is exercised through an injected test double for the proxy, not against a live
  service.
- Summary, quiz, and single-turn Q&A operate on one selected material at a
  time. Quiz answers and scores, Q&A questions/answers/references, approvals,
  and request state remain in memory only; there is no history or batch
  processing.
- Extracted text is capped as described above, and scanned/image-only PDFs are
  not OCR-processed. Images, audio/video, legacy `.doc`, and other unsupported
  formats are not offered for summarization.
- By design, the preview, approval state, output, and request history are
  memory-only. Refreshing or leaving the page discards them; there is no saved
  AI history or AI export.
- No live provider quota, availability, credentials, or error behaviour has
  been exercised. Provider paths use the in-process fake and UI paths use
  injected proxy stubs; no automated test contacts a real provider.

### Phase 3 — Quiz and Q&A (implemented; final owner acceptance pending)

- **Status:** implemented under the owner's explicit authorization covering all
  six steps. Focused tests cover the feature-aware client, quiz parser/fallback/
  local grading, Q&A template/parser/fallback, both routes, disclosure
  placement, viewer entries, and payload privacy.
- **Scope:** multiple-choice quizzes with local answer checking and single-turn
  Q&A over one selected material. Both use the shared request hook and existing
  prepare/send contract. Q&A references are provider-reported and unverified.
- **Privacy:** payloads show only selected-material text and, for Q&A, the
  explicit question. Notes and other material metadata are excluded. All AI
  prompts, outputs, approvals, answers, scores, references, and request state
  remain in memory and are not added to Dexie or backups.
- **Provider at the time:** real dispatch was unavailable; Phase 3 did not
  change provider eligibility, region restrictions, gates, activation, server
  AI production code, provider configuration, or credentials. Phase 5 is
  documented separately below.
- **Verification:** final commands and outcomes are recorded in
  `docs/TEST_PLAN.md` and `docs/AI_LAUNCH_CHECKLIST.md` after the final run.
- **Rollback:** remove the quiz and Q&A routes/components and Phase 3 client
  additions without a data migration; keep Phase 1 and Phase 2 untouched.
- **Acceptance checkpoint:** the owner reviews the final diff and verification
  report before any further work.

### Phase 5 — Gemini integration (implemented in the current working tree)

- **Scope:** use the existing provider interface and prepare/review/approve/send
  pipeline for summary, quiz, and single-turn Q&A; add optional first-launch
  setup and Settings key management; protect the local server key with Windows
  DPAPI.
- **Connection test:** only after the user presses “Save key and test
  connection”; it checks configured model metadata and sends no study material.
- **Provider API status:** Google's current Interactions API documentation
  identifies the API as Beta and warns that features and schemas may change.
  Model-metadata success does not test the Interactions endpoint or guarantee
  project-level generation access; keep model/response handling under review.
- **Dispatch:** requires `STUDY_HUB_AI_ENABLED=1`, a saved key, successful model
  access checks, complete/fresh gates, explicit local activation, and fresh
  approval of the exact payload. It uses one provider attempt without retry.
- **Persistence:** no API key in browser storage, no AI history in IndexedDB or
  backups; local encrypted credential and gate/budget state live under the
  git-ignored `.study-hub/` directory.
- **Verification:** automated provider tests use injected fakes only; live
  requests are not claimed unless separately run with the owner's local key.
- **Approval checkpoint:** report verification and limitations, then wait for
  owner acceptance before committing or starting additional work.

### Deferred

Additional AI features (flashcards, spaced repetition, lecture transcription,
AI-generated study plans, local-model providers) are deferred until the core
summary workflow is stable and approved.

## 6. Runtime activation and fail-closed behaviour

### 6.1 Real dispatch requires all of the following

1. The proxy middleware is mounted (`STUDY_HUB_AI_ENABLED=1`).
2. A Gemini API key is present in the local environment.
3. `.study-hub/ai-launch-gate.json` exists, parses, and passes schema
   validation.
4. `exposureAcknowledged` is `true`.
5. `modelsConfirmed` is `true` and the confirmed model is available to the
   project.
6. `region` is supported; EEA, Switzerland, and UK selections require Paid
   Services and confirmed active billing.
7. `termsEligibility.status` is `established`, with a complete determination
   whose `termsCheckedAt` is within the staleness window (30 days).
8. The owner has confirmed the age requirement and the limit/disclosure
   declarations are complete.
9. An **explicit runtime activation step** follows a successful connection
   check. It is separate from the API key and environment variable.

The server checks the persisted gates and activation state on every send.
Activation is written to a git-ignored local runtime-state file.

**Phase 1 / Phase 5 status.** The server implements the provider interface,
DPAPI-backed key store, Gemini model metadata check, and Interactions API
client. Configuration routes are loopback/Origin protected. The provider call
is available only after the separate runtime gates and explicit user approval.
Automated tests use injected fakes and never contact Google.

### 6.2 Rules

- **Consent never overrides a server-side block.** An approved, well-formed
  request is still refused if a gate fails.
- **An acknowledgement never overrides eligibility.** `exposureAcknowledged`
  and `termsEligibility` are independent.
- **A sample configuration can never enable dispatch.** The sample artifact in
  `docs/AI_LAUNCH_CHECKLIST.md` has `termsEligibility.status: "unresolved"` and
  `exposureAcknowledged: false`, so it fails requirements 4 and 7.
- **A test fixture can never enable dispatch.** The gate evaluator is a pure
  function of the artifact; tests inject a fake provider and never exercise a
  real network path.
- **Phase 2 completion does not enable dispatch.** Only explicit local setup
  and every runtime gate can enable it.
- The owner-reported terms clarification applies only to the intended
  single-user coursework use; it does not establish broader Google approval.

## 7. Launch-gate artifact

The artifact is a local JSON file at `.study-hub/ai-launch-gate.json`. It is
git-ignored. It contains **no API key and no Google Cloud project
identifier**.

### 7.1 Two categories, kept apart

**Category 1 — automated verification gates.** These are produced by the test
suite and the build. They are reported in test output and CI logs. **There is
no artifact field for them.** They are never presented as, and never recorded
as, a user acknowledgement or a user declaration.

**Category 2 — user declarations.** These are made by the owner, recorded in
`docs/AI_LAUNCH_CHECKLIST.md`, and stored in the artifact.

| Gate | Declaration | Artifact field(s) |
| --- | --- | --- |
| A | Limits and models confirmed for the project | `modelsConfirmed`, `limitsConfirmed`, `effectiveDailyCap` |
| B | Cap reconciliation (local ceiling vs. observed project limits) | `effectiveDailyCap`, `notes` |
| D | Region | `region` |
| E | Tier | `tier` |
| F | Terms-eligibility determination | `termsEligibility` |
| G | Exposure acknowledgement | `exposureAcknowledged` |

Gate **C** is an automated verification gate (Category 1) and has no artifact
field by design.

### 7.2 Artifact schema (version 2)

Required fields:

| Field | Type | Notes |
| --- | --- | --- |
| `schemaVersion` | `2` | Exact value; unknown versions are rejected. |
| `region` | `non-eea-uk-ch` \| `eea` \| `switzerland` \| `united-kingdom` | Drives `region_not_permitted`. |
| `tier` | `free` \| `paid` | Declared tier; drives the data-handling disclosures shown. |
| `modelsConfirmed` | boolean | `true` only after confirming the model in the actual project. |
| `limitsConfirmed` | boolean | `true` only after reading the project's real limits in AI Studio. |
| `ageConfirmed` | boolean | Owner confirms the provider's 18+ requirement. |
| `billingConfirmed` | boolean | Required for a declared paid tier or restricted region. |
| `effectiveDailyCap` | positive integer | **The single source of truth** for the local daily request ceiling. |
| `exposureAcknowledged` | boolean | Gate G. |
| `termsEligibility` | object | Gate F; see below. |
| `termsEligibility.status` | `unresolved` \| `established` | `established` requires every sub-field below. |
| `termsEligibility.determinedAt` | ISO timestamp | Required when `established`. |
| `termsEligibility.termsCheckedAt` | ISO timestamp | Required when `established`; drives staleness. |
| `termsEligibility.basis` | `authoritative_source` \| `owner_decision` \| `owner_reported_confirmation` | How the determination was reached. |
| `termsEligibility.sourceUrl` | string | Official terms checked; it is not the owner's unprovided communication. |
| `termsEligibility.sourceQuote` | string or null | Null for the owner-reported confirmation; no unseen quote is invented. |
| `termsEligibility.intendedUse` | string | The use being authorized. |

Audit-only fields (recorded, tolerated, never load-bearing):
`recordedAt`, `recordedBy`, `checklistReference`, `notes`.

### 7.3 Deterministic failure reasons

| Situation | Error code |
| --- | --- |
| Artifact absent | `gates_not_recorded` |
| Artifact unparseable, wrong `schemaVersion`, missing required field | `gates_invalid` |
| `exposureAcknowledged` is not `true` | `gates_exposure_not_acknowledged` |
| `modelsConfirmed` is not `true` | `model_not_confirmed` |
| `region` is EEA, Switzerland, or the United Kingdom | `region_not_permitted` |
| `termsEligibility.status` is `unresolved` | `terms_not_eligible` |
| `termsEligibility.status` is `established` but incomplete | `gates_invalid` |
| `termsCheckedAt` is older than 30 days | `terms_check_stale` |
| `effectiveDailyCap` is missing or not a positive integer | `gates_invalid` |
| The Host header is absent, malformed, not a loopback host, or names another port | `forbidden_origin` |
| A mutating request has no Origin, or the Origin names another host or port | `forbidden_origin` |
| The request peer or actual Vite listener is not loopback | `forbidden_origin` |

Every failure is a **fail-closed** outcome with a documented reason. No failure
path degrades into a permissive default.

The checks run in a fixed order and the **first failing check wins**: artifact
exists → schema valid → terms established → determination complete → not
stale → region → models and limits → exposure → cap valid. A request with
several problems therefore always reports the same code for the same artifact.

### 7.4 One source of truth for limits

- `effectiveDailyCap` in the artifact is authoritative.
- The server enforces it.
- Any other recorded quota value is **display-only context** and is never used
  for enforcement.
- The local cap is a **local ceiling**. It is not a provider reservation and
  is never described as one.

## 8. Privacy and consent

### 8.1 What "no AI persistence" means

**No AI persistence** refers only to StudyHub's own database and application
storage. No AI prompt, response, history, or derived record is written to
IndexedDB, and none appears in a backup. The Dexie schema stays at **v7** and
the backup formats stay at **v2** (full) and **v1** (module).

It does **not** mean the provider keeps nothing. Provider-side handling is a
separate matter and is disclosed separately, in Section 8.4.

### 8.2 Mandatory disclosures M1–M8 (immutable)

These are shown verbatim before the first request and cannot be edited or
dismissed silently:

- **M1 — Free-tier data use.** On the Free Tier, submitted content and
  responses are used to provide, improve, and develop Google's products and
  machine-learning technologies. The pricing page lists "Used to improve our
  products: **Yes**" for the Free Tier and "**No**" for the Paid Tier.
- **M2 — Human review.** On the Free Tier, human reviewers may read, annotate,
  and process API input and output, decoupled from your account, API key, and
  cloud project before review.
- **M3 — Abuse monitoring.** Google retains prompts, contextual information,
  and outputs for **55 days** for Prohibited Use Policy enforcement. This is
  independent of the request's storage flag, and content may be flagged for
  manual review by authorised Google personnel.
- **M4 — Interaction storage.** The Interactions API stores interactions by
  default (`store=true`): **55 days** on the Paid Tier, **1 day** on the Free
  Tier. StudyHub always sends `store=false`, so interactions are not stored;
  `store=false` also forbids `background=true` and `previous_interaction_id`,
  so there is no server-side multi-turn history.
- **M5 — Redaction is not anonymisation.** Google disconnects reviewed data
  from the account, key, and project before human review; that is a
  de-linking step, not an anonymisation guarantee.
- **M6 — Regional terms.** Paid Services are required to make API clients
  available to users in the EEA, Switzerland, and the United Kingdom.
- **M7 — Local non-persistence.** StudyHub stores no AI prompt, output, or
  history locally, and sends no study content except a payload you have just
  approved in full.
- **M8 — Use restriction.** The Gemini API and AI Studio are for developers
  building with Google AI models for professional or business purposes, not
  for consumer use; access is limited to available regions and to users aged 18
  or over.

### 8.3 Optional personal notes (editable, never sent)

The owner may write editable notes for their own reference. They are stored
locally, are clearly labelled as not sent, and are **excluded from the
dispatched payload by construction** — not by a filter applied afterwards.

### 8.4 Provider-side handling, disclosed separately

Three distinct mechanisms must not be conflated:

1. **Interaction storage** — the default `store=true` behaviour (M4). Not
   applicable to StudyHub, which sends `store=false`.
2. **Abuse monitoring** — 55-day retention for policy enforcement (M3).
   Independent of `store`, unaffected by `store=false`, with possible human
   review of flagged content.
3. **Unpaid-tier product improvement** — on the Free Tier, content is used to
   improve Google's products, with possible human review. **No retention
   window is published** for this use, and Google's terms say not to submit
   sensitive, confidential, or personal information to the Unpaid Services.

Also disclosed: Google applies grounding with Search only on the Paid Tier for
these models, and the API's per-project rate limits are not published in the
documentation — the authoritative values are visible only in AI Studio.

### 8.5 Per-request consent

Before every request:

1. Show the **exact payload** that will be sent, in full.
2. Require a **fresh, explicit** user approval for that payload. A previous
   approval never carries over.
3. On approval, **validate the approved payload against the payload actually
   dispatched**; a mismatch is rejected before dispatch.
4. Record a **digest** of the payload. The digest is an **integrity check
   only**. It is never proof that a human approved anything, never proof of
   authorization, and never evidence of eligibility.

### 8.6 Client attempt state machine

The implemented client states are
`idle → preparing → review → sending → complete | incomplete | error`, with
`fallback` reachable from `idle`, `error`, and `incomplete`. Only
`review → sending` after a fresh approval may issue a request; preparation never
dispatches. A settled request never sends automatically. A new request requires
a new explicit user action, a new approval, and a new budget unit.

## 9. Request, budget, and fallback behaviour

### 9.1 Request rules

- **At most one upstream request per user action.** No automatic retries, on
  any status code, including 429 and 5xx.
- The local fallback is a pure function over the in-memory extracted text and
  makes **zero** requests of any kind — not zero provider requests, but zero
  `fetch` calls.
- The budget is charged **once**, and **only when a request is actually
  dispatched**. A pre-dispatch rejection consumes nothing, and a dispatched
  request that fails still consumes exactly one unit.

### 9.2 Two fallback classes

| Class | Meaning | UI wording |
| --- | --- | --- |
| **A** | Never left the machine — the request was refused before dispatch. | "Not sent — &lt;reason&gt;" |
| **B** | The upstream call was attempted and failed. | "Request failed after sending — &lt;reason&gt;" |

The `upstreamAttempted` flag distinguishes them. Class A is a privacy
statement; class B is a delivery statement. The local fallback is available in
both classes and still makes no request.

### 9.3 Error taxonomy

**Pre-dispatch** (`upstreamAttempted: false`, no provider call, no budget
charge): `invalid_request`, `forbidden_origin`, `payload_too_large`,
`not_approved`, `integrity_mismatch`, `paused`, `not_configured`, `local_limit`,
`gates_not_recorded`, `gates_invalid`, `gates_exposure_not_acknowledged`,
`model_not_confirmed`, `region_not_permitted`, `terms_not_eligible`,
`terms_check_stale`.

**Post-dispatch** (`upstreamAttempted: true`, exactly one provider call):
`upstream_auth`, `quota_exceeded`, `rate_limit_exceeded`, `upstream_error`,
`blocked`, `incomplete`.

Two codes were added in Phase 1, both pre-dispatch:

- `forbidden_origin` (HTTP 403) — the request did not come from the local
  application: the Host header was missing, malformed, not a loopback host, or
  named a port other than the one the server is listening on; or a mutating
  request carried no Origin, or an Origin naming another host or port.
- `payload_too_large` (HTTP 413) — the raw request body, the input text, or
  the serialised outbound payload exceeded its configured limit.

`rate_limit_exceeded` and `quota_exceeded` are distinct. **An HTTP 429 is not
assumed to mean the daily quota is exhausted** — the classification uses the
provider's own error detail, and an ambiguous 429 is reported as a rate limit
without claiming the daily quota is gone.

`incomplete` is expected rather than exceptional: `max_output_tokens` is a hard
cap that includes thinking tokens, so a response can be truncated. It maps to
**HTTP 200** with `ok: false`, because the provider did answer and the
truncated output is still returned in `outputText`.

### 9.4 Budget and reset

- The counter is local and server-enforced.
- The counter lives in `.study-hub/ai-usage.json`, a plain local file under the
  git-ignored `.study-hub/` directory. It is written atomically (temporary file
  plus rename), and charges are serialised so that concurrent requests cannot
  lose a unit.
- The reset window is the **machine's local calendar day**, `YYYY-MM-DD` in
  local time. It is **not** implied to match Google's. Google's
  requests-per-day quota resets at **midnight Pacific time** and is applied
  **per project, not per API key**; the local counter may reset at a different
  moment, and the local cap may therefore be stricter or looser than what the
  provider permits at that instant.
- **Fail-closed.** A usage state that is missing, malformed, unreadable, or
  otherwise corrupted is **never silently reset to zero** — resetting it would
  silently grant extra capacity. Such a state refuses further dispatches with
  `local_limit` and a reason that names the file. The only path that starts a
  fresh count is a **rolled-over local day**, which is the documented daily
  reset rather than a recovery from a broken counter.
- A usage state whose `windowStart` is in the future is also refused, because a
  clock that disagrees with the counter cannot be trusted.
- The budget is charged **once**, and **only when a request is actually
  dispatched**. The charge happens immediately before the provider call, so a
  dispatched request that fails still consumes exactly one unit, and a
  pre-dispatch rejection consumes none.
- The UI states that the cap is a local ceiling and does not describe it as
  provider capacity.

### 9.5 What simulated tests do not prove

Every test in this project uses an injected in-process fake provider.
Simulated tests prove **nothing** about live account quota, live availability,
live provider error behaviour, or live billing. They must never be reported as
if they did.

## 10. Model and API configuration

### 10.1 Provisional models

| Purpose | Provisional model | Verified from the public catalogue |
| --- | --- | --- |
| Question and answer | `gemini-3.8-flash` | Model code confirmed; input limit 1,048,576 tokens, output limit 65,536 tokens; thinking `low`, `medium`, `high` supported — `minimal` is **not** supported and returns an error. |
| Summary and quiz | `gemini-3.5-flash-lite` | Model code confirmed; input limit 1,048,576 tokens, output limit 65,536 tokens. |

Both are **provisional**. Public catalogue availability does **not** guarantee
availability or quota for a given Google Cloud project. The actual models must
be confirmed in AI Studio for the project that will be used, and the
confirmation recorded in the artifact (`modelsConfirmed`). A confirmed model
that differs from the table above is a **configuration** change, not a code
change.

### 10.2 Configurable, validated values

Model IDs, per-feature model assignments, thinking levels, `max_output_tokens`
caps, per-feature character/length caps, and the effective daily cap are
**configuration with validation**, not hard-coded constants. Invalid values
are rejected with a deterministic reason before dispatch.

### 10.3 Request shape

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/interactions`
- Header: `x-goog-api-key`
- Body: `model`, `input`, `system_instruction`,
  `generation_config{thinking_level, max_output_tokens}`,
  `response_format{type, mime_type, schema}`, and `store:false`.
- `temperature`, `top_p`, and `top_k` are **never sent**; they are ignored by
  current Gemini models.
- `thinking_level` accepts only `low`, `medium`, `high`. `minimal` errors on
  Gemini 3.8 Flash.
- `max_output_tokens` is a hard cap that **includes thinking tokens**, so
  `status: "incomplete"` is a normal outcome.
- `store:false` is always sent.

## 11. Architecture

- **Single origin, loopback only.** Vite defaults to `127.0.0.1`. AI routes
  also require the actual listener and socket peer to be loopback, so an
  overridden non-loopback Vite host cannot expose the middleware to network
  clients. Host and, for mutating requests, Origin are validated before a
  token or payload is created.
- **Both Vite lifecycles.** One Node-side plugin registers **both**
  `configureServer` (dev) and `configurePreviewServer` (preview). The dev
  server calls only `configureServer`; the preview server calls only
  `configurePreviewServer`.
- **Missing-build behaviour.** Implementing `configurePreviewServer` suppresses
  Vite's own "Did you build your project?" error, so the plugin must restore
  that message; otherwise the missing-build test would be vacuous.
- **Dynamic ports.** The production preview server binds with
  `strictPort:false`, so the port may be assigned at runtime. Tests must read
  the actual bound port rather than assume one. The Host and Origin checks use
  that bound port, so a request made to the wrong port is refused.
- **Test harness.** `scripts/serve-production.mjs` resolves `configFile` only
  for the project root, so a test harness that serves a temporary root must
  call Vite's `preview()` directly.
- **No new dependencies.** Node built-ins and `fetch` only.
- **No new persistence.** The launch artifact and the usage counter are plain
  local files under `.study-hub/`, which is git-ignored. No database store is
  added.
- **Service worker.** `public/sw.js` already passes `/api/*` through — it
  intercepts only `navigate` requests and same-origin hashed assets — so no
  service-worker change is needed. The service worker must not be widened.

### 11.1 Module layout (as implemented)

| Module | Responsibility |
| --- | --- |
| `server/ai/types.ts` | Routes, the error taxonomy, HTTP status mapping, payload shape. |
| `server/ai/config.ts` | Feature configuration, caps, env var, payload builder. |
| `server/ai/gates.ts` | Launch artifact parsing and the pure gate evaluator. |
| `server/ai/budget.ts` | The local usage counter and its fail-closed states. |
| `server/ai/payloadStore.ts` | Token, digest, and single-use payload consumption. |
| `server/ai/requestValidation.ts` | Loopback address and Host/Origin checks, body reading, input validation. |
| `server/ai/provider.ts` | The Gemini provider interface, metadata check, and one-shot Interactions API client. |
| `server/ai/secretStore.ts`, `configuration.ts` | DPAPI-protected server-only key storage and local setup lifecycle. |
| `server/ai/activation.ts` | Explicit activation backed by local configuration and key presence. |
| `server/ai/pipeline.ts` | The ordered, fail-closed request pipeline. |
| `server/ai/handler.ts` | The HTTP surface and the structured request log. |
| `server/ai/logging.ts` | The single-line JSON request log. |
| `server/ai/plugin.ts` | The loopback Vite plugin for dev and preview lifecycles. |
| `src/features/ai/AiConfigurationPanel.tsx`, `aiConfigurationClient.ts` | Optional first-launch and Settings key configuration; browser code never stores or forwards the key to Google. |
| `server/ai/testing/fakeProvider.ts` | The test-only provider double. **Never imported by production code.** |

### 11.2 Browser summary modules (Phase 2, as implemented)

| Module | Responsibility |
| --- | --- |
| `src/pages/MaterialSummaryPage.tsx` | Loads the selected material metadata and bytes, runs local extraction, and renders the summary route. |
| `src/features/ai/extractMaterialText.ts`, `materialTextSupport.ts` | Bounded local extraction for text/code, PDF, DOCX, PPTX, and XLSX/XLSM; no provider or OCR. |
| `src/features/ai/AiSummaryPage.tsx` | Summary surface, request controls, disclosures, outcomes, and optional notes. |
| `src/features/ai/useAiSummaryRequest.ts` | Prepare/review/approve/send state machine, expiry and integrity checks, and fallback transitions. |
| `src/features/ai/aiClient.ts`, `aiTypes.ts`, `payloadIntegrity.ts` | Same-origin prepare/send calls, response validation, and token/digest integrity. |
| `src/features/ai/PayloadPreview.tsx`, `disclosures.ts`, `DisclosurePanel.tsx` | Exact outbound payload, fresh approval, immutable M1–M8, and digest labelling. |
| `src/features/ai/localSummary.ts`, `LocalSummaryPanel.tsx` | Deterministic zero-network fallback over already-extracted in-memory text. |
| `src/features/ai/PersonalNotesPanel.tsx` | Optional personal notes through the existing note service; never added to the payload. |
| `src/features/ai/AiErrorNotice.tsx`, `errorPresentation.ts`, `summaryOutput.ts` | Distinct outcome/error wording and structured-or-raw summary output display. |

### 11.3 Browser quiz and Q&A modules (Phase 3, as implemented)

| Module | Responsibility |
| --- | --- |
| `src/features/ai/aiClient.ts`, `aiTypes.ts`, `testing/stubAiFetch.ts` | Feature-aware shared client contract and in-process test stub for summary, quiz, and Q&A. |
| `src/features/ai/useAiFeatureRequest.ts` | Shared prepare/review/approve/send state machine for quiz and Q&A. |
| `src/features/ai/useMaterialAiSource.ts` | Local source loading and extraction for quiz and Q&A route wrappers. |
| `src/features/ai/AiQuizPage.tsx`, `quizOutput.ts`, `localQuiz.ts` | Validated multiple-choice output, locally checked answers, and deterministic excerpt fallback. |
| `src/features/ai/AiQaPage.tsx`, `buildQaInput.ts`, `qaOutput.ts`, `localQa.ts` | Delimited question template, locally validated question length, inert answer/reference display, and deterministic keyword-overlap fallback. |
| `src/pages/MaterialQuizPage.tsx`, `src/pages/MaterialQaPage.tsx` | Material-scoped route wrappers; viewer entry points are on supported material types only. |

## 12. Requirement-to-verification mapping

The full table lives in `docs/TEST_PLAN.md` under "Requirement-to-verification
map". Each row is labelled **automated test** or **manual verification**. The
Phase 1, Phase 2, and Phase 3 rows are implemented; only checks actually run
are recorded as verified.

## 13. Remaining checks and limitations

These are not a claim that the owner-reported intended-use clarification is
false; they are remaining independent technical, account, and data-handling
checks:

1. **Written confirmation is unavailable to this repository.** The owner
   reports Google's confirmation for the intended use. Do not claim any broader
   approval or quote unseen correspondence.
2. **Regional terms.** Paid Services are required when making API Clients
   available to users in the EEA, Switzerland, and the United Kingdom. The
   runtime requires paid tier and active billing for those selected regions.
   The owner selects their own region; this record does not infer it.
3. **Free-tier data handling.** Product-improvement use, possible human
   review, and no published retention window. Mitigated, not resolved.
4. **Abuse monitoring.** 55-day retention independent of `store`, with possible
   manual review. Disclosed, not resolved.
5. **Interaction storage.** Default `store=true` would apply; StudyHub sends
   `store=false`, which also removes server-side multi-turn.
6. **Live quota is unknown.** Provider limits are per project, unpublished in
   the documentation, and visible only in AI Studio. The local cap is a local
   ceiling, not a provider reservation.
7. **Model availability is provisional.** Public catalogue presence does not
   guarantee project availability or quota.

Guided recall remains local. The owner must use the local setup UI to confirm
their actual region, tier, age, model access, billing (if required), limits,
and disclosures. Real API tests are not claimed unless performed with the key
entered locally.

## 14. Sources

The Gemini API terms, Interactions API, structured-output documentation, and
model catalogue were checked on **2026-11-02**. These documentation checks did
not use an API key and did not contact a Gemini endpoint. The owner's reported
Google communication was not available for inspection.

| Topic | Source |
| --- | --- |
| Additional Terms, use restrictions, unpaid/paid data use | <https://ai.google.dev/terms> (effective 2026-03-23, last updated 2026-04-28) |
| Gemini API and AI Studio available regions | <https://ai.google.dev/gemini-api/docs/available-regions> |
| Abuse monitoring, 55-day retention, manual review | <https://ai.google.dev/gemini-api/docs/usage-policies.md.txt> |
| Log storage and retention, human reviewers | <https://ai.google.dev/gemini-api/docs/logs-policy.md.txt> |
| Interactions API, `store`, `previous_interaction_id` | <https://ai.google.dev/gemini-api/docs/interactions.md.txt> |
| Interactions API overview and response shape | <https://ai.google.dev/gemini-api/docs/interactions> |
| Structured output `response_format` | <https://ai.google.dev/gemini-api/docs/structured-output> |
| Model catalogue | <https://ai.google.dev/gemini-api/docs/models.md.txt> |
| `gemini-3.8-flash` details | <https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash.md.txt> |
| `gemini-3.5-flash-lite` details | <https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite.md.txt> |
| Free/paid pricing and "Used to improve our products" | <https://ai.google.dev/gemini-api/docs/pricing.md.txt> |
| Rate limits, per-project quotas, midnight-Pacific reset | <https://ai.google.dev/gemini-api/docs/rate-limits.md.txt> |

Note: an earlier citation of an "abuse monitoring" page now returns 404; the
live source is the **usage-policies** page cited above. Retention windows in
this plan are kept separate: interaction storage (M4) and abuse monitoring
(M3) are different mechanisms, and the Free Tier product-improvement use has
no published window.
