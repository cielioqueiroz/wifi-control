# Tasks

- [x] Add local SQLite persistence for device snapshots.
- [x] Preserve first seen and latest observed timestamps.
- [x] Record discovery and online/offline status transition events.
- [x] Expose the persisted timeline through the local `/history` endpoint.
- [x] Add a Portuguese dashboard history view with timeline and device summary.
- [x] Keep the database path configurable through `WIFI_CONTROL_DB_PATH`.
- [x] Persist full device evidence and manual preferences between scans.
- [x] Preserve last positive presence time; mark absent devices only after a grace period in a scanned subnet.
- [x] Retain observations for 90 days and index timeline queries.
