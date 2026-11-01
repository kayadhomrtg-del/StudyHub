# Phase 4 — local guided study and active recall

**Status:** Implemented under the owner's explicit authorization; focused and
full automated verification and isolated-origin browser testing are complete.
Owner review and acceptance are pending.

**Recommendation:** a local, material-centred guided study session connects
StudyHub's existing planner to active recall without depending on real AI
dispatch.

This is a new project milestone, not an assertion that the historical
[`PRODUCT_SPEC.md`](PRODUCT_SPEC.md) roadmap's old Phase 4 remains outstanding.
That roadmap's notes milestone is already implemented. The owner authorized
the complete Phase 4 scope and explicitly resolved the product decisions in
this document; no routine between-step approval was required.

**Binding implementation decisions from the owner:** recall attempts are saved
as ordinary material-linked notes using the existing note service; the complete
locally extracted text is revealed only after an explicit action; and session
completion requires an explicit Finish action and confirmation. These decisions
override any earlier ephemeral-attempt, single-passage, or unconfirmed-finish
defaults below. No schema or backup change was required.

## 1. Why this is the recommended next phase

StudyHub already lets a learner organize modules/topics/materials, open
materials, write local notes, track tasks, plan sessions, and see recent
materials and upcoming commitments. The study planner can link a planned
session to one material and record a goal, planned duration, status, and
optional actual duration.

The observed gap is the transition from **a scheduled session** to **a
focused learning activity**. A planner session can open its linked material,
but the current planner does not provide a session workspace or an active
recall loop. At the time this Phase 4 plan was written, the AI surfaces did not fill that
gap in production: provider dispatch was unavailable, and quiz/Q&A fallbacks
showed excerpts rather than questions or answers. Phase 5 later connected the
AI surfaces to the Gemini provider; guided recall remains separate and local.

**Owner-reported Google clarification (2026-11-02):** the owner reports that
Google confirmed the intended personal coursework use. No written response
was available in the project files. This is recorded narrowly and does not
claim broader approval or change the official terms. The clarification does
not change the local-only Phase 4 implementation.

A local guided review is therefore more valuable and lower-risk than adding
another AI surface, changing provider configuration, or persisting generated
content. It improves revision effectiveness using existing materials and
session records while preserving offline use and the provider restriction.

## 2. Current capability and boundary baseline

Verified from the current app routes, pages, services, feature code, and
tests:

- Module and topic organization; local material import, metadata, tags,
  favorites, study status, and supported local viewers.
- Markdown notes with preview, tags, pins, search, and optional record links.
- Tasks with due dates, priorities, statuses, and record links.
- Local metadata/content search, dashboard recents and upcoming tasks/sessions,
  calendar views, and study-session planning.
- Full v2 and module v1 backup workflows; database schema v7 with eight
  stores.
- Optional summary, quiz, and Q&A surfaces over locally extracted material.
  Their request flow can be exercised with injected tests, but real provider
  dispatch is impossible. Local summary is deterministic; quiz and Q&A
  fallbacks are source excerpts, not generated learning assessments.

Constraints to preserve:

- Browser-profile/origin local-first storage; no backend, account, cloud sync,
  telemetry, or remote AI service.
- Existing repository/service ownership of database access, schema v7, eight
  stores, and backup formats v2/v1.
- Bounded local text extraction and imported-file safety protections.
- No real AI provider dispatch, provider eligibility change, API key, endpoint,
  activation path, new dependency, or change to M1–M8.
- No storage of AI prompts, outputs, answers, scores, or history in Dexie,
  backups, application storage, logs, or URLs.

## 3. Feature definition and implementation

### Feature P4-A — Material-linked guided recall session

**Priority:** P1 — high user value; medium implementation effort.
**Provider dependency:** none.
**Schema/backup change:** none proposed.

