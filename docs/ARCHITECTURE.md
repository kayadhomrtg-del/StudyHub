# Architecture

## Phase 0 structure

- `src/main.tsx` is the browser entry point and applies the theme provider.
- `src/App.tsx` defines the React Router routes and shared application shell.
- `src/components/layout/` contains the responsive sidebar and top bar.
- `src/components/theme/` owns the in-memory light/dark appearance state.
- `src/components/ui/` contains reusable loading, empty, error, and confirmation
  states.
- `src/features/navigation/` owns the typed primary navigation definition.
- `src/pages/` contains the dashboard, route shells, and not-found page.

The UI has no persistence layer in Phase 0. Later database access must live in
dedicated repositories and services rather than page or component code.

## Design and privacy

Tailwind CSS utilities use project-owned color tokens, with CSS variables for
light and dark appearances. Fonts and assets use local system resources; there
are no runtime CDN dependencies. The app does not make network requests for
user content or require an account or backend.

## Boundaries

Phase 0 intentionally does not implement IndexedDB, file importing, notes,
assignments, search over data, calendar events, or study sessions. Implement
those only in their roadmap milestones, with tests and migrations when schema
changes are introduced.
