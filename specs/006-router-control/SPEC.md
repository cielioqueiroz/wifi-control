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
