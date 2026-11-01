# Test plan

## Phase 0 checks

- Verify the dashboard and all eight workspace routes render.
- Verify sidebar navigation changes routes and exposes the active route.
- Verify an unknown route provides a path back to the dashboard.
- Verify loading, empty, error, and confirmation UI states are accessible and
  behave as expected.
- Verify strict TypeScript checking, linting, and a production build.
- Manually review the sidebar/top bar at narrow and wide viewport sizes and
  check both appearance themes.

## Later milestones

Each feature milestone must add focused tests for its behavior, validation,
empty/error states, and relevant accessibility. Persistence milestones must
also test migrations, reload behavior, and data preservation on failures.
Import/viewer milestones must test that imported HTML and JavaScript are never
executed. Run the relevant test suite and production build before considering
each milestone complete.

## Phase 1 module checks

- Create a module and verify every entered field is persisted in IndexedDB.
- Edit a module and verify its ID and creation timestamp remain stable while
  its update timestamp changes.
- Reject blank names/codes, invalid accent colors, oversized fields, and
  case-insensitive duplicate module codes without writing a record.
- Archive a module, verify it leaves the active filter, then restore it.
- Delete a module only after explicit confirmation.
- Search module names, codes, lecturer, semester, and academic year; filter by
  semester and active/archived status.
- Open a module detail by stable ID and verify the record survives a page
  refresh.
- Verify the modules page reports IndexedDB errors and offers retry without
  clearing existing data.

  ## Phase 2 topic and material checks

  - Upgrade a version 1 database and verify existing module records remain
    available under version 2.
  - Create, describe, rename, and reorder topics; verify ordering and persistence
    after reopening the database.
  - Import multiple files through both the picker and drag-and-drop, including two
    files with the same filename, and verify distinct material IDs and original
    bytes.
  - Import with no module/topic, and with a valid module/topic; verify
    relationships and unassigned material support.
  - Assign, reassign, and unassign materials; reject a topic from another module.
  - Verify tags are trimmed/deduplicated, and favorite and study status persist.
  - Force an IndexedDB quota/write failure after the first store write and verify
    the transaction leaves neither metadata nor file bytes.
  - Verify each input file has an individual success/failure result and that one
    failed file does not roll back other successfully imported files.
  - Confirm import treats file content as bytes only; it never executes it or sends
    it to a server.

## Phase 3 local viewer checks

- Upgrade a version 2 database to version 3 and verify existing module, material,
    and file-byte records remain available.
- Open a material and verify metadata and original bytes load independently and
    `lastOpenedAt` is persisted without changing `updatedAt`.
- Verify PDF loading, page navigation, zoom, fit-width, and a clear error for
    malformed PDF bytes.
- Verify common raster image formats show a preview and damaged images report
    an error with an original download option.
- Verify TXT, Markdown, code, JSON, CSS, and HTML previews remain inert;
    Markdown raw HTML and imported HTML never create live elements.
- Verify DOCX formatting, PPTX slide parsing/navigation, and XLSX worksheet
    parsing/selection with local Open XML fixtures and malformed-file errors.
- Verify text search reports matches in supported documents and the original
    file remains downloadable from every viewer.
- Navigate between materials assigned to the same topic and verify changing
    files releases the prior viewer resources and records the new open timestamp.
- Verify object URLs and PDF render/document resources are cleaned up on switch
    and unmount.

## Backup, recovery, and storage checks

- Export a full backup and restore it into a fresh IndexedDB database; compare
    module/topic/material relationships and byte-for-byte original-file contents.
- Export and restore a module backup and verify it includes that module's
    topics, assigned materials, and original bytes.
- Reject malformed archives, unsupported versions, missing file entries,
    mismatched sizes, broken references, duplicate IDs, and conflicting module
    codes before mutating any record.
- Reject ZIP archives whose declared expansion exceeds limits before inflation,
    and reject entries with invalid CRCs before restoring their contents.
- Simulate a write/quota failure during restore and verify the Dexie transaction
    rolls back without removing previously stored records.
- Verify merge leaves existing records intact and replace requires confirmation.
- Verify Settings accurately reports estimate/persistence API support and
    handles denied or unsupported persistent-storage requests.
- Verify full export fails explicitly when stored bytes are missing; no material
    is silently omitted from a backup.
- Export and restore an empty backup and a populated backup containing every
    record table, appearance setting, and original file; compare IDs, links, and
    byte contents.
