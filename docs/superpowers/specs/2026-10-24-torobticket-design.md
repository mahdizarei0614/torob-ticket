# TorobTicket — Product and Architecture Specification

**Revision:** 1.7 · 2026-10-26

**Purpose:** Authoritative design companion to the master implementation plan.  
**Status:** Product scope and architecture approved in conversation. Implementation defaults below are explicit engineering decisions made while preparing the plan; they are not additional claims of user approval.

## 1. Intent and success

**Owner presentation ruling, 2026-10-26:** All current and future visible consumer/admin surfaces use ordinary production-style copy, names, status messages, accessible labels and tooltips. Remove demo/test/simulated/fictional indicators, disclaimers and entity-name suffixes. Do not expose fixture/scenario/reset tooling in the traveler journey; useful route presets may appear as ordinary travel suggestions. Technical documentation, source contracts, fixture identities, internal routes, tests and verification evidence continue to describe the mocked implementation honestly. This replaces earlier requirements to label the visible product or entities as fictional/simulated. It does not authorize real OAuth/provider integrations, fabricated live data/conversions, payments or booking-success claims. Meaningful unknown conditions, approximate route facts and actual referral status remain clear.

TorobTicket is an independent, demo-only travel comparison product inspired by Torob. It helps a traveler compare equivalent journeys and their provider offers, discover suitable hotels, and continue with a provider. It never sells tickets, takes payment, issues bookings, or asserts that a referral completed a purchase.

The intended audience includes reviewers of Torob's AI Product Engineer challenge. The demonstration must make product judgment, design quality, engineering correctness, and a verifiable AI-assisted development process visible in under five minutes. The complete product remains freely explorable beyond that walkthrough.

Success means:

- A fresh reviewer can start all applications with one documented command and use the seeded demo without email delivery, external service credentials, or a model API key.
- A Persian/RTL consumer experience feels compact, legible, responsive, and coherent across six mode/scope combinations and six transport/theme palettes.
- Multiple providers genuinely pass through validation, normalization, grouping, eligibility, pricing, and ranking.
- The date explorer, route map, ticket details, hotels, and referral all describe the same selected trip.
- The English admin exposes real processing and referral evidence and meaningful, session-isolated controls.
- Failure scenarios remain understandable and recoverable.
- The implementation is built and evaluated using AI, with an honest evidence log of assistance, corrections, and checks.

Quality takes precedence over an artificial deadline. Scope discipline, measurable gates, and small reviewable increments are how quality is maintained.

## 2. Decision authority and exclusions

**Locked** means explicitly accepted during the conversation. **Default** means a concrete implementation choice filling an unspecified detail without changing the accepted product. Defaults may be changed with an entry in the decision log and corresponding tests. Changing locked behavior requires an explicit product decision.

### Locked scope

- Nx monorepo; consumer frontend, backend, and admin.
- Domestic/international flights, trains, and buses; one-way and round-trip.
- Mock provider inventory and a local simulated provider handoff.
- Guest comparison and referral, optional simulated identity for saved searches/preferences.
- Wheel for nearby-date exploration; calendar for jumping ahead.
- Cheapest, fastest, and fewest stops/transfers; factual explanations.
- Fixed desktop map on the left; results scroll independently; no main travel map on small screens.
- Destination hotel discovery with a desktop modal and a mobile full-page modal.
- WebGL/GLSL as a substantial visual system; semantic HTML controls and content.
- One-command Docker startup, repeatable fixtures, isolated reviewer sessions, inspectable admin, and reviewer documentation.

### Outside this release

Real provider crawling or APIs; real Torob OAuth; payment, ticket issuance, booking confirmation, refunds, or support operations; multi-city trips; mixed-mode trips; dynamic packaging across unrelated providers; historical price forecasting; alerts requiring real delivery services; live road navigation or driving-time estimates; runtime LLM dependencies; advertising that changes ranking; production-scale queues or microservices; SEO acquisition pages; hotel comparison across booking marketplaces.

Future provider research must establish actual payloads, conditions, identifiers, access requirements, and reuse permissions. No existing package, scraped source, or mock response is evidence of a real integration.

### Monetization and identity

