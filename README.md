# College Study Hub

A private, local-first study workspace for college coursework. The project is
being built one milestone at a time; this release is the Phase 0 foundation.

## Principles

- Course materials and personal data stay on this computer.
- No backend, accounts, cloud sync, analytics, telemetry, or external AI APIs.
- Imported HTML and JavaScript are never executed.
- Future persistence belongs in dedicated repositories and services, with
  versioned migrations and no destructive recovery shortcuts.

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

## Phase 0 scope

Phase 0 provides a responsive application shell, client-side routes, light and
dark appearance foundations, reusable interface states, and documentation.
Pages are intentionally empty starting points. Database persistence, importing,
notes, tasks, and other study workflows are not implemented in this milestone.

## Project map

- `src/components/` — shared layout, theme, and UI primitives
- `src/features/navigation/` — typed primary navigation
- `src/pages/` — dashboard and route-level page shells
- `docs/PRODUCT_SPEC.md` — complete product blueprint and phased roadmap
- `docs/ARCHITECTURE.md` — current structure and implementation boundaries
- `docs/DATA_MODEL.md` — planned local persistence model (not implemented)
- `docs/TEST_PLAN.md` — milestone-by-milestone validation plan
