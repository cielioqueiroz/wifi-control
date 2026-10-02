# Spec 006: Router Control

## Objective

Implement router block/unblock only after legitimate router access is available.

## Requirements

- Document vendor capabilities.
- Protect gateway, current host, broadcast, invalid addresses, and mass actions.
- Require confirmation.
- Audit every action.

## Acceptance Criteria

- Huawei AX2 adapter is not implemented before legitimate access.
- Unsupported adapter remains the default fallback.

## Phase 5 implementation boundary

The first Phase 5 slice is a non-I/O safety foundation. It validates explicit
confirmation, unicast MACs, IPv4 targets, and protected addresses, while the
default adapter remains unsupported. Router credentials must be configured
locally and an explicit activation step must happen before a future adapter can
receive a block or unblock action.
