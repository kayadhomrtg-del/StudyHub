# College Study Hub

A private, local-first study workspace for college coursework. This release
includes modules and topics, local material importing and viewing, Markdown
notes, tasks, global search, a calendar and study planner, full local backup
and restore, and production app-shell caching for offline use.

## Principles

- Course materials and personal data stay on this computer.
- No backend, accounts, cloud sync, analytics, telemetry, or external AI APIs.
- Imported HTML and JavaScript are never executed.
- Persistence belongs in dedicated repositories and services, with versioned
migrations and no destructive recovery shortcuts.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Getting started

```sh
npm install
npm run dev
```

The development server prints its local URL in the terminal. The app does not
connect to a backend or send study content anywhere. On the first production
visit, the browser must download the application shell and its static assets
before those assets are available offline.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

## Current scope

Modules and topics are managed locally in IndexedDB. Material metadata is kept
separate from original file bytes; files may remain unassigned and later be
organized into modules and topics. The viewer supports PDF, browser-supported
images, DOCX, PPTX, XLSX, Markdown, and common source/text formats, including
document search where supported. DOCX content is sanitized and isolated in a
sandboxed frame. Markdown raw HTML is disabled, source code and imported HTML
are displayed as text, and imported scripts are never executed. Study files
are never uploaded.

Office previews preserve common formatting but are not a replacement for full
desktop Office applications. XLSX formulas are not recalculated; the viewer
uses values stored in the workbook and caps each sheet preview. Legacy Office
formats and unsupported file types retain their original-download fallback.
Settings provides a versioned ZIP backup/restore workflow and browser storage
usage estimates and allows a browser-managed persistent-storage request.
Appearance is saved locally. Notes retain Markdown source and support linking,
tags, pins, search, and preview. Tasks support optional module/topic/material
links and due dates. Global search reads metadata and records only, not blobs.
Dashboard summaries use stored records. Calendar and the separate study
planner manage dated tasks and local study sessions.

Full backup format v2 is a ZIP containing a manifest, every structured record
table and setting, and a separate entry for each original file. Legacy v1
backups can be restored. Archives are capped at 512 MiB and validated before
database writes. Restore requires an explicit merge or confirmed replace.
Replace and merge are transactional; conflicts stop without partially writing.
Browser storage can still be cleared or lost, so keep backups outside the
browser profile.

The production PWA caches only the app shell and same-origin static build
assets. It does not cache IndexedDB records or material content. Offline
operation was manually checked in a production preview; this is not a guarantee
that every browser retains storage or supports the same offline behavior.

## Current limitations

- Office previews preserve common formatting but are not replacements for
  desktop Office applications. Spreadsheet formulas are not recalculated, and
  each worksheet preview is capped at 500 rows and 40 columns.
- Legacy Office formats and unsupported files use the original-download
  fallback.
- Browser storage quotas vary. Persistent storage is a request, not a guarantee
  against disk failure, profile removal, or user-initiated clearing.

## Project map

- `src/components/` — shared layout, theme, and UI primitives
- `src/features/navigation/` — typed primary navigation
- `src/features/modules/` — module model, validation, Dexie database, repository,
  service, form, and card
- `src/features/topics/` — ordered module topics and topic management
- `src/features/materials/` — local imports, separate bytes/metadata, material
  organization controls, and local viewers
- `src/features/notes/`, `src/features/tasks/`, `src/features/search/`, and
  `src/features/studySessions/` — local study records and workflows
- `src/features/backup/` — validated full-library and module-scoped archives
- `src/features/settings/` — locally persisted app preferences
- `public/sw.js` and `public/manifest.webmanifest` — production app-shell
  offline caching and install metadata
- `src/pages/` — dashboard and route-level page shells
- `docs/PRODUCT_SPEC.md` — complete product blueprint and phased roadmap
- `docs/ARCHITECTURE.md` — current structure and implementation boundaries
- `docs/DATA_MODEL.md` — current local persistence model and schema versions
- `docs/TEST_PLAN.md` — milestone-by-milestone validation plan
