# Codebase Structure Map

## Top-Level Directory Guide
- `crates/`: Rust workspace crates. Start here for backend, desktop runtime, relay, deployment, and git/workspace logic.
- `packages/local-web/`: Local React app shell.
- `packages/remote-web/`: Remote React app shell.
- `packages/web-core/`: Shared frontend product code used by both web apps.
- `packages/ui/`: Shared reusable UI primitives.
- `shared/`: Generated TypeScript contracts and executor schemas.
- `scripts/`: Dev and guardrail scripts.
- `docs/`: Product/documentation site content.
- `npx-cli/`: Published CLI package assets.

## Rust Workspace Areas
### Core local app backend
- `crates/server/src/main.rs`: local server entrypoint.
- `crates/server/src/routes/`: local HTTP route modules.
- `crates/server/src/routes/workspaces/`: workspace lifecycle, git, execution, PR, integrations.
- `crates/server/src/routes/remote/`: local adapters for remote/shared entities.

### Local domain/services
- `crates/services/src/services/`: business/service logic.
- `crates/db/src/models/`: SQLite-backed model/data access layer.
- `crates/db/src/lib.rs`: pool creation and migrations.
- `crates/local-deployment/src/lib.rs`: local dependency wiring and runtime setup.
- `crates/deployment/src/lib.rs`: deployment trait shared by local server code.

### Remote product
- `crates/remote/src/main.rs`: remote server entrypoint.
- `crates/remote/src/app.rs`: remote bootstrap/composition.
- `crates/remote/src/routes/`: remote HTTP routes.
- `crates/remote/src/db/`: Postgres queries/data access.
- `crates/remote/src/auth/`: JWT, OAuth, middleware, handoff logic.
- `crates/remote/src/github_app/`: GitHub App integration modules.

### Shared infrastructure crates
- `crates/api-types/`: types shared between local and remote backends/frontends.
- `crates/git/`: git service and CLI wrappers.
- `crates/review/`: review-related binary/tooling.
- `crates/executors/`: coding-agent/executor profiles and runtime logic.
- `crates/relay-*`, `crates/ws-bridge/`, `crates/desktop-bridge/`: relay/remote-access plumbing.
- `crates/tauri-app/`: desktop app wrapper.

## Frontend Areas
### Local web
- `packages/local-web/src/app/entry/`: bootstrap and root app wiring.
- `packages/local-web/src/app/router/`: TanStack router registration.
- `packages/local-web/src/routes/`: file-based local routes.
- `packages/local-web/src/app/navigation/`: local navigation adapter layer.

### Remote web
- `packages/remote-web/src/app/entry/`: bootstrap and app wiring.
- `packages/remote-web/src/app/router/`: TanStack router registration.
- `packages/remote-web/src/routes/`: file-based remote routes.
- `packages/remote-web/src/app/navigation/`: remote navigation adapter layer.

### Shared frontend
- `packages/web-core/src/pages/`: major product screens/features.
- `packages/web-core/src/shared/`: hooks, dialogs, providers, libraries, shared UI.
- `packages/web-core/src/i18n/`: locale config and translation files.
- `packages/ui/src/components/`: reusable lower-level components.

## Practical “Where To Change What”
- Add or change local API routes: `crates/server/src/routes/**`.
- Change local persistence schema/model logic: `crates/db/src/**`.
- Change local business logic: `crates/services/src/services/**`.
- Change remote REST or Electric-backed behavior: `crates/remote/src/routes/**` and `crates/remote/src/db/**`.
- Change shared types consumed by TS: Rust source in `crates/server/src/bin/generate_types.rs`, `crates/remote/src/bin/generate_types.rs`, and related Rust types; then regenerate `shared/`.
- Change local UI shell/runtime behavior: `packages/local-web/src/app/**`.
- Change remote UI shell/runtime behavior: `packages/remote-web/src/app/**`.
- Change shared feature UI: `packages/web-core/src/**`.
- Change shared UI primitives only: `packages/ui/src/**`.

## Naming and Placement Patterns Observed
- Rust modules use snake_case file names and directories, matching repo guidance in `AGENTS.md`.
- React route files follow TanStack Router file naming in `packages/local-web/src/routes/` and `packages/remote-web/src/routes/`.
- Shared frontend code is increasingly centralized outside app-specific shells, evidenced by the migration guard in `scripts/check-legacy-frontend-paths.sh`.
- Generated route trees live beside route files as `routeTree.gen.ts`.

## Guardrails and Documentation Pointers
- Repo-wide workflow guidance: `AGENTS.md`.
- Remote-specific backend patterns: `crates/remote/AGENTS.md`.
- Local frontend design/migration rules: `packages/local-web/AGENTS.md`.
- Docs authoring rules: `docs/AGENTS.md`.

## Unknowns / Not Confirmed
- No `.planning/STATE.md` existed at mapping time, so no prior project-state overlay was available.
- Some crates such as `crates/relay-tunnel/` and related relay components were inventoried structurally but not deeply decomposed here.
