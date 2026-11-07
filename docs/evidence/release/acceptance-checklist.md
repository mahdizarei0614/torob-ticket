# Release acceptance and decision traceability

Historical record: source IDs and artifact-retention statements describe the
original named run. Bulky raw artifacts were later removed at the owner's request;
see ../../history-rewrite.md. This is not a new test run.

**Status: complete for the recorded local release scope.** Current-source
verification, the concise manual journey, scoped cleanup and independent final
document/projection review are recorded; the tracker/export is synchronized.
This checklist connects every
D01–D25 decision and all 16 release acceptance rows to implementation and actual
retained evidence. Each result below belongs to its named source and run; a
mapped row is not a universal certification or permission to close T35 early.

Authority is [specification 1.43](../../superpowers/specs/2026-10-24-torobticket-design.md),
the owner's later rulings in that specification, and the
[master tracker](../../superpowers/plans/2026-10-24-torobticket-master-plan.md).
The local app is comparison/referral only. This checklist does not authorize
publication, deployment, submission, payments or a booking claim.

## Current rules supersede the initial wording

- The owner's production-style presentation rule replaces visible simulated or
  fictional labels. Technical evidence still identifies authored inventory,
  local identity and placeholder navigation truthfully.
- D16 and the original hotel's “independent edits” wording now mean the
  [arrival-based one-night design](../../decisions/0061-arrival-based-hotel-discovery.md)
  with an independent actual room-capacity choice. The consumer does not configure
  dates or rooms. Generic backend/historical multi-night and occupancy evidence
  remains supported and immutable.
- D17's saved-preference/account presentation is superseded by the
  [profile-only rule](../../decisions/0044-roundtrip-chart-profile-and-corners.md).
  Guest referral works; optional identity is local; saved-search APIs/old records
  remain compatible without consumer save/list entry points.
- D12's explicit ticket pin includes the
  [one-time cheapest eligible auto-selection](../../decisions/0035-compact-ticket-results-and-default-selection.md).
  Map endpoints remain form-owned. Sorting/scrolling does not replace a manual pin.
- Three 44 px wheel rows replace the initial five-row default. Four labeled
  origin/destination/class/exploration controls use one nonwrapping row with
  bounded local scrolling, under the committed
  [four-control clarification](../../decisions/0057-four-controls-row-and-travel-direction.md).
  That record is distinct from [0079 search request control](../../decisions/0079-search-request-control.md).
- Real sourced hotel names/coordinates replace new authored property geography;
  current room prices/availability remain authored. The
  [301-property directory ruling](../../decisions/0064-real-hotel-geography-and-hover-pins.md)
  replaces the original approximate hotel-count target without rewriting legacy
  Hotel/RoomRate roots.
- The [T35 default-scope ruling](../../decisions/0080-final-review-and-canonical-release-scope.md)
  records automatic contextual advice as **faster-journey only**. The domain's
  nearby-date saving selector is not connected to an automatic product banner.
  Nearby prices remain available through the wheel, linked chart and calendar;
  this does not add hidden provider searches or claim the automatic branch shipped.
- [Decision 0081](../../decisions/0081-negotiated-date-evidence-batches.md)
  records the actual T35 calendar deadline repair: the persistence sink negotiates
  a hard maximum of 96 rows while unannotated/custom sinks retain 32. Immutable
  preparation moves outside the session lock; locked authority, atomic writes,
  full inventory, the 4 MiB bound and provider/job deadlines remain unchanged.

The planning-only sentences in specification §14 about the throwaway prototype
describe the document's original creation boundary; they are not a statement
that the current implementation is still that prototype. Later task records,
source identities and actual measurements below describe delivered work.

## Retained evidence and its limits

