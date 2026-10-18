# StudyHub — Project Understanding Report (Read-Only Audit)

**Audit mode:** READ-ONLY. No files were edited, created, deleted, renamed, installed, migrated, committed, pushed, or deployed during the investigation itself. This document is saved in a separate, explicitly requested step.

**Directory inspected:** `C:\Users\amrak\Desktop\Code\Website` — full file access confirmed. This is the StudyHub repository (`origin → https://github.com/kayadhomrtg-del/StudyHub.git`), branch `main`, in sync with `origin/main`, **clean working tree before and after the audit**.

**Evidence convention:** **[V]** = verified by reading code or running a command. **[H]** = hypothesis, not proven. Commands executed during the audit are listed with their exact observed output summaries.

---

## A. Architecture overview and startup

**[V]** Stack (from `package.json`): React 19.1, TypeScript ~5.8.3 (strict), Vite 6.4, Tailwind CSS 4.3 (`@tailwindcss/vite`), Dexie 4.4 (IndexedDB), `react-router-dom` 7.8, `pdfjs-dist` 4.10.38 (pinned exact), `docx-preview`, `pptx-viewer`, `jszip`, `dompurify`, `highlight.js`, `react-markdown` + `remark-gfm`, `lucide-react`. App version in `package.json` is `0.1.0` while git history says "Release 1.0.1" — version metadata mismatch **[V]**.

Startup flow **[V]**:

1. `index.html` → `src/main.tsx`: registers `/sw.js` **only in production** (`import.meta.env.PROD`), wraps `<App/>` in `ThemeProvider` + `StrictMode`.
2. `src/App.tsx`: `BrowserRouter` → `AppRoutes` → single layout route `AppShell` (sidebar/topbar) with dashboard eager-loaded and all other pages `React.lazy()` + `Suspense`.
3. Data layer: one Dexie singleton `moduleDatabase` (`src/features/modules/moduleDatabase.ts`). Every feature has `*Repository` (raw Dexie transactions) → `*Service` (validation/business rules) → pages/components. Singleton services are instantiated at module scope (e.g., `materialService`, `moduleService`).

Routing **[V]**: `/`, `/modules`, `/modules/:moduleId`, `/materials`, `/materials/:materialId`, `/notes/:noteId?`, `/tasks`, `/search`, `/calendar`, `/planner`, `/settings`, `*` → NotFound. `src/pages/workspacePages.ts` defines shared page metadata; `App.tsx` filters it to avoid route collisions.

## B. Directory / file map

| Area | Path | Role |
|---|---|---|
| Entry | `src/main.tsx`, `src/App.tsx` | Bootstrap, SW registration, routes |
| Layout | `src/components/layout/{AppShell,Sidebar,TopBar}.tsx` | Responsive chrome |
| Theme | `src/components/theme/*` | Light/dark, persisted via settings service |
| Shared UI | `src/components/ui/{StatePanel,ConfirmationDialog,useModalFocus}` | Loading/empty/error states, focus-trapped modal |
| DB core | `src/features/modules/moduleDatabase.ts` | Dexie schema v1–v7 (singleton) |
| Features | `src/features/{modules,topics,materials,notes,tasks,studySessions,search,settings,backup,archive,navigation}` | Each follows type → Repository → Service (+ tests) |
| Previewers | `src/features/materials/{PdfViewer,OfficePreview,SpreadsheetParser,MarkdownPreviewContent,pdfLoader}.tsx` | Local document rendering |
| ZIP safety | `src/features/archive/zipSafety.ts` | Pre-inflation ZIP central-directory validation |
| Pages | `src/pages/*` (14 pages) | Route-level components, all tested except `ModuleDetailPage`, `WorkspacePage`, `NotFoundPage` |
| Service worker | `public/sw.js` | App-shell/static-asset cache `college-study-hub-shell-v3` |
| Scripts | `scripts/*.ps1`, `serve-production.mjs`, `serve-production-check.mjs` | Windows setup/startup, loopback-only prod server |
| Docs | `docs/{ARCHITECTURE,DATA_MODEL,PRODUCT_SPEC,TEST_PLAN}.md` | Detailed; spot-checked claims matched code |
| CI | `.github/workflows/ci.yml` | Node 22.x/24.x: `npm ci` → test → test:server → lint → typecheck → build |
| Existing AI rules | `.github/copilot-instructions.md` | 12 rules; overlaps onboarding §5 |

## C. Database model and data-safety implications

