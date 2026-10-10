# College Study Hub

A private, local-first study workspace for college coursework. The project is
being built one milestone at a time; this release includes the Phase 0
foundation, Phase 1 local module management, Phase 2 topics and file importing,
and Phase 3 local material viewing.

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
connect to a backend or send study content anywhere.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

## Current scope

Phase 0 provides the responsive application shell, client-side routes, light
and dark appearance foundations, reusable interface states, and documentation.
Phase 1 adds a versioned local IndexedDB database for modules, with create/edit,
search/filter, detail, archive/restore, and confirmed deletion. Phase 2 adds
module topics and local material importing. Original file bytes and searchable
metadata are stored separately in IndexedDB; materials may remain unassigned
and can later be organized into a module and topic. Phase 3 adds local PDF.js,
image, and safe plain-text previews, plus original-file downloads for formats
without a preview. Imported HTML and code are always displayed as text; they
are never rendered as live pages or executed. Files are neither uploaded nor
sent to a backend. DOCX, PPTX, and XLSX preview is not supported.

Notes, tasks, and other study workflows are not implemented yet.

## Project map

- `src/components/` — shared layout, theme, and UI primitives
- `src/features/navigation/` — typed primary navigation
- `src/features/modules/` — module model, validation, Dexie database, repository,
  service, form, and card
- `src/features/topics/` — ordered module topics and topic management
- `src/features/materials/` — local imports, separate bytes/metadata, and
  material organization controls, and local viewers
- `src/pages/` — dashboard and route-level page shells
- `docs/PRODUCT_SPEC.md` — complete product blueprint and phased roadmap
- `docs/ARCHITECTURE.md` — current structure and implementation boundaries
- `docs/DATA_MODEL.md` — current local persistence model and schema versions
- `docs/TEST_PLAN.md` — milestone-by-milestone validation plan
