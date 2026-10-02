# Spec 003: Device Identification

## Objective

Correlate discovery evidence into device identities without treating inference
as fact.

## Requirements

- Store evidence source, value, time, and confidence.
- Identify private/randomized MAC addresses.
- Support detected, inferred, and manual claims.

## Acceptance Criteria

- Private MACs do not receive invented manufacturers.
- Manual names override display names without deleting evidence.

## Phase 2 implementation boundary

The current engine correlates Windows neighbor entries and ICMP results in
memory and returns normalized evidence for the local agent. Persistence into
the existing SQLite tables and additional hostname protocols remain follow-up
work for the dashboard and history phases.
