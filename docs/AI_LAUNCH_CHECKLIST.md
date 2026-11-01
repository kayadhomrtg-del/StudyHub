# StudyHub AI — launch gate checklist

**Status:** Phase 1 gate machinery and Phase 2/3 summary, quiz, and Q&A surfaces
are implemented. Final verification results are recorded below. The user
declarations in section 2 have **not** been made, and real provider dispatch
remains impossible: no production module reads an API key, an endpoint URL, or
an environment file, and the mounted provider is permanently unconfigured.
This document records *what must be true* before a real provider request could
ever be authorized.

**Current state: real provider dispatch is BLOCKED.** Provider eligibility is
unresolved (see `docs/AI_PLAN.md`, section 3). Nothing in this document changes
that, and nothing in this document can enable a real request.

**How to use this document.** Work top to bottom. Section 1 is produced by the
test suite and is never edited by hand. Section 2 contains only declarations
the repository owner makes, each one backed by something outside this
repository. Section 3 records what is still unresolved. Section 4 is a
deliberate, separate action. The artifact in section 2 is stored at
`.study-hub/ai-launch-gate.json` (git-ignored, no API key, no project
identifier).

---

## 1. Automated verification gates (Category 1)

**These are produced by running the test suite and the build. Do not tick them
by hand.** They are reported in test output and CI logs.

**There is deliberately no field for these in the launch artifact.** Automated
verification evidence must never be stored as, or presented as, a user
acknowledgement or a user declaration. A passing test run says nothing about
the owner's decisions, and a ticked box says nothing about what was tested.

| Gate | What is verified | How |
| --- | --- | --- |
| C | The proxy mounts in both the Vite dev server and the preview server, bound to `127.0.0.1` only. | Automated test (implemented, Phase 1 — `server/ai/plugin.test.ts`, `server/ai/safety.test.ts`) |
| C | The plugin registers both `configureServer` and `configurePreviewServer`, and restores Vite's "Did you build your project?" message when `dist/` is absent. | Automated test (implemented, Phase 1 — `server/ai/plugin.test.ts`) |
| C | The preview server is reachable on its dynamically assigned port when the preferred port is occupied. | Automated test (implemented — `npm run test:server`) |
| C | Every pre-dispatch rejection yields its documented error code, dispatches nothing, and consumes no budget unit. | Automated test (implemented, Phase 1 — `server/ai/handler.test.ts`, `server/ai/pipeline.test.ts`) |
| C | A request whose Host or Origin does not name the local loopback server is refused before a token or a payload is created. | Automated test (implemented, Phase 1 — `server/ai/requestValidation.test.ts`, `server/ai/handler.test.ts`) |
| C | The local usage counter fails closed: a missing, malformed, unreadable, or corrupted counter refuses dispatch and is never silently reset to zero. | Automated test (implemented, Phase 1 — `server/ai/budget.test.ts`) |
| C | The mounted production route answers `not_configured` and performs no outbound call; no production module contains an HTTP client, a provider endpoint, or a credential name. | Automated test (implemented, Phase 1 — `server/ai/safety.test.ts`) |
| C | The sample artifact embedded in this document is inert and fails the launch gates. | Automated test (implemented, Phase 1 — `server/ai/gates.test.ts`) |
| C | The budget is charged exactly once per dispatched request and not at all on rejection. | Automated test (implemented, Phase 1 — `server/ai/budget.test.ts`, `server/ai/pipeline.test.ts`) |
| C | A dispatched request produces exactly one provider call; no retry path exists. | Automated test (implemented, Phase 1/2 — `server/ai/pipeline.test.ts`, `src/features/ai/aiClient.test.ts`) |
| C | Summary, quiz, and Q&A local fallbacks perform zero `fetch` calls of any kind. | Automated test (implemented — local summary/quiz/Q&A fallback and page tests) |
| C | The rendered payload equals the dispatched payload, and a mismatch is rejected before dispatch. | Automated test (implemented, Phase 2 — `AiSummaryPage.test.tsx`, `aiClient.test.ts`, `useAiSummaryRequest.test.tsx`, `server/ai/pipeline.test.ts`) |
| C | The optional personal notes never appear in the dispatched payload. | Automated test (implemented, Phase 2 — `AiSummaryPage.test.tsx`) |
| C | No AI prompt, output, or history is written to IndexedDB, and a backup contains no AI records. | Automated test (implemented, Phase 2 — `AiSummaryPage.test.tsx`, `BackupService.test.ts`) |
| C | A new request requires fresh approval; an earlier approval cannot be reused, and only `review` after approval may send. | Automated test (implemented, Phase 2 — `useAiSummaryRequest.test.tsx`, `AiSummaryPage.test.tsx`, `server/ai/payloadStore.test.ts`, `server/ai/pipeline.test.ts`) |
| C | The digest is labelled an integrity check only and is never accepted as approval evidence. | Automated test (implemented, Phase 2 — `AiSummaryPage.test.tsx`, `server/ai/payloadStore.test.ts`) |
| C | M1–M8 are rendered verbatim, are not editable, and match `docs/AI_PLAN.md` section 8.2. | Automated test (implemented, Phase 2 — `AiSummaryPage.test.tsx`, `server/ai/phase2Docs.test.ts`) |
| C | Pre-dispatch refusal, failure after sending, and unknown outcome remain visibly distinct. | Automated test (implemented, Phase 2 — `aiClient.test.ts`, `AiErrorNotice.test.tsx`, `AiSummaryPage.test.tsx`) |
| C | Quiz and Q&A use only the shared prepare/send contract, require fresh approval, and do not retry. | Automated test (implemented — `aiClient.test.ts`, `useAiFeatureRequest.test.tsx`, `AiQuizPage.test.tsx`, `AiQaPage.test.tsx`) |
| C | Quiz validation and local answer checking are bounded, all-or-nothing, and memory-only. | Automated test (implemented — `quizOutput.test.ts`, `AiQuizPage.test.tsx`) |
| C | Q&A rejects empty/oversize questions locally; the exact preview includes only the selected source and explicit question. | Automated test (implemented — `buildQaInput.test.ts`, `AiQaPage.test.tsx`, `MaterialQaPage.test.tsx`) |
| C | Quiz/Q&A render all frozen M1–M8 disclosures and show references as provider-reported/unverified inert text. | Automated test (implemented — `AiQuizPage.test.tsx`, `AiQaPage.test.tsx`) |
| C | Quiz and Q&A pages have no persistence path for AI results; no AI records are added to backups. | Automated test and source review (implemented — route/page tests, `BackupService.test.ts`) |
| C | `npm run test`, `npm run test:server`, `npm run lint`, `npm run typecheck`, and `npm run build` all succeed. | CI (`test`, `test:server`, `lint`, `typecheck`, `build`) |

