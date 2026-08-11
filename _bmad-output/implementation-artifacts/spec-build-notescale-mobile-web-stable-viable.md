---
title: 'Build a stable, viable NoteScale mobile and web product'
type: 'feature'
created: '2026-08-11'
status: 'done'
baseline_revision: 'NO_VCS'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/Cahier des charges — Application mobile d’apprentissage des gammes musicales.md'
warnings:
  - multiple-goals
  - oversized
deferred: []
---

<intent-contract>

## Intent

**Problem:** NoteScale currently has requirements and BMAD tooling but no executable product. Beginners need a reliable French-language learning experience that teaches major-scale construction rather than rote memorization on both the web and React Native mobile.

**Approach:** Build a minimal npm-workspace monorepo with a dependency-free TypeScript music domain, a responsive offline-capable React/Vite web app, and an Expo React Native app that reuse the same domain behavior. Harden it through deterministic tests, static analysis, production builds, accessibility checks, BMAD review loops, and documented runtime smoke tests.

## Boundaries & Constraints

**Always:** Keep UI copy in French and engineering documents/code identifiers in English; support exactly the 15 conventional major-key spellings from C through seven sharps/flats; preserve diatonic spelling such as E#, B#, Cb, and Fb; use React Native with Expo for mobile and React with Vite for web; keep runtime operation local-only with no account, backend, analytics, remote font, or remote media dependency; use a GitHub Pages-safe router/base; validate persisted data and fail safely; make randomness and time injectable in domain tests; respect keyboard, screen-reader, contrast, touch-target, and reduced-motion accessibility.

**Block If:** A destructive replacement of user-authored files is required; a runtime secret or paid service becomes necessary; a live GitHub Pages deployment is required but no authenticated remote exists; final iOS device proof is required without an accessible iOS device, macOS runner, or EAS build.

**Never:** Add speculative backend/auth/sync, a heavy monorepo orchestrator, duplicated music rules, unsupported double-accidental keys, permissive enharmonic grading, network-required audio, or claim device/deployment verification from local build evidence alone.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Major-scale generation | Any supported tonic ID among 15 keys | Eight correctly spelled notes, repeated tonic, interval pattern 2-2-1-2-2-2-1, canonical key signature | Unsupported tonic returns a typed failure with an enharmonic suggestion when available |
| Exercise grading | Ordered scale, unordered accidental set, interval choice, or one-note error | Structured per-position/set/value feedback shown only after submission | Empty or malformed answer remains ungraded and exposes accessible validation feedback |
| Progress load | Valid, missing, old, or corrupt local payload | Valid fields load; missing/corrupt payload yields safe empty versioned state | Storage exceptions never crash UI and surface a non-blocking persistence warning |
| Adaptive review | Correct/wrong results with injected clock and RNG | Wrong answers become due soon; successes progress through 1/3/7/14/30-day spacing; daily picks are distinct | Invalid dates/records normalize safely and selection falls back deterministically |
| Audio playback | Note/scale, direction, normal/slow speed, pause/restart | Local pitches play in requested order; previous playback stops before new playback | Unsupported/unavailable audio reports a recoverable French message and controls remain usable |
| Offline web | App loaded online once, then connection unavailable | Cached shell, data, icons, and audio reload from GitHub Pages path | Update/cache failure leaves last usable version and exposes retry guidance |

</intent-contract>

## Code Map

