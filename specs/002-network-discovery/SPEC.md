# Spec 002: Network Discovery

## Objective

Discover LAN device evidence through safe, bounded local sources.

## Requirements

- Enumerate local interfaces and gateway/subnet.
- Collect neighbor/ARP evidence.
- Add controlled ping sweep with timeouts and concurrency limits.
- Expose scanner API through the local agent.

## Acceptance Criteria

- Discovery works without internet.
- ICMP is not the only source.
- No aggressive network techniques are used.
