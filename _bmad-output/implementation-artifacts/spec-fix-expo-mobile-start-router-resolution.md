---
title: 'Fix Expo Router resolution during mobile start'
type: 'bugfix'
created: '2026-08-12'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '1ec3b6a96cbb7d7a56be914952a949bb989c7463'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `npm run start:mobile` starts Metro, then crashes while generating typed routes because Expo CLI resolves hoisted `expo-router@6.0.24`, which lacks `expo-router/internal/routing`, instead of the app's SDK 57 `expo-router@57.0.12`. Mobile development is therefore unusable despite successful static exports.

**Approach:** Make the root npm dependency graph resolve one SDK-compatible Expo Router version for both the app and Expo CLI, preserve typed routes, clean up Expo-generated type files, and add a real Metro-start smoke check so CI catches this startup path.

## Boundaries & Constraints

**Always:** Keep npm workspaces, Expo SDK 57, React Native, existing routes, and `experiments.typedRoutes: true`; regenerate and commit the lockfile from the root; prove behavior after a clean install; use only Node built-ins for the smoke check; terminate spawned Metro processes on success, failure, and timeout.

**Ask First:** Any Expo SDK major change, package-manager replacement, typed-routes removal, or application-route change.

**Never:** Patch files under `node_modules`, hide the defect by disabling typed routes, commit generated `expo-env.d.ts`, weaken current tests/exports, or alter web/mobile product behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Fresh install | `npm ci`, then mobile start | Expo CLI loads SDK 57 Router internals and Metro remains healthy | Missing/incompatible module fails verification with captured CLI output |
| Generated types | Typed routes enabled, first start | Expo regenerates ignored `apps/mobile/expo-env.d.ts` | Generated file never becomes tracked source |
| Smoke timeout or port/process failure | Metro never becomes healthy or exits early | Check exits non-zero and leaves no child process | Print captured stdout/stderr and failure reason |

</frozen-after-approval>

## Code Map

- `package.json:21` — root scripts and root-only npm resolution controls; add dependency alignment and smoke command here.
- `package-lock.json:190,7879` — currently records app Router 57.0.12 plus incompatible hoisted Router 6.0.24; regenerated result must eliminate the bad CLI-visible resolution.
- `apps/mobile/package.json:6,23` — Expo Router entry point and intended SDK 57 dependency; keep compatible version intent.
- `apps/mobile/app.json:17-20` — Router plugin and typed-routes experiment; read-only product configuration for this fix.
- `apps/mobile/tsconfig.json:8` — correctly includes generated Expo route types; preserve.
- `apps/mobile/.gitignore` / `apps/mobile/expo-env.d.ts` — Expo-generated hygiene: commit ignore rule, untrack generated declaration.
- `node_modules/expo/node_modules/@expo/cli/node_modules/@expo/router-server/build/typed-routes/index.js` — read-only failure evidence: imports `expo-router/internal/routing` and `internal/testing`.
- `scripts/verify-mobile-start.ts` — bounded Metro/typed-route smoke with signal-safe cross-platform process-tree cleanup using Node built-ins.
- `scripts/verify-mobile-start.test.ts` — deterministic timeout, diagnostics, non-zero exit, and descendant-cleanup coverage using Node built-ins.
- `.github/workflows/pages.yml:25-33` — run startup smoke after clean installation and before mobile export.
- `README.md:28-39` — document the new verification command.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `package-lock.json`, `apps/mobile/package.json` — align Expo Router resolution with SDK 57 and regenerate a deterministic clean-install graph.
- [x] `apps/mobile/.gitignore`, `apps/mobile/expo-env.d.ts` — adopt Expo's generated-file policy without losing TypeScript inclusion.
- [x] `scripts/verify-mobile-start.ts`, `package.json` — start Expo offline on a temporary local port, require a healthy Metro status, observe stability briefly, and always clean up.
- [x] `.github/workflows/pages.yml`, `README.md` — make the regression check mandatory and documented.

**Acceptance Criteria:**
- Given a clean root installation, when `npm run start:mobile` runs with typed routes enabled, then Metro stays running without any `expo-router/internal/*` resolution error.
- Given the resolved dependency tree, when Expo CLI resolves Router from `@expo/router-server`, then it reaches SDK 57 Router internals rather than Router 6.
- Given CI, when dependencies are installed, then the bounded mobile-start smoke passes before Android/iOS export.
- Given a successful start, when Git status is inspected, then `expo-env.d.ts` remains ignored and untracked.
- Given the fix, when existing tests, static analysis, web build, and Android/iOS exports run, then all remain green.

## Spec Change Log

- 2026-08-12 — Added deterministic failure-path coverage during matrix audit; implementation scope unchanged.
- 2026-08-12 — Hardened process-tree cleanup, interruption handling, bounded diagnostics, continuous health polling, and typed-route proof after review.

## Design Notes

The failure is npm workspace peer placement, not application routing. Prefer one root-level resolution constraint over duplicate runtime dependencies or Metro configuration. The smoke must exercise Expo CLI's typed-route bootstrap; `expo export` alone previously passed while this path crashed.

## Verification

**Commands:**
- `npm ci` — clean dependency graph installs reproducibly.
- `npm run verify:mobile-start` — Metro reports healthy and remains alive for the observation window.
- `npm test && npm run typecheck && npm run lint` — existing checks pass.
- `npm run export --workspace @notescale/mobile` — Android and iOS bundles export.
- `npm run build && npm run verify:web-build` — web deployment remains valid.
- `git status --short --ignored apps/mobile` — generated Expo declaration is ignored, not tracked.
