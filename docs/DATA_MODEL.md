# Data Model

SQLite is the local source of truth.

## Tables

- `devices`: current device identity and status.
- `device_addresses`: IP/MAC observations associated with devices.
- `observations`: raw normalized observations.
- `device_aliases`: detected, inferred, and manual names.
- `discovery_evidence`: evidence values with source and confidence.
- `activity_events`: online/offline and user-visible events.
- `router_actions`: future audit trail for block/unblock requests.

## Rules

- Do not use MAC as the only permanent identity.
- Distinguish detected, inferred, and manual values.
- Version Drizzle migrations in Git.
- Do not commit real SQLite databases.
