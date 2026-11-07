# T31 browser, RTL and responsive acceptance

Historical record: source IDs and artifact-retention statements describe the
original named run. Bulky raw artifacts were later removed at the owner's request;
see ../../history-rewrite.md. This is not a new test run.

Status: **ACCEPTED within the documented scope and limits** by root and
independent review. Engine verification and the independent five-case check are
complete. A real transient upstream announcement-reference defect immediately
after profile close remains an explicit follow-up below. Historical failures
remain retained; T30's acceptance does not establish this matrix.

Authority is specification1.42, masterTask31 and
the current T31 brief. Consumer is Persian/RTL; admin is
English. Transport codes retain physical LTR order. No booking/payment/provider
integration or compliance certification is implied.
See reproduction and curation for serial
engine commands and the distinction between curated files and full local raw
artifacts; the root owns the final manifest and staging decision.

## Recorded engine checks

| Engine | Actual executable | T31 status | Limits |
|---|---|---|---|
| Chromium / Chrome | Chrome 156.0.8078.76 through Playwright | Final affected scope: 22/22 pass on v3 | Not a fresh full44; not Android Chrome or physical-device proof |
| Firefox | Playwright Firefox 157.0 | Final affected scope: 22/22 pass on v3 | Desktop engine; touch/viewport settings are emulation |
| WebKit | Playwright WebKit 27.2 | Configured full scope: 43 pass, 0 fail, 1 existing touch skip on v2; desktop 1/1 on v3 | App-only keyboard preference restored; not Safari/iOS/VoiceOver proof |

Initial full44 outcomes, all seven responsive-case results and exact sources
remain below. Final Chrome/Firefox rows are affected checks rather than new
full44 executions. Independent review and its separate residual capture are
recorded below.

The root selects exactly one browser per run and serializes native/GPU jobs.
Automated mutable namespaces are new owned reviewer fixtures; cleanup resets
only those namespaces using their in-memory cookie jars, then closes their
contexts. The separate manual zoom inspection below uses an ordinary session on
an isolated hostname and records its own cleanup limits. Original browser
sessions, the default database and the existing Docker stack remain outside
cleanup scope. Session-bearing traces are off.

## Authored responsive checks

[responsive-rtl.spec.ts](../../../tests/e2e/src/responsive-rtl.spec.ts) contains:

- Actual390×844,768×1024,1280×800,1440×900 and1119/1120 CSS-pixel viewports.
  Main-map omission/creation matches the breakpoint. Form and calendar fit the
  viewport; intentional horizontal scrolling stays local to the compact field
  track without causing page overflow.
- A real complete LAX round trip with multiple outbound segments and independent
  return facts. Mobile retains selected ticket details and its route timeline
  without a map. Actual code text matches the ordered source; DOMRange character
  positions and successive code rectangles check physical LTR placement.
- Actual mobile button hit rectangles, including both wheel arrows, clear-field
  controls, account, calendar, details and airport-code tooltips, meet44×44CSSpx.
  Glyph size alone is not a hit-target measurement.
- Six palettes: actual computed foreground/font data, alpha-composited ancestor
  colors and conservative gradient-channel envelopes. Ordinary text targets4.5,
  qualifying large text3 and actual visible focus3. These are computed CSS
  observations; sibling overlays/antialiasing/GPU pixels and visual context still
  require the semantic audit/manual review. Incomplete axe results remain honest.
- 320CSSpx reflow, a deliberately long Persian city query and844×390 short
  landscape. Calendar content/actions remain reachable and dismissal returns
  focus without changing field-row height.
- Actual browser WebGL2 unavailability with reduced motion: static chart control,
  real complete prices and separate outbound/return details remain usable.

## Zoom and assistive-technology boundary

A narrowed viewport, deviceScaleFactor and CSSzoom are not a native200%browser
zoom check. The automated320CSSpx check is labeled reflow only. The root-owned
native Chrome inspection used Cmd+0 followed by five Cmd+= presses in a new
`http://t31.localhost:4300` tab; the native toolbar exposed «Zoom:200%».
Its before/after receipt records
2056×1146CSSpx/DPR2/document2056/map present becoming
1028×573CSSpx/DPR4/document1020/map absent. The
200% screenshot and
calendar receipt show the actual
scroll owner at x294.25,y16,width432,height541 within the573px viewport,
overflow:auto,scrollHeight613/clientHeight539. Cancel returned focus to its
trigger. The restored receipt
records2056×1146/DPR2 and the map present again, before cleanup stalled.

