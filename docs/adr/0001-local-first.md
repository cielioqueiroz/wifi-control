# ADR 0001: Local-First Architecture

## Context

LAN discovery must work without internet and handles private network data.

## Decision

WiFi Control will keep discovery, device history, and the primary database local
by default.

## Consequences

Cloud sync can be added later, but it cannot become a dependency of LAN
scanning.
