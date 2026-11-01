# Font-independent map heading arrows

Owner adjustment, 2026-11-01: the one-way/round-trip icon above the map is wrong.
The current Chrome page visibly rendered the Unicode arrow as a missing-glyph
box. The city labels and selected round-trip control were otherwise correct.

Render explicit inline SVG strokes instead of a font glyph. For the RTL city
chain, one-way travel points left, from the origin on the right to its destination
on the left. Round trips use two parallel opposing arrows. Keep the existing
muted semantic color, reserved icon footprint, stable animated owner and finite
policy-aware entry. Switching only trip type continues to retain city/code DOM
owners and updates only the arrow; the icon remains decorative and unfocusable.

This is a rendering correction to decision0055, not a change to route facts,
selection, prices or map geometry. Font loading cannot determine the direction
symbol any longer. Maintained glyph expectations now inspect SVG trip-type
identity; all city/code, motion, selection and layout checks remain.

Actual immediate evidence: the original user tab showed a missing-glyph box;
after development HMR it displayed the paired SVG arrows without a user-session
reset or reload. The related 11 heading unit cases and web typecheck passed.
The maintained native toggle/label-identity case now passes in the seven-case
closure, retaining city/code nodes, intermediate arrow opacity, stable geometry,
selected-service revocation and reduced-motion behavior. See
`docs/evidence/T30/resume-2026-11-01/full2-closure/map_heading_evidence_dir/` for
its frame receipt and actual screenshot. Form-only toggles preserve label
positions exactly in the captured frames. Revoking a selected service retains
endpoint nodes but may reflow the destination when stale stop labels disappear;
that case is not claimed position-invariant. The final source-bound unfiltered
T30 run passed224cases with2existingM6guards skipped and0failures. Sourcecfcc3a9; independent5config/77UI/6PG also pass.
