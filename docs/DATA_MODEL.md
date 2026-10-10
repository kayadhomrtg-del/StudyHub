# Data model

## Current schema: version 2

`src/features/modules/moduleDatabase.ts` declares Dexie database version 2.
The v2 migration adds topic, material metadata, and stored-file stores while
preserving existing modules. Module IDs are UUID strings. Records contain:

- `id`, `name`, `code`
- optional `semester`, `academicYear`, `lecturer`, `description`, and `color`
- `isArchived`
- ISO-8601 `createdAt` and `updatedAt`

The module store indexes ID, unique code, name, semester, academic year,
archive status, and update timestamp. The app does not include a fixed course
catalog; the user creates their own modules.

### Topic

Topics/week sections are records with an ID, parent module ID, title, order
index, and ISO creation/update timestamps. Their index supports lookup and
ordering by module. Reordering rewrites sort indexes within one transaction.

### Material metadata

Material metadata is stored separately from original bytes:

- ID, display title, original filename, MIME type, optional extension, size
- optional module and topic IDs (both may be unassigned)
- string tags, study status (`not-started`, `in-progress`, `completed`),
  favorite flag, and ISO creation/update timestamps

IDs—not filenames—identify material records, so multiple files with the same
name remain distinct. Materials can exist without a module or topic.

### Stored file

The `storedFiles` object store holds `{ id, bytes }` records, keyed by material
ID. `bytes` is the original file contents as an `ArrayBuffer`. Importing each
file writes its bytes and metadata in one IndexedDB
transaction. If either write fails (including quota exhaustion), neither
record is committed. Batch imports process files independently and return a
success or failure for each file.

## Persistence boundary

Reads/writes flow through dedicated module, topic, and material repositories and
services. Module validation, including case-insensitive module-code uniqueness,
happens before writing. File metadata and bytes are written atomically per
imported file. UI components do not query IndexedDB directly.

The database is stored by the browser on the local device. Clearing browser
storage can remove it; no cloud copy or automatic backup is provided in this
milestone.

Deleting a topic removes the topic record and clears that topic assignment from
its materials. Deleting a module removes its topics and clears module/topic
assignments from its materials, while retaining their metadata and file bytes.
Deleting a material explicitly removes both its metadata and corresponding
stored bytes in a single transaction.

## Future schema changes

Subsequent milestones may add notes, tasks, and planning records. Every schema
change must increment the Dexie version and provide a migration that preserves
existing user data. Never reset the database to recover from a migration or
storage error.
