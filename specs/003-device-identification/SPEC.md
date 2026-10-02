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

The engine correlates neighbors, ICMP, reverse DNS, mDNS and SSDP. PTR queries
use the private gateway resolver with eight workers and a 700 ms timeout.
Multicast collection lasts 1.5 seconds per interface (at most four interfaces).
SSDP location URLs are never fetched. A failed ping cannot override positive
neighbor or multicast presence. Names retain detected/manual provenance.
