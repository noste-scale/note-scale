---
title: 'Make remaining project code read naturally and separate cohesive responsibilities'
type: 'refactor'
created: '2026-10-29'
status: 'done'
baseline_revision: 'aa04a5c81a3d04d97ef499fa31fc9541c0d2614b'
baseline_commit: 'aa04a5c81a3d04d97ef499fa31fc9541c0d2614b'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The user requests sentence-like readability project-wide, splitting files where useful. The 738-line web application still mixes responsibilities despite the previous naming pass.

**Approach:** Retain clear code. Use domain-specific names, verb-led actions and linear statements. Move cohesive responsibilities into focused modules without changing behavior.

## Boundaries & Constraints

**Always:** English identifiers, French UI. Preserve APIs, stored schema/keys, routes, markup/styles/accessibility, messages, audio, signing safeguards, hooks, cancellation, FIFO saves, clock arithmetic, RNG calls/order and deadlines. Update imports/tests together without weakening coverage.

**Ask First:** Behavior, dependency, schema, public API, or architectural changes beyond moving existing responsibilities.

**Never:** Edit dependencies, generated/native files, signing material, binaries, vendored tooling or history. Add speculative abstractions, boilerplate, redundant wrappers, paraphrasing comments or unrelated fixes. No forced edits or arbitrary length target.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| UI/exercises | Same routes, answers, time, RNG | Same markup, grading and one recorded reveal | Same invalid-input messages |
| Persistence | Corruption, reset, late writes | Same recovery, merging and FIFO | Unreadable bytes protected |
| Audio/native | Preemption, unmount, large fonts | Same ownership, pitches, geometry | Same guards/warnings |
| Tooling | Timeout, assets, signing checks | Same cleanup, exit codes, hashes/bytes | Same diagnostics/validation |

</frozen-after-approval>

## Code Map

Audit: 60 code/style/HTML/workflow files plus JSON configuration; mobile/domain/scripts independently inspected. Tree clean on `main`. Previous `spec-readable-code.md` complete.

