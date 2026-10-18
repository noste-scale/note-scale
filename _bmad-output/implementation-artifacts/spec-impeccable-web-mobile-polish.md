---
title: 'Polish NoteScale learning interactions on web, then mobile'
type: 'bugfix'
created: '2026-10-15'
status: 'done'
baseline_commit: 'fa66c332225f80c3815f336ba9670ccd1797e4f0'
review_loop_iteration: 0
context:
  - '{project-root}/apps/web/PRODUCT.md'
  - '{project-root}/apps/mobile/PRODUCT.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Web controls and narrow layouts obscure choices and notes. Native
audio status and repeated navigation labels miscommunicate state or destination.

**Approach:** Impeccable polish, web then native, preserving identity through the
standard BMad implementation/review/correction loop and existing tools.

## Boundaries & Constraints

**Always:** Preserve French, 15 major keys, grading, local/offline data, audio,
themes, routes and identity. Reuse installed tools. Respect keyboard, screen
readers, touch and large text. Keep `.claude/` intact; user approved this dirty
tree without commits on 2026-10-15.

**Ask First:** Changes to product facts, navigation architecture, visual identity,
dependencies, signing, deployment, or user data; broader fixes found in review.

**Never:** Add backend, accounts, remote assets, new testing frameworks, speculative
abstractions, or claim native device validation from exports. No automatic commit.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Web answer | QCM versus text answer | Compact native radio beside label; text-entry help only for text | Empty validation and one-time recording unchanged |
| Narrow web | 320/390px, long names | Complete formula groups/notes; current exercise type visible | No document overflow or clipped focus |
| Progress | Zero/one/many attempts | Clear next step and grammatical labels | Hydration warning/loading preserved |
| Native audio | Playing, paused, stopped, completed, failure | Status agrees with phase; explicit messages win | Existing errors and playback timing unchanged |
| Native navigation | Repeated lesson/scale links | Destination-specific accessible names | Visible labels and routes preserved |

</frozen-after-approval>

## Code Map

- `apps/web/src/App.tsx`: Home, ExerciseWorkspace/Card, ProgressPage, ScaleList,
  NoteRow own the affected workflows.
- `apps/web/src/styles.css`: global input/label rules cause oversized radios;
  formula, chips, note-row, lesson focus, stats and narrow breakpoint rules.
- `apps/web/src/App.test.tsx`: existing server-rendered route/ARIA regressions.
- `apps/mobile/src/components.tsx`: Action, Chip, RouteAction; reuse Chip widths.
- `apps/mobile/src/audio.tsx`: status renderer; preserve controller.
  `audio-model.ts` and `scripts/self-check.ts`: transitions and runnable checks.
- `apps/mobile/app/(tabs)/learn.tsx`, `apps/mobile/app/scales.tsx`: repeated links.
- `apps/mobile/app/(tabs)/progress.tsx`: native continuation and count labels.
- `packages/music`, signing material, root requirements: read-only for this pass.

## Tasks & Acceptance

**Execution:**
- [x] Both app `PRODUCT.md` and `.impeccable/config.json` -- confirmed context
  and code-first preference recorded.
- [x] `apps/web/src/App.tsx`, `styles.css` -- fix QCM rows/help/action spacing;
  keep current exercise selection visible; wrap formula groups and static notes;
  retain useful compact stats; contextualize catalog links and lesson focus;
  add empty-progress continuation and correct singular labels.
- [x] `apps/web/src/App.test.tsx` -- extend render/name regressions; browser-check
  answer interactions and responsive layout.
- [x] Mobile shared components, audio renderer and named routes above -- fix
  audio status, contextual link labels, non-color selected affordance, bounded
  action widths, and progress continuation. Preserve semantics and state logic.
- [x] Existing mobile self-check -- assert new logic; no source-string UI tests.
- [x] Verification and independent BMad review -- fix confirmed in-scope findings,
  rerun affected checks, record exact remaining device limitations.

**Acceptance Criteria:**
- Given existing journeys, when learners navigate, answer and retry, then
  grading, progress and audio remain available and correct.
- Given both themes at desktop/320/390px, when learning controls are inspected,
  then current type, labels, notes and keyboard focus remain understandable.
- Given passing native exports without a device, when reporting results, then
  native rendering, large text, gestures, screen readers and sound remain unverified.

## Spec Change Log

## Design Notes

Web critique: 26/40, dual assessment; clean TSX scan missed layout defects.
Native: provisional 28/40, code-only. Prefer one labeled select to duplicate
exercise selectors. The user approved the full plan and Exercises as the progress
CTA on 2026-10-15. This is the implementation phase of the existing BMad run;
do not start another planning/approval workflow. Parent owns independent review.
Keep violet web and cream/petrol/amber mobile.

## Verification

**Commands:**
- `npm test`, `npm run typecheck`, `npm run lint` -- all existing checks pass.
- `npm run build`, `npm run verify:web-build` -- valid static web bundle.
- `npm run export --workspace @notescale/mobile` -- Android/iOS bundles resolve.
- Impeccable detector on changed web markup once after polish; inspect findings,
  never treat a clean result as UX proof or run the web detector on native code.

**Manual checks:**
- Web: grouped inspection then one confirmation; keyboard QCM/validation,
  note/formula wrapping, themes and focus.
