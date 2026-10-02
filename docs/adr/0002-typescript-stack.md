# ADR 0002: TypeScript Stack

## Context

The project needs one main runtime for web, local agent, packages, and tests.

## Decision

Use TypeScript strict with Next.js, React, Node.js, pnpm, and Turborepo.

## Consequences

Shared contracts can move across apps and packages without adding another
runtime.