| Key | Actual result | Scope |
| --- | --- | --- |
| E30 | [Behavioral matrix](behavioral-matrix.md): final unfiltered full4, 224 passed, zero failed, two pre-existing guarded skips; all 32 current acceptance cases passed | Development Compose and its recorded source. Earlier failed attempts remain failures. Source commit `cfcc3a9`; this is not a fresh packaged T35 run. |
| E31 | [Accessibility](accessibility.md) and [browser matrix](browser-matrix.md): affected Chrome 22/22, Firefox 22/22; configured Playwright WebKit 43 passed/one existing guard skip | Representative native/semantic checks, not Safari/iPhone, physical devices, spoken assistive technology or WCAG certification. VoiceOver was not performed at the owner's request; T31-F01 remains bounded. |
| E32 | T32 checkpoint: required native 8/8, critical paths 5/5, visual/resource/bundle measurements and independent checks | Recorded Chrome/M3 Pro environment. Submitted cadence is not physical presentation FPS. Initial JS was 358,291 gzip bytes, only 109 bytes below 350 KiB; finite resource/heap samples are not a leak-free guarantee. |
| E33 | T33 checkpoint: clean canonical/current boots, isolated core, reset/recovery, initializer failure/repair and Docker-only restoration; selected quality passed 48 source tasks, 60 tool contracts and seven Chrome cases | Canonical source `62b39ad0` and separately identified private current-product snapshot. Optional PostgreSQL was explicitly skipped in that quality run; actual earlier PostgreSQL receipts remain separate. Builds used caches. |
| E34 | T34 checkpoint: fresh ordinary reviewer path and final paced walkthrough each passed 1/1; actual paced presentation 4:30.006 | Private current-product source `87193a70`, explicit operator hash and disclosed 254.532 s presentation holds. This was automated pacing, not human narration, manual T35 proof, a video or submission. |
| E35 | Current source/build, startup002, [quality002](../T35/quality-002/report.json), focused tools, focused browser, manual002 | Canonical source `d1e052ba` / tree `72ed8084`. Startup 38.221 s. All seven selected release gates passed: 48 unique uncached Nx tasks, 60 tool contracts, 189 real PostgreSQL tests in 27 files and seven critical Chrome cases. Separate 61-asset/two-metadata checks and 16 single-attempt browser cases passed. Concise manual002 passed in 136.058 s; manual001's 562.528 s missed target remains retained. Owned cleanup/original preservation passed; independent final document/projection review and synchronized tracker/export are recorded below. |

These counts belong to their named runs. Overlapping source, browser, acceptance
and focused selections are never added into a larger invented test total. Old
receipts retain their exact source/build identity after later source integration.

The current accepted runtime is canonical commit
`d1e052baec317a8b26085100920cd0a10553221b`, tree
`72ed80841c2ccbebc865cdf2d86c1a0a88732e90`. Its clean Docker checkout and exact
API/gateway/initializer/database images are recorded in E35; all 1,050 host
application-input hashes match that source. The verifier accurately reports the
main workspace's documentation changes, rather than claiming the whole working
tree is clean. The separately accepted branding/search-control integration and
deadline repair now form canonical source; T33/T34 private snapshots remain
historical evidence, not alternative final source identities.

Quality002's PostgreSQL selection includes the actual owned-database restart
case, configured with the exact disposable container/owner. The seven critical
and sixteen focused Chrome cases each have zero failures, skips, retries, flakes
or global errors. Focused browser coverage comprises twelve mode/scope/trip
combinations and four brand cases on the same exact images. Counts stay separate;
`completeReleaseProof:false` still accurately excludes other evidence layers.

Manual001 was manually operated through the interface,
with no fabricated API responses or recording. It exercised nearby dates,
calendar, all three orders, the round-trip route, Golden Palace capacity two and
stars ordering, explicit version 1→2 acceptance (3,362,100→4,370,700 toman), and
the matching confirmed admin/source lineage. Its hotel basemap was actually
unavailable, so only local hotel/selection behavior is claimed. Its 562.528 s
clock includes CUA observation/tool corrections and context overhead; it is a
completed functional journey and a missed timing target, not a five-minute pass.

Manual002 then completed the concise manual critical
journey in **136.058 s (2:16.058)**, without scripted waits, API replacement,
recording or narration. It applied November 7/10 dates, inspected four-provider
results and all three orders, the selected IranAir/هم‌مسیر round trip and its
known/unknown conditions, capacity-two/star-ordered hotel prices, explicit
3,432,500→4,462,200 toman version 1→2 acceptance and matching admin/source records.
Both actual manual attempts saw the hotel basemap unavailable. Manual002's
Golden Palace click was not observed after settling, so hotel selection is not
claimed for that attempt; manual001 separately confirmed it. Neither manual
attempt proves live map/pin two-way behavior. Preparation is outside each clock;
CUA/tool interaction time is included. An observed placeholder tab is not proof
of a loaded provider page, booking or purchase.