- Native: no connected device/emulator/iOS Simulator; state that limitation.
- Stop task-owned preview servers; leave user services, signing and data intact.

### Executed implementation evidence (2026-10-15)

- `npm test`: passed (2 startup, 55 shared music, 44 web tests, mobile self-check).
- Root typecheck/lint, web build/static inventory, and Android/iOS Expo exports:
  passed. Mobile test/typecheck/lint passed again after component-prop checks.
- Matrix: web answer tests plus real keyboard/click submission; responsive
  formula/notes/select geometry at 320px and 389/391px in both themes; web/native
  zero/one/many progress tests; native phase/message tests; all 5 lesson and 15
  scale link names/routes tested by executing actual TSX with host stubs.
- Browser: no document overflow, lesson focus not clipped, empty CTA opens
  exercises, one-time recording survives retry/navigation/reload. Desktop CSS
  width 1706px. Existing Chrome zoom 75% retained. Responsive screenshots timed
  out; DOM/geometry checks succeeded. Desktop capture succeeded.
- Native assertions cover component props, not native rendering. No connected
  device/emulator/Simulator: large text, screen readers, gestures and sound remain
  unverified. No claim of native visual validation.
- Final detector ran once on web App.tsx/styles.css: exit 1, only unchanged Inter
  fallback and feedback accent-border warnings, retained per identity constraint.
- Implementation matrix audit passed. Independent review and correction batch completed below.

### Review and final confirmation

Three context-free BMad reviewers ran in parallel: blind, edge-case, and
verification-gap. Confirmed patch findings were fixed in one batch; no intent
change or specification re-derivation was needed (`review_loop_iteration: 0`).

- Formula permits emergency wrapping; narrow statistics adapt to enlarged text
  while retaining two columns at normal 320px. Long counts stay contained.
- A same-type `Nouvelle question` action restores the previous active-chip
  regeneration behavior without recording an unanswered attempt.
- Native import resolution is relative to each loaded component. Exact control
  roles/states and unselected markers, destination/name pairs, and progress copy
  have stronger assertions.
- Actual full/compact AudioControls now execute under narrow host/hook/player
  stubs: initial/start/pause/resume/stop/completion/error display passes. Two
  deliberate mutations (hardcoded stopped phase; hidden compact active status)
  failed the expected assertions. Both were restored byte-for-byte; checks passed.
- Final full command chain passed again: 2 startup checks, 55 music tests, 44 web
  tests, native self-check, typecheck, lint, web build/inventory, Android/iOS export,
  and diff whitespace checks. No second detector run.
- One final browser confirmation passed: normal 320px light / 391px dark;
  same-type new question by click and Enter; select coherence; unchanged attempt
  count. Actual SSR markup/CSS with a 200% root-font fixture passed targeted
  formula/statistics bounds at 320/391px in both themes, including large counts.
  This fixture is not browser-zoom or assistive-technology certification.
- The enlarged-text fixture exposed an unchanged bottom-navigation overflow:
  documented in [deferred work](deferred-work.md), not silently expanded into
  this polish. Global enlarged-text accessibility is not certified.
- Both retained Impeccable critique snapshots were explicitly closed after their
  selected priority issues were resolved; original scores remain historical.
- No native device rendering, large-text, gestures, screen-reader, or sound check
  was possible. No automatic commit, push, deployment, dependency, signing, or
  pre-existing `.claude/` changes. Sprint synchronization skipped: no story key.

## Suggested Review Order

**Learning controls**

- One visible selector and same-type regeneration retain the existing exercise workflow.
  [`App.tsx:154`](../../apps/web/src/App.tsx#L154)

- Compact clickable radio rows and text-only help remove the QCM ambiguity.
  [`App.tsx:175`](../../apps/web/src/App.tsx#L175)


**Responsive content**

- Keep formula groups intact normally, but allow emergency wrapping for enlarged text.
  [`styles.css:20`](../../apps/web/src/styles.css#L20)

- Adaptive statistics preserve compact defaults without forcing large-text overflow.
  [`styles.css:37`](../../apps/web/src/styles.css#L37)


**Continuation**

- Empty progress now points directly to exercises; count labels agree with values.
  [`App.tsx:204`](../../apps/web/src/App.tsx#L204)

- Native progress mirrors the continuation intent without replacing its visual identity.
  [`progress.tsx:6`](../../apps/mobile/app/%28tabs%29/progress.tsx#L6)


**Native status and accessibility**

- Explicit messages override phase defaults without changing the playback controller.
  [`audio.tsx:255`](../../apps/mobile/src/audio.tsx#L255)

- Contextual route names and bounded action widths preserve native navigation and visible labels.
  [`components.tsx:56`](../../apps/mobile/src/components.tsx#L56)


**Verification and context**

- Rendered web tests pin labels, answer guidance, continuation, and route destinations.
  [`App.test.tsx:62`](../../apps/web/src/App.test.tsx#L62)

- Execute native components with small host stubs; device testing remains explicitly separate.
  [`self-check.ts:281`](../../apps/mobile/scripts/self-check.ts#L281)

- Document preserved product boundaries and code-first workflow in each app.
  [`PRODUCT.md:1`](../../apps/web/PRODUCT.md#L1)

- Keep native audience, offline scope, and platform constraints explicit.
  [`PRODUCT.md:1`](../../apps/mobile/PRODUCT.md#L1)

