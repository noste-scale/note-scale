---
title: 'Enforce practical Clean Architecture and persistent coding guidance'
type: 'refactor'
created: '2026-10-31'
status: 'done'
baseline_commit: 'd4b7e79ee7c1d96d75fd59452928b028f1545f2b'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Training policies mix with presentation models; mobile providers construct concrete storage. The user requests architecture instructions and refactoring, plus global Clean Code guidance.

**Approach:** Extract framework-free training functions, inject existing storage from composition, enforce dependency boundaries, and persist project guidance. Global Clean Code/readability guidance already exists.

## Boundaries & Constraints

**Always:** Preserve UI, routes, accessibility, audio, storage keys/schema, validation, warnings, hydration, FIFO/repair writes and cancellation. Preserve distinct web/mobile policies and RNG calls/order. Keep existing shared exports compatible; clarify internal argument lists. Keep previous research byte-identical. Current branch, no commit: user confirmed.

**Ask First:** Behavior, dependencies, schema, existing public API or product scope changes.

**Never:** Add dependencies, DI frameworks, ceremonial layers or speculative abstractions. Edit signing, generated/native files, binaries, vendored tooling or unrelated features. Claim device testing from exports.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Web | Same type, previous/preferred scale, progress/time/RNG | Same selection, anti-repeat/fallback | Existing invalid-input handling |
| Mobile | Same generation, scale, progress/time/RNG | Same selection and view | Preserve nonfinite RNG/generation bounds |
| Storage | Missing/corrupt data, late/rejected operations | Same recovery, bookmarks/theme, queued saves | Protect bytes; handle failures |
| Imports | Framework/core or cross-app violation | Automated rejection | Identify boundary |

</frozen-after-approval>

## Code Map

- Shared `src/{types,exercises,progress,persistence}.ts`: reuse RandomSource/StorageAdapter, factories, review ranking and validated codecs.
- Web `src/app-model.ts:createRegularExercise`: policy consumes UiScale; keep formatting/parsing and view conversion in app.
- Mobile `src/domain.ts:selectExerciseScale,makeExercise`: extract weighting/type choice; keep distractors, shuffling and projection.
- Mobile `src/{progress,theme}.tsx`: AsyncStorage coupling. Bookmark validation uses presentation `lessons`; switch to shared LESSONS. Root `app/_layout.tsx` composes both providers. Normalize sync/async port calls safely.
- Web `src/app-model.test.ts`, mobile `scripts/self-check.ts`: preserve nonrepeat/scoped-scale, priority/reachability, hydration/FIFO/late-write/bookmark coverage and native stubs.
- Global `C:/Users/Best/.codex/AGENTS.md`: all requested Clean Code categories/readability already present; preserve Ponytail/Izzelle and avoid duplication.

## Tasks & Acceptance

**Execution:**
- [x] `AGENTS.md`, `README.md` — record project boundaries, composition, contextual principles and verification rules.
- [x] `packages/music/src/training.ts`, `src/index.ts`, `tests/training.test.ts` — extract both policies using domain data and explicit time/randomness; deterministic tests.
- [x] `apps/web/src/{app-model.ts,exercise-pages.tsx,app-model.test.ts}` — delegate policy; retain presentation and UI lifecycle; migrate callers.
- [x] `apps/mobile/src/domain.ts`, `app/(tabs)/exercises.tsx`, `scripts/self-check.ts` — delegate policy, preserve adapter assertions.
- [x] `apps/mobile/src/{progress,theme}.tsx`, `app/_layout.tsx`, `scripts/self-check.ts` — inject storage; decouple bookmark validation; test failures with fakes.
- [x] `eslint.config.mjs`, `packages/music/tsconfig.json`, architecture checks — guard core/package/app imports, remove unnecessary DOM types; prove forbidden imports fail and valid imports pass.
- [x] Existing checks/differential comparison — cover matrix, review full diff, record results.

**Acceptance Criteria:**
- Given shared training, when run without frameworks, then both policies use domain types and injected time/randomness.
- Given providers, when composed with fake storage, then persistence works without native imports inside providers.
- Given identical inputs, when checked, then outputs, RNG consumption and saved formats remain equivalent.
- Given forbidden dependencies, when verification runs, then it fails automatically.
- Given future agents, when working here, then project architecture and global Clean Code/sentence-readability guidance remain discoverable.

