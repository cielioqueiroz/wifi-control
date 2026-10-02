# AGENTS

Read only the context needed for the current task. Do not scan the whole
repository by default.

## Context Routing

- Architecture changes: `docs/ARCHITECTURE.md`
- Database changes: `docs/DATA_MODEL.md`
- UI changes: `docs/DESIGN_SYSTEM.md`
- Network discovery/scanner: `docs/NETWORK_DISCOVERY.md`
- Security-sensitive work: `docs/SECURITY.md`
- Router integration: `docs/ROUTER_INTEGRATION.md`
- Current status: `.ai/PROJECT_STATE.md`
- Source index: `.ai/CONTEXT_INDEX.md`

## Rules

- Keep the product local-first.
- Do not implement router blocking until legitimate router access exists.
- Do not use ARP spoofing, deauthentication, packet injection, or similar
  techniques.
- The frontend must not execute shell commands, access SQLite directly, or
  handle router credentials.
- Prefer TypeScript strict, small interfaces, and tests for critical logic.
- Keep docs synchronized only when a change affects their domain.
