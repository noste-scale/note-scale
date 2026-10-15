# NoteScale Mobile

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

French-speaking music beginners learning piano, guitar, or singing, including
people unfamiliar with sharps and flats. Practice sessions last a few minutes.

## Product Purpose

Teach reconstruction of major scales from the tone/semitone formula through
lessons, listening, construction, exercises, explanations, and local progress.

## Operating Context

Expo/React Native application for Android and iOS. Core journeys and bundled
audio work offline after installation. Progress stays on-device; clearing app
data removes it. Preserve native navigation, safe areas, font scaling, and
platform accessibility behavior rather than imposing web interactions.

## Capabilities and Constraints

- Preserve lessons, 15 conventional major keys, scale construction, exercises,
  daily practice, progress, audio, and automatic/light/dark theme preferences.
- Preserve exact written note identity; enharmonic pitches are not interchangeable
  answers. Double-accidental keys remain outside scope.
- No account, backend, analytics, remote font/media, or cross-device sync.
- Keep French interface copy and the incumbent mobile identity. This pass is
  refinement, not a redesign or a forced match to the web palette.
- Preserve the existing Android signing material. Export/build success is not
  evidence of rendering, gestures, accessibility, or audio on a real device.

## Product Principles

- Explain construction and mistakes, not only right/wrong answers.
- Make short touch-first practice sessions and selected choices understandable.
- Keep labels usable with large system fonts and touch targets accessible.
- Protect local progress and expose recoverable errors without blocking learning.

## Evidence on Hand

Confirmed by the user on 2026-10-15. Root requirements, `README.md`,
`docs/build-android.md`, and existing native components are source evidence.
Native screenshot/device verification remains separate from bundle validation.
