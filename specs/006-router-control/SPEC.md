# Spec 006: Router Control

## Objective

Implement router block/unblock only after legitimate router access is available.

## Requirements

- Document vendor capabilities.
- Protect gateway, current host, broadcast, invalid addresses, and mass actions.
- Require confirmation.
- Audit every action.

## Acceptance Criteria

- Huawei AX2 adapter uses the official SCRAM login flow and MAC filter API.
- Unsupported adapter remains the default fallback.
- Real actions require local runtime credentials and explicit confirmation.
- Every request and result is recorded in the local audit history.

## Phase 5 implementation boundary

The adapter is available, but it is opt-in. The agent activates it only when
`ROUTER_ADAPTER=huawei-ax2`, `ROUTER_BASE_URL`, `ROUTER_CREDENTIAL_REF`,
`ROUTER_USERNAME`, and `ROUTER_PASSWORD` are present in the local runtime
environment. Passwords are never committed or stored in the database.

Administrative routes are local-only and guarded by the existing safety policy:
`POST /router/block`, `POST /router/unblock`, and `GET /router/devices`.