**[V]** `ModuleDatabase` (name `"CollegeStudyHub"`), 8 stores, schema **version 7**:

| Store | Indexes (v7) | Added |
|---|---|---|
| `modules` | `id, &code (unique), name, semester, academicYear, isArchived, updatedAt` | v1 |
| `topics` | `id, moduleId, sortOrder, updatedAt` | v2 |
| `materials` | `id, title, originalFileName, moduleId, topicId, *tags, status, isFavorite, createdAt, updatedAt, lastOpenedAt` | v2/v3 |
| `storedFiles` | `id` (key = material id; `{id, bytes: ArrayBuffer}`) | v2 |
| `notes` | `id, title, *tags, isPinned, updatedAt` | v4 |
| `tasks` | `id, moduleId, topicId, dueAt, priority, status, type, *linkedMaterialIds, *tags, createdAt, updatedAt` | v5 |
| `studySessions` | `id, moduleId, topicId, materialId, plannedStart, status, createdAt, updatedAt` | v6 |
| `appSettings` | `id` (appearance theme) | v7 |

Data-safety facts **[V]**:

- **Migrations:** v2 has an upgrade hook (`isArchived ??= false`); v3–v7 are index/store additions only — Dexie does not rewrite records. Matches `docs/DATA_MODEL.md`.
- **Referential integrity is application-level, enforced in transactions:** `MaterialRepository.importFile`/`updateDetails` verify module/topic ownership; `MaterialRepository.delete` removes bytes and clears note/task/session links in one `rw` transaction; `ModuleRepository.delete` deletes topics and *clears* (never deletes) module/topic references from materials, notes, tasks, sessions — deliberately non-destructive to content.
- **Import is atomic per file:** metadata + bytes in one transaction; quota failure rolls back both (`MaterialService.importFiles` + `isQuotaExceeded`).
- **Backup** (`src/features/backup/BackupService.ts`, 687 lines): full backups are **format v2** (manifest.json + records.json + `files/<id>.bin` per material, with counts/CRC/size cross-checks); module backups remain **v1** and merge-only. Restore: full ZIP validation (`inspectZipArchive` before inflation, JSZip `checkCRC32: true`, `validateRecords` deep schema/relationship/duplicate-ID validation) happens **before** any write; then one Dexie `rw` transaction does clear (replace) or collision-checked `bulkAdd` (merge). Any mid-write failure rolls back. Replace requires an explicit confirmation dialog (`SettingsPage.tsx`).
- **Risk [H, medium]:** `createFullBackup` throws if `storedFiles` contains *any* record not referenced by a material (orphan). By design ("Nothing was omitted"), but there is no UI to repair orphans → a corrupted store would block **all** exports with no recovery path other than manual DB surgery.
- Ports are origins: README correctly warns that a changed dev/preview port = a different IndexedDB.

## D. Feature inventory

| Feature | Status | Evidence |
|---|---|---|
| Dashboard | **Verified implemented** | `DashboardPage.tsx` + 2 tests; derives counts from live records |
| Modules CRUD/archive/delete | **Verified implemented** | `ModuleService`/`ModuleRepository`, 10 tests + page tests |
| Topics (create/rename/reorder) | **Verified implemented** | `ModuleTopics.tsx`, TopicService tests |
| Material import (picker + drag-drop, tags, assignment) | **Verified implemented** | `FileImportPanel.tsx`, 3 tests incl. quota-rollback |
| Material viewer + download + status/favorite | **Verified implemented** | `MaterialViewerPage.tsx`, 7 tests |
| PDF preview, page nav, zoom, fit-width, text search | **Verified implemented** (runtime rendering **needs runtime testing**) | `PdfViewer.tsx` (2 tests), search capped at 1,000 pages **[V]** |
| DOCX preview (sanitized, sandboxed iframe + CSP) | **Verified implemented** | `OfficePreview.tsx`; tests assert `sandbox=""` |
| PPTX preview (slide nav + text search) | **Partially verified** — implemented, but renders into the **live document** (not an iframe) | `SlidePreview` in `OfficePreview.tsx`; **needs runtime/malicious-file testing** |
| XLSX preview (≤100 sheets, 500×40 cells, path traversal guarded) | **Verified implemented** | `SpreadsheetParser.ts`, 2 tests |
| Markdown preview (raw HTML off, remote images omitted) | **Verified implemented** | `MarkdownPreviewContent.tsx` (react-markdown default skips raw HTML) |
| Code preview (highlight.js, lazy languages) | **Verified implemented** | `OfficePreview.tsx` `codeLanguages` |
| Notes (autosave serialization, links, tags, pin) | **Verified implemented** | `NoteService.saveDraft` per-note save queue, 5+3 tests |
| Tasks (filters, due states, links) | **Verified implemented** | `taskFilters.ts`, 9+2 tests |
| Search (metadata-only) | **Verified implemented** | `SearchService.ts` — never touches `storedFiles` **[V]** |
| Calendar (tasks + sessions, agenda) | **Verified implemented** (UI **needs runtime testing**) | `CalendarPage.tsx`, 1 test |
| Study planner | **Verified implemented** | `StudyPlannerPage.tsx`, `StudySessionService`, 6 tests |
| Settings: full/module backup, merge/replace, storage estimate, persistence request | **Verified implemented** | `SettingsPage.tsx`, `BackupService.test.ts` (14 tests) |
| Backup v1→v2 migration on import | **Verified implemented** | `parseBackup(..., legacyVersion)` in `BackupService.ts` |
| Service worker (shell + hashed assets, offline nav fallback) | **Verified implemented at source level** — offline behavior **needs runtime testing** | `public/sw.js`; `docs` claim a manual offline check (not reproducible by this audit) |
| Windows startup scripts | **Present, not audited in detail** | `scripts/*.ps1` — not read fully |
| Screenshots, LICENSE | **Not found** (documented as absent in README) | README §Screenshots, §License |
| Error boundary anywhere | **Not found** | grep for `ErrorBoundary`/`componentDidCatch` → 0 matches |

