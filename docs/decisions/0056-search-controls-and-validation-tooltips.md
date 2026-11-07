# 0056 — Compact search controls and above-field validation

Accepted and implemented2026-10-30. Source `f4782bf`. Specification1.27.

Focusing an empty enabled origin/destination input opens the available city
options. React Aria keeps ownership of menu, filtering, keyboard selection and
Escape; no parallel application open-state is introduced. Destination stays
disabled until an origin is selected, and opening a menu never selects a city.

Move the round-trip departure/return exploration choice beside trip class and
use the existing shared segmented control. Keep date-leg/provisional/calendar
state in DateExplorer, with a composition slot for its control. The standalone
explorer retains an inline fallback. Normal desktop tracks share a row and
baseline; narrow layouts can wrap with readable type and44px targets. Remove
routine fixed-opposite-leg captions while preserving calendar price units and
actual missing-return/retrieval states.

Validation descriptions remain accessible and connected to their controls.
Render the visual error in an above-field tooltip with no layout contribution,
available on focus/hover and dismissible with Escape, including hover-only
interaction. It must not steal focus, lock scrolling or block city/calendar
interaction. Deliberate invalid-submit focus, invalid styling, finite shake and
all pending/session/coverage/interaction guards remain intact. Form-level errors
must have the submit control as a useful anchor rather than an empty row.

The shared error helper lives outside React Aria's ComboBox collection-building
tree, so its hidden collection pass cannot create duplicate descriptions or
portals. Passive anchor subscription includes focus already established during
layout and handles enclosing parent refs correctly. Anchor-to-tooltip hover has
a cancellable120ms handoff; Escape also handles hover-only tips. The visual
overlay anchors above the complete city field, including its label.

Four unique native desktop/mobile scenarios passed, including320px layout,
with zero field/form-height changes and page errors. Source checks, independent
review and focused final-anchor checks passed. See the
[checkpoint](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/search-controls-tooltips/checkpoint.md) and
[independent approval](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/search-controls-tooltips/independent-review.md).
M7 remains partial29/35, T30 active; no release or remote action occurred.
