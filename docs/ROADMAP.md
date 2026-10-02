# Roadmap

## Phase 0 - Foundation

Monorepo, tooling, docs, AGENTS, skills, base design system, database schema,
and CI.

## Phase 1 - Network Discovery

Interfaces, subnet, gateway, controlled ping sweep, neighbor/ARP, and scanner
API.

## Phase 2 - Device Identification

Reverse DNS, mDNS, SSDP, MAC flags, evidence engine, and confidence.

## Phase 3 - Dashboard

Overview, device table, details, renaming, and trusted/untrusted flows.

## Phase 4 - History

Observations, first/last seen, online/offline transitions, and timeline.

## Phase 5 - Router Integration

Adapter, protected local API, DPAPI setup, confirmation UI and audit implemented.
Hardware acceptance still requires local credential setup and a selected target.

## Phase 6 - Local notifications

Implemented: persistent notifications and read state, optional system alerts,
monitoring preferences and light/dark themes.

## Windows distribution

Portable static dashboard and bundled agent with start/stop scripts. Node 24
is required. Tauri was evaluated and deferred in ADR 0006.

## Optional cloud sync

Not activated. No cloud resources, accounts or telemetry are required for the
local product. Scope and destination must be chosen before exporting LAN data.
