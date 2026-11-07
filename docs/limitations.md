# Limitations and evidence boundaries

TorobTicket is an independently built local demonstration inspired by Torob.
Its ordinary product-style UI does not imply affiliation, a live marketplace or
an official Torob account connection. These technical boundaries are deliberate.

## Product and data

- Transport services, schedules, fares, stock, policies and provider response
  profiles are deterministic authored data. Market research informed their
  shape; it does not establish live fares, carrier operations or an integration.
- Current hotel discovery uses 301 sourced OSM property identities/locations
  across 34 catalog destinations. The frozen directory was retrieved on
  2026-10-30; current operation, room availability, prices and policies are not
  verified. Room offers are authored separately. Unknown stars and terms remain
  unknown. [Directory and licence](../libs/fixtures/src/catalog/real-hotel-directory.README.md).
- Airport anchors/identifiers have recorded sources. Ground facilities and
  displayed road geometry include authored approximations; the schematic route
  is not navigation, driving time, operational rail/bus tracking or a live flight.
  Hotel distances are straight-line, not routed travel times.
- The application compares and refers. It does not collect payment, issue a
  ticket, book a room, operate refunds or prove a purchase. Local authentication
  is not Torob OAuth. `https://zarei.xyz/` is the owner-selected external handoff
  placeholder; legacy `/provider-demo/:id` routes display local receipts.
- Confirmation records an accepted offer before outbound navigation. A separate
  idempotent outbound ledger records a server-issued redirect, not external
  page-load confirmation, booking or purchase. Historical confirmations are not
  backfilled as traffic.
- The business model is per qualified referral, independent of purchase: once
  per anonymous browser visitor/provider in a rolling 60 minutes, with graduated
  provider rates and Persian-month counters in Tehran time. Rates default unset;
  recorded known/unpriced fees remain immutable when future rates change. These
  fees are not invoices, provider payments received or proof of a commercial
  partnership. Ranking does not sell placement.
- Automatic contextual advice currently suggests qualifying faster journeys.
  The domain supports nearby-date savings, but that automatic banner is not wired
  into the server/UI. Nearby prices remain explorable through the wheel, linked
  chart and calendar. [T35 P2-01 ruling](decisions/0080-final-review-and-canonical-release-scope.md).
- Multi-city or mixed-mode trip composition, unrelated-seller return bundling,
  price prediction, delivery alerts and acquisition SEO are outside this release.

## Network and deployment

The core runtime uses local providers, assets, fonts and geography, with no model
API key or runtime LLM. First Docker build may download dependencies and images.
The optional hotel street map uses external OpenFreeMap styles/tiles/glyphs/sprites
and OpenStreetMap data; no
bundled-offline map or service availability guarantee is claimed. Its cards and
manual coordinate alternative remain usable when the map is unavailable.

This is a local loopback stack, not a hardened public service. The single API
process executes bounded work with persistent PostgreSQL evidence; it has no
production distributed queue, load-test guarantee, real identity provider or
public multi-tenant security certification. Docker defaults include local review
credentials. Publishing requires a separate deployment/security and rights review.

## Visitor identity and billing scope

Traffic uses a server-minted, signed anonymous browser visitor cookie bound to
its private reviewer namespace. It is separate from local sign-in and workspace
authentication, uses an independent durable server-random secret, and is not a
person/device fingerprint. Cookie names are namespaced so late old-workspace
responses cannot overwrite a new workspace’s visitor state. Ordinary request
authentication does not write cookies. Explicit bootstrap repairs visitor state;
reset retains its intentional namespace/auth rotation. Visitor cookies follow
browser-session auth lifetime and the server’s live expiry/revocation bound.
No secret is exposed through public session/admin data.

Two authorized browser visitors in one workspace may count separately; unrelated
reviewer workspaces never aggregate. These are browser-session counts, not
verified people or cross-device deduplication. The local flow is not production
anti-fraud, bot detection, account verification, invoicing, payment collection or
public multi-tenant authorization. Clearing browser state may change visitor
identity. A blocked popup or cancelled action does not request the outbound route;
a recorded redirect still cannot prove the external provider actually loaded.

Hourly eligibility uses the last billable event, not the last repeat. Monthly
reset preserves ledger history and the hourly exclusion across the boundary.
Rate edits are prospective; historical unknown rates are not backfilled. Admin
uses known fee subtotals with explicit unpriced counts, and closed-month records
never infer a past rate from current pricing. [Decision0086](decisions/0086-provider-traffic-and-graduated-referral-fees.md)
records the current model. Its incremental evidence is separate from the dated
T30–T35 checks below; no new full release, public-scale or financial settlement
certification is inferred.

