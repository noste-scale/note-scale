---
title: 'Make NoteScale code read like natural sentences'
type: 'refactor'
created: '2026-10-25'
status: 'done'
baseline_revision: '72a7326577c08c9ba8422118792147df13400000'
baseline_commit: '72a7326577c08c9ba8422118792147df13400000'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The user wants project code to read like sentences. Generic names, nested expressions and compressed React components obscure intent.

**Approach:** Improve first-party web, mobile, domain, tests and scripts using meaningful English names, verbs for actions, explicit predicates and linear statements. Expand dense JSX/control flow in place. Leave clear code unchanged.

## Boundaries & Constraints

**Always:** Preserve public interfaces, persisted fields/keys, routes, French text, accessibility, rendering, styles, errors and outputs. Keep hooks, async cancellation/order, RNG calls, deadlines, scheduling and audio bytes unchanged. Readability beats compact one-liners. Reuse existing modules/tests.

**Ask First:** API/schema, behavior, dependency, architectural or third-party tooling changes become necessary.

**Never:** Edit dependencies, generated builds/native projects, audio assets, signing material, vendored BMad tooling or historical documents. Add fluent APIs, wrappers, artificial helpers, paraphrasing comments, unrelated fixes or formatting dependencies. Lengthen established domain terms without benefit.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Exercises | Same answers, clock, RNG | Identical questions, grading, retries and attempts | Same validation/messages |
| Persistence | Corrupt/incompatible data, concurrent/late writes | Same recovery, merging, FIFO and unreadable-byte protection | Same guards/warnings |
| Adapters | Playback cancellation, offline cache, Expo timeout | Same lifecycle, cache scope and process cleanup | Same deadlines/exit codes |
| Presentation | Existing routes/screens | Same French UI, accessibility and layout | Same empty/loading/error states |

</frozen-after-approval>

## Code Map

Audit covered 60 tracked code/style/HTML/workflow files plus related JSON configuration. Identifiers remain English; UI remains French. Configuration, types, catalog, lessons and exports are already clear.

- `apps/web/src/{App.tsx,app-model.ts,audio.ts,storage.ts,pwa.ts}`: compressed JSX, exercise selection, playback epochs and guarded storage. Prefer local aliases over changing context fields.
- `apps/web/src/{styles.css,sw.ts}`, `apps/web/vite.config.ts`: styles and cache generation. Preserve worker constants `BASE`, `CACHE`, `PRECACHE` and placeholders: build verification inspects them.
- `apps/mobile/app/**/*.tsx`, `apps/mobile/src/*`: dense screens, domain view helpers, audio and progress. Preserve hook dependencies, native late-write repair and FIFO saves. Leave source-inspected privacy paragraphs intact.
- `packages/music/src/{notes,exercises,persistence,progress,scale-generator}.ts`: parsing, grading, recovery, ranking and spelling. Rename misleading French-to-international lookup; preserve sort priorities and clock clamping.
- `scripts/*`: WAV synthesis/verification, offline inventory, Expo process cleanup and Android release. Signing secrets remain unread.
- `packages/music/tests/*.test.ts`, `apps/web/src/*.test.*`, `apps/mobile/scripts/self-check.ts`, `scripts/verify-mobile-start.test.ts`: existing tests; some inspect source strings.

## Tasks & Acceptance

**Execution:**
- [x] `packages/music/src/*.ts`, `packages/music/tests/*.test.ts` — clarify lookup, grading, recovery, ranking and private action names; expand nested choices.
- [x] `apps/web/src/*`, `apps/web/vite.config.ts` — expand JSX/CSS/statements and clarify state, callbacks and adapters without new components.
- [x] `apps/mobile/app/**/*.tsx`, `apps/mobile/src/*`, `apps/mobile/scripts/self-check.ts` — clarify construction, exercise, playback and progress names; expand rendering.
- [x] `scripts/*` — clarify audio, directory, process and duration names where useful. Preserve release security.
- [x] Test files above — clarify local names and update affected source assertions without weakening coverage. Run checks and inspect full diff.