- `Cahier des charges — Application mobile d’apprentissage des gammes musicales.md` -- authoritative user requirements; preserve as read-only input.
- `package.json` -- root npm workspace scripts and Node engine; create.
- `tsconfig.base.json` -- strict shared TypeScript configuration; create.
- `packages/music/src/` -- pure music theory, catalog, lessons, exercises, progression, persistence codecs, and exports; create with zero runtime dependencies.
- `packages/music/tests/` -- golden vectors for all 15 keys plus deterministic exercise/progress/persistence tests; create.
- `apps/web/src/` -- French responsive React application, platform adapters, state context, routes, components, pages, and styles; create.
- `apps/web/public/` -- PWA icons and static metadata only; create generated owned assets when required.
- `apps/mobile/app/` and `apps/mobile/src/` -- Expo Router screens, React Native components, platform storage/audio adapters, and theme; create.
- `assets/audio/` -- generated, owned chromatic WAV samples shared/copied into platform bundles; create with a reproducible generator.
- `.github/workflows/pages.yml` -- official GitHub Pages build/test/deploy workflow; create.
- `README.md` -- English setup, architecture, commands, limitations, deployment, and manual verification ledger; create.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `tsconfig.base.json`, `.gitignore` -- initialize plain npm workspaces and strict shared tooling without Nx/Turbo -- minimize machinery and keep one lockfile.
- [x] `packages/music/src/types.ts`, `notes.ts`, `scales.ts`, `scale-generator.ts`, `index.ts` -- implement canonical ASCII note identity, French/international rendering, 15-key catalog, construction steps, and typed unsupported-tonic results -- establish domain truth before UI.
- [x] `packages/music/src/lessons.ts`, `exercises.ts`, `progress.ts`, `persistence.ts` -- implement five lessons, all five exercise kinds, structured grading, daily session, rolling mastery, streaks, deterministic spaced review, and versioned validation -- cover every main learning journey.
- [x] `packages/music/tests/**/*.test.ts` -- test 15 golden scales, invariants, enharmonics, exercise grading, seeded generation, scheduling, streak boundaries, and corrupt persistence -- prevent theory/data regressions.
- [x] `scripts/generate-audio.ts`, `assets/audio/**` -- generate small owned local note samples reproducibly in TypeScript -- avoid licensing, network dependencies, and a second implementation language.
- [x] `apps/web/src/**/*`, `apps/web/index.html`, `apps/web/vite.config.ts` -- build Home, Learn, Scales/detail/generator, Exercises/daily, and Progress routes with shared domain, responsive accessible UI, theme, local persistence, keyboard visualization, and full audio controls -- deliver the primary deployable product.
- [x] `apps/web/src/sw.ts` or PWA configuration plus icons/manifest -- precache all runtime assets under the repository-aware base and register safe updates -- satisfy offline-after-first-load behavior.
- [x] `apps/mobile/app/**/*`, `apps/mobile/src/**/*`, `apps/mobile/app.json`, `apps/mobile/package.json` -- implement matching core journeys in Expo React Native with mobile storage/audio adapters and accessible native controls -- satisfy Android/iOS scope without duplicating domain logic.
- [x] `.github/workflows/pages.yml`, `apps/web/vite.config.ts` -- derive Pages base from repository context, run install/test/typecheck/lint/build, and upload `apps/web/dist` with official actions -- make deployment repeatable without secrets.
- [x] `README.md` -- document setup, commands, GitHub Pages activation, offline semantics, data privacy, supported keys, testing evidence, and honest device/deployment limitations -- make project operable and reviewable.

**Acceptance Criteria:**
- Given any of the 15 supported tonic spellings, when the shared generator runs on web or mobile, then both surfaces show the exact same eight-note theoretically correct major scale and canonical key signature.
- Given a beginner opening the product, when they navigate with pointer, touch, or keyboard, then Home, five Learn lessons, all scales, detail/generator, all five exercise types, daily training, and Progress are reachable with French labels and visible focus.
- Given an exercise answer, when submitted, then no answer was revealed beforehand and feedback identifies exact errors, correct answer, explanation, and retained rule before updating progress.
- Given six recent scored attempts for a scale, when at least five are correct and the latest is correct, then the scale is mastered; otherwise practiced weak/due scales appear in review and are prioritized deterministically.
- Given saved progress, when the app/browser restarts, then attempts, accuracy, per-scale status, due dates, mastery, and local-calendar streak persist; corrupt data produces an empty usable state rather than a crash.
- Given a user starts note or scale audio, when direction/speed/pause/restart controls are used, then owned local audio follows the control state without overlapping playback or requiring network access.
- Given the web app was loaded online once, when the browser goes offline and hard reloads, then the routed app shell, lessons, scales, exercises, progress UI, icons, and audio remain usable.
- Given a narrow mobile viewport or React Native device, when all journeys are used, then content remains legible, controls meet touch targets, safe areas are respected, and no horizontal clipping blocks actions.
- Given reduced-motion or screen-reader/keyboard use, when interacting with navigation, piano, answer chips, feedback, theme, and audio, then semantics, announcements, labels, contrast, and motion preferences remain usable.
- Given a clean dependency install, when `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` run, then all exit successfully and the web output is a static GitHub Pages-compatible bundle.
- Given the source dependency graph, when application modules are inspected and typechecked, then UI depends inward on application/domain contracts, platform adapters implement ports, the pure domain imports no React/browser/native code, and all authored application logic is TypeScript.
- Given GitHub Pages Actions is enabled on a repository, when `main` is pushed, then the official workflow deploys the tested `apps/web/dist` artifact using the correct repository base without runtime secrets.
- Given documented Android and iOS commands, when run in appropriate supported environments, then Expo can start the same shared-domain application; unavailable hardware/cloud evidence is recorded explicitly rather than inferred.

