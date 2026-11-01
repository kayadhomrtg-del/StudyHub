# Copilot handover — StudyHub Phase 4

**Purpose:** give GitHub Copilot a reliable starting point for continuing
StudyHub without re-planning completed work, duplicating existing features, or
assuming an implementation status from documentation alone.

**Status:** Phases 0–4 are implemented and the requested full automated and
isolated-origin browser verification is complete. Phase 3 and Phase 4 owner
acceptance remain owner decisions; real provider dispatch is still blocked.
The actual repository state always takes precedence over this or any
historical status report.

**Read next, in this order:**

1. [`../AGENTS.md`](../AGENTS.md) — repository rules, architecture, invariants,
   and commands.
2. [`../.github/copilot-instructions.md`](../.github/copilot-instructions.md) —
   mandatory working rules and stop conditions.
3. [`PHASE_4_PLAN.md`](PHASE_4_PLAN.md) — implemented guided-recall behavior,
   owner decisions, tests, and acceptance criteria.
4. [`PHASE_3_PLAN.md`](PHASE_3_PLAN.md) — Phase 3 scope and acceptance status.
5. [`AI_PLAN.md`](AI_PLAN.md) — the source of truth for AI behaviour, gates,
   privacy, disclosures, and provider eligibility.
6. [`AI_PROVIDER_ACTIVATION_PLAN.md`](AI_PROVIDER_ACTIVATION_PLAN.md) — a
   future proposal only; it does not activate or enable provider dispatch.
7. [`TEST_PLAN.md`](TEST_PLAN.md) — verification patterns and requirement map.
8. [`ARCHITECTURE.md`](ARCHITECTURE.md) and
   [`AI_LAUNCH_CHECKLIST.md`](AI_LAUNCH_CHECKLIST.md) — boundaries and launch
   status.

---

## 1. Current project status

| Item | State |
| --- | --- |
| Application | Local-first React 19 + TypeScript + Vite 6 + Tailwind 4 + Dexie/IndexedDB study workspace |
| Data | Browser-local IndexedDB only; Dexie schema **v7**, eight stores |
| Backups | Full **v2** ZIP, module **v1** ZIP; no AI records |
| Phase 0 | Documentation and privacy records complete |
| Phase 1 | Local AI proxy skeleton implemented; no provider dispatch |
| Phase 2 | Summary UI and request pipeline implemented; documentation complete |
| Phase 3 | Quiz and single-turn Q&A implemented; final owner acceptance pending |
| Phase 4 | Local guided recall implemented; recall attempts save as ordinary material-linked notes; final owner acceptance pending |
| Real provider dispatch | **Blocked**; eligibility unresolved; production provider permanently unconfigured; activation reader permanently disabled |
| Provider readiness | `AI_PROVIDER_ACTIVATION_PLAN.md` is a proposal for a separately authorized milestone; no provider activation is implemented |
| Working tree | Inspect Git status and diffs before assuming commit history; inherited Phase 1–3 work must be preserved |

Final local verification on **2026-11-01**: `npm run test` passed twice
(**56 files / 330 tests** each run), `npm run test:server` passed (**3 tests**),
and `npm run lint`, `npm run typecheck`, `npm run build`, and
`git diff --check` all passed. These are local results for this working copy,
not independent verification or evidence of live provider behaviour.

The production build was browser-tested on a fresh `127.0.0.1:4174` origin and
a separate `localhost:4174` origin so test records stayed separate from any
other browser origin. Tested flows included module/topic creation, local text
material import and viewing, notes, search, task/calendar/planner navigation,
summary/quiz/Q&A local fallbacks, guided recall save/reveal/explicit confirmed
completion, and v2 backup export followed by merge restore while preserving a
pre-existing destination module. Browser request observation found no external
requests on local fallback paths; the attempted Q&A preparation reached only
the loopback proxy and was refused because the proxy is disabled. Browser tests
did not exercise a live provider, generated AI quiz/Q&A output, the unsupported
material error screen, a screen reader, or an import from a user's existing
backup.

---

## 2. Completed work

### Phase 0 — documentation and requirements

Phase 0 established the AI plan, the launch-gate checklist, the privacy
disclosures, the product and architecture boundaries, the test plan, and the
instruction updates. It added no runtime AI code.

Relevant records:

- [`AI_PLAN.md`](AI_PLAN.md)
- [`AI_LAUNCH_CHECKLIST.md`](AI_LAUNCH_CHECKLIST.md)
- [`TEST_PLAN.md`](TEST_PLAN.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`../README.md`](../README.md)

### Phase 1 — proxy skeleton and stub verification

Phase 1 added `server/ai/`:

