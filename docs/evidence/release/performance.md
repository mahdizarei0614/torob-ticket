# T32 graphics, lifecycle and responsiveness evidence

Historical record: source IDs and artifact-retention statements describe the
original named run. Bulky raw artifacts were later removed at the owner's request;
see ../../history-rewrite.md. This is not a new test run.

Status: final required Nx selection passes8/8 on the isolated production build.
Independent tool/unit/budget/native checks pass. Source commit:c1f6085;
final documentation/evidence/tracker index review is complete.

The reference host is recorded in `../T32/reference-host.json`:Mac15,7,
18GiB,12 physical/logical cores, macOS27.2, AC power with Low Power Mode1.
Power settings were not changed. Chrome156.0.8078.76 used ANGLE Metal on Apple
M3 Pro. The production app ran on isolated loopback4307, proxying the existing
API. Both blank and ordinary app rAF median were16.7ms despite Low Power Mode1;
this headless run has no measured30Hz cap. It is not physical display timing or
a claim about the user's interactive Chrome window.

## Measurement contract

`@performance` records four trusted samples per family: date-wheel drag and
exact chart selection, exact ticket selection and pinned route, native list
scroll, hotel opening, hotel selection, and theme feedback. Event creation
timestamp, dispatch-handler timestamp, exact DOM state and two native rAF
paint opportunities are separate. This is an input-to-paint-opportunity proxy,
not physical presentation, INP or GPU timing. Both family and pooled p95 must
be below200ms; four samples per family make its p95 the maximum observed.
Approved route/theme completion animation durations are distinct from first
feedback. Five fresh normal searches separately measure actual positive current
prices, viewport intersection, ancestor opacity≥0.5 and complete status;
first useful≤1.5s and complete visible≤3s. DOM commits are recorded separately.

Native draw submission/rAF intervals record the60fps desktop target and
≥30fps low-tier reference. A verified native30Hz Low Power Mode cap must be
reported explicitly; it does not prove60fps, nor justify changing runtime
budgets. A high-DPR resize exercises the actual desktop/mobile DPR caps, not
a real low-tier device. Callback CPU and existing disjoint GPU-query/bloom
diagnostics are reported as their own measurements. Blank/ordinary app cadence
and passively instrumented app measurements expose instrumentation differences;
they do not isolate exact instrumentation CPU overhead.

## Lifecycle contract

Five real hotel opens/closes, themes and mobile/desktop resizes, repeated modes,
native context loss/restoration, browser-disabled WebGL and essential selection
are covered. Passive test-only native wrappers distinguish app and MapLibre,
unique context objects, cumulative create/delete counts, generation-aware live
objects and compile/link errors. Native loss invalidates live resource sets.
Detached MapLibre contexts must be lost, not simply absent from DOM. Actual
existing Driver geometry/program counters are read from change-only public
canvas attributes. Programs and native buffers are not literal material counts;
material-object counts are unavailable. Uncollected `performance.memory` is
a JS heap trend only, not retained GPU memory or proof of garbage collection.

Native draw deltas distinguish permitted visible ambience from settled reduced,
mobile, covered and genuinely hidden scenes. Hidden proof uses a separate
native Chrome process/CDP with `noDefaults:true`, real background/foreground
tabs and actual `document.visibilityState`; no fake property/event or app flag.
MapLibre may render while its modal covers the paused application renderer.

## Run results and limits

Actual final run: native-final-002.log,8passed,
zero failed/skipped/flaky/not-run/interrupted/global errors,3m55s, cache skipped.
The required Nx command executed real cases with one Chrome worker. The exact
current observations are summarized in final-metrics.json,
with complete raw receipts under native-final-002/artifacts.

