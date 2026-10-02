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