- `apps/web/src/App.tsx`: provider 26, shell 120, learning 210, scales 270, generator 332, exercises 377, progress 546, audio 593, primitives 692. Tests import named exports.
- Web model/adapters: remaining ambiguous locals. Other files cohesive; preserve source-inspected worker constants/placeholders.
- `apps/mobile/src/components.tsx:183-282`: piano/catalog/styles. Avoid cycle through `Body`. `audio.tsx` consumes piano; `scripts/self-check.ts` needs explicit mocks for new TSX imports.
- Mobile screens/providers: scale/step/bookmark/playback names. Keep audio controller together and privacy paragraphs inline for source-parity checks.
- Music: distinguish accidental notes, answers, pitch classes, local-calendar days, stored reviews. Modules cohesive.
- `scripts/verify-mobile-start.ts`: lifecycle/Metro coordination; preserve full stability-response budget.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/{App,components,music-components,learning-pages,scale-pages,exercise-pages,progress}.tsx` — extract page groups, presentation and progress into acyclic modules; keep assembly obvious.
- [x] `apps/web/src/{app-model,domain,audio,storage,pwa}.ts` and tests — clarify remaining names/conditions, migrate imports, preserve rendering.
- [x] `apps/mobile/src/{components,piano,audio,progress,theme}.tsx`, `src/domain.ts`, `app/**/*.tsx` — isolate piano/styles, migrate consumers, clarify actions.
- [x] `apps/mobile/scripts/self-check.ts` — name scenario groups and update mocks/loaders. Retain checks; avoid elaborate harness or framework.
- [x] `packages/music/src/*.ts`, `tests/*.test.ts` — clarify locals; preserve exports/determinism, keep cohesive files.
- [x] `scripts/*` — clarify process/path/unit names and certificate predicates. Extract lifecycle helpers only if navigation improves; update tests.
- [x] Existing checks — cover matrix, inspect full diff, distinguish baseline failures from regressions.

**Acceptance Criteria:**
- Given audited source, when reviewed, then changes improve comprehension without artificial abstractions.
- Given extracted modules, when following imports, then dependencies are acyclic and related behavior easy to find.
- Given identical inputs/environment, when checked, then contracts, ordering, rendering and outputs remain equivalent.
- Given final diff, when inspected, then no forbidden or unrelated change appears.

## Spec Change Log

## Verification

- `npm test`, `npm run typecheck`, `npm run lint` — pass or separately evidence baseline failures.
- `npm run build`, `npm run verify:web-build` — production bundle/cache inventory resolve.
- `npm run verify:audio` — 24 samples valid; if regenerated, tracked WAV diff empty.
- `npm run export --workspace @notescale/mobile` — Android/iOS resolve, not device proof.
- Parse changed PowerShell AST; inspect Gradle without secrets or signed build.
- `git diff --check`, full diff review — no unintended drift.

### Baseline evidence — 2026-10-29

- Domain: 55 tests passed across four files.
- Root `npm test`: cleanup test passed; healthy-Metro test failed before edits (Expo not healthy within 30 seconds). Do not alter timeout to hide failure.
- Root chain stopped there; typecheck/lint success not established.


## Review Triage

### 2026-10-29

Three independent review layers completed. Edge-case and verification-gap reviewers reported no findings. Ten low-severity naming/structure refinements were applied: interval counts versus indexes, route identifiers, exercise generation actions, active playback state, keyboard coordinates, signed accidental counts, sequential bookmark guards, removal of a one-use conditional wrapper, and cohesive check grouping. Verification evidence was added below. No unresolved findings or intent changes remain.

## Results — 2026-10-29

- Final `npm test` passed: two process/startup tests, 55 music tests, 45 web tests, and the mobile self-check. Separate workspace execution passed too. Latest healthy-Metro test passed without changing deadlines; earlier startup timeout remains historical baseline evidence only.
- `npm run typecheck`, `npm run lint`, `npm run build` and `npm run verify:web-build` passed.
- Audio regeneration and validation passed for 24 samples; tracked WAV diff remains empty.
- Android/iOS Expo exports passed. PowerShell parses; 27 synthetic signing-predicate comparisons passed. Gradle changes are local renames only; no secrets read or signed release attempted.
- Differential verification against recorded baseline passed 2,332 output/RNG/markup/native-tree/guard-order comparisons. Import graph covers 24 acyclic source modules. Existing mobile assertions were retained: 218 before, 221 after.
- `git diff --check` passed. No dependency, generated/native, binary or secret changes included for delivery. Device rendering/audio still requires real hardware; exports and host stubs are not device proof.
- Rerunnable audit scripts and command logs remain in ignored `output/verification/readable-project-modules/review-fixes/`; `summary.json` records all nine verification commands exiting zero.

### Matrix coverage

- UI/exercises: [`App.test.tsx:18`](../../apps/web/src/App.test.tsx#L18), [`app-model.test.ts:27`](../../apps/web/src/app-model.test.ts#L27), music exercise tests and mobile adapter/response checks all ran and passed.
- Persistence: [`storage.test.ts:29`](../../apps/web/src/storage.test.ts#L29), music persistence/progress tests, and mobile hydration/FIFO/late-write checks all ran and passed.
- Audio/native: [`audio.test.ts:15`](../../apps/web/src/audio.test.ts#L15), native release-order/timer checks and keyboard geometry/caption/font-scale assertions all ran and passed.
- Tooling: [`verify-mobile-start.test.ts:34`](../../scripts/verify-mobile-start.test.ts#L34), healthy-Metro response-budget test, web/audio inventory checks and synthetic signing validation all passed.

## Suggested Review Order

**Application assembly**

- Start with focused imports and unchanged route assembly.
  [`App.tsx:13`](../../apps/web/src/App.tsx#L13)
- Follow single progress ownership through unchanged hydration and synchronization.
  [`progress.tsx:17`](../../apps/web/src/progress.tsx#L17)
- Read exercise generation, grading and continuation as one cohesive concern.
  [`exercise-pages.tsx:28`](../../apps/web/src/exercise-pages.tsx#L28)

**Readable state and boundaries**

- Distinguish completed interval counts from construction-array indexes.
  [`scale-pages.tsx:70`](../../apps/web/src/scale-pages.tsx#L70)
- Inspect independent keyboard coordinates and preserved native presentation.
  [`piano.tsx:26`](../../apps/mobile/src/piano.tsx#L26)
- Trace bookmark guards in original cancellation and revision order.
  [`progress.tsx:97`](../../apps/mobile/src/progress.tsx#L97)
- Read signed accidental counts without changing musical spelling.
  [`scale-generator.ts:77`](../../packages/music/src/scale-generator.ts#L77)

**Supporting checks and scripts**

- Verify named certificate checks still protect release outputs.
  [`build-android.ps1:54`](../../scripts/build-android.ps1#L54)
- Review named scenarios with retained mobile assertions and explicit loaders.
  [`self-check.ts:192`](../../apps/mobile/scripts/self-check.ts#L192)
- Finish with export identity, routes and presentation regression checks.
  [`App.test.tsx:19`](../../apps/web/src/App.test.tsx#L19)
