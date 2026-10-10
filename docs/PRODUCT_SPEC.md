# College Study Hub — Complete Website Blueprint
**Version:** 1.0  
**Purpose:** A local-first, offline-capable personal college study system that can be built iteratively with GitHub Copilot.

---

## 1. Product vision

Build a polished personal “College Study Hub” where the student can organize every module, import and view course materials, take notes, track assignments and exams, plan study sessions, and search everything from one dashboard.

The application should feel like a private study workspace rather than a generic file manager. It must be useful with no account, no backend, and no internet connection after installation.

### Primary principles
1. **Local-first and private:** user content stays on this computer. No analytics, cloud sync, remote database, or third-party content upload.
2. **Material is the center:** modules contain topics, and topics contain files, notes, links, and tasks.
3. **Incremental development:** each feature is a small, testable milestone that Copilot can implement without rewriting the whole project.
4. **Recoverable data:** obvious export, backup, and restore features are essential.
5. **Readable and accessible:** good typography, keyboard support, clear empty states, responsive layouts, and light/dark themes.
6. **No fake complexity:** advanced features should be optional and should not make basic course organization difficult.

## 2. Recommended technical approach

### Recommended stack
- **React + TypeScript + Vite** — application UI and development server.
- **React Router** — client-side pages.
- **Tailwind CSS** — consistent styling and responsive layout.
- **shadcn/ui** (or another locally bundled component library) — accessible interface primitives. Avoid runtime CDN dependencies.
- **Dexie.js + IndexedDB** — structured local database for modules, notes, tasks, metadata, and imported file blobs.
- **PDF.js** — PDF viewer.
- **Marked or a comparable Markdown renderer** — render Markdown notes, with raw HTML disabled or sanitized.
- **Lucide icons** — consistent icons.
- **Vitest + React Testing Library** — unit and UI tests.
- **Playwright** — optional end-to-end tests after the core app is stable.
- **PWA service worker** — cache the application shell for offline launch.

Use stable package versions and commit the lockfile. Copilot should check current compatibility before installing packages.

### Important distinction: local website vs. installed desktop app
The first version is a **local web application** served from the user's computer and opened in a browser. Its database is stored in that browser's local IndexedDB. It can work offline after the app shell has been cached, but browser storage can be cleared by the user or browser, and quotas vary.

For the first version:
- Store imported files as blobs in IndexedDB.
- Never send content to a server.
- Add export/restore and a visible storage/backup status.
- Do not promise that browser storage is an absolute permanent archive.

If the user later wants a more native file-system experience, package the mature app with **Tauri** as a separate later milestone. Do not start with Tauri unless direct filesystem management is a must-have from day one.

## 3. Users and core workflows

### Main workflow: adding a module
1. Open **Modules**.
2. Select **Add module**.
3. Enter module name, short code, semester, lecturer (optional), color/icon, and description.
4. Open the module page.
5. Add topics/weeks/units.
6. Import lecture slides, PDFs, documents, images, code files, and links into the relevant topic.
7. Add notes, tasks, or revision questions.
8. Mark progress as the material is studied.

### Main workflow: studying material
1. Open the dashboard or a module.
2. Select a topic or material item.
3. View it in the built-in viewer when supported.
4. Add a personal note, bookmark a page, or create a task.
5. Mark the item as not started, in progress, or completed.
6. Find it later through global search.

### Main workflow: assignment tracking
1. Create an assignment and link it to a module.
2. Add a due date, priority, description, status, and related files.
3. See it on the dashboard and calendar.
4. Mark it submitted/completed when finished.

### Main workflow: backup and restore
1. Open Settings → Data & Backup.
2. Create a full backup file.
3. Choose a destination in the browser's download dialog.
4. On a new browser profile or after data loss, restore from that backup.
5. Validate the backup before overwriting existing data; offer merge or replace when feasible.

## 4. Information architecture

### Primary navigation
- **Dashboard**
- **Modules**
- **Materials**
- **Notes**
- **Tasks & Assignments**
- **Calendar**
- **Study Planner**
- **Search**
- **Settings & Backup**

On narrow screens, use a compact sidebar or bottom navigation. The current page and current module should always be obvious.

### Page specifications

#### A. Dashboard
Purpose: answer “What should I do next?” immediately.

