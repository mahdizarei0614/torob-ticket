# Verification evidence

Start with the [reviewer guide](../../reviewer-guide.md) and
[walkthrough](../../walkthrough.md) to try the product. This index helps inspect
what the implementation actually proved. It does not replace running the app or
turn local results into a public deployment, booking or compliance claim.

## Current evidence map

| Area | Best entry point | Actual scope |
| --- | --- | --- |
| Behavioral acceptance | [T30 matrix](behavioral-matrix.md) | Development Compose: 224 passed, zero failed, two existing guarded skips; all 32 current acceptance cases passed. Source and later fixes have separate bindings. |
| Accessibility | [T31 audit](accessibility.md) | Representative semantic/keyboard/contrast checks; final affected Chrome 22/22 and Firefox 22/22. VoiceOver not performed; bounded T31-F01 retained. |
| RTL, responsive and browser behavior | [Browser matrix](browser-matrix.md) | CSS viewports, actual native Chrome zoom and configured WebKit scope are distinguished; WebKit 43 passed / one existing guard skip is not Safari/iPhone proof. |
| Graphics, resources and bytes | T32 checkpoint, [performance](performance.md), [visual review](visual-review.md) | Eight required native cases and five critical paths; measured bytes, reference hardware and finite resource observations, with limitations. |
| Clean packaged startup and recovery | T33 checkpoint, [Docker rehearsal](docker-rehearsal.md), [offline](offline-runtime.md) | Actual clean canonical/current source boots, isolated core/map fallback, scoped reset, real API/stack restart and evidence persistence. |
| Latest selected release verifier | [T35 quality002](../T35/quality-002/report.json), [source/image binding](../T35/quality-002-driver.json) | All seven selected gates pass: 48 uncached Nx tasks, 60 tool contracts, 189 real PostgreSQL cases across 27 files including the owned database restart, and 7 single-attempt critical Chrome journeys. Zero failed/skipped/retried browser cases. |
| Independent verification | T33 final review | Separate author/reviewer source, result, staged-scope and cleanup review; independent 19 runner contracts passed. |
| Reviewer materials and timed rehearsal | T34 startup, ordinary reviewer, paced run, measurement | Fresh packaged startup passed in 37.741 s. Ordinary session and final paced narrative each passed 1/1; the presentation measured 4:30.006, including declared holds. No video/audio recording or submission. |
| Final source, manual journey and independent acceptance | [T35 checkpoint](../T35/checkpoint.md), [final review](final-review.md), [D01–D25/16-row checklist](acceptance-checklist.md) | Canonical source `d1e052ba`, startup002 38.221s, 12 trip combinations + 4 branding cases pass separately; 61 brand assets/2 metadata contracts pass. Actual concise manual journey 136.058s, after 562.528s exploratory run; unavailable external hotel basemap disclosed. Scoped cleanup and original preservation have separate receipts. |
| Hotel-map corrective increment | [Follow-up checkpoint](../adjustments/hotel-map-resilience/checkpoint.md), diagnosis, actual Chrome summary | Style CORS failure and catch-all teardown corrected using single free OpenFreeMap provider/current-content readiness.39focused tests, types/lint/build and3Chrome journeys pass; native dark/light/two-way selection/reopen inspected. Controlled failures are distinguished from successful live geography. Previous T35 failure records remain unchanged. |

Counts above belong to their named runs. Do not add overlapping selections into
one larger test total. Earlier failures remain in their task directories; later
passes do not rewrite them. A skipped, incomplete or unperformed check is not a
pass. The selected T33 and T35 quality profiles explicitly have
`completeReleaseProof:false`; neither replaces the separate device, accessibility,
performance or lifecycle evidence.

## Source and runtime identity

T33 source commit `62b39ad0` has the exact tree used by its clean canonical
candidate. Its private current-product snapshot separately captures 99 audited
pre-existing overlays. The source manifest,
staged source audit and actual image receipts
bind those claims; do not assume a dirty working tree is a clean-clone result.
The recorded cold and normal-recovery flows use the exact API/frontend image
IDs reproduced by the final current build. The initializer has its own actual
fresh-start proof.

