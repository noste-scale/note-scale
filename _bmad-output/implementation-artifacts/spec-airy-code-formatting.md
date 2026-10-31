---
title: 'Make existing NoteScale code airy without changing behavior'
type: 'refactor'
created: '2026-10-31'
status: 'done'
baseline_commit: '0c4a98f13a71c74a96c6a2e2d646a0c959806591'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The user wants airy existing project code, not only clearer names. Dense interfaces, conditions, callbacks, calls and JSX still impede scanning.

**Approach:** Separate logical steps and unfold dense constructs using installed tooling and whitespace edits. Global formatting guidance/one-line priority already updated; preserve unrelated instructions.

## Boundaries & Constraints

**Always:** Preserve logic, APIs, imports/order, comments/literals/regexes/templates, UI text/semantics, storage, deadlines, RNG and errors. Keep English identifiers/French UI, existing indentation and clear short guards. Prefer whitespace-only edits; leave readable code alone. Research bytes intact. Current synchronized main; no automatic commit/push.

**Ask First:** Any functional or API change, dependency installation, renamed/extracted symbol, altered assertion or product text.

**Never:** Modify vendored/generated/native files, assets, signing or dependencies. Impose width quotas, split prose/URLs for width, build a formatter framework, or separate every statement with blank lines.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Handling |
|---|---|---|---|
| Dense code | Same source tokens | More readable layout; same syntax tree and execution | Investigate every semantic mismatch |
| JSX and prose | Privacy paragraphs, inline text, attributes | Identical rendered text and content contracts | Keep sensitive spans verbatim |
| Embedded code | Strings, templates, regexes, worker placeholders | Exact content retained | Avoid edits inside literals |
| Platform scripts | PowerShell/Gradle commands | Same arguments, guards and cleanup | Parse PowerShell; conservatively space Gradle |

</frozen-after-approval>

## Code Map

- Owned code: 69 tracked TS/TSX/MJS/CSS/HTML/PowerShell/Gradle files under `apps`, `packages`, `scripts`, plus `eslint.config.mjs`. Exclude generated directories; not all files need changes.
- Web `src/{domain.ts,components.tsx,exercise-pages.tsx,progress.tsx}`: dense interfaces/JSX/calls. Mobile `src/{progress.tsx,theme.tsx,domain.ts}` and screens: similar density.
- `packages/music/src/{training,persistence,exercises,progress,scale-generator}.ts`: multiline conditions, objects and logical-step spacing; preserve explicit dependency boundaries.
- `apps/mobile/scripts/self-check.ts`: dense mocks/assertions; privacy checks extract literal `<Body>`/`<p data-policy>` paragraphs. Preserve these spans in mobile privacy/web HTML.
- `scripts/verify-mobile-start.test.ts`: executable template-string preload must remain exact. `apps/web/src/sw.ts`: preserve `__CACHE__`, `__PRECACHE__`, `__BASE__`.
- `apps/web/src/styles.css`: already multiline declarations; space rules/groups. PowerShell parser available; Gradle lacks an established parser, so only conservative blank-line edits there.
- Installed TypeScript formatter handles indentation, not long-line wrapping. PostCSS through Vite can verify CSS. No Prettier/stylistic plugin installed.

## Tasks & Acceptance

**Execution:**
- [x] `AGENTS.md` — reference inherited airy-formatting guidance; verify global saved rule without duplicating the checklist.
- [x] `apps/web/src/*.{ts,tsx}`, `apps/web/vite.config.ts`, `apps/mobile/{app,src}/**/*.{ts,tsx}` — unfold dense code, separate stages, preserve JSX semantics.
- [x] `packages/music/{src,tests}/*.ts`, `apps/*` tests, `apps/mobile/scripts/self-check.ts`, `scripts/*.ts`, `eslint.config.mjs` — apply the same readable layout to core, tests and tooling; no assertion changes.
- [x] `apps/web/src/styles.css`, owned HTML, `scripts/{build-android.ps1,android-release.gradle}` — improve block separation only where useful and safe.
- [x] `output/verification/airy-code/` — retain runnable semantic comparison/log against baseline; no production framework.
- [x] Full checks and diff review — cover every changed file, verify protected hashes and document results.

**Acceptance Criteria:**
- Given dense code, when reviewed, then actions and logical groups are visually distinct without excessive vertical gaps.
- Given identical inputs, when existing checks run, then behavior and content remain unchanged.
- Given changed source, when compared, then trees/emitted behavior and literal/comment content match baseline.
- Given future work, when global/project guidance loads, then airy readability outranks compact one-liners.

## Spec Change Log

## Verification

- Capture baseline with `git rev-parse HEAD`; research SHA-256 is `0E4E3EFA677645F7E308220E830906739052D436EB9B71C8202F254619CA97D1`.
- TS/TSX/MJS: compare trees without positions, raw literals/comments and transpiled JSX behavior (ASI/text protection). CSS: compare PostCSS structure without layout. HTML/Gradle: exact nonblank lines. PowerShell: same parsed structure/tokens, no parse errors.
- `npm test`, `npm run typecheck`, `npm run lint`; web build/inventory, audio verification and Android/iOS exports using existing README commands.
- Full diff, `git diff --check`, unchanged protected files. Baseline: 115 tests plus mobile self-check passed; exports are not device proof.