Widgets:
- Greeting and current date (local device time).
- Semester overview: active modules and completion indicators.
- “Continue studying” — recently opened material.
- Upcoming deadlines (next 7 days).
- Today's study plan.
- Recently added materials.
- Quick actions: Add module, Import material, New note, New task, Start study session.
- Optional focus timer, disabled by default if it adds distraction.

Every widget should have a useful empty state and a link to the relevant page. Do not invent progress; calculate it from actual records.

#### B. Modules list
- Grid/list toggle.
- Search and filters: semester, active/archived, progress.
- Module cards show name, code, semester, material count, next deadline, and progress.
- Create, edit, archive, restore, and delete actions.
- Deleting a module must explain what linked records will happen to; require confirmation.

#### C. Module detail
Tabs:
1. **Overview** — description, progress, upcoming tasks, recent materials.
2. **Content** — topic/week/unit tree and material list.
3. **Notes** — notes linked to this module.
4. **Tasks** — assignments and revision tasks.
5. **Revision** — optional revision queue and flashcards.

Support topics nested no deeper than necessary. Reordering topics and material should be straightforward. Each module can have its own accent color, but maintain accessible contrast.

#### D. Materials library
- Search all materials by title, module, topic, type, tags, and notes.
- Filters for file type, module, topic, favorites, and completion status.
- Sort by title, date added, recently opened, or study status.
- List and grid views.
- Show filename, original file type, size, module/topic, import date, and status.
- Material details panel with metadata, tags, notes, and linked tasks.

#### E. Material viewer
Use a dedicated, distraction-reduced reading layout:
- Main content area.
- Optional collapsible table of contents or page/section panel.
- Previous/next material navigation within the topic.
- Metadata header: title, module, topic, file type, status.
- Favorite/bookmark, mark complete, edit details, download original, delete.
- Notes panel or linked notes shortcut.
- “Open original file” or download fallback when browser preview is unsupported.

Supported formats for initial release:
- **PDF:** embedded PDF.js viewer with page navigation and zoom.
- **Images:** JPG, PNG, WebP, GIF where browser supports them.
- **Text/code:** TXT, MD, CPP, H, C, JS, TS, HTML, CSS, JSON, and other plain-text files displayed safely as text with syntax highlighting as a later enhancement.
- **Audio/video:** optional if browser can play the format; no transcoding.
- **DOCX/PPTX/XLSX:** do not promise perfect preview in v1. Provide safe download/open-original fallback. Add a local conversion/preview strategy only after the basics work.
- **External links:** display a link card and open only after the user clicks.

PDF requirements:
- Previous/next page, page number, zoom controls, fit width, fit page, search within PDF if supported by PDF.js, and loading/error states.
- Viewer must release object URLs and clean up resources when the material changes or component unmounts.
- Do not silently fail if a PDF is corrupted or unsupported.

#### F. Notes
- Create standalone notes or notes linked to module/topic/material/task.
- Markdown editor with preview toggle.
- Autosave with visible “Saving / Saved / Could not save” state.
- Title, body, tags, created/updated dates, pinned/favorite state.
- Search note title and content.
- Avoid silently overwriting text when navigating quickly; persist before changing records.
- Raw HTML must not execute in rendered notes.

#### G. Tasks & Assignments
Task fields:
- Title, description, module, topic (optional), due date/time (optional), priority, status, task type, tags, linked materials, created/updated dates.
- Types: assignment, quiz, exam, reading, revision, project, personal.
- Statuses: not started, in progress, blocked, completed, submitted.
- Views: list, kanban (optional), and calendar.
- Filters: module, status, priority, due date, type.
- Sort by due date or priority.
- Overdue indicators should be clear but not alarmist.
- Completion should be reversible.

#### H. Calendar
- Month and agenda views first; week view can follow.
- Show assignments, exams, and planned study sessions.
- Filter by module and item type.
- Use local time consistently.
- Clicking an item opens its details.
- Avoid a remote calendar integration in the local-only version.

#### I. Study Planner
- Manually schedule a study session with module, topic/material, date, duration, and optional goal.
- “Today” and “This week” views.
- Simple session completion and actual duration.
- Optional focus timer only after manual planning is working.
- No automatic claims that a session happened unless the user marks it complete.

