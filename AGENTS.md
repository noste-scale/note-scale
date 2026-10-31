# NoteScale architecture

## Boundaries

- Keep music rules, grading, scheduling, training selection and validated codecs
  in `packages/music/src`. Core uses domain data and explicit time/randomness;
  its imports stay within core, without frameworks, platform APIs or app models.
- Keep web weighted random/anti-repeat and mobile weighted rotation as distinct
  policies in `training.ts`. Preserve their RNG calls and order when refactoring.
- Apps consume the public `@notescale/music` entry point, never another app or
  package internals. Keep presentation, routes, accessibility, audio lifecycle,
  hydration and queued save coordination in their platform app.
- Group modules by business responsibility and reasons for change. Keep their
  dependency graph acyclic and directed toward stable policies. Share rules that
  change together; expose only the contracts each consumer needs.
- Cross useful boundaries with simple domain records and narrow ports, not
  framework-owned objects. Implement external mechanisms outside core and
  compose them before use; preserve caller contracts when replacing adapters.
- Compose mobile storage in `apps/mobile/app/_layout.tsx`. Pass one stable
  `StorageAdapter` per provider mount; providers must work with synchronous or
  asynchronous fakes, including thrown and rejected operations. Storage imports
  belong at composition, not inside progress/theme providers.

## Practical Clean Code

Apply inherited global Clean Code and sentence-readability guidance.
Use explicit domain names, verb-named cohesive functions and straightforward
top-down flow. Prefer existing functions and ports over new layers, classes,
dependencies or DI frameworks. Use named options for long internal argument lists.
Keep existing shared exports compatible; preserve typed failures and optional
values where those are the established contracts. Comment intent or constraints,
not code narration. Mark deliberate shortcuts `ponytail:` with their ceiling and
upgrade path where relevant.

## Verification and protected behavior

- Leave a runnable regression check for non-trivial changes. Run `npm test`,
  `npm run typecheck` and `npm run lint`; architecture tests must accept valid
  imports and reject forbidden dependencies. For training refactors compare
  outputs and RNG consumption, not just selected scale IDs.
- Preserve storage keys/schema, validation, French warnings, unreadable-byte
  protection, pending attempts, FIFO/late-write repairs and cancellation.
- For cross-platform changes also run web build/inventory, audio verification
  and Expo exports (commands in README). Report device/audio/accessibility
  checks separately: static exports and host stubs do not prove device behavior.
- Leave signing, generated native files, assets and dependencies alone unless
  explicitly requested.
