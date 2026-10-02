# Tests

- SQLite store keeps the earliest `firstSeenAt` and latest `lastSeenAt`.
- Repeated observations do not create duplicate status transitions.
- A status change creates a `status_changed` activity event with both states.
- Agent discovery persists a snapshot and `/history` returns it over local CORS.
- Dashboard production build includes the history view.