The demo records outbound referral clicks. It does not infer bookings or earnings from them. Booking commissions are a possible future partnership model only when verified conversion reporting exists. Ranking is independent of commercial relationships. Provider and offer presentation uses ordinary product names without fictional/test annotations. Identity controls use normal sign-in wording; the implementation remains local and does not assert an official partnership or verified external OAuth connection.

## 3. Search, inventory, and money

The consumer app uses Persian/RTL. Airport codes, route-code sequences, and relevant Latin identifiers remain readable LTR. Admin uses English. Jalali is the initial calendar; international travel also exposes unambiguous local dates and time zones.

The search contract contains:

- Domestic/international scope and exactly one transport mode.
- Origin and destination city IDs, selected from the supported network.
- One-way or round-trip; outbound local date and optional return local date.
- Party composition and any ages required for eligibility.
- Mode-specific class and eligibility filters.

Changing mode preserves compatible cities and dates. An incompatible destination is cleared with an explanation; it is not silently replaced. Origin selection enables supported destinations. Network support is distinct from availability for a particular date.

**Defaults:** Initial party is one adult; require at least one adult; limit total travelers to nine and infants to the adult count. Mock providers own their age/seat rules. Collect ages only when needed to determine a fare or hotel room; do not collect passenger names, passports, or dates of birth. A hotel age is age at check-in and is not silently inferred from a transport age at a different date.

**Default filter set:** budget, departure time window, operator/provider, mode-specific class, maximum flight stops or ground transfers, refundable-only, and a flight checked-baggage requirement. Unknown conditions never satisfy an affirmative requirement. A condition is shown as unknown instead of invented. The single departure-time window constrains the outbound departure in its origin time zone and is labeled outbound for round trips. The maximum stops/transfers filter uses the complete-trip count (both directions for round trips), with that total explicit in its label.

Prices are the eligible total for the whole party and include all known mandatory charges. A visible breakdown explains the total. Offers with incomplete mandatory totals may appear in a separate incomplete-price state; they cannot win a lowest-price claim or be referred as a final priced offer.

Round trips compare complete outbound-and-return offers actually supplied by the same mock provider. The system does not create a complete fare by adding unrelated sellers' one-way prices.

**Money default:** canonical integer rials throughout domain calculations and persistence; UI explicitly formats toman. Preserve original value and unit in provenance. Reject ambiguous source units. MVP fixtures use rials/toman only; international geography does not imply an unmodeled exchange rate.

Travel segments store UTC instants and IANA time zone IDs for their locations. Search dates and hotel check-in/check-out are local date-only values. Calendar conversion must not turn a local date into a different day through UTC truncation.

## 4. Matching, ranking, and explanations

An itinerary identifies the actual service and segment sequence. Equivalent itineraries offered by different providers are grouped. Airport/station/terminal differences, service/date/time differences, direction, transfer requirements, or changed segment order prevent an incorrect merge.

A fare offer retains provider, class, baggage, refundability, seat/berth conditions, and other material terms. Distinct fare variants remain distinguishable inside a journey group. A quote prices an eligible fare for the current party and dates and has a version and expiry.

Provider-supplied connections are supported. Self-transfers, overnight connections, airport changes, and required ground transfers are explicit. No unsupported connection is manufactured.

| Sort | Primary rule | Tie breakers |
|---|---|---|
| Cheapest — default | Lowest eligible whole-party total | Shorter total travel; fewer stops/transfers; stable ID |
| Fastest | Shortest total travel, including waits | Lower total; fewer stops/transfers; stable ID |
| Fewest stops/transfers | Fewest flight stops, or ground vehicle transfers | Shorter total travel; lower total; stable ID |

For round trips, duration and stops/transfers sum both directions and exclude time at the destination. Rail/bus intermediate stops remain visible and their dwell affects duration, but a stop without changing vehicles is not a transfer. Provider offers inside a journey sort by eligible total, then stable ID.

The group representative is its cheapest eligible complete quote. Ranking, badges, and relative explanations refer to that quote and the current filtered candidate set. Switching providers or fare variants updates the displayed facts and referral selection.

Explanations are deterministic facts with a stated comparison: price difference, time saved, connection count, baggage differences, and responding-provider coverage. While collection is ongoing, claims say “so far.” They do not imply coverage of the entire travel market.

