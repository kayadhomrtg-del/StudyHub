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
  repository transactions, and UI from the stored file-byte records.
- `src/pages/` contains the dashboard, modules collection/detail, route shells,
  and not-found page.

The v2 IndexedDB database is local to this browser profile on this device.
Module, topic, and material reads/writes flow through Dexie repositories and
services, not page components. A material import writes metadata and original
file bytes in one per-file transaction. Imported content is stored as data;
HTML, JavaScript, and other files are never executed. No server or network data
service is used.

## Design and privacy

Tailwind CSS utilities use project-owned color tokens, with CSS variables for
light and dark appearances. Fonts and assets use local system resources; there
are no runtime CDN dependencies. The app does not make network requests for
user content or require an account or backend.

## Boundaries

Phase 1 implements module management. Phase 2 adds module topics and local file
importing, material metadata, tags, favorites, study status, and module/topic
assignment. No material viewer, notes, assignments, global content search,
calendar events, or study sessions are included. Future schema changes must
increment the Dexie version and include a migration without deleting existing
user data.
