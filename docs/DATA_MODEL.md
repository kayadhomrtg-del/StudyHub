# Data model

## Current schema: version 5

`src/features/modules/moduleDatabase.ts` declares Dexie database version 5.
The v2 migration adds topic, material metadata, and stored-file stores while
preserving existing modules. Version 3 adds an index for material last-opened
timestamps without rewriting or deleting existing material or file records.
Version 4 adds the notes store without changing existing records.
Version 5 adds the tasks store without changing existing records.
Module IDs are UUID strings. Records contain:

- `id`, `name`, `code`
- optional `semester`, `academicYear`, `lecturer`, `description`, and `color`
- `isArchived`
- ISO-8601 `createdAt` and `updatedAt`

The module store indexes ID, unique code, name, semester, academic year,
archive status, and update timestamp. The app does not include a fixed course
catalog; the user creates their own modules.

### Topic

Topics/week sections are records with an ID, parent module ID, title, optional
description, order index, and ISO creation/update timestamps. Their index
supports lookup and ordering by module. Reordering rewrites sort indexes within
one transaction.

### Material metadata

Material metadata is stored separately from original bytes:

- ID, display title, original filename, MIME type, optional extension, size
- optional module and topic IDs (both may be unassigned)
- string tags, study status (`not-started`, `in-progress`, `completed`),
  favorite flag, ISO creation/update timestamps, and optional ISO `lastOpenedAt`

IDs—not filenames—identify material records, so multiple files with the same
name remain distinct. Materials can exist without a module or topic.

### Stored file

The `storedFiles` object store holds `{ id, bytes }` records, keyed by material
ID. `bytes` is the original file contents as an `ArrayBuffer`. Importing each
file writes its bytes and metadata in one IndexedDB
transaction. If either write fails (including quota exhaustion), neither
record is committed. Batch imports process files independently and return a
success or failure for each file.

### Note

Notes retain Markdown source, not rendered HTML. Each local record has a stable
ID, title, source text, normalized tags, pin state, and creation/update
timestamps. An optional link targets one module, topic, material, or task ID.
Module/topic/material/task links are checked against local records. Deleting a
linked module, topic, material, or task clears the note link in the same IndexedDB
transaction, preserving the note and its content. Autosaves are serialized per
note so newer edits cannot be overwritten by an older write. Titles are limited
to 200 characters, Markdown to one million characters, and tags to 30 entries
of at most 50 characters each.

Note previews disable raw HTML. Remote images are omitted by the shared
Markdown renderer; imported HTML and scripts are not executed.

### Task

Tasks are local records with a title, description, optional module/topic links,
optional ISO due date/time, priority, status, type, linked material IDs, tags,
and creation/update timestamps. `completedAt` is present only while the task is
completed. Module/topic/material links are validated and are cleared when the
linked record is deleted; deleting a task also clears note links to it without
deleting the note. Missing due dates are allowed. The dashboard lists only
real, future-dated tasks that are not completed or submitted.

### Local search and dashboard queries

Global search runs against module, topic, material metadata, note, and task
stores in this browser. Search results are grouped by record type and link to
their local detail or management view. Search does not query `storedFiles` or
load original file bytes. Topic descriptions are optional; older topics without
a description remain searchable by title. Dashboard module counts, recent
materials, upcoming tasks, and task/material completion totals are derived
from persisted records; an empty database shows zero/empty states rather than
sample activity.

## Persistence boundary

Reads/writes flow through dedicated module, topic, material, note, and task
repositories and services. Module validation, including case-insensitive
module-code uniqueness, happens before writing. File metadata and bytes are
written atomically per imported file. UI components do not query IndexedDB
directly.

The database is stored by the browser on the local device. Clearing browser
storage can remove it; no cloud copy or automatic backup is provided in this
milestone.

Deleting a topic removes the topic record and clears that topic assignment from
its materials. Deleting a module removes its topics and clears module/topic
assignments from its materials, while retaining their metadata and file bytes.
Deleting a material explicitly removes both its metadata and corresponding
stored bytes in a single transaction.

The viewer loads metadata and file bytes through the material service. Opening
a material updates `lastOpenedAt` without changing its content `updatedAt`.
PDF, browser-supported raster images, DOCX, PPTX, XLSX, Markdown, and supported
source/text formats are previewed locally. DOCX rendering is sanitized and
isolated in a sandboxed frame, Markdown raw HTML is disabled, and source text is
highlighted without executing it. PDF, DOCX, PPTX, XLSX, and text content can
be searched in-app; XLSX search covers the worksheet data loaded for preview.
Every material retains an original download action. Office preview limits are
100 MiB per file; text/code preview is limited to 8 MiB / 2 million characters.
Spreadsheet previews show at most 500 rows by 40 columns per worksheet.
DOCX/PPTX/XLSX previews reject ZIP containers exceeding 10,000 entries or
200 MiB expanded. Backup imports are preflighted before inflation, limited to
10,002 entries and 512 MiB of original file data plus bounded metadata, and
verify entry CRCs before records can be restored.

## Backup format version 1

Backups do not alter the IndexedDB schema. A ZIP contains `manifest.json`
(format, version, kind, export timestamp, and record counts), `records.json`
(module/topic/material metadata), and one `files/<material-id>.bin` entry for
each material's exact original bytes. Full backups include unassigned records;
module backups contain that module, its topics, assigned materials, and their
bytes. Export fails explicitly if any associated bytes are missing or do not
match metadata. Restore validates the whole archive and relationships first.
Merge rejects existing IDs and case-insensitive module-code conflicts without
writing; replace clears and writes all included library stores in one Dexie
transaction after explicit user confirmation. Notes and tasks are excluded
from backup archives. Backup archives are limited to 512 MiB,
10,002 entries, and a bounded expanded size before decompression.

## Storage retention

Course data remains in this browser's IndexedDB. Settings displays browser
storage usage/quota estimates where supported and allows a user-triggered
persistent-storage request. A grant depends on browser policy and does not
protect against disk/profile failure or deliberate storage clearing. Keep
downloaded backups outside the browser.

## Future schema changes

Subsequent milestones may add calendar and planning records. Every schema
change must increment the Dexie version and provide a migration that preserves
existing user data. Never reset the database to recover from a migration or
storage error.
