# Hotel map resilience checkpoint

Historical record: source IDs and artifact-retention statements describe the
original named run. Bulky raw artifacts were later removed at the owner's request;
see ../../../history-rewrite.md. This is not a new test run.

The hotel street map renders real geography again. Actual Chrome found that the
previous OSM style returned no CORS Allow-Origin header for this app; direct200
JSON alone did not establish browser access. The adapter separately destroyed
the entire map on any asset error. Diagnosis preserves
both facts without retroactively assigning a cause to T35's earlier failures.

[Decision0082](../../../decisions/0082-hotel-map-provider-and-tile-resilience.md)
and specification1.44 use a single free OpenFreeMap Bright/Dark provider through
the existing pinned MapLibre SDK. No key, account, new package, proxy, provider
fanout, tile archive or bulk prefetch. Credits identify OpenFreeMap/OpenMapTiles/
OpenStreetMap. Hotel source geography, pricing, dates and referral authority are
unchanged.

Readiness now requires current-style loading and genuine rendered primary
vector features. Markers, background raster or all-failed settled tiles cannot
fake streets. Recoverable tile/glyph/sprite errors preserve healthy maps. Theme
changes replace the style on the same map without diffing old content; per-style
listeners/generations fence obsolete callbacks and stop probes after readiness.
The existing15s fallback/retry and context/module failure cleanup remain.

## Actual checks

| Check | Result |
| --- | --- |
| Focused adapter/wrapper/reference tests | 39 passed across3files, including7new lifecycle/error/readiness regressions. |
| Consumer types, scoped lint, frontend build, browser-test types | All exit0. Build retains its vendor-chunk size advisory; no new benchmark or universal performance claim. |
| Chrome browser001 | 3/3single-attempt passes,0failed/skipped/retried/flaky/globalerrors. Real domestic pins/cards/hover/focus/all4orders, real international Istanbul/arrival streets, and controlled style-outage/sprite-error recovery. Each test closes its pages and resets only its own fresh reviewer context. |
| Controlled failure recovery | All styles deliberately blocked→truthful unavailable/canvas0/cards14; visible Retry with live provider→ready/canvas1 despite exactly1deliberately aborted spriteJSON. Successful responses and real geography are not substituted. |
| Native Chrome | Separate ordinary unique-origin session: actual dark streets/labels, Golden Palace card→true visible selected pin, another pin→Si Noor card, close→0canvases, toolbar light theme and reopen→ready/1canvas with selection preserved. Bright streets, Persian labels, airport and cluster visually inspected. |

Verification binding records actual log/source hashes. The
native first press during the theme transition did not open the modal; after
inspecting that state, a deliberate settled opening worked. Native UI verifies
appearance across close/reopen; same-live-map theme replacement is covered by the
focused tests. These are distinct claims. Actual PNG captures below show real
provider geography, not fake or dotted hotel-map content.

Real map after controlled failures

International Istanbul streets

## Review, preservation and bounds

The task implementation subagent and separate independent reviewer inspected
pinned MapLibre behavior, the frozen implementation and meaningful tests. Root
owns all runtime checks. Source review and final
evidence/staged reviews record their actual scope, not assumed future results.

The original Docker app was updated through its existing hot reload. No stack
rebuild/restart, base-data mutation or other reviewer's reset was needed. Native
QA uses its own origin/cookie, and only the new verified map tab is kept open as
a deliverable. Automated contexts were explicitly cleaned. Existing user tabs
and unrelated local edits remain preserved.

The readiness gate verifies initial supported urban content, not every future
tile after arbitrary panning or a service SLA. A missing sprite can omit vendor
POI icons while genuine roads and authored hotel/arrival markers remain useful.
Complete external/network/WebGL failures still expose cards/reference alternatives
and explicit retry. T35's unavailable attempts, prior accessibility/device/
graphics limits and third-party rights boundaries remain historical and bounded.
No full release-suite recertification, physical-device proof, video/audio, push,
publication, deployment or application submission is claimed by this correction.

Accepted source/proof commit: `4db021cd00504d82a68ac067672ad3b7690c423b`, tree `d2827ae2b7b17833ec0ba88f88b3966c118b596a`. Commit receipt binds the six verified source files; tracker transaction completes this follow-up while preserving the35-task baseline and unrelated working edits. Final closing review/commit identity is recorded separately.