| Trusted interaction family | Samples | p95 first feedback + paint opportunity |
| --- | ---: | ---: |
| Date drag and exact chart selection | 4 | 63.1ms |
| Different journey selection and pin | 4 | 88.3ms |
| Hotel frame opening | 4 | 181.2ms |
| Different hotel selection | 4 | 38.6ms |
| Theme feedback | 4 | 64.7ms |
| Native list wheel scroll | 4 | 60.1ms |

Every family passes the unchanged200ms gate. Pooled24-sample p95 is88.3ms;
it must not conceal the higher hotel-opening maximum. Four samples per family
make each family p95 its maximum observation, not a population guarantee.
Five independent normal searches show actual readable prices in382.7–542.6ms
and complete visible comparisons in1735.5–2055.3ms, all below1.5s/3s. Each ends
with48priced cards. DOM commit and readable/paint-ready timestamps stay separate.

Steady Iran map throughput is60.05fps and selected route59.97fps; steady world
is59.86fps and priced world route59.84fps, with median cadence59.88fps. These
approximately60submitted-frame windows meet the reference steady-state target.
Actual rapid route-change throughput is54.78fps, date drag/provider waits57.66,
and theme changes59.31: constant60fps during all interactions is not claimed.
The hotel open/selection phase is5.73app fps because its background renderer is
intentionally covered/paused; it is not a failed visible-map benchmark. Its
24.3ms callback p95 includes transition/other callback work, not pure GPU time.

Bloom genuinely qualifies and remains enabled in Iran/world windows, using
existing asynchronous GPU queries. Steady sampled graphics callback p95 is
1.9–2.2ms; bloom CPU p90 is1.5–1.9ms and GPU p90 is1.87–4.68ms in the recorded
warm/selected windows. Raw receipts identify sample counts, cadence, target
614×766, qualification reason and limiting factor. No gate was forced, quality
feature removed or timing query fabricated. Passive wrappers add nonzero cost.

Five hotel cycles and two three-mode cycles retain one app context; the optional
MapLibre context is separate and retires after close. Actual hotel warm/last
live counts match exactly:51buffers/4textures/3framebuffers/6programs; warmed
mode triplets match49/4/3/5. Shader compile/link error lists are empty. Real
context loss advances generation0→1; restored and native-disabled WebGL retain
selection and48priced cards. Actual reduced/covered/mobile-settled and genuinely
hidden scenes stop both draw and clear submissions; visible ambience resumes.

At browser DPR3, desktop canvas remained1 and mobile canvas became1.5, both
within their ceilings. The same-size desktop override did not prove selecting
the1.75maximum. Literal material counts, retained GPU bytes and actual low-tier
hardware timing are unavailable. Uncollected JS heap varied63.9–94.5MB through
cycles; this is not proof of a leak or a garbage-collected memory plateau.
Independent forced-GC evidence after two warm opens and five repeats measures
39,760,244→41,258,636main-renderer heap bytes (+1,498,392/~3.8%). Seven actual
MapLibre workers start and close, with zero remaining after every dialog close;
all seven maps load14cards/ready tiles. This finite retained-cache/heap increase
is not an exact plateau or leak-free proof, and excludes worker/GPU heap bytes.
See actual report.

Production gzip9 graph: initial349.8936KiB, incremental graphics295.1719KiB,
both passing350/500KiB. Initial headroom is109bytes. MapLibre SDK/worker432.2881KiB,
other deferred application code38.002KiB, CSS and public asset inventory are
separate. Total reachable JavaScript is1,142,124bytes; no chunk is unassigned.
Actual visible desktop graphics fetch immediately after mount, so startup
network cost is not merely the static349.89KiB entry. No zero-cost SDK claim.
See bundle report and
measured changes.

The1027runtime/build inputs match the after7 freeze; browser observation source
has its own run hashes. This is the recorded working tree with preserved prior
changes, not a clean-checkout/deployment claim. Original failed budget reports,
001test-target failures and002affected corrections remain available. Production
was unchanged during browser triage; visible labels/background points use real
trusted input, with exact native hit checks and escaped canonical IDs.
