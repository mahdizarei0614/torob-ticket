# 0066 — Bloom performance recovery and invisible work

Date:2026-10-31. Owner requests the actual reason bloom is disabled and map
optimizations so it runs smoothly when the device has sufficient resources.

The recorded Chrome/AppleM3Pro baseline rejects its first window at33.4ms p90
submission cadence. Domestic CPU/GPU are1.4/0.75ms and world1.1/2.17ms; these
are failed-window values, not a claim about later cadence or physical display FPS.
The previous policy permanently latched that first failure until context reset.

A further discriminating check measures a blank Chrome page and app callbacks in
both headless and visible windows: each delivers native intervals≈33.3/33.4ms.
The read-only power profile reports AC lowpowermode1. This records native30Hz delivery in that preflight,
not a demonstrated skipped map frame or exhausted renderer. Later delivery was
60Hz while Low Power Mode remained enabled; this does not isolate power policy
as the sole cause or establish physical display FPS. No OS settings change.
The optimized first attempt correctly preserved the old23ms rule and emitted no
bloom; retain that failed attempt instead of claiming success.

**Deliberate cadence-rule revision:** replace the absolute23ms cutoff with a
measured stable baseline and no-regression trial. CPU≤8ms and GPU≤10ms remain.
Derive the baseline reference from median submitted intervals; reject medians
slower than34.5ms (below approximately30Hz). Baseline p90 must remain within the
reference plus max(2.5ms,10%reference). Freeze that reference throughout the real
effect trial and enabled monitoring. A60Hz reference yields about19.2ms, a120Hz
reference10.8ms and an OS-capped30Hz reference36.7ms. This is stricter at ordinary
fast delivery and permits a cheap effect to preserve an actual30Hz platform cap.
A slow effect cannot redefine its own target:60→30 and30→20 regressions fail.
A full faster enabled window can tighten the reference; a slower reference needs
backoff, a healthy new baseline and another real effect trial. These measurements
are submission cadence, not proof of physical display presentation FPS.

Recoverable performance/timing failures retain the ordinary map and release bloom
targets during active-time backoff5/10/20/30s (capped). A new24-frame warmup and
180-sample healthy recovery baseline precedes the existing24+90sample real effect
trial, bounded by5active seconds. Long healthy recovery and backoff bound retry frequency and avoid immediate
effect allocation churn; persistent effect-only overload can still retrial after
backoff and another healthy baseline.
Explicit effect/capability/low-quality failures remain terminal. Covered/hidden/
reduced/mobile intervals do not advance cooldown or enter healthy observations.

Keep immutable cached gate snapshots, the strongest limiting input, remaining
active retry time, recovery count and last failed window. DOM diagnostic attributes
are sampled rather than a visible product message. Dispose pending baseline GPU
queries on entry to a trial, so delayed baseline results cannot certify effect
cost. Query attempts use the existing host timestamp at≥200ms intervals instead
of every12frames, retaining sparse fresh evidence at30/60/120Hz. Foreign-owner
checks are bounded by the same slots; at most6queries remain pending. Empty
polls perform no driver query.

Remove the duplicate zero-opacity base-dot cohort when procedural geography owns
visible land dots. Keep major cities, semantic markers and all ordinary simple-map
cohorts byte-equivalent; retain procedural particle lives, density/morph/fluid and
province/country boundaries. Memoize the contextual-city subtree across vehicle-
only presentation updates while camera/label changes still update existing nodes
and fades. These remove proven invisible/repeated work without dropping features.

The blurred glow source uses at most one pixel per CSS pixel (existing1024-edge/
786432-pixel caps remain), independent of the crisp baseDPR. Atmospheric and morph
point sizes use the actual pass viewport/CSS width, so a smaller glow target cannot
enlarge city/morph halos. Completed/reduced-settled morph batches reset their draw
range to0 instead of repeatedly processing up to4096zero-opacity particles.
This preserves stored morph sources, visible land dots and later interruptions.

Preserve one renderer/scheduler, semantic colors, transparent page blending,
map-only scissor/viewport state and vehicle/wagons after all route/bloom layers.
No new dependencies, hidden resource measurement loop or normal-session reset.

Verify current native submitted map cadence separately from frozen rejection
windows, actual effect qualification/draws, pointer/route/world behavior, sustained
load degradation and later recovery, and covered/reduced/context/failure cleanup.
Record device/browser/DPR, controlled tests and independent review. Profile
sampling and CPU throttling are evidence tools, not production settings or FPS
claims. No rebuild/push/deploy/market build or plugin is authorized by this work.

[Task brief](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/bloom-performance/task-brief.md).