T33's post-cleanup preservation receipt compares
six original containers and five full immutable inventory/migration fingerprints.
Only the three owned rehearsal projects and two clean temporary worktrees were
removed. Build cache/images and private provenance refs were retained. That is
scoped cleanup evidence, not a global Docker prune or a claim to inspect every
mutable owner session.

## T34 presentation evidence

The T34 source snapshot is private commit
`87193a70335da7bef0e51c60178b8a5625876009`, tree
`19b43565f16a2e0e5f145a0c3539936802cc3d80`, built from the stated canonical
base plus audited working overlays and reviewer materials. Its startup receipt
records fresh owned data, a clean checkout, no host node_modules/.env and exact
images. It is a separate build claim from T33; later documentation/operator
corrections do not silently rewrite that snapshot.

The final paced browser run passed once, with no skips, retries, flakes or global
errors. Presentation time was 270.006 s: 254.532 s declared narration/inspection holds
and 15.473 s interaction/wait remainder including scheduler overhead. Setup 3.604 s
was outside that clock; the whole operator process took 277.426 s. These are
different measurements, not an app-latency benchmark. The real hotel basemap was
ready, the chosen fare changed from version 1 to 2, and the accepted amount/receipt
matched the admin trail. External placeholder navigation is not a real provider
page or purchase. Earlier failed dry/paced operator attempts remain retained.

See the [script and storyboard](../../walkthrough.md) for stage details and the
[official requirements/attribution review](../T34/submission-and-attribution.md).
The rehearsal is not spoken narration, a recorded application video, an upload
or a submitted application.

## T35 canonical release evidence

Source integration commits the 99 reviewed
current-product overlays as `7bbf785b`; the repair commit
is `d1e052baec317a8b26085100920cd0a10553221b`, tree
`72ed80841c2ccbebc865cdf2d86c1a0a88732e90`. The
source manifest binds 1050 application/build inputs
to Git blobs and the clean detached checkout used for the actual final Docker
images. Main-workspace documentation changes are disclosed, not described as a
clean main tree. Later documentation-only commits retain that application source.

The first full PostgreSQL run failed 180/3; a first batching repair still missed
48 train records. Both failures remain retained. The final repair keeps the
3.5-second provider/5-second job deadlines and all 2112 source records, with
negotiated batch sizes and pure immutable preparation outside the session lock.
Focused 47/47 and final 189/189 PostgreSQL cases pass. The actual manually operated
concise journey follows explicit changed-fare acceptance
to a matching immutable admin receipt and raw/normalized evidence. It is distinct
from T34's paced automation and from a human research study or recording.

## Reproduce a selected check

The app does not need host dependencies to start with Docker. Maintainer source
verification does: use the pinned host toolchain and frozen install described in
[run locally](../../run-locally.md#bounded-release-verification), then point the
bounded runner at an already-ready packaged loopback origin and a **new** report
directory. Smoke and quality have different scope. Real-PostgreSQL integration
requires an explicitly owned existing `_test` database and its opt-in flag; no
normal reviewer database is an acceptable substitute.

The verifier creates and cleans its own reviewer namespaces. Docker restart,
initializer fault injection and destructive reset are separate owned operator
rehearsals, not hidden parts of the default check. See the
[limitations](../../limitations.md) before extrapolating any result to a different
browser, physical device, network, source tree or public deployment.


## Post-baseline route-label correction

General route-label clearance
records decision0083/specification1.45: full measured selected city/wait facts
yield to complete actual flight/rail/road presentation geometry, including return
legs.23focused tests, scoped types/lint/build and8final Chrome journeys pass.
Twenty actual settled DOM/path samples retain all in-view facts with zero recorded
route/label collisions. Native dark normal-motion IFN120wait was inspected
separately. Earlier failed attempts are retained; this bounded correction does not
replace T35 evidence or establish additional device/performance/animation coverage.