Final app cleanup removed only the
four exact startup002 container IDs, their disposable volume/default network and
the unchanged clean canonical checkout. Integration cleanup
removed only the exact owned PostgreSQL test container and disposable resources.
Both retain images/build cache and target no original project. The
post-cleanup preservation receipt matches all six
original container identities/images/states/start times and all five full
immutable table count/hash pairs, with original readiness HTTP 200. Mutable
owner-session rows were neither read nor reset by that audit.

## D01–D25 implementation map

| ID | Current requirement and implementation | Retained actual evidence / qualification |
| --- | --- | --- |
| D01 | Comparison/referral without payment or paid ranking: [referral repository](../../../libs/data-access/src/referral-repository.ts), [handoff UI](../../../apps/web/src/features/referral/provider-handoff.tsx) | E30 guest/changed/sold-out/referral cases; E34 exact accepted version and admin receipt. Confirmed handoff is not a purchase, conversion or commission. |
| D02 | Nx Option A, web/admin/API and bounded shared libraries: [Nx configuration](../../../nx.json), [API modules](../../../apps/api/src/app.module.ts), [architecture](../../architecture.md) | E33 clean packaged startup and actual source-quality/boundary checks; [foundation decision](../../decisions/0001-foundation.md). |
| D03 | Persian RTL consumer, English admin, LTR transport codes and Jalali-first dates: [composer](../../../apps/web/src/features/search/search-composer.tsx), [date explorer](../../../apps/web/src/features/dates/date-explorer.tsx), [admin shell](../../../apps/admin/src/app.tsx) | E30 six-mode/date journeys; E31 keyboard, naming, RTL, date and responsive coverage. |
| D04 | All six mode/scope combinations, supported network and compatible-input preservation: [catalog connections](../../../libs/fixtures/src/catalog/connections.ts), [search controller](../../../apps/web/src/features/search/use-search-controller.ts) | E30's 12 mode/scope/trip rows and rich inventory; unsupported operational routes are not invented. |
| D05 | One-way/complete same-provider round trip, actual directional legs and eligibility: [round-trip rules](../../../libs/domain/src/comparison/round-trip.ts), [quote eligibility](../../../libs/domain/src/comparison/quote-offer.ts), [party rules](../../../libs/domain/src/party.ts) | E30 round-trip pricing and eight party/eligibility cases; directional fare correction. New consumer searches normalize to one adult; general domain/historical parties remain supported. |
| D06 | Equivalent itinerary groups with distinct fare terms, exact facilities/services and unknowns: [itinerary key](../../../libs/domain/src/comparison/itinerary-key.ts), [grouping](../../../libs/domain/src/comparison/group-offers.ts), [normalization](../../../libs/domain/src/normalize.ts) | T06 normalization, T07 fare evidence, E30 source/grouped comparisons and mapping cases. |
| D07 | Three deterministic orders and ties, total waits and actual ground transfers: [group ranking](../../../libs/domain/src/comparison/rank-groups.ts), [results](../../../apps/web/src/features/results/results-page.tsx) | E30 mode/ranking coverage and independent duration/connection tradeoffs. Orders may legitimately coincide for a route; no artificial shuffling. |
| D08 | Factual comparisons/coverage and at most one qualifying **faster-journey** runtime suggestion: [explanations](../../../libs/domain/src/comparison/explain-group.ts), [search projection](../../../apps/api/src/searches/search.service.ts), [accepted suggestion kind](../../../apps/web/src/features/results/results-reducer.ts) | T08 review covers the broader domain selector; E30 covers current result facts. [T35 P2-01 disposition](../../decisions/0080-final-review-and-canonical-release-scope.md): automatic nearby-date saving advice remains domain-only; users explore dates manually. Gold styling does not change organic qualification/ranking; sponsorship is future only. |
| D09 | Progressive collection, guarded adoption, frozen interaction order and fresh referral recheck: [search stream](../../../apps/api/src/searches/search-stream.service.ts), [results adoption](../../../apps/web/src/features/results/use-results.ts), [recheck repository](../../../libs/data-access/src/referral-repository.ts) | E30 delayed/duplicate SSE and inspection cases; T09 report, E33 interruption/retry/replay. E35 includes accepted [0079 request control](../../decisions/0079-search-request-control.md) and the 0081 deadline repair without weakening complete inventory/atomicity. |
| D10 | Wheel preview/settle, linked chart, provisional calendar and stale-generation fences: [date explorer](../../../apps/web/src/features/dates/date-explorer.tsx), [date-state authority](../../../apps/web/src/features/dates/date-state.ts) | E30 maintained date/quiet-recovery cases, E31 calendar cancel/focus, E34 actual wheel/chart/calendar Apply. Apply itself authorizes the valid comparison; sorting does not. |
| D11 | One eligibility/pricing authority for all date surfaces, fixed opposite leg and gaps for unavailable prices: [date projection](../../../libs/domain/src/comparison/project-date-prices.ts), [date-price repository](../../../libs/data-access/src/date-price-repository.ts) | T10 checkpoint, E30 three exact round-trip date cases and directional pricing correction; E34 date-cell minimum equals complete quote minimum. E35's strict real-PostgreSQL calendar check retains 2,112 records/four successful providers and selected-date parity. |
| D12 | Fixed display-only desktop map, selected endpoints/stops/title and deliberate camera fits: [trip map](../../../apps/web/src/features/map/trip-map.tsx), [camera transitions](../../../libs/graphics/src/scenes/camera-transition.ts) | E30 map/heading/navigation cases; E32 six palette visual references and lifecycle observations. Below 1120 CSS px, main map is omitted and semantic route details remain. |
| D13 | Actual mode-specific geometry, staged stops, glass vehicles/light and separate referral authority: [journey presentation](../../../libs/graphics/src/scenes/journey-presentation.ts), [scene drawing](../../../libs/graphics/src/scenes/scene-drawing.tsx) | E30 actual supplied asymmetric legs and motion cases; directional light/foreground review, E32 compiled graphics and lifecycle checks. Geometry is illustrative, not navigation. |
| D14 | Arrival hotel discovery in desktop/mobile foreground with state restoration: [hotel dialog](../../../apps/web/src/features/hotels/hotel-dialog.tsx), [discovery controller](../../../apps/web/src/features/hotels/use-hotel-discovery.ts) | E30 hotel/receipt return cases, E31 native foreground/focus/coordinate controls, E34 real arrival one-night flow and live map. |
| D15 | Complete eligible stay/room totals and four stable sorts, actual arrival/custom point: [stay pricing](../../../libs/domain/src/hotels/price-stay.ts), [hotel ranking](../../../libs/domain/src/hotels/rank-hotels.ts), [free map adapter](../../../apps/web/src/features/hotels/free-map-adapter.ts) | T20 independent allocation/lifecycle evidence, E30 arrival/capacity/custom-point/selection cases, real properties. Distances are straight-line kilometers. |
| D16 | Current automatic arrival-local one-night stay, capacity independent of transport and exact hotel referral: [hotel selection](../../../apps/web/src/features/hotels/hotel-selection.tsx), [hotel recheck](../../../apps/api/src/hotels/hotel-recheck.ts) | Owner0061/0067 supersede the original independent date form. E30 hotel handoff and historical return compatibility; E33 local fallback; early arrival never promises early room access. |
| D17 | Guest path and optional local identity/profile; no consumer saved-search presentation: [account panel](../../../apps/web/src/features/account/account-panel.tsx), [account repository](../../../libs/data-access/src/account-repository.ts) | E30 guest/profile cases, E31 identity lifetime/focus checks; owner0044 supersedes original saved UI. Server compatibility remains; real OAuth and spoken VoiceOver proof are absent. |
| D18 | Six authored provider dialects and deterministic broad/hero inventory: [generator](../../../libs/fixtures/src/generator.ts), [mock registry](../../../libs/provider-adapters/src/mock-registry.ts), [real-property/authored-rate source](../../../libs/fixtures/src/real-hotel-inventory.ts) | T05 catalog, T06 adapters, rich coverage, E30 twelve journey rows. Production-style entity names do not make inventory live. |
| D19 | Normal/slow/timeout/change/sold-out/conflict/empty profiles scoped per reviewer: [fixture scenarios](../../../libs/fixtures/src/scenarios.ts), [admin controls repository](../../../libs/data-access/src/admin-controls-repository.ts) | E30 scenario/referral/empty/recovery cases and E33 actual API interruption; M5, M6. Failures never prove no inventory exists. |
| D20 | Factual admin processing/referral telemetry, scoped mutations, mapping preview/revision/replay: [admin controls](../../../libs/data-access/src/admin-controls-repository.ts), [mapping repository](../../../libs/data-access/src/admin-mapping-repository.ts), [referral evidence](../../../libs/data-access/src/admin-referral-repository.ts) | M5 checkpoint, E30 mapping/replay/isolation and E34 exact original-search/accepted-referral inspection. No invented revenue or conversion dashboard. |
| D21 | Six tokenized palettes, GLSL beyond the map, flat accessible motion and fallback: [semantic tokens](../../../libs/ui/src/styles/tokens.css), [theme uniforms](../../../libs/graphics/src/theme-uniforms.ts), [price chart scene](../../../libs/graphics/src/scenes/price-chart-scene.tsx) | T27 checkpoint, E31 contrast/motion/RTL and E32 actual graphics/visual/resource measurements. MapLibre/vendor styles and frozen brand assets have separate ownership. |
| D22 | Bundled core assets/fonts, one-command immediate access and ordinary suggestions: [Docker entrypoint](../../../tools/docker-up.mjs), [Compose](../../../compose.yaml), [README](../../../README.md) | E33 clean canonical/current starts, no-host-Node restoration and blocked-egress core; E34 ordinary fresh session. Public hotel streets are an explicit external exception with local list/coordinate fallback. |
| D23 | Exact versioned/idempotent local handoff; current confirmed placeholder tab and legacy receipts: [referral repository](../../../libs/data-access/src/referral-repository.ts), [provider handoff](../../../apps/web/src/features/referral/provider-handoff.tsx), [legacy receipt view](../../../apps/web/src/features/referral/provider-receipt-view.tsx) | T11 checkpoint, E30 receipt/history/concurrent-confirm cases and E34 explicit v1→v2 acceptance with exact receipt/admin equality. `zarei.xyz` is a placeholder, not a provider integration. |
| D24 | Actual AI-assisted creation/review evidence and deterministic runtime: [AI development log](../../ai-development-log.md), [architecture](../../architecture.md), [domain comparison](../../../libs/domain/src/comparison/rank-groups.ts) | E34 source/process review and [submission/attribution facts](../T34/submission-and-attribution.md). No fabricated verbatim prompts, model identities, user studies, savings metrics or runtime LLM. |
| D25 | Quality through real behavioral, accessibility, visual/performance and release gates: [release verifier](../../../tools/verify-release.mjs), [evidence index](README.md) | E30–E35 have explicit source/environment/count/skip/limit boundaries. Current canonical startup/quality/PostgreSQL/focused checks, manual002 and scoped cleanup/preservation pass; manual001's missed target stays recorded. Independent final document/projection review and synchronized tracker/export are recorded below. |

