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