**Default contextual suggestion:** show at most one suggestion. Offer a nearby date within ±3 days when it saves at least 10% and 200,000 toman with the same party/filters and fixed opposite leg; or a journey that saves at least 90 minutes for no more than 10% extra. Evaluate relative to the current cheapest complete option, require comparable completed coverage, and show the exact tradeoff. Prefer the larger proportional price saving when multiple date candidates qualify, then nearer date, then stable ID. Otherwise use the time-saving candidate with the greatest minutes saved, then lower price. Dismissal lasts for that search. Thresholds are explicit defaults to validate with fixtures.

During initial collection, results can reorder. Once the user scrolls results, focuses a result, opens details, or selects an offer, preserve the current order and stage later provider updates behind an “updated results available” action. An explicit sort/filter change authorizes a fresh ordering. Invalidated selected offers are visibly marked and blocked from referral immediately even if ordering is frozen.

## 5. Date exploration

The vertical wheel explores nearby dates. It has faded ends, a clear center, daily minimum prices, and a snapped date after release. Dragging previews the date and linked price chart. Settling commits once. Arrow controls, keyboard operation, clicking a date, and the calendar provide equivalent alternatives.

**Defaults:** five visible44px rows with unchanged typography; a250ms settle/debounce target, tuned through usability testing. Desktop arrows sit beside the wheel and price evidence below the chart to reduce form height. Every committed valid query has a generation ID; stale responses cannot replace the active generation. Pointer cancellation restores the last committed selection.

Clicking a chart point synchronizes the wheel. The line describes the minimum eligible offer by departure date under current conditions, not historical price movement. The minimum does not change merely because the result sort changes.

Calendar and wheel use one date-price model. Calendar interaction is provisional until “Apply dates.” Cancel restores the previous selection and focus. Jalali month boundaries, leap years, keyboard navigation, and valid Gregorian conversion are explicit test cases.

For round trips, choose departure first. Return-day prices represent complete round-trip totals. Once both dates are set, changing either leg holds the opposite leg fixed. If the departure makes the return invalid, require the user to reselect; do not silently shift the return. Same-day returns may be valid when actual segment timing makes them possible; the throwaway prototype's stricter behavior is not a production rule.

Date states are priced, checking, no matching offer, and outside coverage. If retrieval fails or no complete price can be established, show a distinct price-unavailable state with recovery; never describe a provider failure as proof that no tickets exist. Missing/unknown values create chart gaps, never zero prices. A price includes coverage and freshness. Filters, party, class, mode, provider scenario, mapping revision, and fixed opposite leg are part of its cache identity.

**Default coverage:** a 90-day departure window anchored to the session's demo date, inclusive of day zero. Return departure must fall inside that window; arrival may fall afterward. Dates with no eligible timetable remain selectable for exploring the empty state, while structurally invalid or out-of-coverage dates are disabled.

## 6. Map and route behavior

The desktop map stays on the left while the right-hand content scrolls. It starts with dotted Iran for domestic scope or dotted world geography for international scope, with shallow depth and a stable camera.

**Owner adjustments,2026-10-26:** The main travel map remains display-only for origin/destination. Only search-form controls change cities. Desktop shows the start→end title and map, without endpoint controls/dropdown, visible zoom toolbar, duplicate details or progress/footer. Compact selected-endpoint and progressively revealed stop names are shown. On the international map, sparse contextual capital/major-city labels may fade with zoom and yield to all selected journey labels; these geographic names imply no inventory or selection action. Selecting cities reveals their locations with a flat halo/pop effect. There is no connecting route before an explicit ticket pin/selection. The hotel location picker remains interactive and unchanged.

Selecting an itinerary pins it and deliberately fits the camera. Hover/focus metadata may still support ticket/mobile inspection, but does not replace or restart the desktop's selected journey. Sorting or scrolling results does not reset the camera. Pinch zoom remains supported. The desktop map has no additional direction toolbar; it displays its current itinerary direction. Round-trip details remain in ticket details, and mobile route panels retain outbound/return controls.

International endpoint selection gently zooms to the selected cities with surrounding margin before a ticket is chosen. An explicit itinerary selection fits all relevant stops and curves, including outlying connections. Camera and annotation easing share the renderer clock; reduced motion settles directly. No separator line divides map and results. Train and bus icons use side profiles, and the thicker route carries a directional shooting-star head and fading tail.