**Acceptance Criteria:**
- Given audited modules, when reviewed, then useful naming/structure improvements read naturally without forced edits.
- Given identical inputs/environment, when journeys/checks run, then behavior, contracts, UI, persistence and audio remain identical.
- Given the final diff, when inspected, then no dependency, layer, secret, binary or vendored tooling change appears.
- Given the updated workspace, when verification runs, then all checks pass or independently reproduced pre-existing/environment failures are reported.

## Spec Change Log

## Review Triage Log

### 2026-10-25 — Review and patch pass

- Three independent layers completed: blind readability, edge cases, and verification gaps.
- Edge-case and verification-gap layers reported no findings. Thirteen readability suggestions and one mixed-newline issue were accepted as low-severity patches; no intent/spec gaps or deferred defects.
- Resolved clearer review sort/conflict names, RNG/wait helpers, native playback/save names, distractor/rotation names, flat progress/continuation branches, exact feedback strings, expanded prop signatures, and consistent self-check newlines.
- All verification commands passed again after patches, including Android/iOS exports. All four baseline differential checks passed again with unchanged comparison counts. No unresolved findings.

## Verification

- `npm test`, `npm run typecheck`, `npm run lint` — baseline passes: 101 tests plus mobile self-check.
- `npm run generate:audio`, `npm run verify:audio` — 24 valid samples; tracked audio diff empty.
- `npm run build`, `npm run verify:web-build` — production bundle/offline inventory pass.
- `npm run export --workspace @notescale/mobile` — Android/iOS bundles resolve; no device rendering/audio claim.
- Parse PowerShell if changed; inspect Gradle signing logic without a signed release.

### Results — 2026-10-25

All listed commands passed, including Android/iOS exports and PowerShell parsing. Audio regeneration left no tracked WAV changes. The diff contains 48 first-party files, no new dependencies or generated/secret changes, and passes `git diff --check`.

Independent comparisons against the captured baseline passed: 45,803 domain results, 36,007 web-model results including exact RNG-call counts, 113 identical web HTML renders, and 380 identical native component text/props/style snapshots. CSS ASTs match including declaration order. Temporary comparison checks remain in ignored output/cache directories; existing committed tests remain the permanent safety net.

Matrix coverage ran and passed: exercise/clock/RNG tests cover exercises; persistence/concurrent storage tests and mobile hydration/FIFO/late-write checks cover persistence; audio/PWA/startup tests cover adapters; web rendering tests and mobile component checks cover presentation. Physical-device rendering/audio and signed releases were not tested.

## Suggested Review Order

**Sentence-like UI**

- Start with explicit construction state and naturally ordered rendering.
  [App.tsx:332](../../apps/web/src/App.tsx#L332)

- Read named selections, feedback and continuation without compressed JSX.
  [exercises.tsx:26](../../apps/mobile/app/(tabs)/exercises.tsx#L26)

- See loading, empty and populated states as explicit branches.
  [progress.tsx:12](../../apps/mobile/app/(tabs)/progress.tsx#L12)

**Domain vocabulary**

- Correct the lookup name without changing note identity.
  [notes.ts:25](../../packages/music/src/notes.ts#L25)

- Follow answer normalization and exact grading with domain names.
  [exercises.ts:159](../../packages/music/src/exercises.ts#L159)

- Keep scheduling priorities and random-call ordering explicit.
  [progress.ts:133](../../packages/music/src/progress.ts#L133)

**Boundary lifecycles**

- Distinguish native writes from timeout-bounded queued saves.
  [progress-state.ts:84](../../apps/mobile/src/progress-state.ts#L84)

- Trace playback ownership, cancellation and stale asynchronous results.
  [audio.ts:35](../../apps/web/src/audio.ts#L35)

**Supporting code and verification**

- Inspect expanded CSS with unchanged rules, values and order.
  [styles.css:1](../../apps/web/src/styles.css#L1)

- Review explicit startup deadlines and process cleanup vocabulary.
  [verify-mobile-start.ts:20](../../scripts/verify-mobile-start.ts#L20)

- Inspect readable assertions and preserved null-style handling.
  [self-check.ts:310](../../apps/mobile/scripts/self-check.ts#L310)

- Finish with existing route, presentation and accessibility assertions.
  [App.test.tsx:8](../../apps/web/src/App.test.tsx#L8)