Final local verification (not independent verification or live provider
validation):

- Last full run: **2026-11-01**, after Phase 4 implementation and documentation
- `npm run test`: **56 files, 330 tests passed** on both requested runs
- `npm run test:server`: 3 tests passed
- `npm run lint`: clean
- `npm run typecheck`: clean
- `npm run build`: succeeded
- `git diff --check`: clean
- Result: **all automated verification gates pass**
- These results were observed locally in this working copy; they are not
  independent verification. No test contacted Google or enabled provider
  dispatch.

---

## 2. User declarations (Category 2)

**These are decisions and confirmations made by the repository owner.** They are
recorded in the artifact below and validated by the server at request time.
None of them can override a server-side block.

A declaration is a statement of fact by the owner. It is **not** evidence. In
particular, ticking a box below does not make a provider's terms permit a
given use.

### Gate A — Limits and models confirmed for this project

- [ ] The model intended for question and answer has been confirmed to exist
      and to be usable **in this specific Google Cloud project** (not merely in
      the public catalogue).
- [ ] The model intended for summary and quiz has been confirmed the same way.
- [ ] The project's actual rate limits have been read in AI Studio.

Public catalogue availability does not guarantee availability or quota for a
project, so the confirmation must come from the project's own AI Studio page.

Artifact fields: `modelsConfirmed`, `limitsConfirmed`.

### Gate B — Cap reconciliation

- [ ] The effective daily cap has been chosen as a **local ceiling** and is
      recorded in the artifact.
- [ ] The owner understands this is **not** a provider reservation, and that
      the local reset window may differ from the provider's midnight-Pacific
      requests-per-day reset.

