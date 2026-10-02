# ADR 0003: SQLite Local Storage

## Context

The MVP needs durable local storage with minimal operational overhead.

## Decision

Use SQLite with Drizzle ORM for the local database.

## Consequences

The product can run locally without Neon. Future sync can map local records to a
remote store when that phase exists.
