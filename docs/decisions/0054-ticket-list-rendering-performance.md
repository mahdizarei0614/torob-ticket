# 0054 — Keep large ticket lists responsive

Accepted and implemented2026-10-30. Owner authorized virtualization or a suitable
alternative for laggy large ticket lists. Source commits: `9ade6c6`, `42a4065`,
`2897063`. Specification1.25.

Use browser-native `content-visibility:auto` and remembered intrinsic row sizes
above24 exact-price cards. Every eligible card remains in the DOM. This preserves
browser find, keyboard/focus, variable details, exact-price keys and scroll
anchors without a recycled-row lifecycle. Unsupported browsers render the full
ordinary list. This is rendering containment, not JavaScript DOM recycling.

Large lists use one finite list fade for replacement/reorder rather than
per-row Motion layout projections. Small lists keep individual motion; details
and seller disclosures retain finite transitions. A development StrictMode bug
that cancelled then snapped initial disclosure height is repaired by tracking
completed entry separately and resuming interrupted entry from its visible frame.

Memoize projections, whole row owners, context values and unchanged card bodies;
reuse bounded locale formatters with exact money/error behavior. Resolve render
eligibility once per list render. All event/effect/referral paths still check live
authority; expiry, adopted/latest evidence and changed provider actions update.

Scrolling cards under the pointer previously published hidden hover previews to
both map and search stores despite an explicit map pin. Ignore only those hidden
pointer previews after the existing owner check. Keyboard inspection, unpinned
hover, clearing, explicit pinning and selection/referral authority remain live.
Moving the pointer aside was a diagnostic; the final proof uses its normal
position and the actual product fix.

Actual48-card native Chrome checks verified36–37 offscreen contents skipped,
exact offscreen selection, focus/details retention, local sorting without new
search/referral requests and no layout jumps. Final Docker development runs at
1366×768 and390×844/DPR1 measured p95 callback intervals9.3/9.2ms and zero long
tasks across three1.8s traversals after date/chart/route completion. These are
recorded-workload results, not physical display FPS or universal device claims.
Earlier slow development and failed disclosure checkpoints remain retained.

See the [checkpoint](../evidence/adjustments/results-scroll-performance/checkpoint.md)
and [independent review](../evidence/adjustments/results-scroll-performance/review-independent.md).
This adjustment does not complete T30 or the remaining T31–T33 audits.