## Spec Change Log

## Design Notes

Logical boundaries, not folder counts. Functions/existing ports suffice. Keep web weighted random/anti-repeat and mobile weighted rotation separately named, not a strategy framework. Retain platform UI/audio/save coordination. Leave correct modules unchanged.

## Verification

- Baseline 2026-10-31: tests/typecheck/lint passed; 2 root, 55 music, 45 web tests plus mobile self-check.
- `npm test`, `npm run typecheck`, `npm run lint` including new focused/architecture checks.
- `npm run build`, `npm run verify:web-build`, `npm run verify:audio`, `npm run export --workspace @notescale/mobile`.
- Compare baseline/current training outputs/RNG calls. Inspect persistence coverage/full diff; `git diff --check`; unchanged research hash, assets, dependencies and signing.

## Implementation Evidence (2026-10-31)

- Implemented both framework-free policies in `packages/music/src/training.ts`
  with explicit `now` and `rng`; web/mobile app bridges keep formatting,
  distractors, shuffling and lifecycle coordination. Internal callers use named
  options. Existing shared exports and persistence code remain compatible.
- Mobile root supplies the existing `StorageAdapter` to progress/theme providers.
  Shared `LESSONS` validates bookmarks. Synchronous values/throws and promises/
  rejections are normalized while retaining warning, queue and hydration behavior.
- Added project `AGENTS.md` and README guidance; global guidance was already
  complete and remains byte-identical. ESLint guards core/package/app imports,
  provider storage imports and browser globals; core compilation excludes DOM.
- Passed `npm test` (6 root checks, 59 music tests, 46 web tests and expanded
  mobile self-check), `npm run typecheck`, `npm run lint`, `npm run build`,
  `npm run verify:web-build`, `npm run verify:audio`, and Android/iOS exports via
  `npm run export --workspace @notescale/mobile`.
- Differential comparison against baseline `d4b7e79ee7c1d96d75fd59452928b028f1545f2b`:
  31,680 cases matched full web selections/retries, complete mobile views and RNG
  consumption. Covered all 15 scales, missing/invalid scope, empty/due/future/
  unscheduled progress, eight type indices, seven generation values, constant/
  boundary sequences and ten seeded RNG streams. Temporary harness removed.
- Actual ESLint CLI probes rejected a core React import (exit 1, named boundary)
  and accepted a local core import (exit 0). Automated checks also cover static
  imports, re-exports, dynamic imports, require, absolute cross-app paths and
  provider storage coupling. TypeScript program inspection proves no DOM libs.

### Matrix Coverage

| Matrix row | Executed coverage |
|---|---|
| Web | [training tests](../../packages/music/tests/training.test.ts), [web bridge tests](../../apps/web/src/app-model.test.ts), 31,680-case differential comparison |
| Mobile | Training tests and [mobile self-check](../../apps/mobile/scripts/self-check.ts): reachability, bounds, type choice, payload/grading, scoped scale and view checks; differential comparison |
| Storage | Existing shared persistence/web storage tests and mobile self-check: missing/corrupt/incompatible bytes, sync/async failures, bookmarks/theme, FIFO, timeout/late-write repair and unmount cancellation |
| Imports | [architecture tests](../../scripts/architecture.test.ts), full ESLint run and positive/negative CLI probes |

`git diff --check` passed; full diff inspected. No dependency, lockfile, signing,
asset, generated/native or unrelated feature changes. Research SHA-256 remains
`0E4E3EFA677645F7E308220E830906739052D436EB9B71C8202F254619CA97D1`;
global AGENTS SHA-256 remains
`52D0673AD7E768F16FDD450B2E87F864FA5C6106140A324A0D67E90E4312C585`.
No commit created. Host stubs/static exports do not establish physical-device,
audible playback or manual accessibility results; those were not claimed.


### Review Patch Evidence (2026-10-31)

All six patch-level findings addressed without changing training/provider behavior
or the frozen intent:

1. Installed ESLint global-object checking rejects `globalThis.fetch` (also proven
   by a TSX CLI probe, exit 1). Windows path comparisons normalize case, with
   valid core and forbidden case-variant core/cross-app/package-internal probes.
