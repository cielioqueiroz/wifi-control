# ADR 0006: Native SQLite and portable Windows distribution

## Context

The history implementation already uses Node 24 node:sqlite. Runtime schema
creation had no migration version. The client is entirely local and can be
exported as static files. A native UI wrapper would add another toolchain.

## Decision

Keep native SQLite as the runtime driver. Version SQL migrations in
packages/database/src/migrations.ts and apply them transactionally using
PRAGMA user_version. Migration 1 adopts existing databases without dropping
tables. Reject databases created by a newer application version.
The original Drizzle schema remains a design reference, not a second runtime
migrator; runtime migrations are the source of truth. This explicitly replaces
the original plan for Drizzle-generated runtime migrations.

Export Next.js to static files and bundle the agent with esbuild. Distribute
a portable Windows directory requiring Node 24, with loopback-only launchers.
Evaluate Tauri again only if native menus or installation become requirements.

## Consequences

No native database dependency build or Rust/WebView toolchain is required.
Data and DPAPI credentials live outside release artifacts. Future schema
changes must add a new ordered migration and a data-preservation test.
