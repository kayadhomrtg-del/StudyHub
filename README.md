# College Study Hub

A local-first study workspace for organizing college modules, course materials,
notes, tasks, study sessions, and backups. The application uses React,
TypeScript, Vite, and Dexie/IndexedDB. It has no backend, account system, cloud
sync, analytics, telemetry, or external AI service.

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
  study planner.
- Export and restore versioned ZIP backups for the full library or an
  individual module.
- Use the production app shell offline after its first successful online load
  in a supporting browser. IndexedDB content remains browser-local and is not
  part of the service worker cache.

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

The Vite development server is for development only. Available checks are:

```powershell
npm run test
npm run test:server
npm run lint
npm run typecheck
npm run build
```

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
account's Startup folder. It launches the built production server at sign-in;
it does not run the development server and does not require VS Code to be open.

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
- `scripts/` — local production serving and Windows setup/startup scripts.
- `public/sw.js` — production application-shell service worker.
- `docs/` — product, architecture, data model, and test-plan documentation.
