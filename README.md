# WiFi Control

Local-first network visibility for a home LAN.

## Status

Phase 0 foundation is being prepared. The MVP does not include router blocking,
router login automation, cloud sync, or aggressive network techniques.

## Commands

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Workspace

- `apps/web`: Next.js dashboard.
- `apps/agent`: local agent/API boundary.
- `packages/network`: platform discovery contracts.
- `packages/database`: SQLite/Drizzle schema.
- `packages/router-adapters`: router integration contracts and safe mocks.
- `packages/shared`: shared domain types.
- `packages/ui`: shared UI primitives.
- `packages/config`: shared configuration helpers.

Read [.ai/CONTEXT_INDEX.md](.ai/CONTEXT_INDEX.md) to find the right context
for a task without loading the whole repository.
