
- source_spec: `spec-impeccable-web-mobile-polish.md`
  summary: Existing web bottom navigation overflows when root text size is doubled on narrow screens.
  evidence: Final browser fixture used actual SSR markup and unchanged navigation CSS with root font 200%; Progression right edge reached 438px at 320px and 391px viewports. Normal text passed. Fix requires a separate accessibility pass; the fixture is not zoom/AT certification.