#### J. Search
Global search across module names, topics, material titles, tags, note titles/content, and task titles.
- Debounce input.
- Group results by category.
- Keyboard accessible.
- Show a helpful no-results state and clear filters.
- Search should work fully offline.

#### K. Settings & Backup
- Theme: system, light, dark.
- Default landing page.
- Optional confirmation for destructive actions.
- Database/storage usage estimate when available.
- Export backup.
- Restore backup with validation and confirmation.
- Export selected notes/tasks/modules where practical.
- Import files and backup files.
- About/version page.
- Clear all data action with typed confirmation.

## 5. Visual design direction

Aim for a calm, premium academic workspace:
- Warm neutral or slate background.
- One restrained accent color (blue, indigo, or teal).
- Strong typography and generous spacing.
- Cards only where they improve scanning; avoid excessive rounded boxes.
- Compact but readable sidebar.
- Clear hierarchy for page titles, module names, topic labels, and metadata.
- Light and dark themes.
- Subtle transitions only; respect reduced-motion preferences.
- Responsive from laptop down to tablet/mobile.
- Keyboard focus rings, accessible contrast, labels, and screen-reader-friendly controls.

### Suggested layout
- Left sidebar: brand, primary navigation, module shortcuts, collapse button.
- Top bar: breadcrumb/current module, global search, quick add, theme/profile/settings.
- Main area: page content with consistent max width.
- Optional right panel: notes/details when useful, never required for core navigation.

Do not build a huge single-page dashboard with every feature visible at once. Keep each page focused.

## 6. Data model

Use Dexie/IndexedDB. Store relationships by stable IDs, not display names. Use UUIDs for IDs and ISO timestamps for dates.

### Module
- id: string
- name: string
- code?: string
- semester?: string
- academicYear?: string
- lecturer?: string
- description?: string
- color?: string
- icon?: string
- isArchived: boolean
- createdAt: string
- updatedAt: string

### Topic
- id: string
- moduleId: string
- title: string
- description?: string
- parentTopicId?: string
- sortOrder: number
- createdAt: string
- updatedAt: string

### Material
- id: string
- moduleId: string
- topicId?: string
- title: string
- originalFileName?: string
- mimeType: string
- extension?: string
- sizeBytes: number
- storageKey: string
- materialKind: "file" | "link"
- externalUrl?: string
- description?: string
- tags: string[]
- status: "not-started" | "in-progress" | "completed"
- isFavorite: boolean
- lastOpenedAt?: string
- createdAt: string
- updatedAt: string

### StoredFile
- id: string
- blob: Blob
- mimeType: string
- sizeBytes: number
- originalFileName: string
- createdAt: string

Store file blobs separately from material metadata. A material's storageKey points to the StoredFile ID. Deleting a material must not accidentally delete a file still referenced elsewhere.

### Note
- id: string
- title: string
- contentMarkdown: string
- moduleId?: string
- topicId?: string
- materialId?: string
- taskId?: string
- tags: string[]
- isPinned: boolean
- createdAt: string
- updatedAt: string

### Task
- id: string
- title: string
- description?: string
- moduleId?: string
- topicId?: string
- dueAt?: string
- priority: "low" | "medium" | "high"
- status: "not-started" | "in-progress" | "blocked" | "completed" | "submitted"
- taskType: "assignment" | "quiz" | "exam" | "reading" | "revision" | "project" | "personal"
- materialIds: string[]
- tags: string[]
- createdAt: string
- updatedAt: string
- completedAt?: string

### StudySession
- id: string
- moduleId: string
- topicId?: string
- materialId?: string
- title: string
- plannedStartAt: string
- plannedDurationMinutes: number
- actualDurationMinutes?: number
- goal?: string
- status: "planned" | "completed" | "skipped"
- createdAt: string
- updatedAt: string

### Bookmark (optional v1.5)
- id: string
- materialId: string
- label: string
- locationType: "pdf-page" | "text-anchor"
- locationValue: string
- createdAt: string

### AppSettings
- id: "singleton"
- theme: "system" | "light" | "dark"
- defaultLandingPage: string
- schemaVersion: number
- updatedAt: string

### Relationship rules
- Module → many Topics, Materials, Notes, Tasks, StudySessions.
- Topic → many Materials, Notes, Tasks, StudySessions; topics belong to one module.
- Material → many Notes and may be linked to many Tasks.
- Deleting a module must offer: archive module (recommended), delete module but keep unlinked materials/notes/tasks, or delete the module and all related content. Explain the selected behavior before proceeding.
- Enforce referential integrity in application services; IndexedDB does not provide relational foreign keys.

