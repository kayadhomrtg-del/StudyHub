# College Study Hub

A local-first study workspace for organizing college modules, course materials,
notes, tasks, study sessions, and backups. The application uses React,
TypeScript, Vite, and Dexie/IndexedDB. It has no backend, account system, cloud
sync, analytics, or telemetry. Core study data stays on this device; the
optional AI flow sends selected extracted text only to its same-machine
loopback proxy. Gemini is accessed only through the local server after
explicit configuration and per-request approval.

## Features

- Create and organize modules and topics.
- Import study files into browser-local IndexedDB, keep them unassigned or link
  them to a module/topic, and manage tags, favorites, and study status.
- Preview PDFs, images, DOCX, PPTX, XLSX, Markdown, and common text/source
  formats locally; download the original file when appropriate.
- Create Markdown notes with preview, tags, pins, search, and optional links to
  other study records.
- Track assignments and other tasks, due dates, priorities, and completion.
- Search local module, topic, material, note, and task metadata.
- View dated tasks and plan local study sessions in the calendar and separate
  study planner; start guided active-recall review from a planned session
  linked to local material.
- Reveal the full locally extracted source only when ready, save recall
  attempts as ordinary material-linked notes, and explicitly confirm session
  completion.
- Export and restore versioned ZIP backups for the full library or an
  individual module.
- Use the production app shell offline after its first successful online load
  in a supporting browser. IndexedDB content remains browser-local and is not
  part of the service worker cache.

## Optional Gemini AI assistance (summary, quiz, and Q&A)

The optional AI feature is designed in `docs/AI_PLAN.md` as an optional,
disabled-by-default, loopback-only proxy for a single user on personal study
material. The application is fully usable without any of it.

**Phases 1–5 are implemented in the current working tree.** Phase 1 added the local proxy
skeleton, request validation, the launch-gate evaluator, the local daily budget,
and the error taxonomy in `server/ai/`, mounted by a Vite plugin in both the
development and the preview server. Phase 2 adds a summary surface reached from
a supported material's **Summarize** action. It extracts text locally, prepares
an exact payload through the loopback proxy, shows the full payload, requires a
fresh approval, and sends only a token and digest. A deterministic local
fallback makes zero network requests. Phase 3 adds **Quiz** with local
multiple-choice answer checking and **Ask questions** with single-turn
material-grounded Q&A. Both reuse the same request pipeline, show the frozen
M1–M8 disclosures and exact payload, and provide deterministic zero-fetch
fallbacks. Quiz answers/scores and Q&A questions/answers/references stay in
memory only. Phase 4 adds a local guided-recall workspace from planned
material-linked sessions. It reveals the complete locally extracted text only
after an explicit action; recall attempts are saved only by an explicit save or
confirmed finish as ordinary notes linked to the material. Finishing is
explicit and never inferred from elapsed time or navigation. This workflow
makes no AI or external request and does not change the database schema or
backup formats.

The Gemini provider uses the existing shared request pipeline. Optional
first-launch setup and Settings store the API key only on the local Windows
server using DPAPI; the browser never stores it or sends it directly to Google.
The first-launch panel does not block navigation. The project development,
preview, production, and Windows automatic-startup commands set
`STUDY_HUB_AI_ENABLED=1` in the server process. The flag enables the local
routes but does not activate provider requests. Dispatch additionally requires
successful model checks, owner confirmations, active gates, and fresh approval
of the exact payload. Local fallbacks continue working without a key.
Automated tests use mocked providers and never contact Google.

The owner reports that Google confirmed the intended personal, single-user
coursework use. No written response was available in the project files, so
this is recorded as a limited owner report, not independent evidence or
broader Google approval. The official terms remain documented. See
`docs/AI_PLAN.md` and `docs/AI_LAUNCH_CHECKLIST.md`.

## Screenshots

Screenshots are not included yet. Add screenshots here when reviewed,
non-personal examples are available.

## Requirements

- 64-bit Windows 10 or Windows 11 for the PowerShell startup scripts.
- Node.js 22.12+ (22.x), 24.x, or 26+, and npm 10+.
- A current browser with IndexedDB support.

The test runner's installed version requires Node.js 22.12+, 24.x, or 26+.
Node 23 and 25 are not in that dependency's supported engine range.

## First-time setup (Windows)

Clone or download the repository, open PowerShell in its folder, and run:

```powershell
.\scripts\setup-study-hub.ps1
```

The script checks Node/npm versions, runs `npm ci` from the lockfile, builds the
production application, and starts it on this PC. It does not change browser
data, Windows-wide settings, firewall rules, or install global npm packages.
It does not open a browser unless `-OpenBrowser` is supplied:

```powershell
.\scripts\setup-study-hub.ps1 -OpenBrowser
```

Open the printed local URL in your browser. If another process occupies the
default port, Vite selects the next available port and prints the actual URL.

