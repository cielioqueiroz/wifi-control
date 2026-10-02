# ADR 0004: Local Agent Boundary

## Context

The frontend must not own shell access, platform discovery, SQLite access, or
router credentials.

## Decision

Use a local agent/API boundary for platform and persistence operations.

## Consequences

The web UI remains safer and easier to reason about. The agent must enforce
validation and bind locally by default.