This manual ordinary session has no deterministic-seed or authentication claim.
It used a different hostname from the original127.0.0.1 session; that original
session was not reset. Final server-session reset and owned-tab closure for the
manual alias are **NOT CONFIRMED**: the cleanup call stalled, then reported no
owned cookie. A separate earlier headful attempt performed no zoom and recorded
an owned reset201; that receipt does not establish cleanup of the final manual
attempt. These boundaries are retained in
manual-check-boundaries.json and
zoom-first-attempt.json.

VoiceOver is **NOT PERFORMED**, following the owner's explicit skip. Physical
device and screen-reader checks are separately recorded in
[accessibility evidence](accessibility.md), not inferred from emulation or AX data.

## Execution and corrections

Root engine checks and final independent review have finished within this scope.
Record each actual command/project/browser version, source binding,
viewport/input/motion setting, pass/fail/skip/incomplete facts and owned cleanup.
Run affected checks after a correction and preserve earlier failed runs. No axe
rule suppression, blanket skip or CSS tolerance increase establishes acceptance.

### First full Chrome matrix, failed

The first full tagged Chrome execution is **43 PASS / 1 FAIL**,512.980s, zero
flaky/skip/not-run/interrupted/global errors:
summary,
Nx log. The directory name `final` does not change
the failed outcome. All seven responsive cases pass, including complete
independent round-trip facts, physical LTR placement, mobile hit targets,
viewport/calendar reflow, both contrast methods, static fallback and arbitrary
keyboard hotel-point selection/scrolling.

The one failure is the first semantic case's focus-audit helper: it expects a new
focus event in the native-Tab-to-clear transition but captures no event. The
test-only helper correction and fresh rerun were pending at this stage; the
final affected scope below records their closure. This first run is not recorded
as an application defect or a successful full matrix. The
before source and
after source retain all1,101 equal
source hashes with no added/removed/changed entries. Later Firefox/WebKit runs
and their exact source bindings are separate acceptance layers.

### First full Firefox matrix, failed

The first full Firefox execution is **40 PASS / 3 FAIL / 1 SKIP**,609.868s,
zero flaky/not-run/interrupted/global errors:
summary,
Nx log. All seven responsive cases pass. The one
skip is the existing Chromium-CDP physical-touch test; it is not counted as
Firefox touch or device proof.

The failed semantic cases concern city-menu focus ownership, an alternative-text
finding in the signed-in profile, and a native traversal target extending below
the viewport. These failed outcomes remain retained; the final affected checks
below record the corrections and fresh evidence. The
Firefox before source and
after source match all1,101
hashes with no added/removed/changed entries during this run. This binding
includes the authorized semantic test-helper changes made after the first
Chrome matrix; it is not presented as identical to that earlier test snapshot.

### First default WebKit matrix, failed

The first full WebKit run with its default native keyboard policy is **40 PASS /
3 FAIL / 1 SKIP**,570.013s, zero flaky/not-run/interrupted/global errors:
summary,
Nx log. All seven responsive cases pass; the skip
is the same existing Chromium-CDP touch guard. The
before source and
after source match all1,102
hashes with no added/removed/changed entries during execution.

Failures concern native Tab skipping the city-clear button, a calendar trigger
absent from the tested Tab cycle, and an older hotel test expecting a clicked
selected card's button to receive focus. The card selection itself succeeds.
The isolated test-application keyboard policy and fresh configured outcomes are
recorded separately below. These three default-policy failures remain retained;
no Safari/device evidence is inferred from configured engine checks.

### Configured full-keyboard WebKit matrix

With only the Playwright app's keyboard preference configured, the full selected
44-case run is **43 PASS / 0 FAIL / 1 SKIP**,544.151s, zero flaky/not-run/
interrupted/global errors:
summary,
Nx log. All nine semantic and seven
responsive cases pass. The one skip remains the existing Chromium-CDP touch
guard. All1,102 hashes in
v2 before source and
after source match throughout.

The wrapper temporarily sets only `org.webkit.Playwright / AppleKeyboardUIMode`
to2; its receipt verifies the
original key was absent and is absent again after the child exits successfully.
Global, Safari and VoiceOver preferences remain outside its scope. Default and
configured native keyboard policies retain separate outcomes; configured
Playwright WebKit does not establish Safari/iOS or assistive-technology proof.