## What was actually checked

| Evidence | Measured scope and limits |
| --- | --- |
| [T30 behavioral acceptance](evidence/release/behavioral-matrix.md) | Development Compose: 224 browser passes and two existing guarded skips; not a fresh packaged release run. |
| [T31 accessibility](evidence/release/accessibility.md), [browser matrix](evidence/release/browser-matrix.md) | Representative native Chrome/Firefox affected checks and configured Playwright WebKit scope. WebKit is not Safari/iOS; CSS viewports and touch settings are not physical-device tests. VoiceOver was not performed at the owner's request. |
| T31-F01 | A transient upstream React Aria announcement-reference defect after profile close remains a bounded follow-up. The audit also records its manual native-zoom cleanup caveat. No WCAG certification or screen-reader speech proof is claimed. |
| T32 graphics/performance | Recorded headless Chrome/M3 Pro steady submissions near 60 fps, with varying interaction windows. Submission cadence is not physical presentation FPS or a guarantee on low-tier hardware. |
| T32 bundle/resource boundaries | Recorded initial JS 358,291 gzip bytes, only 109 bytes below the 350 KiB gate; graphics loads after desktop mount. Heap/resource samples are finite observations, not a leak-free guarantee. Literal GPU/material byte counts, physical low-tier devices and desktop maximum-DPR attainment were not established. Existing bounded label clipping remains documented. |
| T33 startup/recovery | Actual clean source/fresh-data startup, isolated core and map-failure fallback, reviewer reset, API/stack interruption and persistence, plus selected quality checks. Builds were cache-warm; amd64 and cold-cache download time were not measured. |
| T33 quality scope | 48 source tasks, 60 tool contracts and seven Chrome journeys passed. Optional PostgreSQL integration was explicitly skipped in that run; earlier real-DB evidence remains separate. Passing the selected profile is not universal release certification. |
| [T35 final review](evidence/release/final-review.md), [checkpoint](evidence/T35/checkpoint.md) | Canonical source `d1e052ba`, clean packaged startup 38.221s; final quality002 passes 48 uncached Nx tasks, 60 tool contracts, 189 actual PostgreSQL tests and 7 critical Chrome journeys. Separate focused browser001 passes 12 trip combinations plus 4 branding cases; 61 assets and 2 metadata contracts pass separately. These overlapping checks are not added into one total. |
| T35 manual journey | Concise manual pass 2:16.058, after an exploratory 9:22.528 run that missed the five-minute target. Actual date/ranking/route/changed-fare consent/confirmed handoff and persisted source evidence were inspected. External hotel street-map tiles were unavailable in both manual passes; no live basemap or manual map/card two-way proof is claimed. No video, audio or independent human usability study was performed. |
| [Hotel-map follow-up](evidence/adjustments/hotel-map-resilience/checkpoint.md) | Subsequent Chrome diagnosis captures a style CORS failure. Single OpenFreeMap provider and recoverable-error/current-content checks pass39focused tests, consumer/browser types, scoped lint/build and3actual Chrome journeys including controlled outage/retry. Separate native dark/light/selection/reopen proof passes. This updates current behavior without rewriting T35's failures or claiming a service SLA/full release recertification. |

Each receipt binds its source, scenario, build and environment. Earlier failures
remain in the evidence; overlapping runs are not added into an inflated test
count. T33 separately identifies a clean canonical source and a private snapshot
of pre-existing working overlays; they are not interchangeable repository claims. T35 source `7bbf785b` now
integrates those exact reviewed branding/search-control overlays into canonical
history; `d1e052ba` adds independently reviewed date-evidence batching/preparation
and exact inventory assertions without extending provider/job deadlines or
reducing required evidence. Earlier receipts keep their original source identity.

## Sharing and handoff

Third-party airline/ground marks have mixed or ungranted reuse status. The sourced
hotel database, basemap, fonts and renderer have separate notices. Local access
or a source URL does not grant blanket redistribution rights. See
[submission and attribution review](evidence/T34/submission-and-attribution.md)
before public distribution.

The [T34 walkthrough](walkthrough.md) passed as an automated browser rehearsal
at 4:30.006 on its recorded source/images. It includes 254.532 s of intentional
presentation holds; the 15.473 s interaction/wait remainder includes scheduler
overhead and is not an app-latency benchmark. Setup and the whole process are
separate clocks. No spoken narration or video was recorded, and no application
was uploaded/submitted. Public deployment and hiring outcomes are not established
by these materials.
