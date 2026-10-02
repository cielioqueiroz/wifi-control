# ADR 0005: Router Adapter Pattern

## Context

Routers are vendor-specific, and legitimate Huawei AX2 admin access is not yet
available.

## Decision

Represent router capabilities through an adapter interface. Ship only mock and
unsupported adapters in Phase 0.

## Consequences

Future router support can be added without coupling the MVP to one vendor or
encouraging unsafe access workarounds.