## Spec Change Log

## Review Triage Log

### 2026-08-11 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 13: (high 9, medium 4, low 0)
- defer: 0
- reject: 6: (high 0, medium 4, low 2)
- addressed_findings:
  - `[high]` `[patch]` Mobile progress hydration, fallback persistence, and concurrent saves could lose attempts; merged hydrated state, blocked unsafe writes, serialized saves, and added executable regressions.
  - `[high]` `[patch]` Browser storage denial and cross-tab writes could crash or erase progress; guarded storage access, protected unreadable payloads, synchronized/merged attempts, and tested the bridge.
  - `[high]` `[patch]` Review scheduling, streak freshness, local-day sessions, and invalid limits diverged from the adaptive-learning contract; corrected pure domain rules and expanded boundary tests.
  - `[medium]` `[patch]` Persistence accepted noncanonical dates and underreported dropped corrupt fields; enforced canonical instants, preserved valid fields, surfaced warnings, and added malformed-date tests.
  - `[high]` `[patch]` Web exercises repeated fixed/revealed questions and route/filter edge cases could misgrade or farm mastery; randomized fresh attempts, validated route/query state, guarded recording, and added model/UI tests.
  - `[high]` `[patch]` Mobile exercises covered only narrow deterministic recognition flows and lost scale scope; added full-catalog randomization, ordered construction, scoped retries, feedback resets, and executable adapter checks.
  - `[high]` `[patch]` Web audio lifecycle could leave stale UI, overlap players, or mishandle resume/factory failures; added completion/preemption signaling, generation guards, recoverable errors, and production mapping tests.
  - `[high]` `[patch]` Mobile audio lacked real pause/resume and ignored upper-octave files; implemented full lifecycle with direct 24-sample mapping and self-check coverage.
  - `[high]` `[patch]` Piano spelling/interactivity and mobile accessibility/contrast were pedagogically or semantically incorrect; implemented pitch-correct chromatic controls, flat-aware web labels, native playback, readable themes, and radio semantics.
  - `[high]` `[patch]` Service worker could delete unrelated origin caches or return HTML for missing assets; scoped cache deletion, restricted shell fallback to navigation, awaited cache writes, detected redundant installs, and added executable worker tests.
  - `[medium]` `[patch]` Desktop navigation, loading state, malformed routes, empty search, and late theme hydration had usability edge failures; added stable guards and responsive behavior.
  - `[medium]` `[patch]` CI granted deploy permissions during build and omitted mobile bundle gates; split least-privilege jobs, added Android/iOS exports, fixed workspace commands, and pinned formerly floating web versions.
  - `[medium]` `[patch]` Existing verification stopped at domain mocks/source scans for platform bridges, audio, offline responses, and hydration; expanded shared/web/mobile executable coverage and repeated browser offline/runtime checks.

