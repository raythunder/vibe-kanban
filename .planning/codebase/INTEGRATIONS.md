# Codebase Integrations Map

## Persistence and Data Stores
- Local app uses SQLite through `crates/db/src/lib.rs` and model files under `crates/db/src/models/`.
- Remote app uses PostgreSQL via pool creation/migrations in `crates/remote/src/app.rs` and `crates/remote/src/db/`.
- Remote sync depends on ElectricSQL, documented in `crates/remote/AGENTS.md` and wired through `crates/remote/src/routes/electric_proxy.rs`.

## Authentication and Identity
- Remote auth supports GitHub and Google OAuth providers via `crates/remote/src/app.rs` and `crates/remote/src/auth/`.
- Remote JWT/session configuration is parsed in `crates/remote/src/config.rs`.
- Local frontend auth runtime is configured in `packages/local-web/src/app/entry/Bootstrap.tsx`.
- Remote frontend auth runtime is configured in `packages/remote-web/src/app/entry/Bootstrap.tsx`.
- Local deployment can optionally talk to the remote API when `VK_SHARED_API_BASE` is set in `crates/local-deployment/src/lib.rs`.

## Storage and File Handling
- Local attachment/file storage flows through `crates/services/src/services/file.rs` and local attachment routes under `crates/server/src/routes/attachments.rs`.
- Remote issue attachments support Azure Blob storage through `crates/remote/src/app.rs`, `crates/remote/src/config.rs`, and `crates/remote/src/attachments/`.
- Remote review/storage paths support Cloudflare R2 via `crates/remote/src/app.rs` and `crates/remote/src/config.rs`.

## Analytics and Observability
- Local frontend uses Sentry and PostHog in `packages/local-web/src/app/entry/Bootstrap.tsx`.
- Remote frontend uses PostHog in `packages/remote-web/src/app/entry/Bootstrap.tsx`.
- Backend Sentry helper code lives in `crates/utils/src/sentry.rs`.
- Local analytics service is part of deployment wiring in `crates/local-deployment/src/lib.rs` and `crates/services/src/services/analytics.rs`.
- Remote analytics setup is in `crates/remote/src/app.rs` and `crates/remote/src/analytics.rs`.

## Messaging and Notifications
- Email notifications use Loops when configured in `crates/remote/src/app.rs` and `crates/remote/src/mail.rs`.
- Digest/notification background work is controlled in `crates/remote/src/app.rs` and `crates/remote/src/digest/task.rs`.
- Local event streaming is exposed through `crates/deployment/src/lib.rs` and server event routes in `crates/server/src/routes/events.rs`.

## Git and Workspace Tooling
- Git operations are abstracted in `crates/git/src/lib.rs` and `crates/git/src/cli.rs`.
- Workspace/worktree lifecycle uses `crates/workspace-manager/`, `crates/worktree-manager/`, and local deployment wiring in `crates/local-deployment/src/lib.rs`.
- PR/review-related integration points appear in `crates/server/src/routes/workspaces/pr.rs`, `crates/review/src/main.rs`, and remote GitHub App modules under `crates/remote/src/github_app/`.

## Relay / Remote Access
- Relay and remote access infrastructure spans `crates/relay-control`, `crates/relay-hosts`, `crates/relay-client`, `crates/relay-protocol`, `crates/relay-ws`, `crates/relay-webrtc`, and `crates/ws-bridge`.
- Local server exposes relay-related endpoints under `crates/server/src/routes/relay_auth/`, `crates/server/src/routes/host_relay/`, and `crates/server/src/routes/webrtc.rs`.
- Remote frontend can talk back to local APIs over WebRTC via `packages/remote-web/src/app/entry/Bootstrap.tsx` and `packages/remote-web/src/shared/lib/webrtc/`.
- Relay session helpers for shared frontend code live in `packages/web-core/src/shared/lib/relayBackendApi.ts`.

## Generated Type and Schema Contracts
- Local API/shared contracts are generated from Rust into `shared/types.ts` by `crates/server/src/bin/generate_types.rs`.
- Remote API/shape contracts are generated into `shared/remote-types.ts` by `crates/remote/src/bin/generate_types.rs`.
- Frontends import those contracts from `shared/types.ts` and `shared/remote-types.ts`.
- Executor schema JSON files in `shared/schemas/` are injected into both Vite apps through the custom plugin in each `vite.config.ts`.

## HTTP and UI Boundaries
- Local product serves frontend + API from the local server route tree in `crates/server/src/routes/mod.rs`.
- Remote product exposes `/v1/*` API and SPA fallback through `crates/remote/src/routes/mod.rs`.
- Local web API client code is primarily in `packages/web-core/src/shared/lib/api*` and route-specific hooks/components.
- Remote web API client code is in `packages/remote-web/src/shared/lib/api.ts` plus shared helpers in `packages/web-core/src/shared/lib/remoteApi.ts`.

## Deployment and Packaging
- Local desktop packaging uses Tauri in `crates/tauri-app/`.
- Remote stack development uses Docker Compose via root scripts in `package.json`, `crates/remote/docker-compose.yml`, and `crates/remote/Dockerfile`.
- NPX packaging entrypoint lives in `npx-cli/`.

## Unknowns / Not Confirmed
- No third-party billing provider implementation details were inspected beyond the feature-gated hook in `crates/remote/src/main.rs`; the private `billing` crate is not readable from this repository snapshot.
- Webhook coverage was only partially verified; GitHub App and billing webhook routes are visible, but a full endpoint inventory was not enumerated line-by-line.