Artifact field: `effectiveDailyCap` — **the single source of truth**. The
server enforces it. Any other recorded quota value is display-only context and
is never used for enforcement.

### Gate D — Region

- [ ] The owner has confirmed which region applies.

Artifact field: `region`, one of `non-eea-uk-ch`, `eea`, `switzerland`,
`united-kingdom`.

> **Restriction.** Google's Additional Terms permit only Paid Services when
> making API clients available to users in the European Economic Area,
> Switzerland, or the United Kingdom. Paid tier is out of scope for this plan,
> so those three values are rejected with `region_not_permitted`.

### Gate E — Tier

- [ ] The owner has confirmed which tier the project uses.

Artifact field: `tier`, one of `free`, `paid`. This selects which data-handling
disclosures are shown. It does **not** affect eligibility — a paid account does
not establish that a use is permitted.

### Gate F — Terms-eligibility determination

This is the hard gate. It is **evidence**, not a preference.

- [ ] An authoritative source has been read that applies to the intended use,
      and it is recorded below with a URL and a verbatim quote.
- [ ] **Or** the owner has made an explicit, recorded decision to proceed as a
      personal, non-commercial use of an unpaid API under their own account and
      their sole responsibility. This is a decision, not a legal opinion, and
      the artifact labels it as such.

Artifact fields: `termsEligibility.status`, `termsEligibility.determinedAt`,
`termsEligibility.termsCheckedAt`, `termsEligibility.basis`,
`termsEligibility.sourceUrl`, `termsEligibility.sourceQuote`,
`termsEligibility.intendedUse`.

Rules:

- `status` is `unresolved` until a determination exists. `unresolved` blocks
  dispatch.
- `status` is `established` only when every sub-field above is present and
  non-empty.
- `termsCheckedAt` older than **30 days** is stale and blocks dispatch with
  `terms_check_stale`. Re-read the source and update the determination.
- The source must be an official provider document, quoted verbatim.

### Gate G — Exposure acknowledgement

- [ ] The owner has read and accepted the mandatory disclosures M1–M8 in
      `docs/AI_PLAN.md` (section 8.2) as they will be shown in the app.

Artifact field: `exposureAcknowledged` (boolean).

This acknowledgement covers **exposure risk**. It is independent of Gate F, and
it cannot make an ineligible use eligible.

### The artifact

Stored at `.study-hub/ai-launch-gate.json`. Git-ignored. Contains no API key
and no Google Cloud project identifier.

Fields are grouped by the gate they come from, so the mapping between a
declaration and its artifact field stays obvious:

| Gate | Artifact field(s) |
| --- | --- |
| A | `modelsConfirmed`, `limitsConfirmed` |
| B | `effectiveDailyCap` |
| D | `region` |
| E | `tier` |
| F | `termsEligibility` |
| G | `exposureAcknowledged` |
| — (audit only) | `recordedAt`, `recordedBy`, `checklistReference`, `notes` |

---

## 3. Unresolved conditions

**These are open right now and each one blocks a real request.**

1. **Provider eligibility is unresolved.** Google's Additional Terms restrict
   AI Studio and the Gemini API to developers building with Google AI models
   "for professional or business purposes, not for consumer use". No
   authoritative Google document distinguishes a personal study tool from
   consumer use; only community posts discuss it. Nothing here establishes
   that personal coursework qualifies, and nothing here establishes that it
   does not. A paid account, an acknowledgement, or a written rationale does
   not establish it either.
2. **Regional restriction.** The EEA, Switzerland, and the United Kingdom
   require Paid Services. Paid tier is out of scope, so the feature is
   unavailable there.
3. **Free-tier data handling.** On the Free Tier, submitted content is used to
   improve Google's products, human reviewers may read and annotate it, and no
   retention window is published for that use.
4. **Abuse monitoring.** Google retains prompts, context, and outputs for 55
   days for policy enforcement, independently of `store`, and flagged content
   may be reviewed by authorised personnel.
5. **Live quota is unknown.** Provider rate limits are per project, are not
   published in the documentation, and are visible only in AI Studio. The local
   cap is a local ceiling, not a provider reservation.