The hotel test now records actual pointer focus independently from selection.
In this run, pointer selection correctly selects the card, pin and exact quote
while the card does not receive focus. Unconditional native Shift+Tab/Tab/Space
then changes from another hotel to the target and strictly verifies its focus,
selected pin and exact representative quote, with saved focus receipts/PNG.
No browser-conditional assertion or product focus workaround was added. Two
explicit fixture-premise assertions were strengthened after this v2 full run;
the v3 source differs only in that test
file. A fresh exact desktop case passes **1/1**,29.501s total (27.240s test body),
zero other outcomes/global errors:
summary,
log,
after source.
All1,102 v3 hashes remain unchanged during the rerun, and the
preference receipt again
verifies restoration to the original absence. This focused strengthening is
kept separate from the v2 full44 run. Affected final Chrome/Firefox checks are
recorded below without relabeling earlier full-run failures.

### Final affected Chrome checks

The exact changed-runtime/test closure scope passes **22/22**,260.748s, with
zero failed/flaky/skipped/not-run/interrupted/global errors:
summary,
Nx log. Its filter is
`@a11y|@referral|masked date-wheel neighbors|arbitrary hotel reference|desktop binds real named pins|mobile uses a full-page map/card`.
This covers all semantic/referral cases plus the affected wheel, keyboard hotel
reference and desktop/mobile hotel-discovery paths. The
v3 source and
after source match all1,102
hashes throughout. This verifies the corrections on final Chrome source; it is
not relabeled as a new full44 run. The first failed full run remains above.
The corresponding final Firefox scope and independent review are recorded below.

### Final affected Firefox checks

The same final affected scope passes **22/22**,311.851s, zero failed/flaky/
skipped/not-run/interrupted/global errors:
summary,
Nx log. Its nine semantic, nine referral,
two responsive and two hotel-discovery cases match the Chrome closure scope.
The v3 source and
after source match all1,102
hashes throughout. The first full Firefox40/3/1 outcome remains historical;
this is an explicit correction scope, not a newly claimed full44 pass.
Root engine verification and scoped independent approval are complete.

### Independent acceptance and separate post-close residual capture

The independent native Chrome check passes **5/5**,71.350s, zero other outcomes
or global errors:
summary,
log,
before source,
after source/index.
It independently exercises city focus ownership, consent/admin semantics, the
critical keyboard journey, masked-wheel contrast/focus and arbitrary keyboard
hotel-reference selection. All1,102 v3 source hashes and all25 staged
source/config/test hashes remain unchanged. Native verification binds the
combined working tree; staged-source review is separate from a clean staged
checkout execution.

A separate bounded diagnostic captures a real upstream announcement-lifecycle
residual: **1 capture PASS**,16.725s, zero other outcomes/global errors:
capture summary,
observations,
immediate raw axe,
after-retirement raw axe.
Immediately after native Escape closes the profile, two vendor `role=img`
announcement nodes retain an `aria-labelledby` reference to the retired action
button. Raw whole-page axe reports two `role-img-alt` violations at that moment.
Focus correctly returns to the account control, current identity/reopen remain
valid and no hidden/inert focus owner is observed. The nodes naturally retire
about7.13s after close, after which the raw scan has zero violations.

The capture pass confirms that behavior; it does not mean the immediate state
is clean, does not join the five acceptance passes, and does not erase the raw
violations. No vendor-node deletion, application source change or fixed wait was
inserted to hide them. Root and independent review accept T31 with this real
upstream residual recorded. Follow-up: investigate the supported announcement
lifecycle so immediate post-close references remain valid or retire correctly,
then verify that immediate state again. Screen-reader speech and physical-device
behavior remain unperformed; VoiceOver was explicitly waived by the owner.

### Chromium initial five-case audit

Actual first execution is retained at
run summary and
log: **2 PASS / 3 FAIL**, zero
flaky/skip/not-run/interrupted/global errors,35.642s. This is not final acceptance.
The six-viewport/map-boundary/calendar case and unavailable-WebGL/reduced-motion
complete-route case pass.

- Mobile route/target case stops at a genuine30×44CSSpx previous-day hit rectangle.
  The small-screen wheel-column correction was then authored; corrected native
  verification is recorded below. Desktop30px compact columns and132/184px
  vertical geometry remain.
- The contrast case stops at an audit-owner error: the combobox input has no
  border, while its surrounding inputRow owns the visible border. The corrected
  probe records and measures that actual bordered ancestor. No theme-color
  defect or completed six-palette pass is claimed from the initial result.
