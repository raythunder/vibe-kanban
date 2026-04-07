# Codebase Concerns Map

## 1. Local and remote app shells duplicate critical bootstrap logic
- Evidence:
  - `packages/local-web/src/app/entry/Bootstrap.tsx`
  - `packages/remote-web/src/app/entry/Bootstrap.tsx`
  - `packages/local-web/vite.config.ts`
  - `packages/remote-web/vite.config.ts`
- Why it matters:
  - Both app shells repeat similar bootstrapping concerns: auth runtime setup, schema plugin wiring, router startup, analytics setup, and shared alias configuration.
  - Shared behavior can drift between local and remote modes over time because the code is similar but not centralized.
- Risk level:
  - Medium maintainability risk.
- Follow-up:
  - Review whether more of the bootstrap/config surface can move into shared helpers without forcing the two products into the same runtime assumptions.

## 2. Frontend automated test surface looks thin and partially unclear
- Evidence:
  - Only one frontend test file was found: `packages/web-core/src/shared/lib/diffDataAdapter.test.ts`
  - Inspected package manifests (`package.json`, `packages/local-web/package.json`, `packages/remote-web/package.json`, `packages/web-core/package.json`, `packages/ui/package.json`) did not show a dedicated frontend test script or an obvious `vitest` dependency.
- Why it matters:
  - Shared frontend code is large (`packages/web-core/src/**`) and reused by both local and remote apps, but visible automated coverage is sparse.
  - If the test command is undocumented or external, it becomes easy for contributors and automation to skip it.
- Risk level:
  - Medium to high regression risk in shared UI logic.
- Follow-up:
  - Make the frontend unit-test runner explicit in repo scripts, or document why those tests are intentionally not part of the default gates.

## 3. Local composition roots are large and carry many responsibilities
- Evidence:
  - `crates/local-deployment/src/lib.rs`
  - `crates/server/src/main.rs`
  - `crates/server/src/startup.rs`
- Why it matters:
  - These files wire config, DB, analytics, auth, remote client setup, relay, preview proxy, workspace services, and background behavior in one place.
  - Large composition roots are common, but here they also contain notable business/runtime decisions, which raises onboarding and change risk.
- Risk level:
  - Medium maintainability risk.
- Follow-up:
  - Continue extracting focused setup modules where responsibilities are currently mixed with boot-time orchestration logic.

## 4. Remote server configuration matrix is broad and env-sensitive
- Evidence:
  - `crates/remote/src/app.rs`
  - `crates/remote/src/config.rs`
  - `crates/remote/docker-compose.yml`
  - `crates/remote/AGENTS.md`
- Why it matters:
  - The remote product conditionally enables OAuth providers, Loops mail, R2, Azure Blob, GitHub App, analytics, billing, and digest jobs.
  - Several behaviors depend on the difference between unset and empty-string env vars, which the repo explicitly warns about in `crates/remote/AGENTS.md`.
- Risk level:
  - Medium operational risk.
- Follow-up:
  - Keep configuration validation strict and document high-risk combinations prominently; this area is sensitive to deployment drift.

## 5. Frontend structure migration is still in progress
- Evidence:
  - `scripts/check-legacy-frontend-paths.sh`
  - `packages/local-web/AGENTS.md`
  - `scripts/migrate-remote-web-structure.mjs`
- Why it matters:
  - The repo already needs a guard script to block new files in legacy paths and to enforce navigation conventions.
  - That usually means contributors are working across old and new layout patterns at the same time.
- Risk level:
  - Medium architecture consistency risk.
- Follow-up:
  - Finish or clearly phase the migration so contributors know which paths are still transitional and which patterns are final.

## 6. Generated contracts are a real dependency edge, not a nice-to-have
- Evidence:
  - `crates/server/src/bin/generate_types.rs`
  - `crates/remote/src/bin/generate_types.rs`
  - `shared/types.ts`
  - `shared/remote-types.ts`
  - `AGENTS.md`
- Why it matters:
  - Local and remote frontends depend directly on generated Rust-derived TypeScript contracts.
  - If generators are not rerun after backend changes, cross-language breakage is easy to introduce.
- Risk level:
  - Medium correctness risk.
- Follow-up:
  - Preserve or strengthen stale-file checks in CI and contributor workflow.

## 7. Some safety-critical git behavior depends on custom code paths
- Evidence:
  - `crates/git/src/lib.rs`
  - `crates/git/src/cli.rs`
  - `crates/git/tests/git_ops_safety.rs`
- Why it matters:
  - The repo performs advanced git/worktree operations and even contains destructive internal commands such as reset/clean flows.
  - The good news is that these paths are heavily tested, but they remain high-impact code when changed.
- Risk level:
  - Low to medium change risk, high blast radius if broken.
- Follow-up:
  - Treat changes here as test-mandatory and review-heavy.

## Unknowns / Not Confirmed
- No production incident history, bug tracker, or pending TODO backlog was inspected, so this file only reflects structural concerns visible in the code and docs.
