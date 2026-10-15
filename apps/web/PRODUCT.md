# NoteScale Web

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

French-speaking music beginners learning piano, guitar, or singing, including
people unfamiliar with sharps and flats. Practice sessions last a few minutes.

## Product Purpose

Teach learners to reconstruct major scales from the tone/semitone formula,
instead of memorizing every scale separately. Let them learn, listen, practice,
receive explanations, and follow their progress.

## Operating Context

Responsive browser application for desktop and phones. The production app works
offline after a successful initial load. Progress stays in this browser/device;
clearing its data removes progress. Audio samples ship with the application.

## Capabilities and Constraints

- Preserve lessons, the 15 conventional major keys, scale construction,
  exercises, daily practice, progress, local audio, and light/dark themes.
- Preserve exact written note identity: enharmonic pitches are not interchangeable
  answers. Keys requiring double accidentals remain outside scope.
- No account, backend, analytics, remote font/media, or cross-device sync.
- Keep French interface copy and the existing visual identity. This pass refines
  usability and accessibility; it does not redesign or harmonize the two apps.

## Product Principles

- Explain construction and mistakes, not only right/wrong answers.
- Keep short practice sessions and the next action easy to understand.
- Preserve local progress and make storage failures recoverable and explicit.
- Keep keyboard focus, control names, contrast, and narrow layouts usable.

## Evidence on Hand

Confirmed by the user on 2026-10-15. Source requirements are the root
`Cahier des charges — Application mobile d’apprentissage des gammes musicales.md`,
root `README.md`, and the existing application. Existing code is the visual
authority. Build/test results do not establish user research or device validation.
