# Data Model

SQLite is the local source of truth.

## Tables

- `devices`: current device identity and status.
- `device_addresses`: IP/MAC observations associated with devices.
- `observations`: raw normalized observations.
- `device_aliases`: detected, inferred, and manual names.
- `discovery_evidence`: evidence values with source and confidence.
- `activity_events`: online/offline and user-visible events.
- `router_actions`: administrative audit trail.
- `device_snapshots`: persisted identities, claims and evidence for the dashboard.
- `device_preferences`: manual names and trust independent of new discovery results.
- `app_settings`: local monitoring, retention and theme preferences.
- `notification_reads`: acknowledged activity events.

## Rules

- Do not use MAC as the only permanent identity.
- Distinguish detected, inferred, and manual values.
- Runtime SQL migrations are versioned in `packages/database/src/migrations.ts`
  and applied transactionally with `PRAGMA user_version` (ADR 0006).
- The original Drizzle schema is a design reference, not a runtime migrator.
- Do not commit real SQLite databases.