- The320×640 calendar case records an inner dialog content box at
  x3,y17,width314,height623.9375. Its bottom640.9375 exceeds the assertion640.5.
  The scrollable outer Modal, rather than this inner content, owns the viewport
  max-height. Inspect/measure the real scroll host and reachable actions before
  declaring a painted overflow defect or changing CSS. No tolerance is widened.

Failure-safe responsive-observations receipts save hit/viewport rectangles before
assertions. Initial typecheck passes; an unused test import failed initial lint,
was removed, and scoped final lint passes. Subsequent source/test corrections are
not covered by those initial receipts until a fresh run confirms them.

### Additional keyboard location coverage authored

A sixth responsive case exercises an arbitrary hotel reference through native
keyboard coordinate entry. The active hotel prompt now has a collapsed
«انتخاب با مختصات» disclosure; it does not add an arrival/date setup screen.
The case covers native radio navigation, Tab/Shift+Tab, invalid input without
requests, exact validated point commit through the existing controller, unchanged
one-night/party/room facts, cancel/query preservation, reopen and whole-page axe
states. The corrected native execution below passes this case. No pointer-only map success is substituted
for arbitrary keyboard point selection.

### Chromium corrected six-case audit

Web/E2E typechecks and scoped lint pass. The focused HotelDialog file passes
**13/13** unit cases, including validation/no-write/exact-query/cancel and blocked
authority retirement. Source hashes are in
responsive-corrected-source.json.

The first six-case launch inside the sandbox aborted Chrome before application
execution: **0 PASS / 6 launch FAIL**. Its
summary is
retained separately. Managed native execution then reports **5 PASS / 1 FAIL**,
74.164s, zero flaky/skip/not-run/interrupted/global errors, Chrome156.0.8078.76:
summary,
log.

The six viewport/calendar/map-breakpoint case, mobile independent round-trip
route/LTR/44px-target case,320CSSpx/short-landscape reflow case, unavailable
WebGL2/reduced-motion case and native arbitrary-coordinate case pass. Actual
wheel arrows measure44×44 at390 and767px, while the768/1280/1440 desktop columns
retain30px width; date wheel and calendar trigger widths match. The LAX itinerary
retains IKA→DXB→SIN→HND→LAX outbound and LAX→DOH→IKA return with exact source
segment IDs and a selected complete quote.

The coordinate case uses Tab/Shift+Tab, radio arrows, typed numbers, Enter and
Escape. Invalid/local typing makes no hotel request. Its one valid commit adds
exactly one request for35.123456,51.654321; arrival-local2026-11-02→2026-11-03,
one adult/one room remain unchanged. Replacement cancellation preserves the
committed query and reopening restores those coordinates. Both coordinate error
and restored states pass whole-page axe assertions; no screen-reader claim follows.

The remaining failure is an audit locator error: after measuring flight/light,
the test requests a nonexistent «تغییر روشنایی» button instead of the actual
«نمای روشن»/«نمای تیره» names. Flight/light's29 computed text samples pass;
normal-text minimum5.511, actual inputRow boundary3.906,3px focus outline6.140.
Five other palettes remain unmeasured by this run. Fixing that test locator and
freshly exercising all six palettes is required before contrast acceptance.

### Focused corrected contrast case

The locator now matches the toolbar's actual «نمای روشن»/«نمای تیره» names.
Unchanged strict contrast thresholds use reported soft assertions inside the
loop to preserve all six palette observations if any sample fails, followed by
an exact six-palette count. No runtime color changed. E2E types and scoped lint
pass. The new focused run is **1 PASS / 0 FAIL**,16.920s, with zero other outcomes
or global errors:
summary,
source binding,
compact measurements.

| Palette | Text samples | Minimum normal text | Minimum large text | Input boundary | 3px focus outline |
|---|---:|---:|---:|---:|---:|
| Flight/light | 29 | 5.511 | 11.554 | 3.906 | 6.140 |
| Flight/dark | 29 | 7.614 | 14.908 | 3.317 | 11.381 |
| Train/light | 30 | 5.151 | 10.811 | 3.711 | 6.048 |
| Train/dark | 30 | 7.400 | 14.326 | 3.686 | 11.301 |
| Bus/light | 29 | 5.270 | 11.769 | 3.683 | 6.058 |
| Bus/dark | 29 | 6.514 | 14.466 | 3.473 | 11.446 |

These composer/date-price/control samples pass the computed contrast bounds.
All sampled ancestor opacity is1. Each palette includes13 masked wheel samples;
edge alpha, sibling selection overlays, GPU paint and antialiasing remain outside
this computed method. This run does not cover every ticket/map label or resolve
all automatic-audit incomplete groups. Earlier whole-file outcomes are retained;
the focused correction is not relabeled as a fresh six-case whole-file pass.