The international map has very faint country boundaries. Both travel maps use airy dot spacing and crossfade through progressively finer density levels during zoom, with three successive density transitions, preserving recognizable land at close range. A bounded land mesh is prepared outside the frame loop; GLSL evaluates geographic dot lattices and zoom changes uniforms. International context names have a strict visible count and collision budget; endpoints and stops always take precedence. The domestic map remains Iran-only without general city names or country outlines. Trackpad pinch and two-pointer pinch change map zoom, while ordinary wheel scrolling remains page scrolling. GPU and DOM overlays share the same viewport box even when a scrollbar appears, with one origin and one destination marker.

After editing any trip condition, previous result evidence remains readable but cannot pin, select, or authorize a referral for a trip different from the form. Search the updated trip before selecting its offers. Synchronous ownership checks prevent old callbacks from restoring a flight route beneath a train form or any equivalent mismatch.

Flights use visible shallow arcs, rail uses two parallel straight rails between stations, and buses use smoothly curved authored road paths. Paths remain illustrative mock geometry, not navigation guidance. A selected route draws in canonical segment order: reach the next stop, reveal its city and count up its known wait minutes, then continue. Unknown waits remain unknown. One light strand travels the route, with a stronger pulse at intermediate stops, and mode-specific glossy glass vehicle icons. Required ground transfers retain their actual mode. Equivalent canonical facts remain in the textual route timeline.

The route animation is visual presentation, separate from comparison/referral authority. It must never change a quote, create a referral, or suggest a confirmed booking. Internal comparison/referral markers remain 0%, 35%, 70%, 100%, backed by the existing state/receipt rules. The consumer vehicle follows the visual route, while generic laboratory progress controls retain their prior semantics. Reduced motion shows the complete selected route and exact stop values immediately.

Geography dots breathe slowly with varied phases. Mouse movement leaves a dim, geographically anchored trail with a soft onset and gradual decay after the cursor passes, rather than an immediate spotlight. A bounded history and non-additive glow prevent bright accumulation. An authored subset of major-city locations has slightly larger/brighter dots with the same subtle trail, with no population/ranking inference or additional city-selection logic. Ambient dot motion and the route strand share the existing application renderer/clock and run only while the desktop map is visible, uncovered, and motion is permitted. Reduced motion clears pointer trails and settles the geography.

**Layout defaults:** main travel map at widths ≥1120 CSS px, approximately 46% of desktop content width. Below that threshold, omit the main map and use itinerary timelines. Map controls cannot intercept ordinary results scrolling.

Geography, city labels, route paths, hotel landmarks, and fonts are bundled locally with attribution/provenance. Projection and route geometry must handle long routes and the antimeridian without drawing through the entire map accidentally.

## 7. Hotels

A compact “Compare hotels in [destination]” action appears above results. It opens a desktop modal or a mobile full-page modal. Closing restores ticket filters, scroll, selected quote, and pinned route.

Check-in comes from the chosen itinerary's destination-local arrival date. Before an itinerary is chosen, arrival date must be confirmed. Return departure suggests check-out for round trips; one-way searches require check-out before displaying stay prices. A same-day round trip does not silently become a hotel night.

Traveler counts are copied; room count defaults to one. Ask for room count and child ages when necessary for eligibility. Show complete stay totals for all requested rooms with known mandatory charges; nightly price is secondary. An inexpensive room that cannot accommodate the party or the entire stay is not an eligible result.

**Hotel inventory defaults:** nightly inventory extends through day 119 after the session anchor, with check-out allowed on day 120. Every priced night must be covered. Each occupied room requires an adult under the authored mock policies; the requested room count cannot exceed adult count. Infant occupancy follows the specific room policy. These rules are visible fixture conditions, not claims about real hotel policies.

Default sorting is lowest complete stay total. Other sorts are stars, distance to arrival point, and distance to a selected location. **Tie defaults:** stars descending then stay total; distance ascending then stay total; remaining ties by hotel ID. Missing values sort after known values and are labeled unknown.

Arrival point means airport, train station, or bus terminal according to the selected itinerary. If it is not known, require a choice. The custom-location map opens on demand, supports landmarks and a pin, and is available on mobile as an exception to the hidden main travel map. Distances are explicitly straight-line kilometers.