## 7. File import and local storage rules

### Import flow
1. User clicks Import or drops files into an explicit drop zone.
2. Validate file size/type and show a list before saving.
3. Ask which module/topic to use; allow “Unassigned” and organization later.
4. Copy file bytes into IndexedDB.
5. Create Material metadata record.
6. Report success/failure per file.
7. Offer undo where practical.

### Safety and reliability
- No file is uploaded to a server.
- Never execute imported HTML or JavaScript.
- Render code/text as escaped text, not as a live page.
- Sanitize Markdown output and disable raw HTML.
- Handle storage quota errors and private-browsing limitations gracefully.
- Warn users before importing very large files; use a configurable limit rather than an arbitrary hard-coded low cap.
- Check `navigator.storage.estimate()` where supported, but present estimates as approximate.
- Use `navigator.storage.persist()` as a request where supported, never claim it guarantees permanence.
- If import fails, do not leave orphan metadata or partial records.
- Revoke object URLs after use.
- Avoid writing file contents to console logs.

## 8. Local-only and offline requirements

The app must not require login or internet access for core use.
- No server-side API.
- No cloud database.
- No analytics, tracking pixels, or telemetry.
- No external fonts/CDNs at runtime; bundle assets locally.
- No AI API calls or remote summarization.
- No network requests containing study content.
- Service worker caches the app shell and static assets.
- Imported files and structured data remain in local browser storage.
- External links are stored locally and only visited on user action.
- Provide a clear privacy page that explains exactly where data is stored and the limits of browser storage.

### Offline testing
1. Start the app once while online.
2. Load the app and add a module, note, task, and PDF.
3. Disconnect the network.
4. Reload the app.
5. Confirm the dashboard, data, PDF, search, notes, and task editing still work.
6. Confirm that no feature blocks the user with a network error.

For local development, run `npm run dev`. For a production local build, run `npm run build` and `npm run preview`. The app may be hosted only on `localhost`; do not expose it to a public network by default.

## 9. Backup and restore design

Backups are a core feature, not a later polish item.

### Backup format
Use a versioned ZIP archive containing:
- `manifest.json` — backup format version, export timestamp, app version, counts.
- `data/modules.json`
- `data/topics.json`
- `data/materials.json`
- `data/notes.json`
- `data/tasks.json`
- `data/study-sessions.json`
- `data/settings.json`
- `files/<stored-file-id>` — original file bytes, with MIME/name metadata in manifest or file index.

Use a maintained ZIP library compatible with the browser. Validate archive structure, record counts, IDs, blob sizes, and schema version before restoring.

### Restore behavior
- Show a preview: number of modules, materials, notes, tasks, sessions, and total file size.
- Default to **restore into an empty database** or require an explicit choice between replace and merge.
- Make a temporary backup of current data before destructive replacement where feasible.
- Reject malformed archives with a readable error.
- Include migrations for older backup schema versions.
- Test backups with PDFs, images, notes, empty datasets, and large files.

## 10. Suggested project structure