- Restore a supported v1 archive and verify absent newer record collections are
    migrated as empty; reject unknown future versions and broken cross-record links
    before the existing database changes.
- Verify replace and merge preview counts, archive/file sizes, and all-record
    success summaries; ensure transaction errors roll back records in every store.
- Verify the production service worker's cache allowlist includes only the app
    shell and same-origin static assets, with no material or IndexedDB content.
- Manually open the built app, go offline, and verify navigation and static app
    assets still load; do not treat source-level checks as offline verification.

## Phase 4 notes checks

- Upgrade a version 3 database and verify module, topic, material, and original
    file records are preserved while the notes store is added.
- Create, edit, reopen, search, pin, tag, and delete notes; verify changes
    persist in IndexedDB.
- Save rapid successive edits and verify the latest Markdown source wins,
    including while changing note routes.
- Validate module/topic/material/task links against local records.
- Delete a linked module/topic/material and verify the note remains intact with
    its stale link cleared in the same transaction.
- Preview Markdown containing raw HTML and unsafe URLs; verify no script or
    live imported element executes and remote images are omitted.
- Simulate storage failure and verify a clear Save failed state retains the
    editable content and offers retry.

## Phase 5 task checks

- Upgrade a version 4 database and verify all existing records remain while
    the tasks store is added.
- Create, edit, and delete tasks with optional module/topic/material links;
    reject stale or mismatched links and preserve tasks when linked records are
    removed.
- Validate task titles, priorities, statuses, types, tags, and optional due
    date/time values; allow tasks with no due date.
- Verify search, module/type/status/date filters, and due-date/priority/update
    sorting against stored tasks.
- Verify overdue and upcoming indicators, and ensure the dashboard shows only
    actual upcoming tasks that are not completed or submitted.
- Mark a task complete, reopen it, and verify `completedAt` is set and cleared
    appropriately. Confirm task deletion and verify linked note content remains.

## Phase 6 search and dashboard checks

- Search module names/codes, topic titles/descriptions, material titles,
    filenames/tags, note titles/Markdown/tags, and task titles/descriptions.
- Verify category groups and category filters return only matching record types
    with links to the relevant local views.
- Verify a metadata search never reads the stored file-byte table.
- Verify empty query, no matches, loading, and IndexedDB error states.
- With an empty database, verify the dashboard reports no active modules,
    recent materials, or upcoming commitments and displays zero completion counts.
- Populate module/material/task records and verify active-module counts, recent
    material ordering, upcoming task exclusions, and completion summaries match
    actual persisted records (including no fabricated progress).

## Phase 7 calendar and study-session checks

- Upgrade a version 5 database and verify modules, topics, materials, notes,
    tasks, and file bytes remain intact when the v6 session store is added.
- Create, read, edit, complete, skip, and delete sessions; verify stable IDs,
    timestamps, duration validation, and IndexedDB persistence after reopening.
- Reject missing modules, invalid topic/module relationships, malformed local
    date-times, and nonexistent spring-forward times without writing records.
- Verify local date-time round trips, month/year grid boundaries, and the chosen
    behavior for ambiguous fall-back times.
- Verify Calendar month and agenda views include dated tasks and study sessions,
    and module and item-type filters return only matching records.
- Verify Calendar has no session-editing controls; selecting a session opens its
    record in the separate Study planner area.
- Verify Study planner creates, edits, completes, skips, and deletes sessions;
    session material links open the material viewer and session changes persist.
- Verify the dashboard includes only real future tasks and planned sessions,
    with completion counts derived from persisted records.

## Phase 8 guided recall checks

- Verify the planner offers guided recall only for a planned session linked to
    material and routes to the source linked to that exact session.
- Verify missing sessions/materials/files, unsupported formats, empty text,
    invalid text bytes, and extractor errors produce clear errors without
    changing session or material records.
- Verify the existing extractor is used locally and the full extracted text
    remains hidden until explicit reveal; after reveal, verify all extracted
    text appears in its original extracted order and the recall editor remains
    visible for comparison.
- Verify keyboard reveal, labels, live save status, error announcements,
    responsive scrolling, and the explicit Finish confirmation.
- Verify an unsaved attempt is not persisted during ordinary typing, source
    reveal, or navigation; navigation/remount clears unsaved editor state.
- Verify explicit save creates one ordinary note tagged for recall and linked
    to the session's material; repeated saves update the same note, not a second
    record. No study-session relation is added to the note schema.
