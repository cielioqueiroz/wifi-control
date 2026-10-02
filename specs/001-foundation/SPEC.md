# Spec 001: Foundation

## Objective

Create a maintainable local-first monorepo foundation for WiFi Control.

## Requirements

- pnpm workspace and Turborepo.
- Next.js web app.
- Node.js local agent.
- Base packages for UI, shared types, config, database, network, and router
  adapters.
- TypeScript strict, ESLint, Prettier, Vitest, and Playwright configuration.
- SQLite/Drizzle schema.
- Docs, ADRs, AGENTS, context index, project state, and capabilities.
- GitHub Actions CI.

## Behavior

The repository should install, lint, typecheck, test, and build without needing
cloud services.

## Edge Cases

- No router credentials are available.
- The repository may be cloned without local SQLite data.
- CI must not require LAN access.

## Acceptance Criteria

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- Router control remains unsupported.
- Git repository is initialized and connected to the private GitHub repository.