### Quality checks — exact commands and observed results

| Command | Result observed |
|---|---|
| `npm run test` (run 1, in parallel with lint+typecheck) | **2 failed / 112 passed** — one was `OfficePreview.test.tsx:61` `findByRole("heading", { name: "Course notes" })` timeout-type failure (25.7 s run) |
| `npm run test` (4 subsequent sequential runs) | **114/114 passed each** (7.2–7.4 s) |
| `npm run lint` | **pass**, exit 0 |
| `npm run typecheck` | **pass**, exit 0 |
| `npm run test:server` | **3/3 pass**, exit 0 |
| `npm run build` | **NOT RUN** — the read-only audit rules forbade creating files (`dist/`). Requires explicit approval before running. |

**Test flakiness is a preserved, observed fact:** the suite failed 2/114 under machine load (timeout-type failures), then passed 114/114 on four consecutive clean runs. No claim of "all tests always pass" is made. CI status on GitHub was not queried and is unverified.

## E. Key relationships and data flows

- **Import:** `FileImportPanel` → `materialService.importFiles` (reads bytes via FileReader) → `MaterialRepository.importFile` (single transaction: validate assignment → `storedFiles.add` + `materials.add`) → per-file success/failure results in UI.
- **View:** `MaterialViewerPage` loads metadata + bytes **independently** → `markOpened` (updates `lastOpenedAt` only) → `MaterialFileViewer.getViewerKind` dispatches to Pdf/Office/ImageViewer by extension/MIME. Office + text both route through `OfficePreview` (limits: 100 MiB office / 8 MiB text / 2M chars).
- **Delete cascade (material):** bytes + metadata deleted; note links, task `linkedMaterialIds`, session `materialId` cleared — notes/tasks/sessions themselves preserved.
- **Delete cascade (module):** topics deleted; materials/tasks/sessions unassigned; note links cleared; module record deleted — all one transaction (`ModuleRepository.delete`).
- **Backup:** Settings or `ModuleDetailPage` → `BackupService` (both instantiate it directly from `moduleDatabase` — the only pages touching the DB singleton, and only for backup).
- **Search:** `SearchRepository.getCorpus` (metadata tables only) → in-memory lowercase `includes` matching.

## F. Current quality checks and which ones have actually been run

Tooling exists and is wired into CI exactly as README describes **[V]** (`.github/workflows/ci.yml`: test, test:server, lint, typecheck, build on Node 22.x/24.x).

**Actually run during this audit:** `npm run test` (5 runs — see table in §D), `npm run lint`, `npm run typecheck`, `npm run test:server`.

**Not run:** `npm run build` (deliberately withheld under read-only rules), and CI itself was not triggered.

