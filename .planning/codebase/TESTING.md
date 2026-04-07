# Codebase Testing Map

## Primary Verification Commands
- Full repo typecheck gate: `pnpm run check` from `package.json`.
- Full lint gate: `pnpm run lint` from `package.json`.
- Full formatting gate: `pnpm run format` from `package.json`.
- Workspace Rust tests: `cargo test --workspace` per `AGENTS.md`.
- Remote crate tests: `cargo test --manifest-path crates/remote/Cargo.toml` per `crates/remote/AGENTS.md`.
- SQLx prep/check flows:
  - `pnpm run prepare-db`
  - `pnpm run prepare-db:check`
  - `pnpm run remote:prepare-db`
  - `pnpm run remote:prepare-db:check`

## Test Locations Observed
- `crates/git/tests/git_ops_safety.rs`
- `crates/git/tests/git_workflow.rs`
- `crates/services/tests/filesystem_repo_discovery.rs`
- Inline Rust unit tests appear in remote modules such as `crates/remote/src/github_app/jwt.rs`, `crates/remote/src/github_app/webhook.rs`, and other files matched by `mod tests`.
- Frontend test file observed: `packages/web-core/src/shared/lib/diffDataAdapter.test.ts`.

## What Is Actually Covered
### Strongest visible coverage
- Git/worktree behavior and safety rules in `crates/git/tests/git_ops_safety.rs` and `crates/git/tests/git_workflow.rs`.
- Filesystem repo discovery behavior in `crates/services/tests/filesystem_repo_discovery.rs`.
- Some remote backend module-level logic in inline tests under `crates/remote/src/**`.

### Lightweight frontend coverage
- `packages/web-core/src/shared/lib/diffDataAdapter.test.ts` exercises shared diff transformation logic with `vitest`-style imports and snapshots.

## Testing Patterns
- Rust integration-style tests use `tempfile` and real filesystem/git setup, especially in `crates/git/tests/**`.
- Rust async tests use `#[tokio::test]`, for example `crates/services/tests/filesystem_repo_discovery.rs`.
- Frontend test style is colocated near source (`*.test.ts`) rather than in a separate top-level test directory.

## Quality Signals From Tooling
- `pnpm run check` is broad: it covers local web, remote web, web-core, UI package, and backend Rust checks according to `package.json`.
- `pnpm run lint` includes additional scripts for i18n and legacy-path enforcement, so linting is part style gate and part structural gate.
- `pnpm run format` spans both Rust and web code.

## Gaps / Risks Observed
- Only one frontend test file was found during this pass: `packages/web-core/src/shared/lib/diffDataAdapter.test.ts`.
- No `vitest` dependency or dedicated frontend test script was found in the inspected `package.json` files, so the standard way this frontend test is run is not confirmed from the checked files.
- Coverage reporting tooling was not identified in the inspected files.
- End-to-end browser test infrastructure was not identified in the inspected files.

## Suggested Verification Workflow For Future Changes
- Backend or schema changes:
  - run `pnpm run check`
  - run `cargo test --workspace`
  - run SQLx prepare/check commands if queries or migrations changed
- Frontend/shared TS changes:
  - run `pnpm run check`
  - run `pnpm run lint`
  - run `pnpm run format`
  - if relevant, determine and run the missing frontend unit-test command for files like `packages/web-core/src/shared/lib/diffDataAdapter.test.ts`
- Remote-specific changes:
  - run `cargo test --manifest-path crates/remote/Cargo.toml`
  - run `pnpm run remote:prepare-db:check` when SQLx-checked queries change

## Unknowns / Not Confirmed
- CI execution order and required status checks were not inspected.
- Snapshot update workflow for the existing frontend test file was not identified.