**Free-map implementation ruling, 2026-10-26:** The owner requested a free real street map. Use the official OpenStreetMap vector service with MapLibre GL JS: hosted VersaTiles Colorful (light) and Shadow (dark) styles, locally authored landmarks and fictional accommodation markers. No registration, API key or billing is required. This implementation default replaces our earlier OpenFreeMap choice after repeated host timeouts; the official OSM vector styles respond on the current machine. Tile, glyph and sprite requests share vector.openstreetmap.org. The SDK, CSS and local worker load only when the picker opens; the transport renderer pauses behind the hotel dialog. Preserve visible OSM contributor attribution, normal browser caching/Referer and on-demand viewport requests, with no tile proxy, bulk/offline download or app-level speculative prefetch. Network/tiles/WebGL failure retains the local list and coordinates with a clear unavailable state, without a fabricated or silently substituted map. It provides location selection, not street navigation or live routing. Google and Neshan remain superseded; no account/key/billing change was made.

Room type, occupancy, breakfast, cancellation, and fees remain visible. The user chooses an eligible room/rate and follows a tracked hotel-site referral to its simulated landing page. Hotels are compared with each other; merging the same hotel across booking marketplaces is deferred.

Hotel dates may be edited independently. A later trip change offers an update and never overwrites the edited stay silently. An early arrival note explains standard check-in; no early access is promised.

## 8. Sessions, optional login, and referrals

Guest search, comparison, hotel discovery, and referral are fully supported. Optional “Continue with Torob” establishes a local identity inside the same isolated session. It unlocks saved searches and preferences. No password, real OAuth, OTP delivery, or real personal information is needed.

Saved searches store search intent, not a promise of a historic fare. Opening one performs a fresh search. Theme preferences persist locally; session-linked saved searches remain for the lifetime of the demo session.

A provider click triggers a fresh quote check. An unchanged eligible quote proceeds. A changed total or material condition requires explicit acceptance of the new version. A sold-out/expired/incomplete quote cannot be handed off; show alternatives.

The server records one confirmed referral per idempotency key and returns a local handoff path. The simulated provider page shows the exact itinerary or hotel stay, party/rooms, provider, conditions, price version, and time of handoff. It has a clear return action and no fake purchase completion.

**Defaults:** quote expiry is 10 real minutes; referral acceptance intents expire after 2 real minutes. A confirm request validates the selected version and intent expiry. The same key cannot confirm a different payload. Referrals stay in the same browser tab so back navigation can restore context. Provider landing refreshes do not create extra referral clicks.

**Session defaults:** an opaque HttpOnly same-origin cookie; 24-hour inactivity expiry; demo/admin actions scoped on the server. The demo admin grants control only over its own sandbox. Reset cancels active work and clears that session's overrides, saved searches, searches, and referral evidence; immutable base fixtures remain. Another reviewer's data cannot be read or changed through guessed IDs.

## 9. Mock data and scenarios

Use two layers: hand-authored showcase records with meaningful tradeoffs and deterministic generation of surrounding inventory.

- Six authored providers with production-style names, overlapping capabilities and distinct raw payload shapes.
- All six domestic/international × flight/train/bus combinations.
- A curated city/connection network; every selectable destination has complete hotel coverage.
- Multiple services on popular dates and at least three provider offers for main showcase itineraries.
- Approximately 12–20 hotels per showcased destination with several room/rate options.
- Stable prices for an unchanged query and fixture/scenario revision.

**Catalog defaults:** 12 Iranian cities plus 10 international cities; a minimum of six fully polished hero searches: Tehran–Mashhad flight, Tehran–Istanbul flight, Tehran–Mashhad train, Tehran–Van train, Tehran–Isfahan bus, Tehran–Yerevan bus. Services and schedules are authored fiction, not claims about current operating routes. Validate geography and identifiers during fixture authoring. Build reverse journeys and complete same-provider round trips.

Provider IDs are demo-provider-01 through demo-provider-06. Capabilities default to: P01 flight; P02 flight/train; P03 flight/bus; P04 flight/train/bus; P05 train/bus; P06 train/bus. Hero routes have at least three participating providers for their mode.

Fixtures include inconsistent Persian/Arabic letters, whitespace, aliases, rials/toman, duplicates, missing baggage, ambiguous mandatory charges, airport changes, overnight arrival, ground stops without transfers, sold-out inventory, and room occupancy limits. Unicode cleanup never guesses the identity of distinct entities.