| Aspect | Initial proposal (owner decisions below supersede conflicts) |
|---|---|
| User problem | A learner can schedule a study session and open a material, but the app does not guide a focused review or active-recall activity inside that session. |
| Expected benefit | Reduce context switching, encourage retrieval before rereading, and make planned study sessions more actionable without claiming that the app can grade understanding. |
| Interface and behavior | Add an explicit **Start guided recall** action to planned sessions linked to material. Open a session workspace showing the session title, goal, planned time, and selected material. Reuse bounded local extraction; keep the source hidden until the learner chooses **Reveal full source**, then display all text returned by the existing extractor in its original extracted order. Let the learner write a recall attempt, compare it with the source, and save it as an ordinary personal note. Do not score or claim correctness. Require an explicit **Finish session** action and confirmation; optionally accept actual duration. Show extraction errors and a clear return path. |
| Existing architecture to reuse | `StudyPlannerPage`, `StudySessionForm`, `StudySessionService`, `StudySessionRepository`, material services, bounded `extractMaterialText` and `materialTextSupport`, shared loading/error states, and existing session/material relationships. Use services rather than querying `moduleDatabase` in a page. Reuse the text extractor; do not add another parser or OCR path. |
| Likely new files/modules | `src/features/studySessions/studySessionSource.ts` and its tests load the session-linked material through existing services and reuse local extraction. `src/pages/StudySessionReviewPage.tsx` and its tests provide the workspace; `src/App.tsx` and `src/pages/StudyPlannerPage.tsx` provide the route and launch link. |
| Data and persistence | Save a non-empty recall attempt only after the learner explicitly saves it or confirms Finish. Use the existing note model/service and link the note to the selected material; the note model has no session relation, so no session link is invented. Repeated saves update the same note. If no attempt is entered, no recall note is created. On confirmed finish, update only existing `StudySessionRecord` fields through the service (status and optional actual duration). Do not add fields/stores/indexes; do not change backup formats. Do not auto-mark linked material complete. |
| Tests and acceptance criteria | Test eligible and unsupported/missing material handling; local extraction and passage order; keyboard operation and accessible labels/status/errors; explicit reveal/self-assessment; no scoring or answer correctness claims; zero `fetch` calls; memory reset on refresh/route remount; explicit completion updates only the selected session through the service; unrelated sessions/materials stay unchanged; existing planner/calendar/dashboard and backup tests still pass. |
| Risks | Extraction may yield little or unreadable text; long content requires bounded passage rendering. Active recall can be mistaken for grading if copy is unclear. Session completion must not imply material mastery. Reusing an AI-folder helper could create undesirable feature coupling. |
| Rollback | Remove the new route, entry action, workspace, and helper. No migration or destructive cleanup is needed. Preserve any session status/duration values already saved through existing fields; do not roll them back or delete user records. |
| Resolved decisions and remaining limitation | The owner approved the linked-material session flow, whole-source reveal, ordinary note persistence, explicit confirmed completion, and optional actual duration. Existing notes support a material link but not a study-session link; Phase 4 therefore associates the note to the material and includes the session title in the note title. |

## 4. Implemented scope and explicit non-goals

Phase 4 implements **P4-A only**: one planned session linked to one locally
readable material. It does not add a general revision queue or adaptive
scheduling.

Out of scope:

- AI-generated questions, summaries, answers, or feedback; no AI request and
  no attempt to work around blocked dispatch.
- Flashcards, spaced-repetition algorithms, learner scores, mastery estimates,
  answer history, saved recall prompts, or cross-material quiz generation.
- New database stores/fields/indexes, backup format changes, new dependencies,
  telemetry, remote services, or changes to the service worker.
- Automatic material completion, automatic session completion, or claims that
  self-assessment proves mastery.

Potential later opportunities — a review queue, saved learner-authored
flashcards, or richer progress reporting — should be separately prioritized
after observing use of the guided session. They are not implicit Phase 4 scope.

## 5. Original proposal order and actual implementation

The following numbered steps record the original proposal and are retained as
history. The owner later authorized the full scope and resolved the differing
defaults; the actual implementation order and results are recorded in §5.1.

1. **Approve product behavior and accessibility contract.** Confirm the
   decisions in P4-A, supported source types, empty/error states, keyboard and
   screen-reader behavior, and whether actual duration is user-entered. No
   code.
2. **Implement and test the session source model.** Load the selected session
   and its linked material through existing services, use bounded local
   extraction, and define deterministic passage selection. No UI workflow
   changes until tests cover missing, unsupported, empty, and oversized source
   cases.
3. **Implement the proposed recall workspace.** Add the one-material recall
   interaction with no network path. The original memory-only persistence
   default was superseded by the owner's ordinary-note decision.
4. **Integrate session launch and explicit completion.** Add the planner entry
   point and update only the selected existing session via its service. Test
   that no linked material or other session is modified and existing planner
   flows remain intact.
5. **Documentation, verification, and review.** Update architecture/test
   documentation only after behavior is implemented. Run focused tests and
   the full verification suite, perform privacy and accessibility reviews, and
   report results for owner acceptance.

### 5.1 Actual implementation order