- Simulate note-save failure and verify no success status, no orphan note, and
    a successful retry. If note saving fails during Finish, verify the session
    remains planned.
- Verify Finish saves a changed attempt before completing only the selected
    session, accepts only a whole non-negative actual duration, and prevents
    duplicate completion calls. Cancel, navigation, elapsed time, reveal, and
    saving alone never complete a session.
- Verify the recall attempt is ordinary user-authored note data (and therefore
    included in ordinary note backup/export behavior), never AI prompt/output
    data; verify the feature makes no AI or external network request.
- Rerun existing note, material, session, calendar, backup, import, viewer,
    summary, quiz, and Q&A tests; confirm Dexie v7/eight stores and backup
    formats v2/v1 remain unchanged.

## Optional AI feature checks

**Status: Phases 1–5 implemented in the current working tree; Phase 3 and
Phase 4 owner acceptance remains pending.** Phase 5 adds mocked provider,
server configuration, secret storage, and first-launch/Settings checks.

**Owner-reported Google clarification (2026-11-02):** the owner reports that
Google confirmed the intended personal coursework use. No written response was
available in the project files. Record this as a limited report only; do not
quote it or claim broader approval. The official terms remain documented.

**Current verification (local workspace, not independent verification):** on
**2026-11-02**, the first full `npm run test` run had two timing-sensitive
failures in the known `NotesPage` and `OfficePreview` tests. Both passed when
rerun directly. After the loopback-boundary fix, the full run passed
(**61 files / 357 tests**).
`npm run test:server` passed (**3 tests**); `npm run lint`,
`npm run typecheck`, `npm run build`, and `git diff --check` passed. These
results are for this working copy and do not verify live provider behaviour.
The Phase 5 production-browser check confirmed the optional setup panel does
not block Materials or Settings navigation, M1–M8 remain visible, Settings
reports no saved key, and browser localStorage/sessionStorage are empty. The
Continue action was not clicked, to avoid persisting a local dismissal state.
The later security hardening verifies both the actual listener and the request
peer are loopback before Host/Origin checks or pipeline work.
Earlier isolated loopback browser checks covered core navigation, local
material import/view, Phase 2–3 local fallbacks, guided-recall flows, and
backup merge preservation; no external provider request occurred.

The optional AI proxy is off by default and loopback-only. Every automated
provider/configuration check uses an injected in-process fake or mocked fetch:
**a test must never contact Google** or use a real API key.

The server checks live in `server/ai/*.test.ts`. Browser checks live in
`src/features/ai/*.test.*`, `src/pages/MaterialSummaryPage.test.tsx`,
`src/pages/MaterialQuizPage.test.tsx`, `src/pages/MaterialQaPage.test.tsx`, and
the related viewer/backup tests. All run under `npm run test`.

### Phase 0 documentation checks (manual)

