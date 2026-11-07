# T32 visual regression review

Historical record: source IDs and artifact-retention statements describe the
original named run. Bulky raw artifacts were later removed at the owner's request;
see ../../history-rewrite.md. This is not a new test run.

Status:24full consumer and12map comparisons pass in the final no-update Nx run;
manual PNG review and independent checks are complete. Source commit:c1f6085;
final documentation/evidence/tracker index review is complete.

The maintained `@visual` selection in `visual-regression.spec.ts` captures
24 controlled consumer images: flight/train/bus, light/dark, 1440×900 desktop
and390×844 mobile, each before search and after a complete priced comparison.
Each pair uses its own seed3232 session, fixture anchor2026-10-29T06:00:00Z and reduced
motion. Pages are closed after their pair; cookie jars remain available for
the fixture's owned namespace cleanup. Runs use production `http://127.0.0.1:4307`.

Actual metadata is emitted beside every run: browser version, seed/clock,
fixture version, query/state, viewport/device DPR, real canvas DPR/quality,
native renderer, font/image readiness, scroll position and selection. Missing
diagnostics remain unknown. The GL map is retained in the screenshots. The
initial full-page comparator uses color threshold0.08 and max differing pixels0.3%.
Twelve additional desktop-map crops use threshold0.05 and max96 differing pixels
to protect sparse, dim map details. Crops retain the real composed WebGL/DOM
map, without masking. These limits require manual review against actual PNGs
for any change; cross-GPU raster variance remains an explicit limit. Baseline creation is distinct from a later
comparison run. Baseline generation and manual observations are recorded below.

Hotel desktop/mobile and English admin inspection are three additional actual
PNG references. External hotel raster/photos and session-specific admin IDs
are captured as rendered, with public data/geometry assertions; they are not
deterministic pixel gates. Network-unavailable map status must be disclosed,
without replacing external tiles or hiding the application-owned map.

## Execution and manual review receipt

The final required Nx selection executes8/8 cases
successfully, including both visual cases with no snapshot updates. All24full
images and12map crops match the generated baselines at the unchanged limits.
Three actual hotel/admin references also satisfy their complete-data assertions.
Controlled CSS viewports are not physical-device evidence.

`native-baseline-001` retained one failed consumer matrix (default first-batch
scroll left one result visible) and one semantically passing reference case.
Manual review also rejected its admin reference because only the loading frame
had been captured. Explicit real completed-heading scroll and real admin-data
readiness fixed the capture logic; no production UI or tolerance was changed.

`native-baseline-002` executed both cases successfully and generated24 full
consumer plus12 map-detail baselines and3 hotel/admin references. Root reviewed
six complete four-state QA composites and full train search, mobile pricing and
loaded admin images. External hotel tiles rendered ready. Baseline generation
is not a subsequent comparison pass, and does not prove universal rendering.

Root also inspected the actual normal-motion international one-stop flight
reference: country borders, uncrowded city labels, airport codes and the fitted
Tehran→Dubai→Istanbul route render with the correct direction/vehicle. Its
normal GPU metrics are separate from the reduced-motion comparison matrix.
The five affected critical journeys pass:
provisional calendar/focus, hotel capacity/custom-point cancellation, full real
keyboard traversal/handoff and both immutable receipt refresh/return contexts.

The fixture anchor controls deterministic inventory/date planning; it does not
freeze quote freshness or the browser/server wall clock. Queries use explicit
2026-11-02 dates. API `observedAt` and the browser's actual ISO wall clock,
`performance.timeOrigin` and monotonic sample timestamps are recorded separately.

An existing visual follow-up remains: the bounded internal horizontal form-row
scroll strategy can clip the left search-basis label for train even at1440px.
This capture does not claim all form controls are visible simultaneously. Keep
the T31 bounded-scroll/reachability strategy; no new layout redesign was made.
The mobile hotel's horizontally scrolling order controls also show only part
of their options at once. These known scroll affordances remain layout follow-ups.
The36golden PNGs are the recorded Darwin/Chrome reference; another OS/GPU needs
explicitly reviewed references or justified raster tolerances, not automatic
baseline approval. Actual cross-OS rendering is not established here.

T31 accessibility/browser evidence and the explicitly unperformed VoiceOver
check remain separate. No T32 screenshot establishes screen-reader support.