## Development and quality checks

Run these from the project directory:

```powershell
npm ci
npm run dev
```

The development and preview commands set `STUDY_HUB_AI_ENABLED=1` in the
Node process before Vite starts. The production `npm run start` command and
the Windows automatic-startup script do the same. This enables the local AI
proxy routes; it does not bypass key configuration, launch gates, explicit
activation, budget limits, or fresh payload approval.

The Vite development server is for development only. Available checks are:

```powershell
npm run test
npm run test:server
npm run lint
npm run typecheck
npm run build
```

`npm run test` runs both the browser tests and the Node-side tests for the
optional AI proxy in `server/ai/`. `npm run test:server` covers the standalone
production server script.

`npm run build` includes a TypeScript project build before generating `dist/`.
To serve the built application locally:

```powershell
npm run build
npm run start
```

`npm run start` serves the production build through Vite's preview server,
bound to `127.0.0.1`. The default URL is
[`http://127.0.0.1:4173`](http://127.0.0.1:4173). It requires an existing
`dist/` build. Port conflicts fall through to another available port.
The port is part of the browser origin and therefore selects a separate
IndexedDB database. If a conflict makes the server choose a later port, use
the printed URL consistently; choose and configure a stable port before
creating study records to avoid confusing multiple local databases.
Configure the preferred port with:

```powershell
$env:STUDY_HUB_PORT = "4300"
npm run start
```

The standalone server is for an individual's local use, not a hardened,
multi-user production host. LAN mode is not implemented: the server always
binds to loopback, and the startup scripts do not open firewall ports or
configure a router.

## Windows automatic startup

The startup integration creates one per-user shortcut in the current Windows
account's Startup folder. It launches the built production server at sign-in,
with `STUDY_HUB_AI_ENABLED=1` set for the Node process before it starts. It
does not run the development server and does not require VS Code to be open.

Install (safe to rerun; it updates the same project-specific shortcut):

```powershell
.\scripts\install-startup.ps1
```

By default, sign-in starts the local server without opening a browser. To also
open the default browser at sign-in:

```powershell
.\scripts\install-startup.ps1 -OpenBrowserAtSignIn
```

The option is explicit; rerunning the installer without it turns automatic
browser opening off. To open the browser manually while starting or reusing the
server:

```powershell
.\scripts\start-study-hub.ps1 -OpenBrowser
```

To use another startup port:

```powershell
.\scripts\install-startup.ps1 -Port 4300
```

Remove only this project's startup shortcut (the server and application files
are left untouched):

```powershell
.\scripts\uninstall-startup.ps1
```

Stop a server started for this project:

```powershell
.\scripts\stop-study-hub.ps1
```

The startup scripts write process metadata and logs under the current user's
`%LOCALAPPDATA%\CollegeStudyHub` directory, separated by a hash of the project
path. The metadata is used to avoid duplicate server processes and to ensure
the stop script targets only this checkout. Startup errors are reported with
the log path. Setup/installation do not require administrator privileges.
Automatic startup and automatic browser opening are separate behaviors.

## Data storage, privacy, and backups

Study records, settings, and imported file bytes are stored in IndexedDB for
the current browser profile and origin on this computer. They are not
synchronized to another browser, profile, computer, or clone of the repository.
Clearing browser site data, profile loss, disk failure, or device loss can
destroy local records. A browser's persistent-storage grant is not a guarantee
against these events. Export backups regularly and store them somewhere safe
outside the browser profile and repository.

In **Settings & backups**, export either:

- A full-library ZIP containing all records/settings and every referenced
  original material file; or
- A module-scoped ZIP containing that module, its topics/materials, and
  associated original file bytes.

Restore validates the archive before writing. Choose merge or explicitly
confirm replace; conflicting IDs/module codes are reported rather than silently
overwritten. Full backup format v2 is versioned; supported v1 backups are
migrated on import. Archives have size and entry limits. Keep independent
backups: importing one archive is not a substitute for preserving your only
copy.

The production service worker caches only the application shell and same-origin
static assets. It does not cache study content or send it to a server. Offline
launch requires a successful first load and service-worker installation while
online, and browser support/storage policies vary. Offline functionality is
not guaranteed in every browser or private-browsing mode.

Do not place personal study materials, database files, or private backup ZIPs
inside the repository. `.gitignore` excludes common local data folders and
database/backup extensions, but always inspect Git status and staged files
before publishing.

### Optional AI feature and provider-side handling

The optional AI proxy described in `docs/AI_PLAN.md` is off by default. Phase
1–5 are implemented in the current working tree. It is a local, loopback-only
service for one user, and it changes three separate things that must not be
confused:

- **StudyHub's own storage.** AI prompts, outputs, and history are never
  written to IndexedDB, so nothing AI-related appears in a backup. "No AI
  persistence" refers only to StudyHub's own database and application storage.
  The proxy stores the encrypted key, launch artifact, activation state, and
  local usage counter under the git-ignored `.study-hub/` directory.