6. **Model availability is provisional.** Public catalogue presence does not
   guarantee availability or quota for a specific project.

**Phase 1 added a structural barrier on top of these.** The implemented proxy
contains no HTTP client, no provider endpoint, and no credential lookup, and
its provider is permanently unconfigured. Resolving every item above would
still not produce a request, because there is no code path that could make
one.

**Phase 2 adds the summary surface but no provider path and resolves none of
these conditions.** It adds no key lookup, endpoint, HTTP client, or activation.
In the current repository state (no launch artifact and no activation),
preparation fails closed and the UI exposes the local fallback; no real provider
request is possible.

---

## 4. Runtime activation

**Activation is a separate step from the API key and from environment
configuration.** Setting a key and setting environment variables are
preparations; they do not, on their own, authorize anything.

Real dispatch requires **all** of the following, and the server enforces every
one of them independently:

1. The proxy middleware is mounted (`STUDY_HUB_AI_ENABLED=1`).
2. A Gemini API key is present in the local environment.
3. `.study-hub/ai-launch-gate.json` exists, parses, and passes schema
   validation.
4. `exposureAcknowledged` is `true`.
5. `modelsConfirmed` is `true` and the confirmed model is available to the
   project.
6. `region` permits use.
7. `termsEligibility.status` is `established`, complete, and not stale.
8. The explicit activation step has been performed.

Rules that always hold:

- Consent never overrides a server-side block. An approved, well-formed
  request is still refused if a gate fails.
- An acknowledgement never overrides eligibility.
- **Unresolved eligibility blocks dispatch regardless of activation settings**,
  including a paid account, a fully populated artifact, and a completed
  activation.
- A sample configuration cannot enable dispatch.
- A test fixture cannot enable dispatch.
- Completing Phase 2 does not enable dispatch.

Status of the activation step:

- Activation mechanism: **implemented in Phase 1 and permanently disabled.** The
  server reads the activation state through an activation reader, and the
  mounted reader always reports "not activated", which produces
  `not_configured` before any payload is built. A real activation mechanism
  would be introduced only in a later phase, and only if eligibility is
  resolved.
- Activated: **No**

---

## 5. Sample artifact (inert)

The block below is a **sample**. It shows the file's shape. It is not a record
of anything, it must never be copied over a real artifact, and it **cannot
enable a real request**:

- `termsEligibility.status` is `"unresolved"`, which fails Gate F.
- `exposureAcknowledged` is `false`, which fails Gate G.
- `modelsConfirmed` and `limitsConfirmed` are `false`, which fails Gate A.

Any one of those is enough to block dispatch. All three are false at once, so
there is no combination of edits short of rewriting the file that would enable
a request — and rewriting it is exactly what the gates in section 2 are for.

```json
{
  "schemaVersion": 1,
  "region": "non-eea-uk-ch",
  "tier": "free",
  "modelsConfirmed": false,
  "limitsConfirmed": false,
  "effectiveDailyCap": 20,
  "exposureAcknowledged": false,
  "termsEligibility": {
    "status": "unresolved",
    "determinedAt": null,
    "termsCheckedAt": null,
    "basis": null,
    "sourceUrl": null,
    "sourceQuote": null,
    "intendedUse": "Personal study summaries, quizzes, and Q&A over material imported on this machine by a single user."
  },
  "recordedAt": "2026-10-22T00:00:00.000Z",
  "recordedBy": "sample",
  "checklistReference": "docs/AI_LAUNCH_CHECKLIST.md#5-sample-artifact-inert",
  "notes": "Inert sample artifact. termsEligibility.status is unresolved and exposureAcknowledged, modelsConfirmed, and limitsConfirmed are false, so this file fails the launch gates and cannot enable a real request. It contains no API key and no project identifier."
}
```

---

## 6. Related documents

- `docs/AI_PLAN.md` — the design: scope, eligibility analysis, milestones,
  phases, gates, privacy, error taxonomy, model configuration.
- `docs/TEST_PLAN.md` — the "Optional AI feature checks" section and the
  requirement-to-verification map.
- `docs/PRODUCT_SPEC.md` §8 — the amended local-only requirements.
- `docs/ARCHITECTURE.md` — the amended privacy boundary.
