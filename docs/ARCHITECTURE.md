# Architecture

## Application structure

- `src/main.tsx` is the browser entry point and applies the theme provider.
- `src/App.tsx` defines the React Router routes and shared application shell,
  including the modules collection and module detail.
- `src/components/layout/` contains the responsive sidebar and top bar.
- `src/components/theme/` owns the in-memory light/dark appearance state.
- `src/components/ui/` contains reusable loading, empty, error, and confirmation
  states.
- `src/features/navigation/` owns the typed primary navigation definition.
- `src/features/modules/` contains the typed module model and validation,
  versioned Dexie database, repository, service, and module UI.
- `src/features/topics/` provides module-scoped topic creation, renaming,
  ordering, and relationship-safe operations.
- `src/features/materials/` separates import orchestration, metadata,
  repository transactions, stored file-byte records, and local file viewers.
- `src/features/backup/` creates and validates versioned local ZIP archives,
  including module-scoped packages.
- `src/pages/` contains the dashboard, modules collection/detail, route shells,
  settings/backup controls, and not-found page.

The v3 IndexedDB database is local to this browser profile on this device.
Module, topic, and material reads/writes flow through Dexie repositories and
services, not page components. A material import writes metadata and original
file bytes in one per-file transaction. The viewer retrieves metadata and bytes
independently through the material service. PDF.js and its worker are bundled
locally. DOCX, PPTX, and XLSX
processing is local; DOCX markup is sanitized and shown in a sandboxed frame,
and Markdown does not enable raw HTML. Code is highlighted as text. HTML/JS
imports are never executed. Original downloads use temporary object URLs that
are revoked after use.

`BackupService` writes a documented ZIP containing a manifest, JSON records,
and a separate binary entry for every material. It checks relationships,
record counts, file sizes, CRCs, and identity/code conflicts before restoring.
ZIP central-directory limits are checked before inflation, including expanded
size, entry count, unsafe paths, encryption, and unsupported ZIP64 entries.
Office preview archives are also bounded before local parsing.
Replace is atomic and the UI requires explicit confirmation; merge preserves
existing data and rejects collisions. Settings uses `navigator.storage`
estimates and only requests persistent storage after a user action. Neither
feature provides a remote copy or guarantees that the browser will retain data.

## Design and privacy

Tailwind CSS utilities use project-owned color tokens, with CSS variables for
light and dark appearances. Fonts and assets use local system resources; there
are no runtime CDN dependencies. The app does not make network requests for
user content or require an account or backend.

## Boundaries

Phase 1 implements module management. Phase 2 adds module topics and local file
importing, material metadata, tags, favorites, study status, and module/topic
assignment. Phase 3 adds local PDF/image/Office/Markdown/code previews,
download, document search, topic navigation, and last-opened tracking. Full and
module-scoped backup/restore use ZIP format version 1 without changing the
IndexedDB schema. Notes, assignments, global cross-library search, calendar
events, and study sessions are not included. Future schema changes must
increment the Dexie version and include a migration without deleting existing
user data.