The generator is a pure function of fixture version, seed, demo date, scenario, mapping revision, and query. Delay schedules do not change quote contents. Session demo time is frozen at creation for reproducible schedules; actual event timestamps and expiry use a separate real clock. Reset starts a new reproducible session state. A recorded anchor/seed can reproduce a previous scenario. Session creation/reset anchors use UTC seconds with optional 1–3 fractional digits and millisecond storage/comparison; equivalent spellings resume the same session, while a different instant requires explicit reset. Sub-millisecond and minute-only anchor inputs are rejected.

| Scenario ID | Required behavior |
|---|---|
| normal | All available providers respond with stable valid inventory |
| slow-provider | Useful partial results, visible coverage, staged late arrivals |
| provider-timeout | Bounded wait, explicit failed coverage, useful remaining results |
| price-change | Quote total or condition changes at recheck; acceptance required |
| sold-out | Selected quote becomes unavailable; alternatives remain actionable |
| conflicting-data | Ambiguous/rejected source records visible in admin |
| no-eligible-results | Clear empty-state recovery through dates, filters, or supported routes |

**Latency defaults:** normal responses 150–1200 ms; slow response 2400 ms; individual timeout 3500 ms; whole search deadline 5000 ms. Values are configurable scenario settings. No deliberate delay is added after useful data is ready. At most two provider operations per search run concurrently; at most two active searches per reviewer session; excess work returns a retryable status instead of unbounded timers.

## 10. Admin and reviewer experience

Admin uses shared design primitives and English copy.

| Area | Evidence | Actions |
|---|---|---|
| Providers | Response time, status, offer counts, freshness | Pause provider; choose latency/failure profile |
| Data quality | Raw record → normalized record → grouped itinerary; rejected/ambiguous records | Preview alias correction impact; apply revision; reprocess |
| Searches | Coverage, grouping, exclusions, ranking inputs/explanations | Replay a query and inspect decisions |
| Referrals | Quote and recheck versions, handoff payload, event trail | Inspect the search-to-referral sequence |

Controls produce actual backend behavior and audit events. Charts derive from real session events; empty activity stays empty. There are no fictional revenue or conversion metrics.

A mapping correction targets a specific entity type/source namespace. Preview shows collisions and affected records. Applying a valid mapping creates a new revision. Existing search/quote evidence remains immutable; new searches or an explicit replay use the new revision.

The customer journey has no demo/test indicator or fixture/scenario/reset menu. Prepared searches appear as normal travel suggestions. Existing operational controls remain outside the traveler journey, with the dedicated operations/admin experience continuing in its planned milestone. Reviewers use documentation for setup and scenario walkthroughs; they are never forced through a tour.

Provide a README, an under-five-minute walkthrough, AI development evidence, a known-limitations document, and verification evidence. One coherent narrative covers date exploration, provider comparison, route/hotel inspection, changed-fare handling, referral, and admin evidence. **Default walkthrough target:** 4 minutes 30 seconds, leaving room beneath the challenge's five-minute limit. A timed script/storyboard is part of this implementation; an actual application video is a subsequent deliverable when requested, not an excuse to claim a recording exists. Recheck current submission requirements before any eventual submission.

## 11. Architecture and alternatives

### Selected: Option A

Nx + pnpm + strict TypeScript; React/Vite consumer and admin; one modular NestJS API; PostgreSQL + Prisma; shared Three.js/React Three Fiber/Drei/GLSL graphics. React Router owns navigation; TanStack Query owns server snapshots; typed reducers own transient interactions.

Option A matches the agreed interactive, self-contained demo and keeps one backend domain authority. Its initial public pages require JavaScript; route SEO would need a separate rendering decision later.

### Considered: Option B

Next.js consumer frontend, React/Vite admin, and NestJS backend. It provides a stronger starting point for server-rendered discovery pages but adds a frontend server and rendering boundaries. Since indexed destination pages are outside this release, the user selected Option A.

### Logical boundaries

Three application projects: web, admin, api. Shared libraries: contracts, domain, fixtures, provider-adapters, data-access, ui, graphics, client. Feature libraries are split where independent ownership or size makes it useful; do not create one Nx project per component.