### Implementation evidence — 2026-10-31

- Baseline HEAD confirmed: `0c4a98f13a71c74a96c6a2e2d646a0c959806591`; initial tracked diff empty. `context: []` contains no additional required files.
- Reformatted 65 of 69 owned code files using whitespace only: 60 TS/TSX/MJS, one CSS, two HTML, one PowerShell and one Gradle. Readable `theme-state.ts`, web `main.tsx`, core `index.ts` and `lessons.ts` remain untouched. No source symbols, assertions, imports/order or product text changed.
- Updated only the inherited-guidance reference in project `AGENTS.md`; existing saved global airy-formatting rule verified unchanged.
- Runnable comparison: `node output/verification/airy-code/verify.mjs`. Snapshot sources are checked against baseline Git blobs with checkout line endings normalized; literal/comment/template comparisons retain exact initial checkout bytes. All changed TS trees and emitted JSX behavior match, CSS PostCSS structure matches, HTML/Gradle nonblank lines match, and PowerShell parsed nodes/tokens match without parse errors.
- Protected checks passed: all 623 other tracked files byte-identical to initial checkout; research SHA-256 unchanged; mobile/public privacy spans exact; complete templates (including executable preload) unchanged; service-worker placeholders unchanged.
- All commands passed: `npm test` (7 root + 62 core + 46 web tests, plus mobile self-check), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run verify:web-build`, `npm run verify:audio`, and `npm run export --workspace @notescale/mobile` (Android and iOS). Final mobile self-check also rerun after layout review.
- Full diff and per-file review evidence retained in ignored `output/verification/airy-code/{final.patch,reviewed-files.tsv,report.txt,results.json,semantic.log}` alongside command logs, baseline snapshot and PowerShell comparison. `git diff --check` passed. No formatter framework, dependency, commit or push added.
- No implementation task remains. Device rendering, audible playback and manual accessibility checks were not run; host stubs and static exports do not prove them. Android signing/release build was not run; PowerShell/Gradle verification remained static. Workflow status is owned by the parent review.

### Localized review corrections — 2026-10-31

- Applied all twelve cosmetic review requests plus separation between `UiNote` and `UiScale`, across ten already-modified source files. Guard actions, tab-icon/route/button attributes, nested UI expressions, accidental-error stages, element searches, assertions and arithmetic callbacks now have clearer layout.
- Preserved the frozen whitespace-only contract throughout: no added braces/parentheses/tokens, extraction, renaming or assertion changes. French mixed-text spans remain exact by restricting their edits to existing JSX expression braces. No suggestion required an exception.
- Reran semantic/protected comparison and every full-spec command successfully: 115 tests plus mobile self-check, typecheck, lint, web build/inventory, audio verification, Android/iOS exports and `git diff --check`.
- Refreshed `output/verification/airy-code/{results.json,semantic.log,final.patch,reviewed-files.tsv,report.txt}` and command logs. `review-corrections.tsv` maps each request to its implementation. Spec status left unchanged for the parent review; device/audio/accessibility and signed-release limitations remain unchanged.

## Review Summary

Three independent reviews completed. Edge-case review found no issues; verification review found no gaps. Twelve low-severity cosmetic findings plus declaration spacing were patched without changing tokens. Parent reran the complete semantic/protected-file audit successfully. Tests, typecheck and lint independently passed; the implementation agent reran the full build/export suite after corrections. No unresolved actionable finding remains. No commit/push, honoring the approved scope.

## Suggested Review Order

**Readable application flow**

- Start with separated application stages and unfolded JSX while preserving all visible text.
  [`exercise-pages.tsx:31`](../../apps/web/src/exercise-pages.tsx#L31)

- Inspect spaced guards and validation stages without changing logic.
  [`persistence.ts:36`](../../packages/music/src/persistence.ts#L36)

- Follow the same training algorithm through clearer conditions and grouped steps.
  [`training.ts:76`](../../packages/music/src/training.ts#L76)

**Platform layout and effects**

- Check nested conditions, async operations and cleanup boundaries.
  [`theme.tsx:52`](../../apps/mobile/src/theme.tsx#L52)

- Compare unfolded component structure with unchanged rendered children.
  [`components.tsx:18`](../../apps/web/src/components.tsx#L18)

- Review blank-line-only separation of guarded build stages.
  [`build-android.ps1:6`](../../scripts/build-android.ps1#L6)

**Verification and future guidance**

- Confirm readable test scaffolding retains the same assertions and dependency behavior.
  [`self-check.ts:872`](../../apps/mobile/scripts/self-check.ts#L872)

- Inspect expanded test arguments with unchanged baseline signatures.
  [`training.test.ts:30`](../../packages/music/tests/training.test.ts#L30)

- Read the lightweight reference to global airy-formatting guidance.
  [`AGENTS.md:26`](../../AGENTS.md#L26)