- loopback-only request validation and Host/Origin checks;
- launch-gate evaluation;
- local daily budget with fail-closed usage state;
- single-use payload token/digest storage;
- deterministic error taxonomy and structured logging;
- a Vite plugin mounted in both dev and preview servers;
- a permanently unconfigured provider and a permanently disabled activation
  reader; and
- tests using an injected in-process fake provider.

No production module reads an API key, contains a provider endpoint, or contains
an HTTP client. The proxy has no UI.

### Phase 2 — summary UI and request pipeline

Phase 2 added the summary route and its local-first workflow:

- material loading and bounded local text extraction;
- exact payload preparation through the local proxy;
- full payload review and fresh per-request approval;
- send with only token and digest;
- M1–M8 disclosures;
- distinct error, incomplete, and fallback states;
- optional personal notes stored through the existing note service and never
  sent; and
- focused component, hook, route, extraction, fallback, and persistence tests.

The summary flow remains intact. Quiz and Q&A reuse its shared client contract,
payload preview, disclosure panel, error presentation, and prepare/review/
approve/send route rather than creating a second network pipeline.

---

## 3. Phase 3 — quiz and Q&A

Phase 3 adds two optional surfaces over one selected material:

1. **Quiz generation** — multiple-choice questions from the extracted material,
   with local answer checking, score, and explanations.
2. **Grounded Q&A** — one question at a time, answered from the selected
   material, with provider-reported references.

The implementation order and resolved owner choices are in
[`PHASE_3_PLAN.md`](PHASE_3_PLAN.md). The implemented scope:

- `/materials/:materialId/quiz` and `/materials/:materialId/qa` routes, exposed
  from supported materials in the viewer;
- show M1–M8 on each surface before the first request;
- reuse the existing prepare/review/approve/send pipeline;
- keep all AI state in memory;
- make both fallbacks deterministic and zero-fetch;
- do not enable or simulate real provider dispatch;
- do not change the Dexie schema, backups, dependencies, production server AI
  implementation, gates, region rules, or activation;
- report the six completed steps and wait for owner acceptance before any
  further work.

The owner approved all documented defaults and authorized the six steps
autonomously. There are no unresolved Phase 3 product decisions. Provider
eligibility remains an external unresolved launch condition and still blocks
real dispatch.

### Phase 4 — local guided recall

Phase 4 adds a focused, fully local review workspace for planned sessions that
link to a material:

- Planner entry: **Start guided recall** appears only for planned sessions
  with a material ID; route is
  `/planner/sessions/:sessionId/review`.
- `src/features/studySessions/studySessionSource.ts` resolves the session and
  its linked material through existing services, then reuses
  `extractMaterialText` and `materialTextSupport`. It reports missing,
  unsupported, empty, and failed extraction.
- `src/pages/StudySessionReviewPage.tsx` keeps extracted text out of the
  rendered page until **Reveal full source**. It displays the full extracted
  text and leaves the attempt visible for comparison. No scoring or mastery
  claim is made.
- Recall attempts are unsaved in memory until explicit Save or confirmed
  Finish. They then use `noteService` as ordinary notes linked to the material.
  The existing note model cannot link to study sessions; no schema change was
  made. Repeated saves update one note; atomic note creation prevents empty
  orphan notes after failed saves.
- Finish requires explicit confirmation, saves a changed attempt before
  completion, then calls the existing session service for the selected
  session. Navigation, reveal, note saving, and elapsed time do not complete
  the session.
- No AI request, external network call, database store/index, or backup-format
  change was added.
- Acceptance status and exact verification are in
  [`PHASE_4_ACCEPTANCE_REPORT.md`](PHASE_4_ACCEPTANCE_REPORT.md).

---

## 4. Inspect the actual working tree before assuming anything

The actual repository state takes precedence over this handover and every
historical report: documentation can lag code, and the worktree may contain
inherited changes. Verify the current tree and tests before relying on any
status statement. Before making any change:

1. Run `git status --short` and read the result. Preserve all modified and
   untracked files; do not infer their ownership from their content alone.
2. Inspect the relevant implementation and tests directly. Do not infer that a
   feature exists because a plan, README, or checklist describes it.
3. Check whether the feature is already present before adding a new file.
4. Read the existing test for the touched area before changing it.
5. Report what is actually present, what is missing, any blocking decision, and
   the next authorized step.
6. Wait for explicit owner approval before starting work not already authorized.

Useful inspection commands (read-only):

```powershell
git status --short
git diff --stat
Get-ChildItem src\features\ai
Get-ChildItem server\ai
```

Do not commit, push, create a branch, revert, or discard changes.

---