Domain rules do not import React, Nest, Prisma, or transport code. Contracts contain runtime schemas and public types, not persistence models. UI does not import provider raw formats or database code. API alone orchestrates providers and persistence. Nx ESLint tags enforce these boundaries.

Core backend modules: sessions, catalog, providers, searches, date-prices, hotels, referrals, saved-searches, and admin. One backend process executes bounded searches. Persisted logs/snapshots support audit and reconnect, not a distributed event-sourcing platform.

REST creates queries and performs mutations. SSE sends provider status, versioned result snapshots, and terminal search state. Event IDs are ordered per search. A snapshot endpoint recovers from gaps. REST polling is a fallback when streaming repeatedly fails. Completed streams close. New queries cancel superseded work where possible, and clients always reject events belonging to a different generation.

On API restart, persisted completed searches remain inspectable. Previously running searches become interrupted and can be explicitly retried. Do not pretend an in-memory job resumed. Each retry creates a new search ID linked to its predecessor.

Same-origin gateway routes / to web, /admin to admin, /api to NestJS, and /provider-demo to a web route. It serves static assets with correct SPA fallbacks and forwards SSE without buffering.

## 12. Rendering, design, and accessibility

Use React Aria primitives, custom CSS Modules, and semantic CSS variables for all authored UI colors, SVG fills/strokes, chart colors, focus states, and shader uniforms. Avoid hardcoded component colors. Transport × appearance yields plane blue, train green, and bus red in dark/light versions. The canvas and surface families carry the transport hue: very dark blue for flights, dark green for trains, dark red for buses, with corresponding restrained light palettes. Admin uses the shared neutral/blue token family.

Local font defaults are Vazirmatn for Persian and Inter for English; verify and bundle font licenses. The visual reference is compact comparison UI with clear hierarchy, not a dashboard template. Density must not remove readable price conditions or focus targets.

**Owner layout adjustment,2026-10-26:** Compact the right-hand desktop controls through shared rows and reduced empty space without reducing font sizes. Origin/destination/class share a row; passenger counts and the search action share a row. Keep the date wheel/chart, required ages, errors and price provenance available. A normal desktop viewport should contain the default search controls with minimal scrolling; expanded requirements and result lists may extend the page.

A persistent app-owned WebGL2 renderer uses clipped views for transport maps and charts. Context/material/geometry resources are shared, not allocated per ticket card. **Owner’s free-map exception:** the on-demand hotel picker uses a separate MapLibre renderer inside its native dialog, with at most one active provider map and complete cleanup on dismissal. It does not create another app-owned renderer or alter the transport scene. HTML owns labels, controls, forms, calendars, dialogs, and selectable information. App WebGL handles dotted transport geography, routes, vehicle progress, chart emphasis, and selected flat effects.

Official OSM-hosted VersaTiles styles and required OpenStreetMap contributor attribution are third-party assets; authored hotel controls and custom markers still use semantic tokens. Record its lazy SDK/network weight separately from app-owned bundles and disclose the total map cost. No provider key or account is required. Provider map styles and SDK UI are vendor assets; custom controls and markers remain subject to semantic theme tokens.

When the hotel modal is open, pause the background travel scene and preserve its camera/pinned state. Scene layering must keep native modal focus and pointer semantics correct. All UI animations are flat except shallow map/route depth.

Shaders consume resolved theme tokens through typed uniforms. Theme transitions update CSS and GPU colors before the new transition frame. Preserve the requested rules:

~~~css
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
~~~

**Transition default:** a 260 ms flat reveal centered on the toggle, with no animation under reduced motion. Unsupported browsers update theme directly. Loading the app applies the stored/system theme before the first visible frame.

Use on-demand rendering outside explicitly active animation. The owner-requested desktop map ambience permits a visible animation loop through the existing scheduler; suspend covered/hidden/document-hidden scenes and all continuous motion under reduced motion. Dark palettes use very dim shaded blue/green/red backgrounds with semantic gradient haze, rather than a bright solid fill. Default DPR caps are 1.75 desktop and 1.5 mobile, with a lower-quality tier. Context loss or unavailable WebGL produces a static map/route or textual timeline and an SVG price chart; all selections remain available.

