# Project State

Current phase:
Phase 5 - Router control adapter and guarded actions.

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
- Router action safety policy validates confirmation and protected targets.
- Huawei AX2 adapter implements the official SCRAM login flow, device listing,
  dual-band MAC filter updates, and guarded block/unblock routes.
- Local router configuration now accepts only adapter, endpoint, gateway, and a
  non-secret credential reference. Runtime credentials are accepted only from
  process environment values and are never stored or returned.

Next:

- Configure the local runtime credentials and perform a harmless read-only AX2
  round trip before using an explicitly confirmed block/unblock action.

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