## 5. Where the relevant implementation lives

### Browser AI modules — `src/features/ai/`

| File | Responsibility |
| --- | --- |
| `aiTypes.ts` | Client contract: prepared payload, send request, client failures, feature request shape. |
| `aiClient.ts` | Feature-aware same-origin `/api/ai/prepare` and `/api/ai/send` calls; summary compatibility wrappers remain. |
| `useAiSummaryRequest.ts` | Approved Phase 2 prepare/review/approve/send state machine. Keep unchanged unless a separate refactor is approved. |
| `AiSummaryPage.tsx` | Summary surface and M1–M8 placement. |
| `useAiFeatureRequest.ts` | Shared quiz/Q&A request state machine with approval, expiry, integrity, and no-retry guards. |
| `AiQuizPage.tsx`, `quizOutput.ts`, `localQuiz.ts` | Quiz surface, strict validation, local answer checking, and deterministic excerpt fallback. |
| `AiQaPage.tsx`, `buildQaInput.ts`, `qaOutput.ts`, `localQa.ts` | Single-turn question template, answer/reference parsing, and deterministic keyword-overlap fallback. |
| `useMaterialAiSource.ts` | Shared local material loading, extraction, and error state for quiz/Q&A route wrappers. |
| `PayloadPreview.tsx` | Full exact-payload preview and fresh approval checkbox. |
| `payloadIntegrity.ts` | Preview-versus-payload integrity checks. |
| `disclosures.ts`, `DisclosurePanel.tsx` | Frozen M1–M8 source and rendering. |
| `AiErrorNotice.tsx`, `errorPresentation.ts` | Distinct pre-dispatch, post-dispatch, and unknown-outcome wording. |
| `extractMaterialText.ts`, `materialTextSupport.ts` | Bounded local extraction for supported materials. |
| `summaryOutput.ts` | Summary JSON parser. |
| `localSummary.ts`, `LocalSummaryPanel.tsx` | Deterministic zero-fetch summary fallback. |
| `PersonalNotesPanel.tsx` | Optional personal notes through the existing note service; never sent. |
| `testing/stubAiFetch.ts` | Test-only same-origin proxy stub for summary/quiz/Q&A; never import it from production. |
| `*.test.ts`, `*.test.tsx` | Focused Phase 2/3 coverage, including client contract, parsing, fallbacks, routes, and privacy. |

### Routes and pages

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | Lazy route registration for summary, quiz, and Q&A. |
| `src/pages/MaterialSummaryPage.tsx` | Loads material metadata/bytes, extracts text, renders the summary surface. Its Phase 2 flow remains unchanged. |
| `src/pages/MaterialQuizPage.tsx`, `src/pages/MaterialQaPage.tsx` | Quiz/Q&A source wrappers using the shared local source hook. |
| `src/pages/MaterialViewerPage.tsx` | Material viewer; exposes Summarize, Quiz, and Ask questions only for supported materials. |
| `src/pages/MaterialsPage.tsx` | Materials listing; not expected to change. |

### Server AI — `server/ai/`

| File | Responsibility |
| --- | --- |
| `config.ts` | Feature configs for `summary`, `quiz`, and `qa`; provisional models, limits, system instructions, JSON schemas. |
| `requestValidation.ts` | Host/Origin, body, feature, text, thinking-level, and output-token validation. Already accepts `quiz` and `qa`. |
| `pipeline.ts` | Ordered fail-closed prepare/send pipeline. |
| `handler.ts` | HTTP surface and structured log. |
| `provider.ts`, `activation.ts` | Permanently unconfigured provider and disabled activation reader. Do not change for Phase 3. |
| `gates.ts`, `budget.ts`, `payloadStore.ts`, `types.ts` | Gates, local cap, token/digest store, and shared contract. |
| `testing/fakeProvider.ts` | Test-only provider double. Never import from production. |
| `*.test.ts`, `phase2Docs.test.ts` | Existing Phase 1/Phase 2 tests and disclosure checks. |

`server/ai/config.ts` already has quiz/Q&A configuration. Phase 3 required no
production server change. Any future request to change production server AI
code requires separate owner approval.

### Data and safety boundaries

| Area | Files / rule |
| --- | --- |
| Dexie schema | `src/features/modules/moduleDatabase.ts` — v7, eight stores; do not change. |
| Backups | `src/features/backup/BackupService.ts` — v2 full, v1 module; no AI records; do not change format. |
| Service worker | `public/sw.js` — app shell and same-origin hashed assets only; never widen it. |
| Provider status | `docs/AI_PLAN.md` §3 and §6; `docs/AI_LAUNCH_CHECKLIST.md`; blocked. |
| Disclosures | `src/features/ai/disclosures.ts` and `docs/AI_PLAN.md` §8.2; frozen M1–M8. |

