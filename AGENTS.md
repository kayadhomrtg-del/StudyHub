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
   same-origin hashed assets. One narrow exception is documented in `docs/AI_PLAN.md`:
   an optional, disabled-by-default, loopback-only Gemini proxy for a single user.
   Real provider dispatch stays blocked while provider eligibility is unresolved
   (see `docs/AI_LAUNCH_CHECKLIST.md`); it must never be enabled by a sample
   configuration, a test fixture, or the completion of a phase.
6. Keep changes minimal and scoped; reuse existing components/hooks/utils; do not bump
   dependency versions without a clear reason (`pdfjs-dist` is pinned exactly on purpose).

## Verification
- Read the existing test for the touched area first; add/update focused tests;
  run test, lint, typecheck, and (when permitted) build; report exact commands and outcomes.
- Git: never commit, push, revert, or discard user changes without explicit request.
  Check `git status` before and after; inspect the full diff.