```text
college-study-hub/
├── public/
│   ├── icons/
│   └── manifest.webmanifest
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── Breadcrumbs.tsx
│   │   ├── common/
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   └── ErrorState.tsx
│   │   └── ui/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── modules/
│   │   ├── topics/
│   │   ├── materials/
│   │   │   ├── MaterialLibraryPage.tsx
│   │   │   ├── MaterialViewerPage.tsx
│   │   │   ├── ImportMaterialsDialog.tsx
│   │   │   └── viewers/
│   │   │       ├── PdfViewer.tsx
│   │   │       ├── ImageViewer.tsx
│   │   │       ├── TextViewer.tsx
│   │   │       └── UnsupportedViewer.tsx
│   │   ├── notes/
│   │   ├── tasks/
│   │   ├── calendar/
│   │   ├── planner/
│   │   ├── search/
│   │   └── settings/
│   ├── db/
│   │   ├── database.ts
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   └── repositories/
│   │       ├── modules.repository.ts
│   │       ├── topics.repository.ts
│   │       ├── materials.repository.ts
│   │       ├── notes.repository.ts
│   │       ├── tasks.repository.ts
│   │       └── files.repository.ts
│   ├── services/
│   │   ├── import.service.ts
│   │   ├── backup.service.ts
│   │   ├── search.service.ts
│   │   └── storage.service.ts
│   ├── hooks/
│   ├── lib/
│   │   ├── dates.ts
│   │   ├── fileTypes.ts
│   │   ├── ids.ts
│   │   └── validation.ts
│   ├── styles/
│   ├── types/
│   ├── test/
│   ├── main.tsx
│   └── vite-env.d.ts
├── tests/
│   └── e2e/
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── DATA_MODEL.md
│   ├── COPILOT_WORKFLOW.md
│   └── TEST_PLAN.md
├── .github/
│   └── copilot-instructions.md
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

Do not create every file as empty placeholders up front. Create folders and files as their milestone begins. Keep each feature modular and keep database logic out of UI components.

## 11. Routes

- `/` — dashboard
- `/modules` — module library
- `/modules/new` — create module
- `/modules/:moduleId` — module overview
- `/modules/:moduleId/content` — topic/material organization
- `/materials` — all materials
- `/materials/:materialId` — viewer/details
- `/notes` — notes library
- `/notes/new` — new note
- `/notes/:noteId` — edit/view note
- `/tasks` — task/assignment manager
- `/calendar` — calendar
- `/planner` — study planner
- `/search` — search results
- `/settings` — preferences
- `/settings/backup` — backup/restore

Unknown routes should show a designed not-found page with a way back home.

## 12. Quality requirements

### Performance
- Keep initial application bundle reasonable.
- Lazy-load PDF viewer and less-used routes.
- Use pagination or virtual lists if libraries become large.
- Avoid loading all file blobs just to render a list.
- Search metadata first; fetch file bytes only when opening a file.

### Accessibility
- Full keyboard navigation.
- Visible focus indicators.
- Proper labels and accessible dialog behavior.
- Respect reduced-motion preference.
- Sufficient color contrast in both themes.
- Do not communicate status with color alone.

### Reliability
- Loading, empty, success, and error states for every data-driven page.
- Validate forms.
- Handle missing/deleted relationships.
- Autosave only with clear status.
- Destructive operations require confirmation.
- Database migrations must be versioned and tested.
- Never wipe the database automatically to fix an error.

### Code quality
- TypeScript strict mode.
- Small components and focused services.
- Avoid `any` unless justified and documented.
- Avoid one giant component.
- Avoid duplicated database access code.
- Use consistent naming and formatting.
- Do not add packages without explaining why they are needed.
- Keep a short decision log for architectural changes.

## 13. Implementation roadmap

Build in the following order. Do not ask Copilot to implement everything in one prompt.

### Phase 0 — Foundation
- Create React + TypeScript + Vite app.
- Set up styling, routing, linting, tests, and strict TypeScript.
- Create responsive app shell and placeholder routes.
- Add README and Copilot instructions.
**Done when:** app launches, routes work, layout responds to screen size, tests/build pass.

### Phase 1 — Local database and modules
- Configure Dexie and schema version 1.
- Implement module repository and create/edit/archive module flows.
- Add modules list, module detail, validation, empty states.
**Done when:** modules survive reload, and all CRUD operations are tested.

### Phase 2 — Topics and material organization
- Add topic tree and reordering.
- Add material metadata and tag management.
- Implement import of multiple files into IndexedDB.
- Add per-file success/failure results.
**Done when:** files can be imported, assigned to module/topic, listed, and reopened after reload.

### Phase 3 — Material viewer
- PDF.js viewer.
- Image viewer.
- Safe text/code viewer.
- Unsupported-format fallback and original-file download.
- Recent materials and favorites.
**Done when:** supported files open reliably and object URLs/resources are cleaned up.

### Phase 4 — Notes
- Markdown editor and safe preview.
- Autosave state.
- Link notes to module/topic/material.
- Search notes.
**Done when:** notes persist and linking/unlinking works without data loss.

### Phase 5 — Tasks and assignments
- CRUD, status, priority, module links, due dates.
- Dashboard upcoming deadlines.
- List filters and sorting.
**Done when:** task lifecycle and date behavior are tested.

### Phase 6 — Search and dashboard
- Search across all metadata and note content.
- Dashboard widgets from real database queries.
- Recent items and quick actions.
**Done when:** results are relevant, grouped, and fully local.

### Phase 7 — Calendar and planner
- Agenda/month calendar.
- Study session CRUD and completion.
- Filters by module and event type.
**Done when:** dates/time zones behave consistently and items link to their source.

### Phase 8 — Backup, restore, offline
- Versioned ZIP backup and restore.
- Service worker/PWA.
- Storage warnings and privacy explanation.
- Offline test suite.
**Done when:** a full backup can restore all records and file bytes in a fresh browser profile; core workflows work offline.

### Phase 9 — Polish and optional features
- Dark theme, keyboard shortcuts, accessibility audit.
- Flashcards and spaced repetition.
- PDF bookmarks and annotations (only if feasible).
- Export individual notes or module reports.
- Optional Tauri packaging.
**Done when:** each feature is separately tested and does not destabilize core flows.

## 14. Testing checklist

### Core
- [ ] Create, edit, archive, restore, and delete a module.
- [ ] Create, reorder, and delete topics.
- [ ] Import one file and many files.
- [ ] Handle duplicate filenames without collision.
- [ ] Open a PDF, image, and text file.
- [ ] Refresh and verify data remains.
- [ ] Create and edit a note; test autosave and error states.
- [ ] Create a task with and without a due date.
- [ ] Verify dashboard counts match database records.
- [ ] Search by module, topic, filename, tag, note content, and task title.
- [ ] Export and restore a backup.
- [ ] Restore malformed backup and verify no data is destroyed.
- [ ] Test offline launch and use.
- [ ] Test empty database and missing relationships.
- [ ] Test keyboard navigation and both themes.
- [ ] Test large file/quota error behavior.

### Data safety
- [ ] No imported content is sent over the network.
- [ ] No imported HTML/JS executes.
- [ ] No automatic database reset exists.
- [ ] Destructive actions have confirmation.
- [ ] Backup includes every stored file referenced by material records.
- [ ] Restoring a backup validates before committing changes.

## 15. GitHub Copilot working agreement

Create `.github/copilot-instructions.md` with these rules:

```markdown
# Project instructions

