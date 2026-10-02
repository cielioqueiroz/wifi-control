# PRD

## Vision

WiFi Control gives a home user a local-first view of devices present on their
LAN and prepares for safe router control later.

## Problem

Home routers often expose limited, vendor-specific device lists. Users need a
clear local inventory with evidence, history, and trust status without sending
private network identifiers to cloud services.

## Objective

Detect LAN devices, correlate evidence into device records, show online status,
allow manual naming/trust decisions, and preserve local history.

## Target User

A technical home user running Windows 10/11 who wants visibility into a
domestic network.

## Scope

- Local agent and dashboard.
- Device discovery architecture.
- SQLite local storage.
- Evidence-based identification.
- Disabled router-control surface until configured.

## Non-Scope

- Router login automation.
- Blocking/disconnecting devices in the MVP.
- Cloud sync, Neon, Vercel deployment, notifications, Tauri, or mobile apps.
- Aggressive network techniques.

## Functional Requirements

- List detected devices with IP, MAC, hostname, status, and evidence when
  available.
- Distinguish detected, inferred, and manually defined values.
- Mark devices as trusted, unknown, or blocked in local state.
- Record first seen, last seen, observations, and activity events.
- Signal private/randomized MAC addresses.

## Non-Functional Requirements

- LAN discovery must work without internet.
- Default API bind address must be `127.0.0.1`.
- Scans must use bounded concurrency and timeouts.
- UI should prioritize dense, legible network operations workflows.

## Security Requirements

- No router credentials in SQLite, logs, commits, or frontend responses.
- No frontend shell execution.
- Zod validation at local API boundaries.
- Future blocking must protect gateway, host machine, broadcast, and invalid
  addresses by default.

## Technical Metrics

- TypeScript strict passes.
- Lint, tests, and build pass in CI.
- Discovery engine can accept multiple evidence sources without cloud
  dependency.

## Acceptance Criteria

- Phase 0 creates a working monorepo foundation.
- Docs and ADRs define product boundaries.
- Router integration remains abstract and non-functional.
- CI runs install, lint, typecheck, tests, and build.

## Known Limitations

- No scanner implementation yet.
- No persisted runtime database connection yet.
- No router admin credentials available.

## Roadmap

1. Foundation.
2. Network discovery.
3. Device identification.
4. Dashboard.
5. History.
6. Router integration after legitimate access.
7. Optional notifications.
8. Optional cloud sync.
9. Optional desktop packaging.