1. **Session source loading:** resolve the selected planned session, load only
   its linked material and file bytes through existing services, then call the
   existing bounded local extractor. Missing, unsupported, empty, and failed
   sources produce clear errors; extraction warnings are shown.
2. **Recall workspace:** add a local recall editor with no source displayed
   initially, an explicit whole-source reveal, visible recall text during
   comparison, accessible controls, and no scoring or mastery claim.
3. **Ordinary note saving:** save only on explicit Save or confirmed Finish
   through the existing note service/model, link to the material, and update
   the same note for repeated saves. Note creation is atomic so a failed save
   cannot leave an empty note.
4. **Planner integration and completion:** offer guided recall only for a
   planned session with a material link. Finish requires confirmation, saves a
   changed recall attempt first, and calls the existing session status service
   once; only the selected session is changed.
5. **Documentation and verification:** update project documentation, add
   focused persistence/source/UI tests, run all automated checks, browser-test
   against a separate local origin, and prepare the acceptance report.

## 6. Original acceptance gate and actual results

The original proposed acceptance criteria below are retained for traceability;
the owner's decisions above override the original memory-only and
single-passage defaults.

Phase 4 should be accepted only if:

- A planned session linked to one supported material can open a usable guided
  recall workspace; invalid or unavailable sources fail clearly and do not
  block the existing planner.
- The recall interaction works offline and makes zero network/fetch calls.
- Unsaved recall text and reveal state remain in memory. An explicit Save or
  confirmed Finish stores the learner-authored attempt only as an ordinary
  material-linked note, which participates in normal note backup/export and is
  never treated as AI content.
- Only an explicit user completion action updates the selected session record;
  no material completion or mastery state is inferred.
- Existing session, calendar, material, note, task, backup, import, and viewer
  behavior remains intact.
- Keyboard, labels, focus, announcements, contrast, and error states have
  automated coverage plus a manual accessibility check.
- Schema v7/eight stores, backup v2/v1, dependencies, service-worker scope,
  provider gates, activation, and M1–M8 remain unchanged.
- The owner has reviewed the final diff and explicitly accepted it.

### 6.1 Actual implementation acceptance status

| Requirement | Result |
|---|---|
| Planned session opens only its associated local material | Verified by source-loader and planner tests |
| Unsupported, missing, empty, and failed extraction are reported | Verified by loader and UI tests |
| Full extracted text is absent from the UI until reveal and is completely displayed afterward | Verified by keyboard reveal test and source text assertion |
| Recall remains visible during comparison; no score or mastery claim | Verified by workspace implementation and UI tests |
| Explicit Save creates an ordinary material-linked note; repeat saves update that note | Verified by note/service and UI persistence tests |
| Failed note save does not report success, leave an orphan, or complete the session; retry works | Verified by atomic service and workspace retry tests |
| Finish requires explicit confirmation, saves unsaved recall first, and updates only the selected planned session | Verified by workspace tests |
| Navigation clears unsaved attempt state; no AI request or external request is added | Verified by remount and zero-fetch source tests plus source review |
| Schema v7/eight stores, backup v2/v1, dependencies, service worker, and AI provider controls remain unchanged | Verified by source/diff review and full regression checks |

## 7. Major risks and mitigations

| Risk | Mitigation |
|---|---|
| Provider-blocked AI is mistaken for a working generated quiz | Keep Phase 4 entirely local; label excerpts as source material and never present them as generated questions or verified answers. |
| Recall responses are saved without the learner's intent | Save only on explicit Save or confirmed Finish; show unsaved state, use ordinary notes, and test failure/retry and idempotent updates. |
| Session completion is confused with learning mastery | Require explicit completion; do not auto-complete materials, assign scores, or claim mastery. |
| Large/unsupported source harms responsiveness | Reuse bounded extraction, render the full extracted result in a scrollable region only after reveal, surface extractor truncation notes, and fail visibly on extraction errors. |
| Review feature becomes coupled to AI internals | Reuse pure extraction only; extract a genuinely shared helper if needed rather than adding AI request code or duplicating parsers. |
| Existing user session data is damaged | Update through `StudySessionService`; test targeted record changes; no schema migration, deletion, or backup-format change. |

## 8. Approval and status

The owner explicitly authorized full Phase 4 implementation and resolved the
product defaults that differ from the original proposal. Implementation is
complete pending final owner review and acceptance. The official terms
classification for the owner's intended personal use remains unresolved; no
Phase 4 step enables, simulates, or requests real provider dispatch.