### 2026-08-11 — Follow-up review pass
- intent_gap: 0
- bad_spec: 0
- patch: 16: (high 9, medium 7, low 0)
- defer: 0
- reject: 7: (high 0, medium 5, low 2)
- addressed_findings:
  - `[high]` `[patch]` Exercise prompts and mobile multi-select modes lacked structural proof; added natural/sharp/flat prompt invariants and multi-accidental selection/grading checks.
  - `[high]` `[patch]` Scoped retries, French answer parsing, and accidental normalization could silently switch keys or reject valid input; preserved requested scales and hardened parsers with regression tests.
  - `[high]` `[patch]` Concurrent tab merges undercounted review stages/streaks and could collide attempt IDs; replayed merged attempts, sorted/deduped persisted histories, added collision-resistant injected IDs, and clamped backward clocks.
  - `[high]` `[patch]` Ordinary practice ignored adaptive-review state; both clients now prioritize due/error-prone scales while fixed-scale routes remain fixed.
  - `[high]` `[patch]` Fixed PWA cache identity could retain stale assets and tests bypassed emitted inventory; generated content-derived cache IDs, scoped cache reads/cleanup, and added post-build inventory verification.
  - `[high]` `[patch]` Shared lesson truth and required generator/interval detail diverged between clients; reused shared lessons, restored construction fields, and visually distinguished semitones.
  - `[high]` `[patch]` Mobile storage/theme hangs, stale warnings, and write ordering could freeze or mislead users; added bounded retries/timeouts, serialized writes, recovery clearing, and orchestration self-checks.
  - `[medium]` `[patch]` HashRouter skip navigation, scale audio labels, route/settings playback changes, and stalled voices had accessibility/lifecycle gaps; added focus-main behavior, unique labels, stop/restart guards, and watchdog coverage.
  - `[high]` `[patch]` Cross-tab deletion restored supposedly cleared progress; respected explicit deletion while retaining merge-safe ordinary updates.
  - `[medium]` `[patch]` Documented custom base and Node 22.13 script execution were inconsistent; implemented base override and explicit TypeScript stripping.
  - `[medium]` `[patch]` `lint` duplicated typecheck and PRs lacked gates; added real ESLint and pull-request verification.
  - `[medium]` `[patch]` Audio regeneration was outside normal evidence; CI now regenerates and verifies 24 pitches, WAV metadata, and byte-identical copies across three destinations.
  - `[medium]` `[patch]` Build verification did not inspect real emitted offline assets; added a deterministic post-build verifier for hashed JS/CSS, shell, manifest, icon, cache ID, Pages base, and all WAVs.
  - `[medium]` `[patch]` Progress UI omitted correct-answer count and controls could remain apparently enabled after grading; completed summary and disabled semantics.
  - `[medium]` `[patch]` README mixed pending and completed offline evidence; reconciled automated, local-manual, device, and live-deployment claims.
  - `[high]` `[patch]` Platform grading/persistence boundaries remained weakly exercised; extracted minimal pure controller seams and expanded exact-once submit, hydration/save, routing, and adapter checks without a heavy UI framework.

## Design Notes

- Separate written identity from sound: `C#` and `Db` are distinct spellings but share pitch class 1. UI localization never becomes a domain key.
- Generate letters diatonically from tonic, then derive the required accidental against major offsets `[0,2,4,5,7,9,11,12]`; reject deltas requiring double accidentals in this MVP.
- Use plain React Context/reducers and platform adapters. Do not share DOM/native UI components.
- Apply pragmatic Clean Architecture dependency direction: pure domain and use cases at the center, storage/audio contracts at the boundary, platform adapters outside, and React/React Native UI outermost. Keep layers as folders/modules rather than speculative classes.
- Use TypeScript for all authored source, tests, scripts, and supported tool configuration. JSON, YAML, Markdown, generated assets, and mandatory tool bootstrap files are format exceptions rather than application logic.
- Prefer generated local WAV samples over third-party files. Core returns pitch IDs; platform code owns playback lifecycle.
- Use HashRouter plus a repository-aware Vite base. A generated service worker is acceptable because offline hard reload is explicit scope, not speculative PWA work.

## Verification

**Commands:**
- `npm install` -- expected: one lockfile and all workspaces resolve without peer errors.
- `npm test` -- expected: exhaustive domain and UI tests pass deterministically.
- `npm run typecheck` -- expected: strict TypeScript checks pass for shared, web, and mobile.
- `npm run lint` -- expected: all authored TypeScript/React code passes lint.
- `npm run build` -- expected: Vite emits a production static bundle with service worker and no unresolved assets.
- `npm run start:web -- --host 127.0.0.1` -- expected: manual responsive and accessibility journeys operate in a browser.
- `npm exec --workspace @notescale/mobile expo export -- --platform android` -- expected: Expo resolves and bundles Android without domain/package resolution failures.
- `npm exec --workspace @notescale/mobile expo export -- --platform ios` -- expected: Expo resolves and bundles iOS without domain/package resolution failures.

