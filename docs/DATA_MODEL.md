# Data model

## Current status

Phase 0 has no application data model and does not create or access an IndexedDB
database. Route content is static presentation only; it is not persisted.

## Planned persistence boundary

The initial data-model milestone will define typed records for modules and any
required metadata, stored locally in IndexedDB. Subsequent milestones may add
topics, materials and their file blobs, notes, tasks, and planning records.
Database schemas must be versioned, and every schema change must include a
migration.

Persistence will be accessed through dedicated repositories and services. UI
components will not query IndexedDB directly. Recovery and migration failures
must preserve existing user data; an automatic database reset is never an
acceptable fallback.

The detailed entity fields and relationships will be documented before the
database milestone is implemented.