- Verify `docs/AI_PLAN.md`, `docs/AI_LAUNCH_CHECKLIST.md`, `README.md`,
  `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, and
  `.github/copilot-instructions.md` describe the same feature: optional, off by
  default, single user, no accounts, no telemetry, no hosted backend.
- Verify the sample gate artifact in `docs/AI_LAUNCH_CHECKLIST.md` is inert:
  `termsEligibility.status` is `unresolved` and `exposureAcknowledged` is
  `false`, so no reading of it can enable a real request. **Automated since
  Phase 1** — `server/ai/gates.test.ts` extracts the block from this document
  and asserts that it fails the gates.
- Verify the sample artifact contains no API key and no Google Cloud project
  identifier.
- Verify the artifact separates user declarations from automated verification
  evidence: there is no artifact field for test output, and no checklist
  checkbox stands in for an eligibility determination.
- Verify exactly one field is named as the source of truth for the effective
  daily request cap, and that the plan, the checklist, and the sample artifact
  all name the same field.
- Verify every provider citation in the plan was fetched from official
  documentation on the recorded date and still contains the quoted text.

### Phase 1 proxy checks (implemented)

- Verify the proxy mounts in the Vite dev server and in the preview server, and
  that the bound host is `127.0.0.1` only. — `server/ai/plugin.test.ts`,
  `server/ai/safety.test.ts`
- Verify the plugin registers both `configureServer` and
  `configurePreviewServer`, and that the preview server still reports Vite's
  own "Did you build your project?" message when `dist/` is absent (registering
  `configurePreviewServer` suppresses it, so the plugin must restore it). —
  `server/ai/plugin.test.ts`
- Verify the preview server is reachable on its dynamically assigned port when
  the preferred port is occupied. — `npm run test:server`
- Verify the mounted production route answers `not_configured` and makes no
  outbound call. — `server/ai/safety.test.ts`
- Verify no production module contains an HTTP client, a provider endpoint, or
  a credential name, and that no production module imports the test-only
  provider. — `server/ai/safety.test.ts`
- Verify a request with no API key is rejected before any upstream call and
  consumes no budget unit. — `server/ai/handler.test.ts`
- Verify the Host header and the Origin header are validated before a token is
  created or a payload is stored, and that a foreign Host or Origin is refused
  with `forbidden_origin`. — `server/ai/requestValidation.test.ts`,
  `server/ai/handler.test.ts`
- Verify input validation rejects malformed or oversized payloads before any
  upstream call. — `server/ai/requestValidation.test.ts`
- Verify the local daily cap is enforced server-side, that the counter is
  charged exactly once per dispatched request, and that pre-dispatch rejections
  consume nothing (inject a clock/counter so the reset window is deterministic).
  — `server/ai/budget.test.ts`, `server/ai/pipeline.test.ts`
- Verify a missing, malformed, unreadable, or corrupted usage counter fails
  closed with `local_limit` and is never silently reset to zero; only a
  rolled-over local day starts a fresh count. — `server/ai/budget.test.ts`
- Verify the daily cap is a local ceiling only, is not presented as a provider
  quota, and is labelled with a reset time that is not implied to match the
  provider's midnight-Pacific RPD reset. — `server/ai/budget.test.ts`
- Verify each dispatch produces exactly one upstream call and that no retry
  path exists. — `server/ai/pipeline.test.ts`
- Verify the request log line contains method, path, status, duration, byte
  counts, model, upstream status, upstream-attempted flag, error code, and gate
  verdict — and contains no request or response body, no header value, and no
  key material. — `server/ai/handler.test.ts`

### Phase 2 UI and request pipeline checks (implemented)

- Verify the exact outbound payload is displayed before sending and that the
  displayed payload matches the dispatched payload byte-for-byte. —
  `AiSummaryPage.test.tsx`, `aiClient.test.ts`, `server/ai/pipeline.test.ts`
- Verify a request cannot be sent without a fresh, explicit approval, and that
  a previous approval cannot be reused for a later request. —
  `useAiSummaryRequest.test.tsx`, `AiSummaryPage.test.tsx`,
  `server/ai/payloadStore.test.ts`
- Verify the payload digest is reported as an integrity check and is never
  presented as proof of approval or authorization. — `AiSummaryPage.test.tsx`,
  `server/ai/payloadStore.test.ts` + manual
- Verify a payload mismatch is rejected before dispatch with a deterministic
  reason and consumes no budget unit. — `useAiSummaryRequest.test.tsx`,
  `aiClient.test.ts`, `server/ai/pipeline.test.ts`
- Verify optional personal notes never appear in the dispatched payload. —
  `AiSummaryPage.test.tsx`
- Verify no AI prompt, output, or history is written to IndexedDB and that a
  backup contains no AI-related records. — `AiSummaryPage.test.tsx`,
  `BackupService.test.ts`
- Verify the local fallback path performs zero `fetch` calls of any kind and
  produces a result from in-memory extracted text only. —
  `localSummary.test.ts`, `useAiSummaryRequest.test.tsx`,
  `AiSummaryPage.test.tsx`, `MaterialSummaryPage.test.tsx`
- Verify the UI distinguishes "Not sent — reason" (pre-dispatch rejection),
  "Request failed after sending — reason" (upstream already attempted), and an
  unknown outcome. — `AiErrorNotice.test.tsx`, `AiSummaryPage.test.tsx`,
  `aiClient.test.ts`
- Verify rate limiting and quota exhaustion are reported as distinct outcomes
  and that an HTTP 429 is not assumed to mean the daily quota is exhausted. —
  `aiClient.test.ts`, `AiErrorNotice.test.tsx` (simulated proxy responses only)
- Verify a provider error and a network failure are reported as distinct
  outcomes. — `aiClient.test.ts`, `AiErrorNotice.test.tsx`
- Verify the client attempt state machine permits sending only from `review`
  with a fresh approval, never from preparation or a settled state, and that a
  new request requires a new user action. — `useAiSummaryRequest.test.tsx`
- Verify the mandatory disclosures M1–M8 are shown verbatim and cannot be
  edited, while the optional personal notes remain editable. —
  `AiSummaryPage.test.tsx`, `server/ai/phase2Docs.test.ts` + manual

### Phase 3 quiz and Q&A checks (implemented)

- Verify `quiz` and `qa` use the shared relative prepare/send routes with exact
  request keys; summary wrappers retain their Phase 2 behaviour. —
  `aiClient.test.ts`, `testing/stubAiFetch.test.ts`
- Verify quiz JSON is bounded and validated; invalid or incomplete output is
  shown as inert raw text and cannot be graded. —
  `quizOutput.test.ts`, `AiQuizPage.test.tsx`
- Verify answer checking requires every choice, locks after checking, computes
  all-or-nothing score locally, and displays explanations. —
  `AiQuizPage.test.tsx`
- Verify Q&A question validation rejects blank and over-limit questions without
  a request, and the exact `buildQaInput` template contains only selected
  material text and the entered question. —
  `buildQaInput.test.ts`, `AiQaPage.test.tsx`, `MaterialQaPage.test.tsx`
- Verify Q&A parsing requires a non-empty answer, tolerates missing or invalid
  references without inventing any, and renders valid reference strings as
  provider-reported/unverified inert text. —
  `qaOutput.test.ts`, `AiQaPage.test.tsx`
- Verify quiz and Q&A local fallbacks are deterministic, use only extracted
  source excerpts, and make zero `fetch` calls. —
  `localQuiz.test.ts`, `localQa.test.ts`, `AiQuizPage.test.tsx`,
  `AiQaPage.test.tsx`, `useAiFeatureRequest.test.tsx`
- Verify each AI surface renders the frozen M1–M8 entries before the first
  request; no AI notes, prompts, outputs, answers, scores, or references are
  written to Dexie or backups. —
  `AiQuizPage.test.tsx`, `AiQaPage.test.tsx`, `MaterialQuizPage.test.tsx`,
  `MaterialQaPage.test.tsx`, `BackupService.test.ts` + source review
- Verify supported-material viewer links route to quiz and Q&A, while
  unsupported material types do not expose AI actions. —
  `MaterialViewerPage.test.tsx`

### Requirement-to-verification map

| Requirement | Verification | Type |
| --- | --- | --- |
| Loopback-only, single-origin proxy | Proxy mounts in dev and preview; host is `127.0.0.1` | Automated (implemented — `plugin`, `safety`) |
| Dev and preview lifecycle both supported | Both Vite hooks registered; missing-build message restored | Automated (implemented — `plugin`) |
| Dynamic port handling | Preview server reachable on an assigned port when the preferred one is busy | Automated (implemented — `test:server`) |
| Real dispatch disabled by default | Missing `STUDY_HUB_AI_ENABLED=1`, key, activation, or valid gates each fail closed | Automated (implemented — `plugin`, `handler`, `pipeline`, `gates`) |
| Activation is separate from key/env configuration | Key plus env vars alone still fail closed | Automated (implemented — `handler`, `safety`) |
| Sample artifact cannot enable dispatch | Sample is extracted from the checklist doc and asserted inert | Automated (implemented — `gates`) + manual |
| Unresolved artifact eligibility blocks dispatch | Artifact with `status: "unresolved"` is rejected | Automated (implemented — `gates`) |
| Missing / malformed / stale gate | Each case yields its documented deterministic error code | Automated (implemented — `gates`) |
| Host and Origin must name the local server | A foreign Host or Origin is refused before a token or payload exists | Automated (implemented — `requestValidation`, `handler`) |
| Local usage counter fails closed | Missing, malformed, unreadable, or corrupted counter yields `local_limit` | Automated (implemented — `budget`) |
| Provider credentials and endpoint stay server-side | Source scan excludes provider endpoint and key markers from browser code; only provider module owns external fetch | Automated (implemented — `safety`) |
| Key never appears in response, logs, or plaintext file | Fake-protector tests, route tests, and source scan | Automated (implemented — `secretStore`, `handler`, `safety`) |
| Configuration endpoints reject cross-origin requests | Foreign Origin refused before secret save or model test | Automated (implemented — `handler`) |
| First-launch setup is optional and non-blocking | Continue-without-AI is remembered; app navigation remains usable | Automated (implemented — `AiConfigurationPanel.test`) |
| Key can be replaced or removed in Settings | Mocked configuration API verifies replace/remove UI actions | Automated (implemented — `AiConfigurationPanel.test`) |
| Gemini provider uses only mocked API responses in tests | One metadata check per configured model; one Interactions request; safe errors/no retry | Automated (implemented — `provider.test`) |
| Consent and acknowledgement cannot override a server-side block | Blocked gate wins over an approved request | Automated (implemented — `pipeline`, `handler`) |
| Exact payload shown before sending | Rendered payload equals the dispatched payload | Automated (implemented — `AiSummaryPage.test`, `aiClient.test`, `pipeline`) |
| Fresh explicit approval per request | Reusing an old approval is rejected | Automated (implemented — `useAiSummaryRequest.test`, `AiSummaryPage.test`, `payloadStore`, `pipeline`) |
| Only review plus fresh approval may send | Preparation and settled states cannot dispatch; no auto-send | Automated (implemented — `useAiSummaryRequest.test`) |
| Digest is an integrity check only | Digest is never accepted as approval evidence | Automated (implemented — `AiSummaryPage.test`, `payloadStore`, `pipeline`) + manual |
| Personal notes never sent | Dispatched payload contains no note field | Automated (implemented — `AiSummaryPage.test`) |
| M1–M8 immutable | Disclosures render verbatim and are not editable | Automated (implemented — `AiSummaryPage.test`, `phase2Docs.test`) + manual |
| No AI persistence | IndexedDB and backup contain no AI records | Automated (implemented — `AiSummaryPage.test`, `BackupService.test`) |
| Quiz and Q&A use the shared request contract | Only exact `feature/text` prepare and `token/digest` send bodies use same-origin routes | Automated (implemented — `aiClient.test`, `stubAiFetch.test`, `useAiFeatureRequest.test`) |
| Quiz answers remain local | Required all-or-nothing grading and locked score; no follow-up request | Automated (implemented — `AiQuizPage.test`) |
| Q&A question is validated and visible | Blank/over-limit is rejected; selected source and question appear in exact payload | Automated (implemented — `buildQaInput.test`, `AiQaPage.test`, `MaterialQaPage.test`) |
| Q&A references are not verified | String references are inert and labelled provider-reported/unverified | Automated (implemented — `qaOutput.test`, `AiQaPage.test`) |
| Quiz/Q&A fallback is local | Deterministic source excerpts; injected fetch not called | Automated (implemented — `localQuiz.test`, `localQa.test`, `AiQuizPage.test`, `AiQaPage.test`) |
| Phase 3 M1–M8 placement | All eight frozen disclosure texts render on each new page before interaction | Automated (implemented — `AiQuizPage.test`, `AiQaPage.test`, `phase2Docs.test`) |
| Provider-side handling disclosed separately | Disclosure text distinguishes the three retention mechanisms | Manual |
| At most one upstream request per action | Fake provider call count is exactly one | Automated (implemented — `pipeline`) |
| No automatic retries | Fake provider call count stays one after a failure | Automated (implemented — `pipeline`) |
| Local fallback makes zero provider requests | Fake provider call count stays zero on the fallback path | Automated (implemented — summary/quiz/Q&A local fallback tests and page tests) |
| Budget charged once, only when dispatched | Counter increments exactly once per dispatch and not on rejection | Automated (implemented — `budget`, `pipeline`) |
| Three attempt outcomes remain distinct | Pre-dispatch refusal, failed-after-sending, and unknown are labelled separately | Automated (implemented — `aiClient.test`, `AiErrorNotice.test`, `AiSummaryPage.test`) |
| Rate limit vs quota vs invalid vs provider error vs network failure | Each simulated condition yields its own error code and client wording | Automated (implemented client presentation — `aiClient.test`, `AiErrorNotice.test`; live provider classification remains unverified) |
| Local reset may differ from the provider reset | The counter window is the local calendar day and the wording says so | Automated (implemented — `budget`) + manual |
| Local cap is not a provider quota | Documentation and UI wording; no claim of provider capacity | Manual |
| No new dependency, backend, telemetry, or persistence | Dependency list and store list unchanged | Manual |
| Service worker still ignores `/api/*` | Service worker behaviour unchanged | Manual (verified by inspection — `public/sw.js` untouched) |

**Caveat:** every automated check that reaches the provider uses the fake
provider; Phase 2 UI and client checks use an injected stub fetch or the
in-process proxy. Simulated tests prove nothing about live account quota, live
availability, or live provider error behaviour, and must never be reported as if
they did.