## All 16 release acceptance rows

| Area | Current acceptance and implementation | Actual retained evidence / remaining boundary |
| --- | --- | --- |
| Inventory | Supported selectable network, all destination property catalogs, six hero comparisons: [connections](../../../libs/fixtures/src/catalog/connections.ts), [hotel directory](../../../libs/fixtures/src/catalog/real-hotel-directory.json) | E30 twelve mode/scope/trip cases and rich inventory checkpoint; E35 freshly repeats all twelve combinations. Twelve services/four seller quotes are authored coverage, not real availability. |
| Pricing | Integer-rial whole-party/all-room/all-night totals; unknown mandatory charges cannot win/refer: [money](../../../libs/domain/src/money.ts), [transport quote](../../../libs/domain/src/comparison/quote-offer.ts), [stay pricing](../../../libs/domain/src/hotels/price-stay.ts) | T07/T20 reviewed domain/API evidence, E30 exact date/party totals and E34 cell/quote/accepted-price agreement. Current one-night UI does not remove general historical stay authority. |
| Matching | Exact itinerary identity groups equivalent services while preserving material fares/facilities; no cross-seller manufactured return: [itinerary key](../../../libs/domain/src/comparison/itinerary-key.ts), [round-trip validation](../../../libs/domain/src/comparison/round-trip.ts) | T06/T07 records, E30 grouped comparison and admin correction/replay; source facts remain immutable after mapping revisions. |
| Ranking | Three objectives, exact deterministic ties, waits included, destination stay excluded, dwell distinct from vehicle change: [ranking](../../../libs/domain/src/comparison/rank-groups.ts) | Tradeoff evidence, E30 mode/ranking cases and E34 local sort without a new search. Same-count/direct services may retain the same order. |
| Dates | Wheel snap/preview/commit, linked truthful chart gaps, provisional Jalali Apply/Cancel, feasible same-day returns and fixed opposite leg: [date explorer](../../../apps/web/src/features/dates/date-explorer.tsx), [time rules](../../../libs/domain/src/time.ts) | T10, E30 three exact round-trip date cases and maintained calendar/recovery, E31 keyboard/focus and E34 real calendar commit. |
| Results | Coverage and empty/failure distinctions, stale-generation fences, staged adoption after inspection, explicit same-price seller authority: [results state](../../../apps/web/src/features/results/use-results.ts), [search controller](../../../apps/web/src/features/search/use-search-controller.ts) | E30 delayed/duplicate SSE/isolation/results cases; M6 recovery. Form segment edits clear selection; pure ranking remains local. |
| Map | Fixed left/shared background, form-owned endpoints, selected labels, mode paths/stops/waits, stable pin/camera and eased fit: [trip map](../../../apps/web/src/features/map/trip-map.tsx), [journey presentation](../../../libs/graphics/src/scenes/journey-presentation.ts) | E30 maintained map/motion/heading checks, E32 visual/lifecycle measurements, E34 selected round trip. Auto-cheapest selection is an authorized pin; illustrative route is not navigation. |
| Hotels | Actual arrival-local one night, true-coordinate sourced property pins, two-way card selection, independent capacity/four sorts/custom point and return state: [discovery](../../../apps/web/src/features/hotels/use-hotel-discovery.ts), [free map](../../../apps/web/src/features/hotels/free-location-map.tsx) | E30 hotel/custom-point/receipt coverage; E31 keyboard/foreground; E33 external-map failure fallback; E34 basemap ready. E35 critical hotel/keyboard/return checks pass; manual001 used the genuinely unavailable map/local collection state. Source names/coordinates are real; room prices remain authored. |
| Referral | Guest recheck, changed-term consent, sold-out alternatives, expiry/idempotency and exact confirmed handoff: [referrals](../../../libs/data-access/src/referral-repository.ts), [referral controller](../../../apps/web/src/features/referral/referral-controller.ts) | T11/T20 real API and E30 concurrent/lost-confirm/return cases; E34 exact v1→v2/receipt/admin. Local handoff proves no external purchase. |
| Admin | Actual source/normalization/grouping/exclusion/referral evidence and scoped controls/mapping/replay: [admin search repository](../../../libs/data-access/src/admin-search-repository.ts), [admin routes](../../../apps/admin/src/routes.tsx) | M5 review/actual backend evidence, E30 correction/replay/isolation and E34 original-search lineage. Empty activity remains empty. |
| Appearance | Six palettes, semantic authored colors, local fonts/art, compact readable flat UI except shallow map: [tokens](../../../libs/ui/src/styles/tokens.css), [graphics theme bridge](../../../libs/graphics/src/theme-uniforms.ts) | E31 six-palette contrast and E32 24 full references/12 map crops, owner-reviewed visual states. E35's canonical branding integration passes 61-asset freshness, two metadata contracts and four brand browser cases; this is not a repeated full visual/performance matrix. |
| Accessibility | Native keyboard journey/focus return, usable RTL/LTR, reduced motion and non-color-only state: [shared UI](../../../libs/ui/src/index.ts), [semantic acceptance](../../../tests/e2e/src/accessibility.spec.ts) | E31 actual Chrome/Firefox/configured WebKit results; VoiceOver skipped by owner, T31-F01 retained and manual native-zoom cleanup caveat explicit. No compliance certification or physical-device proof. |
| Graphics | Compile/link/context fallback/recovery, themed uniforms, modal layering, pause/cleanup and bounded device-qualified bloom: [shared renderer](../../../libs/graphics/src/shared-renderer.tsx), [bloom](../../../libs/graphics/src/map-bloom.ts), [GPU flow](../../../libs/graphics/src/particle-flow.ts) | E30 graphics closure/full4, E32 actual context/resource/performance proof and sparse bloom. Finite retained-resource observations and submitted cadence are bounded evidence. |
| Packaging | Plain one-command start, health/init dependencies, no real credentials, blocked-egress core and preserving restart: [Compose](../../../compose.yaml), [Docker runner](../../../tools/docker-up.mjs), [run guide](../../run-locally.md) | E33 clean source/fresh data, internal-network core, failed-init repair, API/full-stack persistence and Docker-only restoration. E35 fresh canonical startup and critical blocked-egress journey pass on exact recorded images. First build needs network; optional streets remain external; cold-cache/amd64 not proven. |
| Isolation | Server-scoped resources/mutations/reset, guessed IDs fail and historical evidence stays immutable: [scope locks](../../../libs/data-access/src/scope.ts), [session repository](../../../libs/data-access/src/session-repository.ts) | E30 five isolation cases, T11/T20 API proofs, E33 reset A preserves exact B evidence. Local sandbox isolation is not a public multi-tenant security certification. |
| Reviewability | Plain README, supported suggestions, under-five-minute story, honest AI/source/limit records: [guide](../../reviewer-guide.md), [walkthrough](../../walkthrough.md) | E34 actual 4:30.006 paced operator rehearsal and ordinary fresh session; [rights/source review](../T34/submission-and-attribution.md). E35 source/build is bound; manual002 passed in 2:16.058, while manual001's 9:22.528 missed target remains. Cleanup/preservation passed; independent final document/projection review and synchronized tracker/export are recorded below. |