No coverage tooling is configured. `tsconfig.app.json` is strict with `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.

## G. Findings, ranked (severity / confidence)

1. **Medium / High — Test flakiness under load.** Observed 2/114 failing (timeout in `findByRole`) when the suite ran alongside other CPU load; 4 clean runs after. CI on shared runners may hit this too.
2. **Medium / High — No React error boundary.** A failed lazy-chunk import (e.g., preview server restarted mid-session) or any render throw blanks the whole app; `Suspense` has no error counterpart (`src/App.tsx`).
3. **Medium / High — PPTX renders untrusted content into the live document**, unlike DOCX (sandboxed iframe + CSP + DOMPurify). Spot-check of the minified `pptx-viewer` bundle shows run text is escaped before `innerHTML` (escaping helper replaces `&<>"'`), but every insertion path was not proven escaped — **[H]** residual XSS risk; needs a malicious-fixture test. Dependency `pptx-viewer@0.2.2` is young.
4. **Medium / Medium — Backup export can hard-fail on orphaned `storedFiles`** records with no in-app repair path (see §C).
5. **Low–Medium / High — PDF search has no debounce and no in-loop cancellation** (`PdfViewer.tsx` — the page loop only checks `active` after finishing): each keystroke on a 1,000-page PDF kicks off overlapping full-document scans — wasted CPU, results discarded.
6. **Low / High — `TextSearch.searchCount` splits up to 2M chars per keystroke** in `OfficePreview.tsx` — same unbounded-work pattern.
7. **Low / High — `MaterialViewerPage` loads *all* material metadata** (`materialService.getAll()`) on every open just for topic neighbors — O(library) per view.
8. **Low / Medium — SW install failures are only `console.error`'d**; users get no in-app "offline unavailable" signal. Assets hashed into `SHELL_CACHE` are never evicted until `sw.js` byte content changes (cache grows across HTML-only deploys).
9. **Low / Medium — Non-UTF-8 text files** (`TextDecoder(..., { fatal: true })`) fail with a generic preview error rather than a fallback decode.
10. **Info / High — Version drift:** `package.json` says `0.1.0` vs git "Release 1.0.1"; `__APP_VERSION__` lands in backup manifests, so backups claim v0.1.0.
11. **Accessibility (spot-check, Low–Medium confidence):** generally good — labeled inputs, `aria-live` regions, focus-trapped `useModalFocus`, `aria-pressed` toggles. Not systematically audited; the PDF canvas has an `aria-label` but no text alternative for page content.

**No security issues found** in the DOCX/XLSX/Markdown/text paths — those are hardened deliberately (DOMPurify + `sandbox=""` + inline CSP + inert `DOMParser` XML + ZIP path-traversal/zip-bomb checks in `zipSafety.ts`).

## H. Missing information / areas needing further inspection

- **Runtime browser behavior:** real PDF/DOCX/PPTX/XLSX rendering, offline service-worker behavior, responsive layouts, both themes — none reproducible in this audit.
- `scripts/*.ps1` (Windows startup suite) read only at a glance; `serve-production.mjs` partially reviewed.
- `docs/PRODUCT_SPEC.md` (686 lines) not read line-by-line; `docs/TEST_PLAN.md` read in full.
- Not every page component was read exhaustively (Notes/Tasks/Calendar/Planner/Dashboard pages verified via tests + service tracing rather than full reads).
- `pptx-viewer` escaping not fully proven (minified bundle).
- Whether CI is currently green on GitHub was not queried.

## I. Rules a future AI assistant must follow when modifying this project

1. **Never touch the Dexie schema without necessity.** If unavoidable: bump the version, add only additive changes, write an upgrade hook that preserves records, and prove it with a migration test. Never `clear()`/recreate the database to "fix" an error.
2. **All DB access goes through the feature's Repository/Service** — pages/components never query `moduleDatabase` directly (sole precedent: direct `BackupService` construction, which is acceptable).
3. **Preserve transactional integrity**: multi-table writes in one Dexie transaction; link-clearing (never record-deleting) behavior on cascade deletes; per-file atomicity on import.
4. **Treat imported files as hostile.** Keep DOCX in the sandboxed iframe + CSP + DOMPurify; keep text/markdown inert; run `inspectZipArchive` before any ZIP inflation; don't render untrusted HTML into the live document (and consider extending that to PPTX).
5. **Backup compatibility:** full exports are v2, module exports are v1/merge-only; restore must keep validating fully *before* writing and must remain rollback-safe. Backups must never silently omit a material.
6. **Smallest coherent change**; read the existing test for the area first; add/update a focused test; run `test`, `lint`, `typecheck` (and `build` when allowed) and report exact results — including flakiness. Never claim a pass you didn't watch.
7. **No backend, no accounts, no telemetry, no new runtime network dependencies.** Don't bump dependency versions without cause (`pdfjs-dist` is deliberately pinned exact).
8. **Git:** no commits/pushes/deletes/reverts without explicit request; always inspect `git status` and the diff; never discard uncommitted work.
9. **Report unrelated bugs separately** instead of expanding scope.
10. **Data caution:** never clear browser-origin data, never widen `.gitignore` protections for study files, keep `public/sw.js` restricted to shell/static assets.

