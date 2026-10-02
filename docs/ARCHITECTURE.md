# Architecture

WiFi Control is a local-first monorepo.

```text
Web UI
  |
Local Agent/API
  |
Discovery Engine
  |
Correlation / Identification Engine
  |
SQLite
  |
Router Adapter Layer
```

## Boundaries

The Web UI renders device status and sends requests to the local agent. It must
not execute shell commands, call PowerShell, access SQLite directly, mount
commands, or handle router credentials.

The Local Agent owns platform access, discovery orchestration, validation,
storage, and future router calls. Its default bind address is `127.0.0.1`.

The Discovery Engine collects bounded evidence from platform adapters. It must
not depend on internet access.

The Router Adapter Layer is a contract boundary. Phase 0 includes only
unsupported and mock behavior.

## Packages

- `packages/shared`: domain types and small shared helpers.
- `packages/config`: validated runtime config.
- `packages/network`: network adapter contracts.
- `packages/database`: Drizzle SQLite schema.
- `packages/router-adapters`: router contracts and safe mocks.
- `packages/ui`: shared UI primitives.

## Platform Strategy

Windows is first. Platform-specific logic should live behind adapter
interfaces. Future adapters may support Linux and macOS.