---

## 6. Completed Phase 3 implementation order

The six authorized steps were completed in this order:

1. **Shared feature contract and test double** — add `quiz`/`qa` client support
   and stub coverage; preserve summary behavior; no routes or UI.
2. **Quiz core** — quiz parser/validator, local fallback, and the generic
   Phase 3 request hook.
3. **Quiz surface and route** — page, route wrapper, disclosures, answer
   checking, viewer entry.
4. **Q&A core** — deterministic question template, Q&A parser, local fallback.
5. **Q&A surface and route** — page, route wrapper, question input, answer and
   references display, viewer entry.
6. **Documentation, full verification, and acceptance** — update status records,
   run the full suite, complete the privacy review, and submit the final diff
   for owner acceptance.

No Phase 3 implementation step remains. Do not extend or revise the scope
without explicit owner approval.

---

## 7. How to report completed work

Use a short, concrete report:

```text
Step: <number and name>
Status: complete / blocked / needs decision

Changed files:
- <path> — <what changed and why>

Tests and checks:
- <exact command> — <pass/fail and relevant counts>
- <exact command> — <pass/fail>

Privacy and scope:
- M1–M8 placement: <where>
- AI persistence: <none / explanation>
- Provider dispatch: unchanged and still blocked
- Schema/backup/dependency/server changes: none / approved exception

Known limitations or unresolved decisions:
- <item>

Next authorized action:
- <wait for approval / specific decision needed>
```

Do not claim a check passed if it was not run. Do not present a simulated test as
proof of live provider behaviour. Do not mark a Phase 3 item verified until the
code that exercises it exists and the test has actually run.

---

## 8. Stop and wait rules

For future work, Copilot must stop and wait for explicit owner approval:

- before extending or revising the completed Phase 3 scope;
- before any production `server/ai/` change;
- before any change to the prepare/send contract;
- before any schema, backup, dependency, provider, gate, activation, or region
  change;
- before any real network/provider test;
- before any commit, push, branch, or revert.

A passing test, a completed step, or silence is not approval for additional
scope. Only an explicit owner message authorizes further work.

---

## 9. How to avoid duplicating Phase 2

Reuse, do not rebuild:

| Need | Reuse |
| --- | --- |
| Material loading and supported-type check | `materialService`, `isMaterialTextSupported`, and the Phase 2 extraction path. |
| Text extraction | `extractMaterialText.ts` / `materialTextSupport.ts`; do not add OCR or a second parser. |
| Prepare/review/approve/send network protocol | `aiClient.ts`, shared client types, and the existing `/api/ai/prepare` / `/api/ai/send` routes. |
| Exact payload preview and fresh approval | `PayloadPreview.tsx`; add only an optional surface noun if needed. |
| Integrity and expiry checks | `payloadIntegrity.ts` and the existing hook guards. |
| M1–M8 | `disclosures.ts` and `DisclosurePanel.tsx`; never copy or reword. |
| Error classes and wording | `AiErrorNotice.tsx`, `errorPresentation.ts`, and the existing taxonomy. |
| Summary fallback pattern | Keep `localSummary.ts` for summary; add a separate pure quiz/Q&A fallback rather than a second network path. |
| Test double | Extend `testing/stubAiFetch.ts`; do not create a second fake proxy. |
| Personal notes | `PersonalNotesPanel.tsx` / `noteService` only if the owner approves notes on the new surfaces; never include them in the payload. |
| Tests | Reuse the Phase 2 test patterns and fake/stub boundary; do not contact a provider. |

Do not:

- add a second prepare/send route or a provider client;
- copy the M1–M8 strings into new components;
- reimplement the state machine without preserving the Phase 2 states, expiry
  guard, integrity guard, no-retry rule, and zero-fetch fallback;
- add a second source-extraction implementation;
- create a new fake provider when the existing test double can be extended.

The Phase 3 proposal deliberately leaves `useAiSummaryRequest.ts` and
`MaterialSummaryPage.tsx` unchanged to protect the approved Phase 2 flow. New
surfaces use a generic Phase 3 hook and a small shared new source loader. A later
unification refactor would be a separate, approved change.

---

## 10. First action for future Copilot work

Read the documents listed at the top of this handover, inspect the actual
working tree and relevant implementation/tests, then report:

1. what exists and what is missing;
2. any unresolved decision that blocks the requested work;
3. the next authorized step and its scope.

Do not treat this handover as approval for new work. Wait for explicit owner
approval whenever the requested scope has not already been authorized.