**Manual checks (if no CLI):**
- Verify installable web app online, then offline hard reload and audio after cache warm-up.
- Verify keyboard-only navigation, focus order, screen-reader names, contrast, reduced motion, and 320 px layout.
- Smoke test Android on emulator/device and iOS through an accessible supported device/macOS/EAS path; record what was actually tested.
- After connecting a GitHub remote, verify the Pages public URL and workflow run rather than treating the local build as deployment proof.

## Auto Run Result

### Summary

Implemented and hardened a complete French NoteScale MVP across React/Vite web and Expo React Native mobile, backed by one pure TypeScript music domain and platform adapters. The review pass repaired data-loss races, weak exercise flows, audio/piano mismatches, offline cache hazards, adaptive-review defects, accessibility gaps, and verification blind spots.

### Files changed

- `package.json`, `package-lock.json`, TypeScript configs -- npm workspace, reproducible tooling, and root verification scripts.
- `packages/music/src/**` -- canonical note/scale theory, lessons, five exercise kinds, structured grading, daily/adaptive review, streaks, merge-safe persistence.
- `packages/music/tests/**` -- 44 deterministic domain and persistence tests.
- `apps/web/src/**`, `apps/web/public/**`, `apps/web/vite.config.ts` -- accessible responsive React journeys, storage/audio adapters, chromatic piano, PWA worker, and 29 web tests.
- `apps/mobile/app/**`, `apps/mobile/src/**`, `apps/mobile/assets/**` -- matching React Native journeys, hydration-safe progress, ordered exercises, accessible chromatic piano, and local audio lifecycle.
- `scripts/generate-audio.ts`, `assets/audio/**` -- reproducible owned 24-note WAV set.
- `.github/workflows/pages.yml` -- least-privilege tested GitHub Pages deployment with mobile export gates.
- `README.md` -- setup, architecture, privacy/offline behavior, verification ledger, deployment, and residual-risk disclosure.

### Review findings breakdown

- Patches applied: 29 consolidated groups across two BMAD review passes; follow-up pass fixed 16 groups (high 9, medium 7, low 0).
- Items deferred: 0.
- Items rejected: 13 review-only, synthetic-diff, hardware-only, or alternative-reading claims across two passes.
- Follow-up review recommendation: true by BMAD formula because the final pass repaired high-severity findings. Work stops at the user-specified 23:45 deadline after all local stability gates pass; remaining proof requires external hardware or an authenticated remote.

### Verification performed

- `npm install`: passed; one current lockfile.
- `npm test`: passed after the follow-up pass; 55 shared tests, 40 web tests, and expanded executable mobile self-check.
- `npm run typecheck`: passed across all workspaces.
- `npm run lint`: passed across all workspaces.
- `npm run build`: passed; static Vite bundle emitted.
- Audio regeneration/verification: passed for 24 pitches, WAV metadata, inventories, and byte-identical copies across all three destinations.
- Web build inventory: passed for `/`, custom-base, and `/NoteScale/` builds with content-derived cache IDs and all 24 WAV files.
- Android Expo export: passed with 24 bundled WAV files.
- iOS Expo export: passed with 24 bundled WAV files.
- Chromium production smoke: passed at 320 px without horizontal overflow; fresh exercise generation, grading, progress persistence, offline deep hard reload, cached B5 fetch, and missing-asset rejection verified.

### Residual risks

- Physical Android/iOS audio, safe-area, and screen-reader behavior still requires real-device testing; bundle exports do not prove hardware behavior.
- Live GitHub Pages workflow/public URL requires an authenticated GitHub remote.
- `npm audit --omit=dev` reports 14 high and 10 moderate advisories in upstream Expo/Metro build tooling; npm's proposed force fix is an incompatible React Native/Expo downgrade, so no unsafe forced change was applied.
