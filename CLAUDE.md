# Cadence Development Guidelines

## Project Structure
- Source code: `src/`
- Tests: colocated `*.test.ts`
- Build output: `dist/`

## Commands
- Install: `pnpm install`
- Build: `pnpm build`
- Test: `pnpm test`
- Lint: `pnpm lint`

## Code Style
- TypeScript, strict mode, ESM
- No `any` — use proper generics
- Colocate tests with source files
- Keep files focused and small

## Git Workflow
- Work on feature branches off `main`
- Use PRs for all changes
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

## Architecture Principles
- Pluggable interfaces (Transport, Store, Executor)
- Build for sophisticated, implement simple
- No domain-specific concepts in core — this is infrastructure
- Consumers (OpenClaw, MindMirror) define their own signal types

## Build Journal

After completing significant work (features, debugging sessions, deployments,
2+ hour focused sessions), write a build journal entry.

**Location:** `buildlog/YYYY-MM-DD-{slug}.md`
**Template:** `buildlog/_TEMPLATE.md`
