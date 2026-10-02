# Network Discovery

Discovery is evidence-based and local-first. Do not rely on a single source.

## Sources

1. Network interfaces.
2. Gateway/subnet.
3. ICMP ping.
4. ARP.
5. Windows neighbor table.
6. Reverse DNS.
7. mDNS.
8. SSDP/UPnP.
9. MAC OUI when applicable.
10. Light service fingerprinting only when needed.

## Rules

- Some devices ignore ICMP.
- Use bounded concurrency, timeouts, cancellation, and scan intervals.
- Do not run broad port scans by default.
- Do not use ARP spoofing, deauthentication, or packet injection.
- Treat inferred values as claims, not facts.

## Private MAC

Locally administered MAC addresses, such as `EA-57-FD-A3-38-C8`, must be
marked as private/randomized. Do not invent a manufacturer OUI for them.
