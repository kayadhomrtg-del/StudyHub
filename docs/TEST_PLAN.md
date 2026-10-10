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

## Phase 1 module checks

- Create a module and verify every entered field is persisted in IndexedDB.
- Edit a module and verify its ID and creation timestamp remain stable while
  its update timestamp changes.
- Reject blank names/codes, invalid accent colors, oversized fields, and
  case-insensitive duplicate module codes without writing a record.
- Archive a module, verify it leaves the active filter, then restore it.
- Delete a module only after explicit confirmation.
- Search module names, codes, lecturer, semester, and academic year; filter by
  semester and active/archived status.
- Open a module detail by stable ID and verify the record survives a page
  refresh.
- Verify the modules page reports IndexedDB errors and offers retry without
  clearing existing data.

  ## Phase 2 topic and material checks

  - Upgrade a version 1 database and verify existing module records remain
    available under version 2.
  - Create, rename, and reorder topics; verify ordering and persistence after
    reopening the database.
  - Import multiple files through both the picker and drag-and-drop, including two
    files with the same filename, and verify distinct material IDs and original
    bytes.
  - Import with no module/topic, and with a valid module/topic; verify
    relationships and unassigned material support.
  - Assign, reassign, and unassign materials; reject a topic from another module.
  - Verify tags are trimmed/deduplicated, and favorite and study status persist.
  - Force an IndexedDB quota/write failure after the first store write and verify
    the transaction leaves neither metadata nor file bytes.
  - Verify each input file has an individual success/failure result and that one
    failed file does not roll back other successfully imported files.
  - Confirm import treats file content as bytes only; it never executes it or sends
    it to a server.

## Phase 3 local viewer checks

- Upgrade a version 2 database to version 3 and verify existing module, material,
    and file-byte records remain available.
- Open a material and verify metadata and original bytes load independently and
    `lastOpenedAt` is persisted without changing `updatedAt`.
- Verify PDF loading, page navigation, zoom, fit-width, and a clear error for
    malformed PDF bytes.
- Verify common raster image formats show a preview and damaged images report
    an error with an original download option.
- Verify TXT, Markdown, code, JSON, CSS, and HTML previews remain inert;
    Markdown raw HTML and imported HTML never create live elements.
- Verify DOCX formatting, PPTX slide parsing/navigation, and XLSX worksheet
    parsing/selection with local Open XML fixtures and malformed-file errors.
- Verify text search reports matches in supported documents and the original
    file remains downloadable from every viewer.
- Navigate between materials assigned to the same topic and verify changing
    files releases the prior viewer resources and records the new open timestamp.
- Verify object URLs and PDF render/document resources are cleaned up on switch
    and unmount.

## Backup, recovery, and storage checks

- Export a full backup and restore it into a fresh IndexedDB database; compare
    module/topic/material relationships and byte-for-byte original-file contents.
- Export and restore a module backup and verify it includes that module's
    topics, assigned materials, and original bytes.
- Reject malformed archives, unsupported versions, missing file entries,
    mismatched sizes, broken references, duplicate IDs, and conflicting module
    codes before mutating any record.
- Reject ZIP archives whose declared expansion exceeds limits before inflation,
    and reject entries with invalid CRCs before restoring their contents.
- Simulate a write/quota failure during restore and verify the Dexie transaction
    rolls back without removing previously stored records.
- Verify merge leaves existing records intact and replace requires confirmation.
- Verify Settings accurately reports estimate/persistence API support and
    handles denied or unsupported persistent-storage requests.
- Verify full export fails explicitly when stored bytes are missing; no material
    is silently omitted from a backup.
