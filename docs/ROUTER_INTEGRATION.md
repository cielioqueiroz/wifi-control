# Router Integration

Router control is not part of the MVP.

Current observed router:

- Vendor: Huawei
- Model: WiFi AX2
- Gateway: `192.168.3.1`

The owner is waiting for legitimate administrative credentials from the
provider. Until then, do not implement Huawei AX2 login, reverse engineering,
blocking, deauthentication, ARP spoofing, packet injection, or any workaround.

## Adapter Contract

Router integrations must implement:

- `getInfo`
- `listConnectedDevices`
- `blockDevice`
- `unblockDevice`
- `listBlockedDevices`

Phase 0 includes `UnsupportedRouterAdapter` and `MockRouterAdapter` only.
