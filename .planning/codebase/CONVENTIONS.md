# Codebase Conventions Map

## Repo-Level Rules
- Repo guidance is centralized in `AGENTS.md`.
- Required finish-step called out there: run `pnpm run format` before completing work.
- Rust expectations in `AGENTS.md`: `rustfmt`, small functions, snake_case modules, PascalCase types.
- TypeScript/React expectations in `AGENTS.md`: ESLint + Prettier, 2-space indent, single quotes, ~80 column formatting, PascalCase components, camelCase functions/variables.

## Frontend Organization Conventions
- Local and remote app packages are thin shells around shared code in `packages/web-core/src`.
- `packages/local-web/AGENTS.md` documents an explicit split:
  - stateless view components in `views/`
  - stateful containers in `containers/`
  - reusable primitives in `ui-new/`
- New design styles are scoped under `.new-design` and rooted in `packages/web-core/src/app/styles/new/index.css` per `packages/local-web/AGENTS.md`.
- Navigation abstraction is treated as important enough to guard with script checks in `scripts/check-legacy-frontend-paths.sh`.

## Backend Organization Conventions
- Local backend shows a layered split:
  - HTTP adapters in `crates/server/src/routes/**`
  - deployment/runtime composition in `crates/local-deployment/src/lib.rs`
  - business logic in `crates/services/src/services/**`
  - persistence in `crates/db/src/**`
- Remote backend keeps routing under `crates/remote/src/routes/**` and data access under `crates/remote/src/db/**`.
- `crates/remote/AGENTS.md` documents a standardized mutation pattern using `MutationBuilder`, with route definitions gathered in `crates/remote/src/routes/mod.rs`.

## Shared Type and Schema Conventions
- `shared/types.ts` and `shared/remote-types.ts` are generated, not hand-edited, per `AGENTS.md`.
- Local generator source: `crates/server/src/bin/generate_types.rs`.
- Remote generator source: `crates/remote/src/bin/generate_types.rs`.
- Executor schema JSON files are consumed from `shared/schemas/` via custom Vite plugins in both app configs.

## Quality Gates and Automation
- Root checks in `package.json`:
  - `pnpm run check`
  - `pnpm run lint`
  - `pnpm run format`
- Additional frontend guardrails:
  - `scripts/check-legacy-frontend-paths.sh`
  - `scripts/check-unused-i18n-keys.mjs`
- Remote SQLx offline workflow is documented in `AGENTS.md` and `crates/remote/AGENTS.md`.

## Error Handling and Runtime Patterns
- Rust crates commonly use `thiserror` for domain errors, e.g. `crates/server/src/main.rs` and `crates/deployment/src/lib.rs`.
- Remote routes centralize request/response middleware in `crates/remote/src/routes/mod.rs`.
- Frontend auth requests use shared runtime helpers rather than inline token logic, e.g. `packages/web-core/src/shared/lib/remoteApi.ts` and `packages/web-core/src/shared/lib/relayBackendApi.ts`.

## Testing and Safety Norms Observed in Code
- Rust tests are colocated or live under crate-specific `tests/` directories, matching `AGENTS.md`.
- Git safety is explicitly tested in `crates/git/tests/git_ops_safety.rs` and `crates/git/tests/git_workflow.rs`.
- Legacy frontend migration is actively constrained instead of left to convention alone, via `scripts/check-legacy-frontend-paths.sh`.

## Documentation Sync Expectations
- `AGENTS.md` explicitly requires doc sync with code changes.
- `docs/AGENTS.md` adds stricter documentation rules for MDX pages and says to avoid assumptions.

## Unknowns / Not Confirmed
- No explicit conventional-commit rule or PR template was inspected in this pass.
- No repository-wide ESLint or Prettier config file was opened here, so formatter details beyond scripts and guidance are not restated.