- **Provider-side handling.** A provider request sends the reviewed material
  text to Google under the configured project and tier. The provider's terms
  apply to submitted content: provider retention windows, abuse monitoring
  independent of the request's storage flag, possible
  review by authorised provider personnel, and — on a free tier — use of
  submitted content to improve the provider's products, where human reviewers
  may read and annotate it. These are disclosed from current official
  documentation and are not covered by StudyHub's local storage guarantees.
- **Per-request consent.** Before anything is sent, the exact payload is shown
  and requires a fresh, explicit approval. A payload digest is an integrity
  check only and is never proof of approval or authorization.

The owner reports that Google confirmed the intended personal coursework use.
No written response was available to this repository; do not infer broader
approval or quote unseen correspondence. The official terms are recorded
without alteration. See `docs/AI_LAUNCH_CHECKLIST.md`.

## Run your own copy

Every clone is an independent application source tree. Each user's data is
held by that user's browser profile and local origin; this repository does not
include or distribute your IndexedDB contents or backups.

1. Install a supported Node.js/npm version.
2. Clone this repository or download its source.
3. In PowerShell, run `.\scripts\setup-study-hub.ps1`.
4. Open the local URL printed by the script.
5. Optionally install automatic startup with
   `.\scripts\install-startup.ps1`.

For development, use `npm ci` and `npm run dev` instead.
Before rerunning the setup script in a checkout where a development or
production server is already running, stop that server first. Setup checks for
an active Vite process and refuses before `npm ci` can replace files it is
using.

## GitHub Actions

The CI workflow checks out the source, installs from `package-lock.json` with
`npm ci`, and runs the unit/server tests, lint, typecheck, and production build
on Node.js 22 and 24. It does not deploy the application.

## Publish your own GitHub repository

1. Create an empty repository on GitHub. Do not initialize it with a README,
   license, or personal study content.
2. Review `git status --short`, `git diff --check`, and the complete file list
   below. Stage only project source/configuration and documentation (not local
   study files, browser exports, logs, or generated output).
3. Review the staged file list and patch before committing:

   ```powershell
   git add .github .gitignore README.md docs eslint.config.js index.html package.json package-lock.json public scripts src tsconfig.app.json tsconfig.json tsconfig.node.json vite.config.ts
   git status --short
   git diff --cached --stat
   git diff --cached
   ```

4. Commit and push the current branch (the branch name is not rewritten):

   ```powershell
   git commit -m "Prepare College Study Hub for local distribution"
   git remote add origin https://github.com/<YOUR-ACCOUNT>/college-study-hub.git
   git push -u origin HEAD
   ```

   If a remote named `origin` already exists, inspect it with
   `git remote -v` instead of adding another. GitHub may prompt you to
   authenticate using its supported credential flow; never put a token in the
   repository or command text.

## Troubleshooting

- **Node/npm version error:** install Node.js 22.12+ (22.x), 24.x, or 26+,
  then open a new PowerShell window and check `node --version` and
  `npm --version`.
- **Setup install fails:** inspect the npm error printed by `npm ci`; ensure
  registry access is available for first-time dependency installation. No
  global packages are required.
- **No production build:** run `npm run build`, or rerun
  `.\scripts\setup-study-hub.ps1`.
- **Port is busy:** the server selects a later port automatically. Use the URL
  it prints, or set `$env:STUDY_HUB_PORT` / pass `-Port` to a PowerShell script.
- **Startup shortcut does not run:** verify the shortcut is in the current
  account's Startup folder and inspect the log under
  `%LOCALAPPDATA%\CollegeStudyHub`. The project directory and built `dist/`
  directory must still exist.
- **Offline page unavailable:** open the app online once in a browser that
  supports service workers, allow the service worker to finish installing, and
  retry. Browser storage clearing can remove offline cache and study data.
- **Missing local records:** confirm the same browser profile and origin are
  being used. Backups from another profile/device must be restored explicitly.

## License

No `LICENSE` file is present. A public GitHub repository without an explicit
license is not automatically open source and does not grant permission for
unrestricted reuse. Choose and add a license only after deciding which terms
you want to apply; no license has been selected for this project.

## Repository guide

- `src/` — React/TypeScript application and feature modules.
- `server/` — Node-side Vite plugin for the optional, gated AI proxy. It runs
  only in the Vite server process and has no browser code.
- `scripts/` — local production serving and Windows setup/startup scripts.
- `public/sw.js` — production application-shell service worker.
- `docs/` — product, architecture, data model, and test-plan documentation.
- `docs/AI_PLAN.md` — phased design for the optional, gated AI proxy.
- `docs/AI_LAUNCH_CHECKLIST.md` — launch-gate template, unresolved conditions,
  and the inert sample gate artifact.
