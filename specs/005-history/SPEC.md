# Spec 005: History

## Objective

Track device presence over time.

## Requirements

- Persist first seen and last seen.
- Record online/offline transitions.
- Show activity timeline.

## Acceptance Criteria

- Repeated observations update `lastSeenAt`.
- Status transitions create activity events.

## Phase 4 implementation boundary

History is persisted in a local SQLite file managed by the agent. Discovery
snapshots, evidence, and activity events remain on the machine and are exposed
through the loopback-only `/history` endpoint. Router actions and credential
storage remain separate phases.