## T35 closure gates

- [x] Fresh domain and UX/operations reviewers inspect current implementation,
  exact integration and meaningful evidence. Source confirmation
  and batch correction review
  retain the actual finding/repair boundaries; P2-01 is explicitly limited.
- [x] Current accepted source/tree and Docker images are bound to the build and
  reviewer documentation, without importing unrelated local work. E35 records
  all 1,050 matching inputs and the exact clean-checkout runtime identities.
- [x] Actual `pnpm verify:release` result is recorded after review fixes: all seven
  selected gates passed, including real PostgreSQL. The same-source focused
  mode/brand selection also passed 16/16.
- [x] A manually operated timed reviewer journey is completed and recorded:
  manual002 took 2:16.058, separately from T34's automated
  paced rehearsal and manual001's missed target. Map/selection limits are explicit;
  no video, narration or provider-page loading is implied.
- [x] Original stack/data preservation and final owned cleanup are recorded:
  app resources,
  integration database, and
  original identities/full fingerprints all pass.
- [x] Final document/index review and exact tracker/export completion are recorded:
  independent staged/projection approval
  and applied tracker/export transaction preserve
  unrelated master edits and bind the canonical completion projection.

## Explicit remaining limits

Keep [limitations](../../limitations.md) with this checklist: owner-waived
VoiceOver; configured WebKit rather than Safari/iOS; CSS/touch emulation rather
than physical mobile/low-tier proof; T31-F01; finite GPU/heap/resource observations;
bounded train-label clipping; cache-warm build timing; no amd64 proof; optional
hotel map/network availability; mixed or ungranted transport-mark reuse and no
blanket source-code/brand licence. Official challenge content/gated form access,
local build, actual video, public availability and application submission are
separate evidence layers. No current task authorizes the latter actions.

**P2-01 default limitation:** automatic advice currently selects qualifying
faster journeys. Nearby-date saving logic exists in the pure domain but is not
an integrated automatic banner; manual nearby-date wheel/chart/calendar
exploration remains implemented. This explicit T35.2 default clarification does
not remove a locked journey or imply that unavailable automation passed a
runtime check.
