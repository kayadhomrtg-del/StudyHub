# StudyHub — Copilot instructions

## Before proposing or making changes

1. Read [`docs/COPILOT_HANDOVER.md`](../docs/COPILOT_HANDOVER.md),
   [`docs/PHASE_4_PLAN.md`](../docs/PHASE_4_PLAN.md),
   [`docs/PHASE_3_PLAN.md`](../docs/PHASE_3_PLAN.md),
   [`docs/AI_PLAN.md`](../docs/AI_PLAN.md), and [`AGENTS.md`](../AGENTS.md).
2. Inspect `git status --short`, then inspect the relevant implementation and
   tests in the actual working tree. Documentation and historical reports are
   not proof that code exists or is unchanged.
3. Summarize what exists, what is missing, any unresolved decision that blocks
   the work, and the next authorized step. Wait for explicit owner approval.
4. Read the existing tests before editing. Implement only the scope explicitly
   authorized by the owner. If authorization covers a complete multi-step
   scope, proceed only through those steps; otherwise stop at the stated
   approval checkpoint.

Never infer approval from silence, a passing test, or a completed step.

## Project and architecture

StudyHub is a personal, local-first college study workspace built with React
19, TypeScript, Vite 6, Tailwind 4, and Dexie/IndexedDB. It has no accounts,
hosted backend, cloud sync, analytics, telemetry, or runtime CDN. Study data
belongs to the current browser profile and origin.

- Routes and app shell: `src/main.tsx`, `src/App.tsx`.
- Features follow `type` → repository → service → page/component; pages do not
  query `moduleDatabase` directly.
- IndexedDB is schema **v7** with eight stores. Backups are full **v2** and
  module **v1**. See `AGENTS.md` for data and imported-file invariants.
- AI browser code is in `src/features/ai/`; the loopback proxy is in
  `server/ai/`.

## AI status and request path

The existing AI path is:

```text
selected material → local extraction → POST /api/ai/prepare { feature, text }
→ validation and gates → exact payload review and fresh approval
→ POST /api/ai/send { token, digest } → local budget → at most one attempt
```

Preparation never dispatches or charges the budget. The digest is an integrity
check, not approval. There are no retries. The deterministic local fallback
makes zero `fetch` calls.

- **Phase 0:** AI requirements, privacy, and launch-gate documentation complete.
- **Phase 1:** proxy skeleton implemented; provider permanently unconfigured,
  activation reader disabled, and no production API-key lookup, provider
  endpoint, or HTTP client.
- **Phase 2:** summary route, local extraction, exact-payload review, fresh
  approval, request state machine, disclosures, errors, fallback, and focused
  tests implemented. Reuse this work; do not create a second request pipeline.
- **Phase 3:** quiz and single-turn Q&A are implemented in the browser over the
  shared client and request pipeline. Routes, local extraction, parsers,
  deterministic fallbacks, answer checking, and supported-material viewer
  actions exist. AI state remains memory-only.
- **Phase 4:** local guided recall is implemented for planned sessions linked
  to material. The full locally extracted text remains hidden until reveal.
  Recall attempts are saved only after explicit Save or confirmed Finish as
  ordinary notes linked to the material; the note model has no session link.
  Finish requires explicit confirmation and updates the selected session
  through the existing service. No AI or external request is made.

Real provider dispatch remains **blocked**: eligibility is unresolved and the
production provider/activation path is structurally unavailable. Never enable,
simulate, or request real dispatch.
For separately authorized provider-readiness work, read
`docs/AI_PROVIDER_ACTIVATION_PLAN.md` as a proposal only. `docs/AI_PLAN.md` and
`docs/AI_LAUNCH_CHECKLIST.md` remain authoritative; the proposal grants no
eligibility or activation approval.

## Phase 3 and privacy boundaries

Phase 3 was explicitly authorized as a complete six-step scope. For any future
work, read `docs/COPILOT_HANDOVER.md`, `docs/PHASE_3_PLAN.md`, and
`docs/AI_PLAN.md` first; inspect the actual tree and relevant tests; then
implement only the next explicitly approved step and stop for owner approval.
The completed Phase 3 surfaces are:

1. Shared quiz/QA client contract and test-double support.
2. Quiz parser, local fallback, and generic request hook.
3. Quiz page, route, disclosures, and local answer checking.
4. Q&A template, parser, and local fallback.
5. Q&A page, route, disclosures, answer, and references.
6. Documentation, full verification, privacy review, and owner acceptance.

The Phase 3 defaults and model-display choice recorded in
`docs/PHASE_3_PLAN.md` are resolved for that implementation. Stop for owner
approval before any new scope and before any production `server/ai/`,
prepare/send contract, provider, gate, activation, region, schema, backup, or
dependency change.

- Show the complete exact outbound payload and require fresh approval for each
  request. Never treat its digest as authorization.
- Reuse the immutable M1–M8 disclosures in
  `src/features/ai/disclosures.ts` and `docs/AI_PLAN.md` §8.2; never change,
  shorten, reorder, or hide their wording.
- Never send notes, other materials, module/topic metadata, or hidden context.
  Never persist AI prompts, outputs, answers, references, scores, attempts, or
  history in IndexedDB, application storage, backups, logs, or URLs.
- Guided-recall attempts are ordinary user-authored notes, not AI content.
  Save them only through the existing note service after explicit Save or
  confirmed Finish; link to the material where possible and never send them to
  AI.
- Keep AI state in memory. A refresh or route change clears it. Fallbacks make
  zero `fetch` calls.
- Tests use injected stubs or in-process fakes only; never contact Google or
  enable real dispatch.
- Do not add a provider endpoint, key lookup, HTTP client, activation path,
  network destination, backend, telemetry, or background/retry request.
- Preserve schema v7/eight stores, backup v2/v1, and `public/sw.js`'s
  same-origin asset boundary. Never delete user data or execute/render imported
  HTML; keep provider text inert.

## Verification and reporting

Run from the repository root:

```powershell
npm run test
npm run test:server
npm run lint
npm run typecheck
npm run build
```

Add focused tests for approved changes; run relevant tests and the build. If a
test fails, report the exact failure and rerun a focused test when a known
load-related flake is suspected. Do not claim unrun checks passed.

For each approved task, report its scope, changed files and reasons, exact
commands/results, privacy and persistence checks, confirmation that provider
dispatch remains blocked, schema/backup/dependency/server changes, and
limitations. Never continue into additional work without explicit approval.
