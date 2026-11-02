# 0083 — Route-aware city and stop labels

Date: 2026-11-02. Owner reports unreadable stop/wait text over the
Tehran(THR)→Isfahan(IFN)→Mashhad(MHD) flight, then explicitly requires the same
general solution for every route and vehicle type.

The prior annotation placement considered other labels and point anchors but
did not reserve the actual route. Fixed offsets cannot address different flight
arcs, double rails, winding roads, asymmetric returns or camera zoom.

## Ruling

- Treat all complete supplied route polylines as screen-space obstacles,
  including outbound/return presentation lanes and required transfer modes.
  Reuse the same geometry/projection/lane helpers as WebGL and SVG. Use the
  displayed camera frame and CSS-pixel dimensions, not a target camera or DPR
  approximation. Reserve stroke/soft-light clearance and label entry movement.
- Keep every geographic anchor and canonical itinerary unchanged. Reposition
  only text, with existing leader cues where needed. Do not cover routes with
  opaque badges or reduce font sizes. Both the city name and full stop/wait
  information are part of the protected text box.
- Measure complete final facts before their reveal, including direction prefixes,
  unknown waits, longer names, RTL and font readiness. A hidden, inert,
  accessibility-hidden measurement cohort cannot add duplicate semantic endpoints,
  stops or count-up selectors. Its font/resize observations are owned and cleaned;
  no continuous measurement loop or vehicle-tick layout is introduced.
- Prefer route-clear placements, then keep labels and point anchors distinct and
  inside the viewport. Use bounded deterministic candidates with spatial rejection
  and a narrow-gap fallback rather than a city-specific exception. Retain stable
  relative placement where possible. Reserve all stops before progressive reveal,
  so counting up/revealing a later city does not shift previous facts.
- Decorative international city names yield or disappear if their boxes conflict
  with the selected route. Selected itinerary facts keep priority. Apply the same
  rules to all vehicle modes and the static/reduced-motion presentation.

No routing, pricing, timing, selection, map-camera authority, renderer, scheduler,
provider, dependency or backend changes. Theme colors remain semantic.

## Verification boundary

Focused geometry tests must cover full line/box crossings with both vertices
outside, curves, rails/roads, both legs, narrow clear corridors, repeated stops,
long measured facts, resizing and retained-callback cleanup. Browser checks
compare actual visible text boxes with the actual canonical rendered paths/lane
offsets from public search/catalog/local assets using an independent intersection
postcondition. Verify all three modes, round trips, zoom/resize, complex world
routes and fallback, with actual readable captures and independent review.

Source hashes and checked fixtures do not by themselves establish readability or
every possible future dense layout. Actual supported cases, failure findings and
remaining limits belong in the task checkpoint/tracker. Prior map and hotel-map
evidence remains source-bound and unchanged.
