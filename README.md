# NoteScale

NoteScale is a French-language beginner app for understanding and constructing
major scales. It ships the same dependency-free music domain to a React/Vite
web app and an Expo React Native app. Runtime data, lessons, progress, icons,
and audio remain local; there is no account, backend, analytics, remote font,
or remote media.

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- For mobile: an Expo-supported Android/iOS environment

## Install and run

```bash
npm install
npm run start:web -- --host 127.0.0.1
npm run start:mobile
npm run android
npm run ios
```

The web development server prints its local URL. Expo prints the device,
emulator, and development-build options supported by the current machine.

## Verification commands

```bash
npm run generate:audio
npm run verify:audio
npm test
npm run typecheck
npm run lint
npm run build
npm run verify:web-build
npm run preview:web
npm run export --workspace @notescale/mobile
```

`generate:audio` reproduces two chromatic octaves (24 short WAV samples) in the root asset source
and both platform bundles. The files are synthesized locally and contain no
third-party recording.

## Architecture

```text
packages/music       pure domain, use cases, ports, codecs, deterministic tests
apps/web             React UI and browser storage/audio/service-worker adapters
apps/mobile          React Native UI and Expo storage/audio adapters
assets/audio         reproducible source WAV files
scripts              TypeScript asset generation
```

Dependencies point inward: UI calls shared use cases, platform modules implement
storage/audio boundaries, and `packages/music` imports no React, DOM, browser, or
native implementation. DOM and native UI are intentionally not shared. npm
workspaces provide linking and one root lockfile; no monorepo orchestrator is
needed.

Canonical domain note IDs use ASCII (`F#`, `Bb`). Rendering converts them to
French/international names and Unicode accidentals. Written identity remains
separate from pitch, so `C#` and `Db` sound alike but are never accepted as the
same written answer.

## Supported major keys

Exactly these conventional spellings are supported:

`C`, `G`, `D`, `A`, `E`, `B`, `F#`, `C#`, `F`, `Bb`, `Eb`, `Ab`, `Db`, `Gb`, `Cb`.

Keys that require double accidentals are outside this MVP. An unsupported tonic
returns a typed failure and, where possible, a supported enharmonic suggestion.

## Local data and privacy

Progress uses a validated version-1 JSON envelope. The web adapter stores it in
`localStorage`; the mobile adapter stores it on-device. Missing, incompatible,
or corrupt payloads fall back to a usable in-memory state without overwriting
unreadable or incompatible stored bytes. Storage failures produce a non-blocking French warning. Clearing browser/app data removes progress, and
there is no cloud recovery or cross-device synchronization.

## Offline behavior

The installed production web build registers a base-aware service worker. After
one successful online load, it precaches the app shell, bundled code, manifest,
icon, and local WAV files. Hash-based routes avoid GitHub Pages deep-link 404s.
If an update fails, the last successful cache remains available and the UI gives
retry guidance. Development mode does not claim offline behavior.

The mobile bundle contains the domain, UI, and audio assets, so its core journeys
do not require a network after installation.

## GitHub Pages

Live web app: <https://noste-scale.github.io/note-scale/>

1. Push this repository to GitHub with `main` as the deployment branch.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Push `main` or manually run the **Test and deploy NoteScale Pages** workflow.

Vite derives its default base from `GITHUB_REPOSITORY` in Actions, uses `/` for an
`owner.github.io` repository and `/<repository>/` otherwise, and accepts `VITE_BASE_PATH`
as an explicit slash-normalized override. The workflow runs install/tests/
audio regeneration/validation, typecheck/ESLint, Android/iOS Expo exports, and web build, then uploads `apps/web/dist` with the official Pages
actions. It needs no runtime secret. The production deployment is live at the
URL above.

## Manual verification ledger

| Check | Evidence in this workspace | Still required externally |
|---|---|---|
| Shared theory, grading, scheduling, persistence | Deterministic automated tests | None |
| Static web bundle and offline runtime | Automated inventory/worker tests plus a local production-browser online warm-up and offline hard reload | Repeat on the live Pages origin after deployment |
| Keyboard, visible focus, reduced motion, 320 px layout | Authored semantics plus a local production-browser 320 px check | Screen-reader, touch-device, and broader manual accessibility pass |
| Local audio lifecycle | Adapter tests and generated files | Audible browser/device smoke test |
| Android/iOS bundle resolution | Expo export commands when recorded below | Physical/emulator journey and audio checks |
| GitHub Pages | Successful authenticated workflow run and public URL | None |

### Environment record

- 2026-08-11: `npm test` passed 55 shared-domain tests, 40 executable web
  UI/adapter/service-worker tests, and the expanded mobile hydration/save/grading/audio/routing self-check.
- 2026-08-11: `npm run typecheck`, real ESLint via `npm run lint`, and `npm run build`
  passed. Post-build inventory checks passed for `/`, explicit `/custom/base/`, and Pages `/NoteScale/` bases.
- 2026-08-11: audio regeneration verified 24 pitches, WAV metadata, exact inventories,
  and byte-identical root/web/mobile copies.
- 2026-08-11: Expo SDK 57 exported Android and iOS bundles successfully.
- 2026-08-11: production-browser smoke check reached all 15 scales,
  validated exercise feedback and persisted progress, showed no document-level
  overflow at 320 px, then hard-reloaded Progress offline and fetched a cached
  WAV while `navigator.onLine` was false.
- Windows can typecheck and produce static web/Expo bundles.
- No physical Android or iOS result is inferred from a bundle export.
- Final iOS device proof requires iOS hardware, macOS, or an EAS build.
- 2026-08-11: GitHub Pages deployment completed successfully at <https://noste-scale.github.io/note-scale/>.

### Dependency audit note

The 2026-08-11 production audit reports upstream Expo/Metro build-tool
advisories (14 high, 10 moderate) and proposes incompatible SDK/React Native
downgrades rather than a safe patch. NoteScale processes only repository-owned
assets through those tools; they are not part of the static web runtime. Keep
the toolchain on current compatible Expo patches and rerun `npm audit
--omit=dev` before release rather than applying `npm audit fix --force`.

## MVP limits

- Major scales only; no double-accidental keys.
- Local progress only; clearing site/app storage is destructive.
- Synthetic oscillator-like samples, not recorded piano samples.
- No notifications, microphone recognition, accounts, sync, analytics, or
  backend.