You are helping build College Study Hub, a local-first college study application.

## Non-negotiable requirements
- All user data and imported course materials remain local.
- Do not add a backend, login, cloud sync, analytics, telemetry, or external AI API.
- Do not load runtime fonts, scripts, or styles from a CDN.
- Do not execute imported files or render imported HTML as trusted content.
- Do not wipe the database to fix a bug.
- Add a migration when changing the database schema.
- Keep file bytes in the file store and metadata in the material table.
- Use TypeScript strict mode and avoid `any`.
- Put persistence logic in repositories/services, not UI components.
- Provide loading, empty, error, and success states.
- Confirm destructive operations.
- Add tests for each feature and run relevant tests plus the production build.
- Do not rewrite unrelated working code.
- Do not install a dependency without explaining its purpose.
- Update README/docs when behavior or setup changes.

## Workflow for every task
1. Inspect the existing code and relevant docs first.
2. Summarize the planned changes in 3–7 bullets.
3. Implement only the requested scope.
4. Add/update tests.
5. Run lint, tests, and build where available.
6. Report changed files, commands run, results, and any remaining issues.
7. If requirements conflict, stop and explain the conflict rather than silently violating local-only behavior.
```

## 16. Master prompt for GitHub Copilot

Use this once to establish the project, then use the smaller prompts below.

> You are the lead engineer for College Study Hub, a polished local-first college study web app. Read `docs/PRODUCT_SPEC.md`, `docs/DATA_MODEL.md`, `docs/TEST_PLAN.md`, and `.github/copilot-instructions.md` before coding.
>
> The application must run locally, work offline for core features, and never upload user data or study files. Use React, TypeScript, Vite, React Router, Tailwind CSS, Dexie/IndexedDB, and Vitest. Keep the architecture modular, typed, accessible, and testable.
>
> First inspect the repository. If it is empty, implement only Phase 0 from the roadmap: scaffold the application, configure strict TypeScript, styling, routing, test setup, a responsive app shell, placeholder routes, README, and the project instructions file. Do not implement all product features yet.
>
> Before editing, provide a concise plan. After editing, run the available tests and production build, fix failures caused by your changes, and report the changed files and results. Do not claim a command passed unless you actually ran it.

## 17. Ready-to-use prompts for later milestones

### Prompt A — Modules
> Read the product spec and Copilot instructions. Implement Phase 1 only: Dexie schema and migration setup, typed module repository, module list, create/edit form, module detail shell, archive/restore, validation, and tests. Keep all data local. Do not implement file importing, notes, tasks, or unrelated features. Run tests and build.

### Prompt B — Topics and imports
> Implement Phase 2 only. Add topics linked to modules, a simple reorderable topic list, multi-file import, local blob storage, material metadata, tags, and per-file import results. Validate files and handle quota failures without partial records. Do not implement the PDF viewer yet. Add tests and run build.

### Prompt C — Viewer
> Implement Phase 3 only. Add a PDF.js viewer, image viewer, and safe text/code viewer. Add unsupported-file fallback and original-file download. Never execute imported files. Ensure object URLs and viewer resources are cleaned up. Add tests for loading, error, and file switching states.

### Prompt D — Notes
> Implement Phase 4 only: notes CRUD, Markdown editing/preview with raw HTML disabled or sanitized, autosave status, optional links to module/topic/material, tags, pinning, and note search. Prevent accidental data loss during navigation. Add tests.

### Prompt E — Tasks
> Implement Phase 5 only: task/assignment CRUD, due date, priority, status, type, module/topic/material links, filters, sorting, and dashboard deadline query. Add validation and tests for missing due dates and status changes.

### Prompt F — Global search/dashboard
> Implement Phase 6 only. Add offline global search over modules, topics, material metadata/tags, notes, and tasks. Update dashboard widgets using actual database queries. Do not invent or hard-code progress. Add empty states and tests.

### Prompt G — Calendar/planner
> Implement Phase 7 only: local calendar agenda/month view and study-session planning. Use one consistent local-time strategy, test date boundaries, and link events to their records. No external calendar APIs.

### Prompt H — Backup/offline
> Implement Phase 8 only. Add a versioned ZIP export/import that includes all structured records and referenced file blobs, validates before restore, and offers explicit merge/replace behavior. Add PWA offline caching and storage warnings. Test malformed backups and verify no data is deleted on validation failure.

### Prompt I — Feature request template
> I want to add: **[FEATURE]**.
>
> First inspect the existing architecture and identify the smallest implementation that fits it. Explain the UX, data model changes (if any), risks, and test plan before coding. Preserve the local-only requirement. Implement only this feature, add migrations if required, add tests, run tests/build, update docs, and report changed files. Do not refactor unrelated parts.

## 18. How to work with Copilot without losing control

1. Create a Git repository before substantial coding.
2. Commit after each milestone that passes tests.
3. Keep `docs/PRODUCT_SPEC.md` as the source of truth.
4. Ask Copilot for one milestone or one feature at a time.
5. Review database migrations and deletion behavior carefully.
6. Test backup/restore before importing all of your real course material.
7. Keep a small set of sample files for testing.
8. When asking for a visual redesign, specify which pages and behaviors must remain unchanged.
9. Never accept “implemented” as proof: ask which tests ran and verify the feature manually.
10. Keep a `CHANGELOG.md` or milestone notes so future prompts have reliable context.

## 19. Recommended v1 scope

For the first genuinely useful release, focus on:
1. App shell and navigation.
2. Modules and topics.
3. Local file import.
4. PDF/image/text viewing.
5. Notes.
6. Tasks and deadlines.
7. Search.
8. Full backup/restore.

Calendar, study timer, flashcards, PDF annotations, AI features, and desktop packaging can wait. This protects the core experience from becoming too large before it is reliable.

## 20. Acceptance definition: “ready for real college use”

The app is ready when the student can:
- Create all current modules and organize topics.
- Import course PDFs and common files without internet access.
- Open supported files inside the app.
- Write notes connected to course materials.
- Track assignments and exams.
- Find content through one search box.
- Close and reopen the app without losing ordinary data.
- Export a complete backup and restore it successfully.
- Use core features with the network disconnected.
- Understand the storage limitations and has a tested backup.
- Use the app without broken routes, silent errors, or destructive surprises.

**Final rule:** build a dependable personal study system first; add sophistication only when the foundation is proven.
