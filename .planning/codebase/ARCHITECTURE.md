# Codebase Architecture Map

## High-Level Shape
- The repository contains two closely related products:
  - Local/desktop Vibe Kanban, centered on `crates/server`, `crates/local-deployment`, `packages/local-web`, and `crates/tauri-app`.
  - Hosted/remote Vibe Kanban, centered on `crates/remote` and `packages/remote-web`.
- Shared frontend domain logic is extracted into `packages/web-core/src`.
- Shared low-level UI primitives live in `packages/ui/src`.
- Shared API/type contracts are emitted into `shared/`.

## Local Product Architecture
### Composition
- `crates/server/src/main.rs` boots listeners, asset setup, deployment initialization, preview proxy, and the Axum route tree.
- `crates/server/src/lib.rs` aliases `DeploymentImpl` to `local_deployment::LocalDeployment`.
- `crates/local-deployment/src/lib.rs` is the main local composition root: config loading, DB creation, analytics, auth context, remote client, relay control, preview proxy, workspace manager, and container services.
- `crates/deployment/src/lib.rs` defines the abstract deployment contract consumed by server routes.

### Request Flow
- HTTP enters `crates/server/src/routes/mod.rs`.
- Routes are organized by concern, for example `crates/server/src/routes/workspaces/`, `crates/server/src/routes/repo.rs`, `crates/server/src/routes/events.rs`, and `crates/server/src/routes/attachments.rs`.
- Route handlers call deployment-backed services from `crates/services/src/services/` and models in `crates/db/src/models/`.
- Persistent local state is stored in SQLite via `crates/db/src/lib.rs`.

### Frontend Flow
- Local React bootstrap is `packages/local-web/src/app/entry/Bootstrap.tsx`.
- Router is created in `packages/local-web/src/app/router/index.ts`.
- Root route shell is `packages/local-web/src/routes/__root.tsx`.
- Most feature screens and shared hooks/components come from `packages/web-core/src`.

## Remote Product Architecture
### Composition
- `crates/remote/src/main.rs` loads config, optional billing provider, and starts `Server::run`.
- `crates/remote/src/app.rs` builds the remote server state: Postgres pool, migrations, Electric setup, JWT/OAuth services, mailer, storage services, GitHub App, analytics, and router.
- Shared request state is centralized in `AppState` (referenced throughout `crates/remote/src/routes/`).

### Request Flow
- HTTP enters `crates/remote/src/routes/mod.rs`.
- Public routes and protected routes are split before protected routes are wrapped with `require_session`.
- CRUD-style route modules are grouped by domain: `projects`, `issues`, `project_statuses`, `tags`, `notifications`, `organization_members`, `workspaces`, and related issue subresources.
- Remote persistence is in `crates/remote/src/db/`.
- Electric read-sync runs beside REST mutation paths; this is described in `crates/remote/AGENTS.md`.

### Frontend Flow
- Remote React bootstrap is `packages/remote-web/src/app/entry/Bootstrap.tsx`.
- Remote router is created in `packages/remote-web/src/app/router/index.ts`.
- The remote root layout in `packages/remote-web/src/routes/__root.tsx` wraps shared providers, workspace context, modal support, and keyboard shortcut infrastructure.
- Remote web still reuses large portions of `packages/web-core/src`.

## Shared Layering Pattern
- Transport and bootstrapping:
  - Local: `crates/server/src/routes/**`, `packages/local-web/src/app/**`
  - Remote: `crates/remote/src/routes/**`, `packages/remote-web/src/app/**`
- Domain/service logic:
  - Local: `crates/services/src/services/**`
  - Remote: route/domain modules under `crates/remote/src/` and `crates/remote/src/db/**`
- Persistence:
  - Local: `crates/db/src/**`
  - Remote: `crates/remote/src/db/**`
- Shared contracts:
  - `crates/api-types/`
  - `shared/types.ts`
  - `shared/remote-types.ts`

## Key Cross-Cutting Flows
### Type Sharing
- Rust structs/enums derive `TS`, then generators in `crates/server/src/bin/generate_types.rs` and `crates/remote/src/bin/generate_types.rs` emit TypeScript contracts into `shared/`.
- Both frontends consume those generated contracts directly.

### Local-to-Remote Bridge
- `crates/local-deployment/src/lib.rs` reads `VK_SHARED_API_BASE` / `VK_SHARED_RELAY_API_BASE`.
- Shared frontend remote helpers live in `packages/web-core/src/shared/lib/remoteApi.ts` and `packages/web-core/src/shared/lib/relayBackendApi.ts`.
- Remote frontend can proxy some local interactions over WebRTC from `packages/remote-web/src/app/entry/Bootstrap.tsx`.

### Preview / Runtime Shell
- Local server also starts a preview proxy in `crates/server/src/main.rs`.
- Shared preview-related server logic is separated into `crates/preview-proxy/` and `crates/server/src/routes/preview.rs`.

## Architectural Themes Observed
- Strong preference for many focused crates rather than a single large Rust binary.
- Frontend aims for thin app shells with shared product logic in `packages/web-core/src`.
- Route trees are file-based/generated on the frontend and module-based on the backend.
- Local and remote products share concepts but not identical persistence or auth stacks.

## Unknowns / Not Confirmed
- Eventual production topology for the local server outside Tauri/NPX was not traced end-to-end.
- Some relay crates were identified structurally but not deeply analyzed in this pass, so their internal protocol layering is only partially mapped.
