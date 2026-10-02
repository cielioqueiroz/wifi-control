# Project State

Current phase:
Phase 5 - Router control safety foundation.

In progress:

- None.

Completed:

- Initial monorepo structure.
- Base app/package scaffolding.
- Initial docs, ADRs, specs, and capabilities.
- Dependency installation.
- Validation: lint, typecheck, tests, and build.
- Git repository initialized.
- Foundation commit created.
- Windows network adapter, subnet guards, neighbor parsing, bounded ICMP scan,
  and local `/discover` endpoint implemented.
- Phase 1 tests and monorepo validation passed.
- Evidence correlation package, private-MAC protection, manual aliases, and
  local `/devices` endpoint implemented.
- Phase 2 tests and monorepo validation passed.
- Operational Dashboard with real agent data, responsive table, filters,
  details drawer, local rename/trust actions, and explicit connection states.
- Local CORS, interface timeout handling, and reserved neighbor filtering
  validated against the Windows runtime.
- Local SQLite history store persists device first/last seen data, discovery
  evidence, and status transitions.
- Dashboard history view exposes a Portuguese activity timeline and device
  presence summary through the local `/history` endpoint.
- Phase 4 tests, full QA, and a real Windows discovery/history round trip
  passed.
- Router action safety policy validates confirmation and protected targets
  without performing router I/O; the unsupported adapter remains the default.
- Local router configuration now accepts only adapter, endpoint, gateway, and a
  non-secret credential reference; passwords are not read by the application.

Next:

- Configure credentials locally and explicitly activate a documented router
  adapter before implementing block/unblock I/O.

Known issues:

- Next.js build emits a non-blocking warning that the Next ESLint plugin is not
  detected by the flat ESLint config.

Relevant files:

- `package.json`
- `turbo.json`
- `apps/web/`
- `apps/agent/`
- `packages/`
- `docs/`

Last updated:
2026-10-02