### Masked wheel and scrolling follow-up

The unmasked six-palette pass does not establish the contrast of faded neighbor
rows. A seventh focused case measures those actual enabled date/price text
ranges against the observed opaque form background after resolved mask alpha.
The native before-fix run records **0 PASS / 1 FAIL**,22.171s, all six palettes,
53 reported assertion failures and no other outcomes/global errors:
summary,
source,
raw measurements.
For flight/light, neighbor price centers are2.576/2.790 and date centers
3.384/3.745. Text-range edge samples are conservative layout bounds, not exact
glyph-ink or antialiasing samples. Native wheel focus retains the30/70mask in
all six, clipping its otherwise3px outline; the focus screenshot confirms no
visible light-theme ring.

The minimal fix keeps the edge fade at8%/92% and removes only this mask during
focus-visible. It does not change fonts, colors or row height. Independent source
review cleared it, then fresh focused verification records **2 PASS / 0 FAIL**,
39.548s, with no other outcomes or global errors. E2E types and scoped lint pass:
summary,
six-path source binding,
compact raw measurements.

All six palettes now give alpha1 at the measured neighbor text-range positions;
composed minima are6.222/9.923 flight light/dark,6.492/11.760 train and6.139/9.979
bus. Native Tab wheel focus has mask:none and a3px outline at2px offset in all
six. The light focus screenshot was visually inspected and shows the purple
outline. The mask remains on pointer/blur use; this is a scoped wheel correction.

The coordinate case also proves native Tab reaches the hotel-card scroll region
while every card selection is disabled. PageDown moves scrollTop0→335 with
clientHeight420/scrollHeight1318 and focus retained. The3px inset outline at−3px
is visible in the inspected screenshot. Exact coordinate submission, unchanged
one-night/occupancy and cancellation still pass. The responsive file now has
seven cases, frozen for the final engine runs; these focused2 passes do not
replace earlier whole-file outcomes or constitute a fresh whole-file pass.

### SDK attribution and navigation follow-up

A separate source-bound docs-only probe distinguishes SDK-internal OSM
attribution from the two application credit links below the map. Its actual
before-fix execution is **0 PASS / 1 diagnostic FAIL**,26.374s, all four
light/dark×390/1280 states recorded, no other outcomes or global errors:
summary,
raw measurements,
source binding.
Internal links lack an at-rest underline; both mobile zoom controls measure
29×29. The two application credits are already underlined. All centre hits and
native Tab/Enter zoom changes work. The separate pre-application config launch
failure is preserved in vendor-map-before.log.

The approved scoped correction adds permanent internal-link underlines and an
opaque themed attribution background, raises mobile zoom targets to44×44 while
retaining desktop29, and uses a semantic focus ring/opaque halo beside native
icons. Inline legal-credit links retain their inline-target exception. Independent
source review cleared it; strict post-fix contrast/hit/camera and screenshot
verification is recorded below. No contrast over unknown raster pixels is inferred.
The isolated probe's typecheck passes; its two docs-only Nx fixture-import lint
findings are retained and explicitly accepted without aliases or suppression.

Post-fix Chrome execution is **1 PASS / 0 FAIL**,28.100s, all four states,
no other outcomes or global errors:
summary,
measurements,
before source,
after source.
All1,102 application/test source hashes and all three isolated-probe hashes
remain identical during this run. Both mobile zoom buttons measure44×44;
desktop remains29×29. Internal attribution is underlined at rest/focus with text
contrast14.528light/15.530dark against its observed opaque surface. Both
attribution and zoom focus contrast is6.140light/11.381dark against their known
surface/halo. All centre hits and native keyboard zoom-in/out camera changes
pass. The legal inline link remains85.375×14 under its explicit inline exception.

Four actual light-desktop/dark-mobile link/zoom focus screenshots were visually
inspected: focus is visible without rounded-edge clipping or adjacent-control
overpaint, and the native icons remain readable. Independent review inspected
the same four screenshots and cleared these specific Chrome map defects.
This scoped flight-theme
Chrome probe is not a fresh full matrix or a claim of raster-pixel contrast.
The default and configured WebKit matrices are recorded above; the final
test-premise rerun and affected Chrome/Firefox checks pass on v3. Scoped
independent acceptance and the real post-profile-close residual are recorded
above. Earlier full-matrix failures remain preserved.
