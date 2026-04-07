# Codebase Stack Map

## Snapshot
- Monorepo with a Rust workspace plus multiple TypeScript packages.
- Local product: Axum backend + Vite/React frontend + Tauri desktop wrapper.
- Remote product: separate Axum/Postgres service plus separate Vite/React frontend.
- Shared frontend code lives in `packages/web-core/src` and `packages/ui/src`.

## Languages and Runtimes
- Rust 2024 edition across workspace crates in `Cargo.toml`, `crates/server/Cargo.toml`, and `crates/remote/Cargo.toml`.
- TypeScript + React 18 in `packages/local-web/package.json`, `packages/remote-web/package.json`, `packages/web-core/package.json`, and `packages/ui/package.json`.
- Node.js `>=20` and pnpm `>=8`, pinned via `package.json` and `packageManager`.
- Tauri desktop runtime wired through `crates/tauri-app/` and root scripts `tauri:dev` / `tauri:build` in `package.json`.

## Backend Stack
- Local backend entrypoint: `crates/server/src/main.rs`.
- Local server framework: `axum` + `tokio`, configured in `Cargo.toml` and `crates/server/Cargo.toml`.
- Local persistence: SQLite via `sqlx` in `crates/db/src/lib.rs`.
- Local composition root uses deployment abstraction from `crates/deployment/src/lib.rs`, implemented by `crates/local-deployment/src/lib.rs`.
- Remote backend entrypoint: `crates/remote/src/main.rs`.
- Remote server framework: `axum` + `tokio` in `crates/remote/Cargo.toml`.
- Remote persistence: PostgreSQL via `sqlx` in `crates/remote/src/app.rs` and `crates/remote/src/config.rs`.

## Frontend Stack
- Local web entrypoint: `packages/local-web/src/app/entry/Bootstrap.tsx`.
- Local router setup: `packages/local-web/src/app/router/index.ts` with TanStack Router generated tree from `packages/local-web/src/routeTree.gen.ts`.
- Remote web entrypoint: `packages/remote-web/src/app/entry/Bootstrap.tsx`.
- Remote router setup: `packages/remote-web/src/app/router/index.ts` with generated tree in `packages/remote-web/src/routeTree.gen.ts`.
- Shared UI/domain code: `packages/web-core/src`.
- Reusable UI primitives: `packages/ui/src`.
- Styling/build tools: Vite, Tailwind, PostCSS, React Compiler plugin in `packages/local-web/vite.config.ts` and `packages/remote-web/vite.config.ts`.

## Major Libraries Observed
- Backend: `axum`, `tower-http`, `sqlx`, `reqwest`, `git2`, `tracing`, `sentry`, `ts-rs`.
- Frontend: `@tanstack/react-router`, `@tanstack/react-query`, `zustand`, `i18next`, `posthog-js`, `@sentry/react`, Radix UI, Lexical, DnD libraries, `framer-motion`.
- Desktop/runtime glue: `@tauri-apps/api`, `crates/tauri-app`, `crates/desktop-bridge`, `crates/embedded-ssh`, relay-related crates under `crates/relay-*`.

## Build and Dev Tooling
- Root workspace scripts live in `package.json`.
- Main local dev flow: `pnpm run dev` starts backend + local web with auto-assigned ports from `scripts/setup-dev-environment.js`.
- Backend watch mode: `pnpm run backend:dev:watch`.
- Full typecheck gate: `pnpm run check`.
- Lint gate: `pnpm run lint`.
- Formatting gate: `pnpm run format`.
- Rust workspace tests: `cargo test --workspace`.
- Local packaging: `pnpm run build:npx` and `npx-cli/`.

## Type Generation
- Local shared types are generated into `shared/types.ts` from `crates/server/src/bin/generate_types.rs`.
- Remote shared types are generated into `shared/remote-types.ts` from `crates/remote/src/bin/generate_types.rs`.
- JSON executor schemas are loaded from `shared/schemas/` through a virtual Vite plugin in `packages/local-web/vite.config.ts` and `packages/remote-web/vite.config.ts`.

## Configuration Surfaces
- Repo-level guidance and commands: `AGENTS.md`.
- Remote-specific configuration notes: `crates/remote/AGENTS.md`.
- Local frontend structure/styling notes: `packages/local-web/AGENTS.md`.
- Local server runtime env usage: `crates/server/src/main.rs`.
- Remote env/config parsing: `crates/remote/src/config.rs`.
- Build-time env injection for local server: `crates/server/build.rs`.
- Build-time env injection for local deployment: `crates/local-deployment/build.rs`.

## Notable Generated or Derived Artifacts
- `shared/types.ts` and `shared/remote-types.ts` are generated and should not be edited directly.
- `packages/local-web/src/routeTree.gen.ts` and `packages/remote-web/src/routeTree.gen.ts` are generated route artifacts.
- SQLx offline metadata exists in `crates/db/.sqlx`, `crates/remote/.sqlx`, and `crates/relay-tunnel/.sqlx`.

## Unknowns / Not Confirmed
- No single top-level CI workflow was inspected in this pass, so CI job composition is not confirmed here.
- Frontend production bundling beyond the inspected Vite configs is partly inferred from scripts and Docker/Tauri wiring, not from a full deploy walkthrough.