2. Core compiles with `types: []` and source-only inclusion. A small separate
   `tsconfig.tests.json` preserves test typechecking. Architecture verification
   inspects the real core TypeScript program for Node ambient declarations and
   every `lib.dom*` / `lib.webworker*` declaration-library variant.
3. Import/global guards share JS, JSX, MJS, CJS, TS, TSX, MTS and CTS scopes.
   AsyncStorage imports are permitted only at mobile `app/_layout.tsx`.
   Nonliteral dynamic import/require expressions fail in core with an explicit
   boundary diagnostic; executable-extension and computed-import probes pass.
4. Mobile self-check now verifies progress-aware `makeExercise` delegation using
   the existing error-prone E fixture and explicit focus time.
5. Small durable golden signatures were captured directly from baseline
   `d4b7e79ee7c1d96d75fd59452928b028f1545f2b`. They verify nonconstant RNG order,
   output variants and call counts for all five kinds, scoped retry/type fallback
   and unscoped ranking/selection. The 31,680-case run remains historical
   differential evidence, not a permanent large harness.
6. Injected-provider integration checks now verify delayed hydration plus two
   early attempts saves exactly the merged snapshot, genuinely deferred writes
   remain FIFO, replacement storage props retain the original port, and rejected
   late reads plus resolved/rejected pending saves cannot update unmounted state.
   The existing mount harness now honors memo/effect dependencies so replacement
   tests observe hydration restarts rather than suppressing rerender effects.

Reran and passed all spec commands: `npm test` (7 root checks, 62 music tests,
46 web tests and mobile self-check), `npm run typecheck`, `npm run lint`,
`npm run build`, `npm run verify:web-build`, `npm run verify:audio`, and
`npm run export --workspace @notescale/mobile` (Android and iOS).
`git diff --check` passed. Focused mutation probes confirmed the new mobile tests
fail when progress forwarding or mounted-port retention is removed; original
source bytes were restored and the mobile self-check passed again.
Research/global guidance retain their recorded hashes. No dependency, lockfile,
asset, signing or generated/native-source changes; no commit. No unresolved patch
finding. Physical-device/audio/manual-accessibility evidence remains out of scope.

## Review Summary

Three independent reviews completed. Accepted guard and regression-test gaps were patched; verification reran successfully. No unresolved actionable finding, intent gap or deferred issue remains. Final parent-agent tests, typecheck and lint passed. Project guidance was pruned to durable rules, with acyclic dependencies, stable policies and narrow contracts made explicit. No commit created, honoring user confirmation.

## Suggested Review Order

**Application policies**

- Start with explicit domain-only inputs and the preserved web training policy.
  [`training.ts:59`](../../packages/music/src/training.ts#L59)

- Compare the deliberately distinct weighted mobile rotation.
  [`training.ts:108`](../../packages/music/src/training.ts#L108)

- Follow domain selection back into presentation without leaking view types into core.
  [`app-model.ts:55`](../../apps/web/src/app-model.ts#L55)

**Composition and persistence**

- See native storage assembled once and supplied through existing ports.
  [`_layout.tsx:7`](../../apps/mobile/app/_layout.tsx#L7)

- Inspect retained-port hydration, pending attempts and protected serialized saves.
  [`progress.tsx:36`](../../apps/mobile/src/progress.tsx#L36)

- Check synchronous/asynchronous storage normalization and late-read cancellation.
  [`theme.tsx:39`](../../apps/mobile/src/theme.tsx#L39)

**Regression checks and guidance**

- Review durable baseline signatures, scoped fallbacks and RNG-order checks.
  [`training.test.ts:28`](../../packages/music/tests/training.test.ts#L28)

- Follow injected-provider hydration, FIFO, replacement-port and unmount regressions.
  [`self-check.ts:629`](../../apps/mobile/scripts/self-check.ts#L629)

- Verify allowed and forbidden imports plus platform-free core compilation.
  [`architecture.test.ts:11`](../../scripts/architecture.test.ts#L11)

- Inspect cross-platform boundary enforcement and diagnostics.
  [`eslint.config.mjs:10`](../../eslint.config.mjs#L10)

- Read persistent project constraints alongside inherited global Clean Code guidance.
  [`AGENTS.md:3`](../../AGENTS.md#L3)