Target WCAG 2.2 AA behaviors through explicit audits: keyboard completion, visible focus, meaningful names, dialog focus/return, sufficient contrast, non-color-only status, and reduced motion. Mobile targets are at least 44 × 44 CSS px; compact desktop controls may have smaller visible surfaces while preserving practical hit areas. A test tool alone does not establish compliance.

**Performance defaults to measure:** 60 fps target during desktop interaction, low-tier target ≥30 fps; interaction latency <200 ms; normal scenario first useful result ≤1.5 s and complete results ≤3 s on the recorded reference setup. The provider concurrency and delay schedule must be authored to meet these normal-case targets. Initial route JavaScript target ≤350 KiB gzip; deferred graphics target ≤500 KiB gzip. Record hardware/browser/dataset; do not claim universal performance or reduce approved features silently to meet a number.

## 13. Packaging, verification, and handoff

Root pnpm docker:up runs build, startup, initialization, readiness checks, and prints the web/admin URLs. Default URLs are http://localhost:4300/ and http://localhost:4300/admin/; TOROBTICKET_PORT overrides the host port. Compilation happens inside Docker. A direct Docker Compose command is also documented for reviewers without local Node/pnpm. Services: gateway/static frontends, API, PostgreSQL, plus a one-shot migration/seed initializer. Readiness waits for a healthy database and successful initialization. Restart does not erase data.

Pin a compatible Node LTS, package manager, Nx/plugin set, runtime dependencies, and container versions during foundation work. Keep the lockfile committed; record the compatibility matrix. Do not invent unverified version combinations in this specification.

The mock comparison/referral runtime needs no external API credentials, remote font, image host, CDN script or LLM. The explicitly requested hotel street-map exception loads public vector tiles/styles/glyphs/sprites on demand; its local list/coordinate fallback stays usable without that service. First build may download dependencies/images. Docker shutdown and explicit local reset commands are documented separately.

Verification includes domain/adapter tests, real-PostgreSQL integration tests, Playwright reviewer journeys, six mode/scope coverage, one-way/round-trip, keyboard/RTL/mobile/light-dark states, scenario recovery, session isolation, shader fallback/context restoration, resource cleanup, and clean startup. Component visual fixtures are kept in Storybook.

AI evidence records what AI helped produce, relevant decisions, rejected suggestions, corrections, and actual verification. It must not fabricate prompts, user tests, performance measurements, or model-derived outputs. No runtime LLM is required or simulated as live intelligence.

## 14. Traceability and document lifecycle

The companion master plan maps every section to task IDs, lists exact file ownership and interfaces, and supplies an editable progress tracker. At implementation start, copy both documents into docs/superpowers/specs and docs/superpowers/plans without losing their revision history; rewrite the companion links to their new relative locations.

Current executable work is limited to the throwaway date explorer. Its accepted interaction is wheel-nearby/calendar-ahead. Its source, fixed dates, visual polish, strict return-day rule, and simulated browser delays are not a production implementation baseline.

No product source, repository scaffold, container, deployment, or application submission is created by writing these documents.

## 15. Primary references

- Torob challenge: https://jobs.torob.com/ai-product-engineer
- Torob merchant information and tariff: https://torob.com/sell/ and https://panel.torob.com/s/tariff
- Nx React: https://nx.dev/docs/technologies/react/introduction
- Nx NestJS: https://nx.dev/docs/technologies/node/nest/introduction
- Nx boundaries: https://nx.dev/docs/features/enforce-module-boundaries
- Next.js alternative: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Internationalized dates: https://react-aria.adobe.com/internationalized/date/
- React Aria calendar: https://react-aria.adobe.com/Calendar
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview
- Zod: https://zod.dev/
- Three.js WebGL2: https://threejs.org/docs/pages/WebGLRenderer.html
- Three.js GLSL materials: https://threejs.org/docs/pages/ShaderMaterial.html
- Shared graphics views: https://drei.docs.pmnd.rs/portals/view
- On-demand rendering: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- Motion: https://motion.dev/docs/react
- SSE: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- Prisma seeding: https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding
- Compose readiness: https://docs.docker.com/compose/how-tos/startup-order/

Library references were consulted during architecture selection on 2026-10-24. Validate exact package compatibility during T01. Geographic/catalog sources and asset licenses are gathered during their owning tasks.
