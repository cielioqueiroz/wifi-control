# Router Integration

Router control is not part of the MVP.

Current observed router:

- Vendor: Huawei
- Model: WiFi AX2
- Gateway: `192.168.3.1`

Legitimate administrative credentials are available to the owner, but they must
be configured locally before any action can be enabled. Do not paste them into
chat or commit them. Until a documented administrative integration is enabled,
do not implement Huawei AX2 login by reverse engineering, deauthentication, ARP
spoofing, packet injection, or any workaround.

## Adapter Contract

Router integrations must implement:

- `getInfo`
- `listConnectedDevices`
- `blockDevice`
- `unblockDevice`
- `listBlockedDevices`

Phase 0 includes `UnsupportedRouterAdapter` and `MockRouterAdapter` only.

## Phase 5 safety boundary

The adapter package now includes a pure validation policy for future actions.
It requires an action-specific confirmation, a valid unicast MAC, a valid IPv4
address, and rejects the gateway, local host, and broadcast addresses. It does
not perform router I/O. The default adapter continues to return
`unsupported`, so no network device can be blocked until the owner explicitly
activates a configured adapter.
