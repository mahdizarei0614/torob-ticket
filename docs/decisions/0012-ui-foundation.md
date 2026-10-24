# T12 — Shared UI and theme foundation

2026-10-24. Implements specification §2/§12 without a new production journey.

- React Aria controls own semantics; CSS Modules own presentation. Controlled
  values remain with feature callers. ComboBox exposes both input and selection;
  committing an option synchronizes its label and ID. Segment choices are radios.
- UI public index imports the shared CSS. Both application entry points install
  one root ThemeProvider, Persian/RTL consumer and English/admin. Explicit Latin
  identifiers use `Code` (`bdi`, LTR, Inter, tabular numerals).
- `Price` accepts canonical Money and mandatory party/stay scope, uses domain
  `formatTomanParts`, and announces the exact whole total including a tenth of a
  toman when required. No per-person or nightly price is inferred.
- Shared token inventory covers text, surfaces, borders, states, icons, focus,
  elevation, chart, and future scene colors. Flight is blue, train green, bus red across canvas/surfaces and accents;
  admin uses the neutral/blue family. Flat strokes inherit semantic currentColor.
- Every actionable mobile target is at least44px. Pending buttons stay focusable
  through React Aria `isPending`, suppress actions, and announce localized loading
  text. Disabled buttons leave the tab order. Modal owns containment/restore;
  tooltip descriptions never replace essential visible conditions.
- `assets/theme-init.js` is a local blocking head script before body content. It
  honors stored light/dark or system and tolerates unavailable storage. The root
  provider follows system changes while system is selected and stores preferences.
- Theme updates use the specified260ms flat root reveal centered at its control,
  with direct fallback and no animation under reduced motion. CSS and the optional
  synchronous `onThemeChange(ThemeSnapshot)` callback update inside the transition
  DOM update before its new frame. `readThemeColors()` returns resolved semantic
  CSS strings for T13's typed uniform adapter. UI imports no graphics code.
- Fonts are unmodified upstream WOFF2 binaries with full licenses/provenance in
  `assets/fonts`. Storybook serves local assets. The shared Nx uiAssets input is
  included in UI's default inputs, so dependency-aware app/UI/Storybook builds
  invalidate when root fonts change. An executable cold/warm/mutated-font probe
  verifies both UI and Storybook target policies.
- Storybook10.6.3 and user-event14.6.8 were checked against official peer metadata
  and pinned exactly.14 gallery stories cover every language/palette pair plus
  both English admin appearances; this is a review surface only.