---

## Proposed AGENTS.md — Not Yet Approved

> **Status: PROPOSAL ONLY. `AGENTS.md` has NOT been created or modified.** This section preserves the proposed content for review. It must not be treated as an existing file. Approval is required before creating it. The proposal suggests a short file (~60 lines), not a copy of the onboarding prompt.

```markdown
# AGENTS.md — StudyHub (College Study Hub)

Local-first college study workspace. React 19 + TypeScript + Vite 6 + Tailwind 4 +
Dexie/IndexedDB. No backend, accounts, cloud sync, analytics, or runtime CDNs.
Data lives only in the browser's IndexedDB for the current origin.

## Commands
- `npm run test` · `npm run test:server` · `npm run lint` · `npm run typecheck` · `npm run build`
- Tests can be flaky under machine load (observed `findByRole` timeouts); re-run before concluding failure.
- CI (`.github/workflows/ci.yml`) runs all of the above on Node 22.x and 24.x.

## Architecture (verified)
- Entry: `src/main.tsx` → `src/App.tsx` (React Router, lazy pages, `AppShell` layout).
- Data: singleton Dexie DB `src/features/modules/moduleDatabase.ts`, schema **v7**,
  8 stores: modules, topics, materials, storedFiles, notes, tasks, studySessions, appSettings.
- Pattern per feature: `type.ts` → `*Repository.ts` (transactions) → `*Service.ts` (validation)
  → pages/components. Pages must not query `moduleDatabase` directly
  (exception: constructing `BackupService`, used by Settings and ModuleDetail).
- Materials: metadata (`materials`) separate from bytes (`storedFiles`, keyed by material id);
  import writes both in ONE transaction; viewer loads them independently.
- Backups (`src/features/backup/BackupService.ts`): full = ZIP format **v2**
  (manifest.json, records.json, files/<id>.bin); module = **v1**, merge-only.
  Everything is validated BEFORE writing; restore is one transaction (replace clears all
  8 stores; merge aborts on ID/code collisions).

## Invariants — never break these
1. Do not add/remove/rename stores or indexes without incrementing the Dexie version and
   proving an additive, record-preserving migration. Never clear/recreate the DB to fix errors.
2. Cascade deletes CLEAR links from related records (notes/tasks/sessions/materials);
   they never delete unrelated user content.
3. Imported files are untrusted bytes: DOCX runs in `sandbox=""` iframe with CSP + DOMPurify;
   markdown/text/code render inert; run `inspectZipArchive` before inflating any ZIP.
   Do not render untrusted HTML into the live document.
4. Backups must never silently omit a material; keep v1/v2 read compatibility and
   validate-before-write restore semantics.
5. No backend/network/telemetry additions; keep `public/sw.js` limited to app-shell and
   same-origin hashed assets.
6. Keep changes minimal and scoped; reuse existing components/hooks/utils; do not bump
   dependency versions without a clear reason (`pdfjs-dist` is pinned exactly on purpose).

## Verification
- Read the existing test for the touched area first; add/update focused tests;
  run test, lint, typecheck, and (when permitted) build; report exact commands and outcomes.
- Git: never commit, push, revert, or discard user changes without explicit request.
  Check `git status` before and after; inspect the full diff.
```

**Optional extra doc:** `docs/ARCHITECTURE.md` + `docs/DATA_MODEL.md` already cover the project map well (and matched this audit). A second architecture document is **not** recommended; the only gap — a one-page data-safety checklist for migrations — is covered by the invariants in section I above.

---

## Audit summary

- Repository inspected read-only at `C:\Users\amrak\Desktop\Code\Website`; findings in sections A–I above.
- Commands run during the audit: `npm run test` (×5: one flaky run with 2 failures under machine load, then 114/114 four times), `npm run lint` (pass), `npm run typecheck` (pass), `npm run test:server` (3/3 pass).
- **`npm run build` was NOT run.**
- No application source code, dependencies, database schema, or lockfiles were changed.
- `AGENTS.md` was NOT created or modified.
