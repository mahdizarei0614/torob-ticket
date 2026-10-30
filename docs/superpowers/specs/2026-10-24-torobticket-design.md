# TorobTicket — Product and Architecture Specification

**Revision:** 1.35 · 2026-10-31

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
- Guest comparison and referral, optional local identity with a compact profile.
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

Changing mode preserves compatible cities and dates. An incompatible destination is cleared without the routine compatibility notice; it is not silently replaced. Required field validation remains available. Origin selection enables supported destinations. Network support is distinct from availability for a particular date.

**Owner adjustment, 2026-10-27:** New consumer transport searches compare one adult; the passenger calculator is removed. URL, presets, saved-search opens and new submissions normalize consumer intent consistently. Historical result/quote/referral evidence retains its original party; a changed draft cannot select that old evidence. The general domain/admin contracts still support parties of up to nine, at least one adult, and infants no greater than adults. Hotel room/guest eligibility remains independently enforced. Mock providers own their age/seat rules; no passenger names, passports, or dates of birth are collected. A hotel age is age at check-in and is not inferred from transport age at a different date. Keep a compatible selected class; otherwise preselect economy, seat or standard from the catalog, falling back to its first valid class.

Search controls share compact rows without smaller type. **Owner adjustment, 2026-10-28:** origin/destination/class share aligned label and control baselines; class uses the same accessible segmented choice pattern as transport and trip type, with a compatible preselected value. Narrow layouts place class beneath the city pair as needed for readable targets. The mode, scope and trip-type group names remain accessible but are not visible headings. City fields show search and clear icons, search placeholders and a restrained focus state. Remove the repeated traveler/trip/time-zone summary and routine instructional copy. **Owner refinement,2026-10-28 (decision0043):** shared segmented choices use one measured sliding indicator whose position and width follow the selected option over320ms. Physical bounds preserve RTL/LTR, varying labels and wrapped rows. Resizes/font changes and reduced/covered/hidden/disabled policy settle directly; interruptions continue from the visible indicator. Radio semantics and focus remain native.

**Owner refinement,2026-10-29 (decision0049):** all segmented tracks use the ranking control's4px padding on every side; remove form/class overrides that collapse it. Preserve measured sliding indicators and readable option type. Operating-carrier marks use40px display boxes with14px desktop/13px narrow labels; marketplace identity remains separate.

**Owner quiet-feedback refinement,2026-10-29 (decision0051):** remove routine quote-expired recovery cards and passive generic incomplete-form/date hints. Expired cards retain their concise invalid-price indicator and cannot select/refer old evidence. Incomplete search remains visually inactive but accepts a pointer/keyboard validation attempt: mark actual invalid fields, apply a finite horizontal shake and focus the first useful editable field. Invalid attempts never call search or alter committed evidence. Pending/reset/session/covered/date-interaction guards remain truly disabled; reduced motion retains errors without shaking. Calendar trigger shows its icon and compact readable label.

**Owner compact-control refinement,2026-10-30 (decision0056):** focusing an empty enabled city input opens its supported options without choosing a city. Preserve native typing, keyboard choice, clearing, Escape and disabled-destination behavior. Place the class choices and round-trip departure/return exploration segments in a shared compact row; narrow layouts may wrap without shrinking type or touch targets. The date explorer continues to own the active leg and calendar/interaction state; relocating its control must not duplicate that state or alter search intent by itself. One-way travel can omit the redundant leg selector.

Field validation uses above-control tooltips instead of below-field paragraphs, so invalid feedback does not change field or row height. Keep persistent accessible error descriptions and invalid styling even while the visual tooltip is dismissed. Tooltips are available through focus and hover, dismiss with Escape in either case, and do not steal focus, block the city menu/calendar or lock scrolling. Deliberate invalid-submit focus and finite shake remain. Routine fixed-opposite-leg captions are removed; calendar price units, actual missing-return errors and retrieval-failure distinctions remain meaningful.

**Owner row/label clarification,2026-10-30 (decision0057):** origin, destination, class and the outbound/return exploration control occupy one physical nonwrapping row. The last control is visibly labeled «جستجو بر اساس» and retains a checked outbound option for one-way trips; round trips expose both options. It selects the inspected travel leg. The calendar remains below the wheel. This supersedes the previous allowance to omit the one-way control or wrap these groups into a second row. Keep aligned labels, shared control heights, readable type and unchanged date ownership. Constrained widths or intrinsically long class choices scroll only this row horizontally; never overflow the page or wrap segment options. Portalled city menus and validation tips remain usable outside that clipping.

**Default filter set:** budget, departure time window, operator/provider, mode-specific class, maximum flight stops or ground transfers, refundable-only, and a flight checked-baggage requirement. Unknown conditions never satisfy an affirmative requirement. A condition is shown as unknown instead of invented. The single departure-time window constrains the outbound departure in its origin time zone and is labeled outbound for round trips. The maximum stops/transfers filter uses the complete-trip count (both directions for round trips), with that total explicit in its label.

Prices are the eligible total for the whole party and include all known mandatory charges. A visible breakdown explains the total. Offers with incomplete mandatory totals may appear in a separate incomplete-price state; they cannot win a lowest-price claim or be referred as a final priced offer.

Round trips compare complete outbound-and-return offers actually supplied by the same mock provider. The system does not create a complete fare by adding unrelated sellers' one-way prices.

**Owner directional-trip correction,2026-10-30 (decision0062):** each supplied leg may have different stops, carriers, services, local timings and endpoint facilities. Preserve both actual ordered routes in cards/details/graphics, with separately labeled outbound/return map chains; never imply an unsupplied transfer across the destination stay or mirror the outbound geometry. Decision0062 introduced source-v4-directional-fares-2026-10-30 for v3 transport operations, supplying one complete gross influenced by both travel dates/directions/service bands and deterministic calendar demand; decision0063 advances new operations to v5 while retaining this recorded source. Fixture/catalog identities and old default/source bytes remain unchanged. Historical selected quotes recheck their recorded source; old searches/quotes/date caches/receipts remain immutable and accessible in the same session. No session reset/migration or independently sold one-way fare combination.

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

**Owner ranking correction,2026-10-30 (decision0063):** retain both fastest and fewest-stop/transfer controls: total elapsed time and connection count are independent objectives, supported by primary travel-planner documentation. Keep the existing lexicographic comparators, truthful ground vehicle-change semantics and deterministic ties; never shuffle to force movement when data agrees. The18-query v4 baseline had identical orders because of monotone authored schedules. New v3 transport operations freeze source-v5-schedule-tradeoffs-2026-10-30 with selected long-haul long-layover versus well-timed multi-stop service trade-offs. Real airport paths/carriers/flying minutes remain; dependent stop/segment instants and IDs retime before return feasibility. Preserve twelve services, all sellers, both-date fares and exact recorded base/v4 source replay/rechecks. New server source identity and frontend date-policy identity retire prior estimates without rewriting old results. London showcases distinct leaders/order; same-count direct trains retain identical rankings. Sort changes remain local to received facts, preserving prices, selection/map pin, focus and immutable query, with no new search/date/referral mutation.

For round trips, duration and stops/transfers sum both directions and exclude time at the destination. Rail/bus intermediate stops remain visible and their dwell affects duration, but a stop without changing vehicles is not a transfer. Provider offers inside a journey sort by eligible total, then stable ID.

The group representative is its cheapest eligible complete quote. Ranking, badges, and relative explanations refer to that quote and the current filtered candidate set. Switching providers or fare variants updates the displayed facts and referral selection.

Explanations are deterministic facts with a stated comparison: price difference, time saved, connection count, baggage differences, and responding-provider coverage. While collection is ongoing, claims say “so far.” They do not imply coverage of the entire travel market.

**Default contextual suggestion:** show at most one suggestion. Offer a nearby date within ±3 days when it saves at least 10% and 200,000 toman with the same party/filters and fixed opposite leg; or a journey that saves at least 90 minutes for no more than 10% extra. Evaluate relative to the current cheapest complete option, require comparable completed coverage, and show the exact tradeoff. Prefer the larger proportional price saving when multiple date candidates qualify, then nearer date, then stable ID. Otherwise use the time-saving candidate with the greatest minutes saved, then lower price. Dismissal lasts for that search. Thresholds are explicit defaults to validate with fixtures.

During initial collection, results can reorder. Once the user scrolls results, focuses a result, opens details, or selects an offer, preserve the current order and stage later provider updates behind a compact toolbar refresh action. An explicit sort/filter change authorizes a fresh ordering. Invalidated selected offers are visibly marked and blocked from referral immediately even if ordering is frozen. **Owner refinement,2026-10-28:** ranking-only segments reorder adopted results locally without starting a search, clearing the list or mutating its immutable query/quotes. The displayed sort persists through later date/filter/fresh submissions, saved-search intent and return checkpoints. The source URL stays bound to the received evidence during view-only ranking; checkpoint draft and saved query retain the displayed preference. Explicit presets/saved opens establish their own ranking.

**Owner results adjustment, 2026-10-27:** Results use compact readable cards with operator/date/price, departure and arrival times, ordered route codes, duration/connections, and one details expansion. Round-trip return times and overnight date changes remain visible; full provider fares, unknowns, material conditions and breakdowns remain in expanded evidence. Remove the repeated collection sentence and separate conditions-and-costs disclosure. The card's native selection surface is keyboard-operable; route tooltips, details and provider choices remain independent controls. A selected card shows an accent/check and, under the later same-price seller adjustment below, provider icon links for its exact total. Those actions retain explicit recheck, changed-price consent and exact referral recovery. Remove the routine update banner, normal response-count paragraphs, positive selection announcement and results edit button. Put the actual successful seller count beside the mode heading, preserving material failure and stale-evidence states. Move the functioning travel-suggestion chooser to the intro.

**Owner price/seller adjustment, 2026-10-27:** Derive a separate card for each exact currency/total within a canonical itinerary group. Only sellers offering that amount appear as large icon navigation actions at the bottom of its selected card; different totals belong to different cards. Replace the mixed-price offer-count list and separate provider CTA. Keep same-price fare variants distinguishable, with exact conditions in the compact journey details. Preserve canonical group/quote identity, use stable price-card keys for scroll/focus, and rank each displayed price under the chosen sort. An icon resolves its exact seller selection before the existing recheck/handoff; accepted versions and ambiguous-confirm recovery remain authoritative. Decision0037 records the boundary.

A fresh current search reaching usable terminal results selects its cheapest complete eligible unexpired quote once, independently of displayed sort, and pins its map route. Adopt final evidence through the existing scroll anchor first when needed. A manual choice during collection wins; automatic selection never starts a referral or focuses/scrolls to the provider action. Restored checkpoints, stale/historical intent, empty/cancelled results and sort/filter refinements do not receive an automatic replacement. Expiry and later same-generation changes cannot trigger repeated selection. Decision0035 records this superseding default.

**Owner notice refinement,2026-10-28 (decision0044):** remove the separate long changed-form notice. A concise card-level invalid-price indicator covers changed intent as well as expired evidence, while distinguishing genuinely replaced/invalidated offers. A different or incomplete draft cannot select or refer old quotes. Retain the matching search action and required input validation; removing copy never restores authority.

## 5. Date exploration

The vertical wheel explores nearby dates. It has faded ends, a clear center, daily minimum prices, and a snapped date after release. Dragging previews the date and linked price chart. Settling commits once. Arrow controls, keyboard operation, clicking a date, and the calendar provide equivalent alternatives.

**Owner wheel refinement,2026-10-29 (decision0049):** each44px option is a single horizontal date — price/status row, preserving13px date/12px price type and the full accessible name. Reserve sufficient wheel width; at very narrow widths place the chart below instead of compressing prices. Availability, unknowns, price bands and keyboard/settle semantics remain shared.

**Defaults (owner adjustment, 2026-10-28):** three visible 44px rows with unchanged typography; a250ms settle/debounce target, tuned through usability testing. Desktop arrows sit beside the wheel to reduce form height. The later owner adjustment removes the selected-day observation/coverage card and routine chart caption, makes the search button full width, and increases the desktop chart. The 2026-10-28 adjustment places a full-wheel-width calendar action below the 132px wheel with an 8px gap; the chart plot spans their combined 184px height. Its heading/axis remain outside that plot. Every committed valid query has a generation ID; stale responses cannot replace the active generation. Pointer cancellation restores the last committed selection.

Clicking a chart point synchronizes the wheel. The line describes the minimum eligible offer by departure date under current conditions, not historical price movement. The minimum does not change merely because the result sort changes.

**Owner chart refinement,2026-10-28:** exact-date/price custom tooltips enter with a finite fade and move smoothly between cells. Use a gently smoothed3.25 CSSpx line with round ringed markers that grow on hover/focus; a persistent distinct ring and date guide retain the chosen day while another is inspected. Shared bounded monotone geometry never bridges unavailable days or introduces synthetic price observations. Tooltips show only actual cell values/statuses. Keyboard, touch, Escape and outside dismissal remain usable; overlapping or mismatched pointers cannot commit a date. GPU and SVG match; before each GPU draw read the actual renderer CSS viewport/DPR so narrow plots retain their intended stroke and marker proportions. Hover uses the existing finite Motion service even when the desktop map loop is absent.

**Owner chart lifecycle refinement,2026-10-28 (decision0044):** first appearance and re-entry draw the curve from its chronological start to end with eased progress. Changed dates/inventory reshape from the currently displayed geometry; rapid interruptions continue there. No-priced-data transitions fade/retract the retained visual before clearing it. One finite frame store owns both GPU and SVG presentation, including tooltip coordinates, exact target-cell facts, gap topology and point opacity. Reduced/covered/hidden motion settles without a new persistent renderer loop. Range labels read «کمترین قیمت» and «بیشترین قیمت».

Calendar and wheel use one date-price model. Calendar interaction is provisional until “Apply dates.” Cancel restores the previous selection and focus. Jalali month boundaries, leap years, keyboard navigation, and valid Gregorian conversion are explicit test cases.

The calendar uses a compact icon trigger and a narrow month dialog with priced days and usable touch targets. Gregorian manual entry is available in an optional disclosure. The date wheel retains keyboard/drag interaction without visible drag hints or the redundant date-comparison heading.

**Owner round-trip adjustment, 2026-10-28:** on an explicit one-way→round-trip toggle, initialize a visible editable return three days after the chosen departure, clamped to the destination-local 90-day date horizon. This makes complete round-trip prices and ticket selection available immediately; it does not invent inventory. A later departure edit that invalidates the return still clears it, requires reselection and initially moves the wheel to return selection once. Explicit outbound/return exploration and provisional calendar editing remain available while that return is unset.

For round trips, choose departure first. Return-day prices represent complete round-trip totals. Once both dates are set, changing either leg holds the opposite leg fixed. If the departure makes the return invalid, require the user to reselect; do not silently shift the return. Same-day returns may be valid when actual segment timing makes them possible; the throwaway prototype's stricter behavior is not a production rule.

**Owner return-price correction,2026-10-30 (decision0062):** all date surfaces use the same current complete-trip cell minimum and selected-date eligibility authority, with the opposite leg fixed. New server cache identity freezes the active source revision, and frontend code-policy identity retires pre-directional in-memory estimates. Exact wheel/chart toman values and calendar accessible amounts must match the cheapest eligible complete result for that query; compact calendar visual amounts retain their explicit thousand-toman unit. Ranking does not redefine this minimum.

Date states are priced, checking, no matching offer, and outside coverage. If retrieval fails or no complete price can be established, show a distinct price-unavailable state with recovery; never describe a provider failure as proof that no tickets exist. Missing/unknown values create chart gaps, never zero prices. A date estimate retains its observation/coverage evidence internally. It remains reusable for the same session and query identity without a 60-second stale warning or retry prompt; invalid/future timestamps and actual retrieval failures remain distinct. Date retrieval failures get one quiet delayed recovery attempt per unchanged active hook identity, plus reconnect recovery; no manual retry control or refresh loop. Quote expiry and referral recheck are separate and unchanged. Filters, party, class, mode, provider scenario, mapping revision, and fixed opposite leg are part of its cache identity.

**Relative price colors:** One shared rule colors the chart, wheel, calendar prices and ticket totals: the lower quarter of the comparable minimum–maximum range (including 25%) is green, upper quarter (including 75%) red, and middle yellow. Equal or sole prices are yellow; unknowns are neutral. Date surfaces share one range of available daily minimums for the same intent; ticket cards use eligible amounts in the adopted result set, independent of sort. Numerical values and selection indicators remain readable without relying on color. CSS, SVG and GLSL use semantic price tokens across all themes.

**Default coverage:** a 90-day departure window anchored to the session's demo date, inclusive of day zero. Return departure must fall inside that window; arrival may fall afterward. Dates with no eligible timetable remain selectable for exploring the empty state, while structurally invalid or out-of-coverage dates are disabled.

## 6. Map and route behavior

The desktop map stays on the left while the right-hand content scrolls. It starts with dotted Iran for domestic scope or dotted world geography for international scope, with shallow depth and a stable camera.

**Owner background adjustment, 2026-10-27:** The desktop map belongs to one shaded page background, with no differently colored rectangular panel. A shared viewport-aligned atmosphere spans the map and right-hand content. Geography dots, faint borders and morph particles fade softly toward the scene edges, with a broader transition toward the results. The GPU and static fallback both use the fade, which stays visually stable during zoom. Selected route and endpoint/stop labels remain readable; camera alignment, normal scrolling and content interaction stay intact. Decision0036 records this presentation-only change.

**Owner adjustments,2026-10-26:** The main travel map remains display-only for origin/destination. Only search-form controls change cities. Desktop shows the start→end title and map, without endpoint controls/dropdown, visible zoom toolbar, duplicate details or progress/footer. Compact selected-endpoint and progressively revealed stop names are shown. On the international map, sparse contextual capital/major-city labels may fade with zoom and yield to all selected journey labels; these geographic names imply no inventory or selection action. Selecting cities reveals their locations with a flat halo/pop effect. There is no connecting route before a selected ticket; a fresh completed search now automatically selects its cheapest eligible quote as specified above. The hotel location picker remains interactive and unchanged.

**Owner heading correction,2026-10-30 (decision0055):** switching only one-way/round-trip retains unchanged city-label DOM and visibility. Animate the arrow change within a fixed inline footprint, respecting covered/reduced/hidden motion policy. Preserve this continuity when a trip-type edit revokes an old selected ticket, while clearing its old airport codes/service facts. Genuine city, stop, direction or selected-service changes keep their appropriate finite transitions; presentation continuity does not retain invalid quote authority or stale facts.

The map title follows the pinned canonical itinerary and direction, with ordered city stops and a compact operator/local-departure/code line so different services between the same cities remain recognizable. Heading changes use a finite fade/up replacement; hover does not replace a pinned title. The transparent fixed map and its header are layered above the shared WebGL canvas so correctly updated text stays visibly painted. Selecting an itinerary pins it and deliberately fits the camera. Hover/focus metadata may still support ticket/mobile inspection, but does not replace or restart the desktop's selected journey. Sorting or scrolling results does not reset the camera. Pinch zoom remains supported. The desktop map has no additional direction toolbar; it displays its current itinerary direction. Round-trip details remain in ticket details, and mobile route panels retain outbound/return controls.

International endpoint selection gently zooms to the selected cities with surrounding margin before a ticket is chosen. A manual or automatic itinerary selection fits all relevant stops and curves, including outlying connections. Camera and annotation easing share the renderer clock; reduced motion settles directly. No separator line divides map and results. Train and bus icons use side profiles, and the thicker route carries a directional shooting-star head and fading tail.

The international map has very faint country boundaries. Both travel maps use airy dot spacing and crossfade through progressively finer density levels during zoom, with three successive density transitions, preserving recognizable land at close range. A bounded land mesh is prepared outside the frame loop; GLSL evaluates geographic dot lattices and zoom changes uniforms. International context names have a strict visible count and collision budget; endpoints and stops always take precedence. The domestic map remains Iran-only with faint internal province lines and no general city names. Decision0047 adds locally bundled Natural Earth Admin-1 boundaries; boundary changes retain the outgoing lines for a300ms fade-out, then fade the incoming layer in over1s. Particles continue their morph independently. Initial/reduced rendering settles directly; covered/hidden states pause; rapid interruptions preserve the visible opacity with at most one visible and one pending boundary owner. Trackpad pinch and two-pointer pinch change map zoom, while ordinary wheel scrolling remains page scrolling. GPU and DOM overlays share the same viewport box even when a scrollbar appears, with one origin and one destination marker.

**Owner viewport-filter correction,2026-10-30 (decision0062):** result filters use a viewport-positioned portal with12px side margins, collision flip/shift and available-height bounds. Keep a reachable close header and an internally scrollable body; action buttons stay in ordinary flow rather than covering fields in short viewports. Preserve native focus/Escape/outside dismissal, finite motion and per-open stale callback guards. Actual desktop/mobile/short-height pointer checks verify bounds and field/action reachability.

**Owner result refinement,2026-10-28:** changing a form segmented choice (vehicle, scope, trip type or class) clears the visible comparison and its map selection immediately, cancels/fences obsolete work and permits a valid draft to be searched again. Persistent server evidence remains unchanged. Other form edits retain previous evidence as inspection-only until the updated trip is searched. Ranking segments reorder the existing comparison instead. Synchronous ownership checks prevent late responses or old callbacks from restoring a flight route beneath a train form or an equivalent mismatch. Remove the generic «دریافت پیشنهاد کامل نشد» card; genuine session/identity and retrieval failures retain purposeful recovery. Completed zero-card lists use a compact illustrated no-match or filter-empty state, with existing date/form/filter actions. No-match requires successful completed responses from every nonempty expected-provider set; incomplete, failed or cancelled collection never claims no tickets exist. Trip details expand/collapse with finite height/opacity motion that keeps the trigger, card top, focus and scroll stable; list-position projection depends on ordered card identities so it does not fight the disclosure height.

**Owner directional-light refinement,2026-10-31 (decision0065):** add a restrained soft directional halo along the line itself, with a leading tip and longer fading tail moving from each supplied segment origin toward its destination. Keep flight arcs, double rails, curved roads and required transfer modes readable. Round trips show glow for BOTH supplied directions after their geometry has been revealed; the return line/light uses a subtly distinct tint derived from the current semantic theme. Both flows remain readable while the original vehicle-attached comet keeps its own established fade.

Where an outbound/return path section fully overlaps, separate only that shared section into two slightly spaced presentation lanes. Compare actual fragment geometry, including reversed/resampled equivalents; shared endpoints, crossings and nearby parallel alternatives alone do not establish overlap. Taper back to exact stops/endpoints. This changes display positions only: source geometry, chronology, distances, camera fitting, vehicle facts and referral authority remain canonical. Handle partial-journey overlap and map seam fragments independently. Reuse the existing permitted render clock and resources; covered/hidden/disabled motion pauses, reduced motion shows settled directional cues for both legs, and SVG fallback retains true-tangent direction/lane/tint cues without a scheduler. Do not add brighter page backgrounds, a renderer, postprocessing chain or dependency.

**Owner vehicle-foreground correction,2026-10-31 (decision0065):** the vehicle head and both train wagons must remain above map geography, borders, route lines and glows. Exclude them from bloom input and draw the foreground once after emitted light in the existing renderer; ordinary non-bloom views retain explicit final ordering. Preserve glass artwork, canonical motion, turn/stop/fade/blur behavior and reduced/covered/hidden ownership. Camera masks, viewport/scissor, clear state and render targets must restore on success and failure. This adds no renderer, scheduler, dependency or postprocessing chain.

Flights use visible shallow arcs, rail uses two parallel straight rails between stations, and buses use smoothly curved authored road paths. Paths remain illustrative mock geometry, not navigation guidance. A selected route draws in canonical segment order: reach the next stop, reveal its city and count up its known wait minutes, then continue. Unknown waits remain unknown. One light strand travels the route, with a stronger pulse at intermediate stops, and mode-specific glossy glass vehicle icons. Required ground transfers retain their actual mode. Equivalent canonical facts remain in the textual route timeline.

**Owner round-trip motion refinement,2026-10-28 (decision0044), amended2026-10-29 (decision0049):** a selected complete round trip reveals its supplied outbound path and stops, turns its vehicle at the destination, then follows its actual return segments and stops to the origin and blur-fades there. Flight uses a banking loop, train a wider turn with two wagons following the same track, and bus a tighter road U-turn. The small maneuver affects only the decorative vehicle, never the geographic line or itinerary facts. Different airports/stations or modes blur-handoff to the supplied return, without inventing a connecting journey. After the first pass, repeat the complete decorative outbound/turn/return/fade/re-entry at the same1.8× timing used by the one-way loop; route reveal, final stop counts and completion/announcements stay settled. Whole-trip desktop headings show A↔B and both local departures. Place actual sourced IATA codes beside each city, and retain the full asymmetric airport chain below; different return airports in the same city are both shown. One-way/explicit return headings remain ordered and directional. Before service selection, ambiguous cities stay city-only; internal station/terminal IDs never masquerade as public codes. Reduced motion shows complete facts immediately with the finished round-trip vehicle hidden.

**Owner boundary contrast refinement,2026-10-29 (decision0049):** domestic province-line alpha uses0.52 times the semantic dot alpha; world borders retain0.32. Each retiring geometry retains its scope's strength through the existing300ms fade-out/1s fade-in. Static fallback matches. Do not alter fluid, map ownership or source boundary geometry for contrast.

The route animation is visual presentation, separate from comparison/referral authority. It must never change a quote, create a referral, or suggest a confirmed booking. Internal comparison/referral markers remain 0%, 35%, 70%, 100%, backed by the existing state/receipt rules. The consumer vehicle follows the visual route, while generic laboratory progress controls retain their prior semantics. Reduced motion shows the complete selected route and exact stop values immediately.

Geography dots have staggered particle lifecycles. **Owner refinements, 2026-10-28 (decision0041):** each dot softly appears, moves along a smooth random-looking path near its geographic anchor, then fades away. Independent6.5–10s lives and a short invisible interval keep the silhouette visible without synchronized blinking. Seeded time-varying waypoints joined by a convex cubic B-spline provide continuous position, velocity and acceleration, without a fixed looping path. The excursion is bounded by9 CSSpx and capped further only at extreme zoom-out to preserve a complete core inside the searched neighborhood. This supersedes the earlier drift/orbit presentation. Neighbor-aware shading skips invisible density levels and distant candidates. Shared shader/CPU position and opacity math makes scope morph snapshots begin at displayed particles; the live land clock continues through scope changes; morph particles meet the same wandering field instead of a frozen landing position (decision0046). Visible ambience explicitly owns continuous animation. Decision0046 synchronizes the living field and scope morph on the same active simulation clock with a50ms per-frame cap, preventing a slow-frame target jump; route motion also retains bounded steps. Borders, named endpoints/stops and routes keep their canonical anchors. Coverage/hidden state pauses clocks, normal visibility resumes them, and reduced motion shows steady anchored dots. No additional renderer or scheduler loop is added. Mouse movement leaves a dim, geographically anchored trail with a soft onset and gradual decay after the cursor passes. A bounded history and non-additive glow prevent bright accumulation. An authored subset of major-city locations has slightly larger decorative dots with the same particle/trail effect and restrained dot/route tint, with no population/ranking inference or additional city-selection logic. Ambient particles and the route strand share the existing application renderer and run only while the desktop map is visible, uncovered, and motion is permitted.

**Owner morph refinement,2026-10-29 (decision0045):** scope particles have independently seeded start delays and travel durations, so arrivals are distributed independently; the original1.7s presentation and the later4.6s presentation are superseded by decision0047: all particles depart together, with only travel duration/arrival independently staggered. Matching per-anchor destination-lattice gates and complementary particle fades hand off each arrival separately; a global destination fade must not erase late arrivals or reveal the whole map at once. All handoffs finish before the final transition frame. Shared uint hash/timing functions keep CPU snapshots, GLSL vertices and land gates aligned through interruption. Preserve active/reduced/hidden ownership; decision0046 replaces frozen target time with a continuously moving destination. Keep normal and offscreen geography shader materials alive while replacing scope/projection geometry, to retain their compiled programs across switches. Dark scene-dot tokens are roughly15% brighter, retaining hue and dim backgrounds; decision0046 strengthens the local cursor response; light dot contrast stays intact.

**Owner motion adjustment, 2026-10-27:** Switching Iran/world redistributes a bounded deterministic particle field along scattered paths, then settles into the destination's airy dot lattice. Interrupted changes continue from the visible state; reduced motion settles directly. Vehicles follow the local path tangent, with a locomotive and two independently following wagons for trains. A blur/opacity envelope softens vehicle entry, arrival and loop restart. Selected origin/destination visuals fade in and out, retaining outgoing visuals only for the exit; current semantic endpoint identities stay unique.

**Layout defaults:** main travel map at widths ≥1120 CSS px, approximately 46% of desktop content width. Below that threshold, omit the main map. Only small screens below768px show a selected-itinerary timeline; larger layouts retain route facts in ticket details. There is no standalone placeholder route card. Map controls cannot intercept ordinary results scrolling.

Geography, city labels, route paths, hotel landmarks, and fonts are bundled locally with attribution/provenance. Projection and route geometry must handle long routes and the antimeridian without drawing through the entire map accidentally.

## 7. Hotels

**Owner redesign,2026-10-30 (decision0061):** hotel discovery is an arrival-based map and square-card collection. This supersedes the earlier independently configured stay, arrival confirmation, room-count/date form and manual hotel-submit flow. The owner explicitly chose **always one night**, for both one-way and round-trip travel.

The compact hotel action remains an absolute overlay at the bottom of the fixed desktop travel map, inset24px, entering upward without changing the map/WebGL viewport. Narrow layouts place the entry inline above results. It opens a wide desktop modal and a mobile full-page view. If no transport comparison exists, its first click may establish the ordinary comparison context; only the comparison's normal selected offer supplies actual arrival facts. Unknown/unselected arrival never becomes a guessed stay.

Check-in is the chosen itinerary's final outbound arrival date in the destination time zone, with the exact airport, train station or bus terminal. Check-out is the following calendar day, including round trips and same-day returns. Room count is one and travelers follow the normalized consumer party. New consumer discovery has no date, room, age or arrival-point configuration. Generic backend/admin hotel contracts and historical party/stay facts remain supported and immutable; unknown eligibility is never invented.

Opening the view and changes to a current valid selected ticket automatically load its one-night offers, with bounded query/view/revision/session ownership and cancellation. Failures remain distinct and explicitly retryable; they are not automatic retry loops or proof of no rooms. Historical multi-night/room snapshots cannot appear as live prices under the new summary. A compatible one-night return retains a validated fresh higher-version quote, while incompatible context refreshes the new automatic query without changing the receipt.

**Owner real-property refinement,2026-10-30 (decision0064):** the arrival street map shows a static named airport/station/terminal and true-coordinate hotel pins. Hotel names are hidden at rest on every viewport and appear with a bounded finite transition on hover or keyboard focus; touch selection focuses the pin. Card selection highlights its pin without showing an unrelated permanent name. Remove the displaced grid/spider hotel targets and leader lines: only the tooltip may shift inside the viewport. Keep native44px targets and full accessible names. At overview zoom, genuinely overlapping hotels form explicit count markers that zoom into their members; grouped individual targets are hidden/inert, never moved to fake locations. Selecting a card zooms as needed to expose that hotel's real anchor. Initial fitting includes the hub and hotels. Selection/ordering retain renderer and keyed marker ownership, current/retired guards, focus, reference picking and reduced-motion behavior. Clicking a pin or card selects the same hotel in both views. A priced hotel binds its current representative eligible complete quote automatically; incomplete/unavailable hotels remain inspectable without an actionable fabricated price.

New hotel operations under existing showcase-v3 use the recorded source revision `hotel-directory-osm-2026-10-30`:301 actual mapped properties across all34 current destination cities, with3–14 genuinely verified properties per city. Source OSM object IDs, versions, timestamps, coordinates/footprint derivation, attribution/licence and corroboration URLs remain bundled and auditable. Exclude wrong-city, duplicate, private/staff/teacher, closed and airside-only properties. Unknown stars/address/check-in and service policies remain unknown. Real property geography does not establish real rates or availability: deterministic room/price inventory remains separately authored with its own provenance. No runtime lookup, API key, scraping or external hotel offer integration is added. Existing permanent OpenStreetMap contributor credit applies to the map and sourced geography; retain ODbL data licence documentation separately from application code.

Do not overwrite the original476 authored hotel rows or1428rate templates. Old roots, stored hotel searches/quotes/receipts, fingerprints and higher-version return evidence remain exact. New runs persist their full real-property/authored-rate source facts; recheck and confirmation reconstruct that recorded source while checking fresh current session/provider/mapping authority. Ordinary cached pre-directory discovery refreshes to the new source; a validated historical referral return retains its original compatible snapshot and quote. No schema/catalog/session migration or reset.

Default order remains lowest complete stay total. Other orders are stars, distance to actual arrival point, and distance to a selected point. Ties remain stars descending then total, distance ascending then total, then hotel ID; missing values follow known values. Fourth-sort reference selection happens directly in the same map, with immediate application, repeatable change-point action and Cancel preserving the old reference. Distances are explicitly straight-line kilometers, never street routing or driving time.

Square cards show hotel identity/stars, distance and the complete one-night price. Read-only room/occupancy/breakfast/cancellation/mandatory-fee/check-in facts remain available in the selected-hotel area, alongside the tracked provider action. Do not promise early hotel access from an early arrival. Quote recheck, changed-version consent, eligibility, exact handoff and return authority remain intact. Selection does not issue a booking.

**Hotel inventory defaults:** authored nightly inventory extends through day119 after the session anchor, with check-out allowed on day120 and every priced night covered. Room/adult/child/infant eligibility remains enforced. These are mock fixture policies, not claims about actual hotel operations. Current hotel/source data and immutable fixture versions are not rewritten for this UI change.

**Free-map implementation ruling:** retain official OpenStreetMap-hosted VersaTiles Colorful/Shadow styles through the pinned MapLibre SDK, loaded lazily when hotel discovery opens. No registration/key/billing or Google/Neshan integration. Keep OSM attribution, ordinary caching/Referer and on-demand requests without proxy/bulk prefetch. One active provider map is permitted inside the dialog; the background travel scene pauses. Explicit active ownership covers retained exits, late SDK loads, rapid reopen, style/context/resize and disposal. Network/WebGL failure keeps hotel cards and known-location reference choices usable with a truthful unavailable state, without a fabricated replacement map.

## 8. Sessions, optional login, and referrals

Guest search, comparison, hotel discovery, and referral are fully supported. Optional “Continue with Torob” establishes a local identity inside the same isolated session. No password, real OAuth, OTP delivery, or real personal information is needed.

**Owner profile refinement,2026-10-28 (decision0044):** account controls use a compact anchored nonmodal popover with keyboard/Escape/outside dismissal and focus return. Keep it within the viewport, with a sticky close/header and44px mobile close target; the underlying map stays active. A signed-in profile contains only user details and a danger logout button with an inline icon. Guest sign-in remains reachable. Remove all consumer saved-search presentation and saving actions, including existing-record lists; do not fetch unused saved records for the profile. Remove the profile appearance control; the toolbar theme action and local preference persistence remain. Existing server saved-search APIs and records remain intact for compatibility, without consumer entry points. Close/reopen, intent and session leases continue to fence identity mutations.

A provider click triggers a fresh quote check. An unchanged eligible quote proceeds. A changed total or material condition requires explicit acceptance of the new version. A sold-out/expired/incomplete quote cannot be handed off; show alternatives.

The server records one confirmed referral per idempotency key and returns a local handoff path. The simulated provider page shows the exact itinerary or hotel stay, party/rooms, provider, conditions, price version, and time of handoff. It has a clear return action and no fake purchase completion.

**Defaults:** quote expiry is 10 real minutes; referral acceptance intents expire after 2 real minutes. A confirm request validates the selected version and intent expiry. The same key cannot confirm a different payload. Referrals stay in the same browser tab so back navigation can restore context. Provider landing refreshes do not create extra referral clicks.

**Session defaults:** an opaque HttpOnly same-origin cookie; 24-hour inactivity expiry; demo/admin actions scoped on the server. The demo admin grants control only over its own sandbox. Reset cancels active work and clears that session's overrides, saved searches, searches, and referral evidence; immutable base fixtures remain. Another reviewer's data cannot be read or changed through guessed IDs.

**Expiry-collection ruling,2026-10-29 (decision0045):** authentication enforces the24-hour inactivity cutoff immediately; physical garbage collection is separate. Collect at most one oldest expired session per bounded transaction, skipping a concurrently locked owner, with25s SQL/30s transaction/2s acquisition deadlines. The existing startup pass and periodic maintenance drain the backlog incrementally instead of repeatedly rolling back an unbounded sweep. Live scopes and immutable evidence retain their existing isolation and recovery semantics.

## 9. Mock data and scenarios

Use two layers: hand-authored showcase records with meaningful tradeoffs and deterministic generation of surrounding inventory.

- Six authored providers with production-style names, overlapping capabilities and distinct raw payload shapes.
- All six domestic/international × flight/train/bus combinations.
- A curated city/connection network; every selectable destination has complete hotel coverage.
- Multiple services on popular dates and at least three provider offers for main showcase itineraries.
- Approximately 12–20 hotels per showcased destination with several room/rate options.
- Stable prices for an unchanged query and fixture/scenario revision.

**Catalog defaults, amended2026-10-29 (decision0052):** current`showcase-v3/catalog-v3` has12Iranian and22international cities,114places,348directedconnections,476hotels and1428roomtemplates. Twelve distinct services per route/class have four seller quotes across ordinary90-day dates; reserve periodic empty/gap behavior for explicit scenarios rather than normal inventory. Include156domestic directions between non-Tehran cities, with explicit Tehran rail transfers where applicable. Keep the six hero searches and the distant cities introduced in0049, including authored1/2/3-stop flight alternatives and hotels. Do not invent direct Tehran long-haul services, cross-ocean ground routes or unsupported continuous trains. Regional international rail beyond Van explicitly supplies a required Van–Tatvan road connector between trains, both matching transfer facts, chronology and a complete single-provider fare; protection/baggage/meal/cancellation remain unknown. Baku is air-only in newv3 under current sourced land-border restrictions. Preserve local/UTC/date-line coherence, realistic relative class/distance/time pricing and physically valid return timing. Services, schedules, gross prices, conditions and hotels remain authored mocks, not current operating-route claims.

Public MrBilit/Alibaba/Flytoday cards inform route/class price bands, bus seat layouts, rail saloon/4/6-berth distinctions, elapsed times, airport changes and material conditions. Record query dates, passenger/cabin/trip context, currencies, sold-out states and inconsistent reported data; never treat a sold-out fare, calendar shorthand or suggested separate tickets as an available complete quote. No exchange-rate guess or runtime provider access. Multioperator fares retain unknown protection/baggage conditions. Optional materialTerms pass through all six raw dialects; absence preserves the old normalization result. Whole-party totals, unknown fees, eligibility, versioned quotes and referral semantics remain authoritative.

The prior`showcase-v1/catalog-v1` and`showcase-v2/catalog-v2` sources, raw payloads, normalized evidence, policies and hotel templates remain frozen. New sessions usev3; old sessions and persisted searches/quotes stay on their own root. Seed all three complete versions insert-only and atomically; reseeding preserves payloads and timestamps. Keep original geographic features and36legacy winding road paths while appending new destinations and route geometry. Research and asset source records are technical documentation, not visible demo labels.

**Rich-calendar scale ruling,2026-10-29 (decision0052):** retain normal provider/job deadlines and full authored inventory. Persist bounded atomic normalization batches and small provider/coverage progress without repeatedly repricing the full ledger. Valid date cells stay checking until the one terminal atomic pricing projection, while invalid/outside-coverage cells remain explicit. That projection reuses the single eligibility evaluation per source entry with its original committed observation and immutable quote preference; IDs, whole-party totals, unknowns and timestamps stay exact. Bulk-insert only missing quote versions, never update existing evidence. Time-zone validation may cache exact native Intl validity in a bounded128entry cache without changing validation/errors or canonicalizing values.

The existing52-airline/156-PNG library remains intact. Add23authentic ground identities (9rail,14bus),69transparent32/64/128PNGs sourced from observed marketplace-hosted originals and optimized locally. Exact mode-scoped identities and neutral unknown/error fallback avoid unrelated branding; provider identity cannot select an operating logo. Preserve names/marks together, hashes, transformations, dates and retained rights in manifests/READMEs. No blanket open license, operating certification, availability or partnership is implied. Legacy presentation aliases retain their original technical evidence.

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

**Rich-inventory storage ruling,2026-10-29 (decision0052):** snapshot-only REST/internal reads share comparison-parent guards, scope locking and an atomic snapshot/cursor with replay, but skip decoding discarded history. Projection quote reads use the same session and the exact already-loaded owned offer IDs, retaining all versions and immutable payloads; no offers means no quote read. Provider date chunks remain bounded by32rows/4MiB and preserve cancellation, row-hook fallback and partial committed evidence.

Core backend modules: sessions, catalog, providers, searches, date-prices, hotels, referrals, saved-searches, and admin. One backend process executes bounded searches. Persisted logs/snapshots support audit and reconnect, not a distributed event-sourcing platform.

REST creates queries and performs mutations. SSE sends provider status, versioned result snapshots, and terminal search state. Event IDs are ordered per search. A snapshot endpoint recovers from gaps. REST polling is a fallback when streaming repeatedly fails. Completed streams close. New queries cancel superseded work where possible, and clients always reject events belonging to a different generation.

On API restart, persisted completed searches remain inspectable. Previously running searches become interrupted and can be explicitly retried. Do not pretend an in-memory job resumed. Each retry creates a new search ID linked to its predecessor.

Same-origin gateway routes / to web, /admin to admin, /api to NestJS, and /provider-demo to a web route. It serves static assets with correct SPA fallbacks and forwards SSE without buffering.

## 12. Rendering, design, and accessibility

**Owner identity selection, 2026-10-29 (decision0050):** adopt Compact Loop with
two Torob-inspired leaves. Its rounded arch and connected hollow endpoints use
semantic brand red/green with a charcoal wordmark on light surfaces and an
entirely white mark/wordmark on dark surfaces, independent of transport hue.
Share vector geometry and outlined Persian/English wordmarks across consumer,
admin and locally bundled production logo/favicon/install/share assets. Keep
home links accessible, correct root/admin paths and manifest scopes, and honest
deployment/offline semantics. This presentation change does not alter the
comparison/referral product or milestone status.

Use React Aria primitives, custom CSS Modules, and semantic CSS variables for all authored UI colors, SVG fills/strokes, chart colors, focus states, and shader uniforms. Avoid hardcoded component colors. Transport × appearance yields plane blue, train green, and bus red in dark/light versions. The canvas and surface families carry the transport hue: very dark blue for flights, dark green for trains, dark red for buses, with corresponding restrained light palettes. Admin uses the shared neutral/blue token family.

**Owner intro/price-label adjustment, 2026-10-28:** remove the intro subtitle; align the main title and suggested-trips control at their vertical centers in one compact row. Keep each minimum/maximum label attached to its own numerical price with a small explicit gap and bidi isolation; narrow layouts may stack complete pairs.

**Owner account/card/light refinement,2026-10-29 (decision0051):** remove the toolbar comparison tagline while preserving the accessible brand/home link. Use a circular identity/avatar trigger and full-width danger logout with inline icon; profile contains identity/sign-in/out only. Selected-card logical leading emphasis stays outside its contents without moving the content. The transient shooting-star light shares the vehicle’s end fade and soft loop re-entry for allmodes and roundtrips; the already-drawn base route remains. Reduced motion hides the transient GPU light, matching static fallback. Preserve stops, facts, shared scene ownership and motion policy.

**Owner corner refinement,2026-10-28 (decision0044):** all authored CSS corner radii use shared semantic variables. Cards, buttons, fields, dialogs and segmented tracks/indicators apply native `corner-shape: var(--corner-shape)` with `squircle`; unsupported browsers retain the ordinary tokenized rounded radius. At the default root size, small/medium/large radii are10/16/24px. True circles, geographic markers and spinners explicitly retain the round shape; vendor-owned map styles stay intact. Native border/focus/shadow/overflow behavior is preserved without polygon clipping.

Local font defaults are Vazirmatn for Persian and Inter for English; verify and bundle font licenses. The visual reference is compact comparison UI with clear hierarchy, not a dashboard template. Density must not remove readable price conditions or focus targets.

**Owner layout adjustment,2026-10-26:** Compact the right-hand desktop controls through shared rows and reduced empty space without reducing font sizes. Origin/destination/class share a row; passenger counts and the search action share a row. Keep the date wheel/chart, required ages, errors and price provenance available. A normal desktop viewport should contain the default search controls with minimal scrolling; expanded requirements and result lists may extend the page.

A persistent app-owned WebGL2 renderer uses clipped views for transport maps and charts. Context/material/geometry resources are shared, not allocated per ticket card. **Owner’s free-map exception:** the on-demand arrival hotel view uses a separate MapLibre renderer inside its native dialog, with at most one active provider map and complete cleanup on dismissal. It does not create another app-owned renderer or alter the transport scene. HTML owns labels, controls, forms, calendars, dialogs, and selectable information. App WebGL handles dotted transport geography, routes, vehicle progress, chart emphasis, and selected flat effects.

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

**Owner transition adjustment, 2026-10-28:** vehicle mode changes smoothly interpolate all resolved semantic palette tokens over approximately 760ms through the existing CSS/GPU bridge, without a circular reveal. Interrupted changes continue from the displayed palette. Light/dark keeps a circular reveal centered on the toggle, slowed to approximately 780ms after the graphics flush. Initial load, reduced motion, hidden/inactive owners and forced-color palette fallback settle directly. Unsupported View Transition browsers apply appearance directly. Loading applies the stored/system theme before the first visible frame. Decision0038 records lifecycle and ownership boundaries.

Use on-demand rendering outside explicitly active animation. The owner-requested desktop map ambience permits a visible animation loop through the existing scheduler; suspend covered/hidden/document-hidden scenes and all continuous motion under reduced motion. Dark palettes use very dim shaded blue/green/red backgrounds with semantic gradient haze, rather than a bright solid fill. Default DPR caps are 1.75 desktop and 1.5 mobile, with a lower-quality tier. Context loss or unavailable WebGL produces a static map/route or textual timeline and an SVG price chart; all selections remain available.

**Owner continuous-motion refinement,2026-10-29 (decision0046):** scope particles blend into each destination dot's live random-looking path and lifetime, matching arrival position and terminal velocity. Decision0047 shortens the transition to2s. Every start delay is zero; independently seeded travel covers54–86% of the window (arrivals1.08–1.72s), followed by a complementary12% handoff. All handoffs finish by1.96s. Source particles retain their float; interrupted transitions snapshot the actually displayed field and resume bounded residual wander. Pointer movement creates restrained local light; decision0048 replaces cursor-centered positional repulsion with evolved GPU fluid momentum and slow return; named cities, routes and borders remain anchored. CPU snapshots and GLSL use the same motion and pointer field, with zoom-aware neighborhood bounds, existing visibility/reduced-motion policies and one scheduler. This supersedes frozen landing followed by restarted float.

**Owner scope/glow refinement,2026-10-29 (decision0047):** pointer interaction uses a broad stroke radius up to110CSSpx, capped at20% of viewport width/22% of height, separately from the48px illumination trail. Decision0048 supersedes radial distance maintenance with GPU fluid motion. Displacement remains bounded to12CSSpx and the complete5×5 neighborhood support. Geography, decorative major-city points and morph points share smooth seeded random-looking glow in0.58–0.80; pointer lift is bounded to0.90 with final geographic alpha capped0.94. Decorative tints use semantic dot/route colors instead of near-white highlight, preventing an isolated geography dot from becoming a white hotspot. Semantic selected-city/stop/vehicle/route markers keep their intentional emphasis. The static fallback uses restrained geographic colors too. Preserve device-qualified bloom and the single renderer/scheduler.

**Owner GPGPU-fluid refinement,2026-10-29 (decision0048):** geographic dots follow a real GPU fluid and Lagrangian displacement field. Cursor strokes inject directional momentum and signed eddies; stationary input adds no force and there is no pointer obstacle/exclusion circle. Low-resolution aspect-preserving ping-pong HalfFloat targets (max128px edge,8targets/≤1MiB steady state) run velocity advection/damping, curl/vorticity, divergence,6pressure iterations/projection and integrated particle displacement/velocity. Seeded per-dot modulation follows the evolved field, carrying motion after input stops and gently returning toward the current random floating path with a3–4s spring. This is a sampled GPU flow/displacement grid, not a CPU update for every particle.

The field reprojects through actual absolute-geographic camera frames. Land, decorative major-city dots and live morph endpoints share its state/clock; selected route/city anchors remain canonical. CPU bilinear snapshots include the same displacement, with one bounded Float32-copy/readback only during an actual scope/projection interruption (≤.25MiB additional target). Ordinary frames and pointer strokes perform no GPU readback. The existing12CSSpx/complete5×5-neighborhood cap remains. One shared renderer/scheduler owns compute and draws, preserving physical/logical viewport/scissor including HiDPI, current target/face/mip, clear and XR/debug settings.

No targets/compute are created before a genuine stroke. A verified negligible tail sleeps after18active seconds of quiet; covered/hidden pauses, reduced motion clears, context recovery restarts safely, and unsupported/failed float compute falls back to the ordinary living map. Scope/border transitions,2s simultaneous particle departure and bounded glow remain. StrictMode setup/cleanup must acquire a live engine without leaking or retaining a permanently disposed instance. No runtime physics dependency is added.

**Owner adaptive-bloom refinement,2026-10-29 (decision0045):** use pinned pmndrs `postprocessing`6.39.5 BloomEffect for a restrained map-only glow on eligible devices. Preserve the normal map draw and add emitted light inside the same saved viewport/scissor, using one bounded local HalfFloat target (≤1024px edges and786432 pixels), then restore all renderer state. Charts, DOM labels, transparent page blending and hotel MapLibre remain isolated. No EffectComposer canvas resize, extra renderer or persistent scheduler is introduced. All colors originate from semantic scene tokens; semantic intensity/threshold tokens control the effect.

Qualification uses actual steady submission cadence, CPU submission and asynchronous non-disjoint GPU elapsed measurements when available, after shader warmup. A healthy baseline permits a bounded live effect trial; sustained good measurements enable it. Current defaults:24 warmup frames and90 steady samples per phase; p90 cadence≤23ms, CPU≤8ms, GPU≤10ms when available. GPU values expire after2 seconds of active sampling; an unverified trial ends within5 active seconds. Unsupported/software/low-quality paths retain the ordinary brighter map. Hidden/covered/reduced/mobile owners do not run the effect; sustained poor delivery or failed effect initialization disables it without repeated oscillation. Release targets/passes on degradation, context loss and unmount; context restoration requalifies. Timer queries are sparse, bounded, nonblocking and never nest another owner's query. Hardware identification alone is insufficient to enable the effect. Record device/browser/DPR, baseline and effect trials and startup stalls separately; submitted frame cadence is not a claim of physical display presentation FPS.

**Owner content-motion adjustment, 2026-10-28:** reserve skeleton space during initial/provider/hotel/referral loading. Animate replacements, selected seller rows and details with finite fade/up/collapse transitions. Stable exact-price keys support list insertion, removal and position changes; obsolete exits become inert and hidden immediately. Preserve expanded state, keyboard focus, scroll anchors, comparison/referral authority and session fencing through coverage/reduced/hidden changes. Foreground dialog content owns motion while its page is covered, retaining suspension/disabled/global motion policy. No new persistent renderer loop is added.

**Owner large-list refinement,2026-10-30 (decision0054):** when more than24 exact-price cards are visible, use browser-native `content-visibility:auto` with remembered intrinsic block sizes. Retain every card in the DOM, its exact key, expanded details, focus and scroll anchors. Unsupported browsers retain the ordinary full list. Long lists use one finite replacement/reorder fade instead of individual row layout projections; small lists retain individual entry/reorder motion, and disclosures retain finite height transitions. Memoize stable projections, whole rows, motion-policy values and bounded locale formatters, while rechecking live quote/owner authority on every action. Interrupted initial disclosure effects resume their visible progress under development StrictMode.

**Owner vehicle/filter text refinement,2026-10-30 (decision0058):** mode-dependent segmented options ease their intrinsic widths, opacity and small lift/blur so surrounding controls reflow without scaling text. Retiring options immediately lose native interaction and accessible authority; interruptions retain at most one previous option cohort and settle on the latest inventory. Preserve four aligned controls, native focus/selection and the measured indicator. Reusable whole-phrase transitions keep one current accessible Persian phrase and at most one inert decorative outgoing phrase; unchanged values never restart. Apply to meaningful control words, result/coverage headings, filter labels/counts/errors, empty states and the hotel destination prompt. Filter-overlay exits remain finite and inert, with per-open live action guards. Keep typed/native values, caret/IME, native select options, monetary facts and all ticket-row text immediate. Use the existing Motion/policy system; GSAP adds no necessary capability here. Reduced/covered/hidden/disabled states settle without replay or another persistent scheduler.

Scrolling cards under a stationary pointer must not publish hover previews hidden by an explicit map pin. Keep unpinned hover, keyboard focus inspection, explicit selection, clearing and repinning available. The pinned route remains the presentation authority. This small pointer-inspection refinement avoids rerendering the entire search/map page during ordinary scrolling; it does not alter quote selection or referral eligibility. Record actual skipped contents and native interaction/cadence evidence separately from CSS support or source tests.

Target WCAG 2.2 AA behaviors through explicit audits: keyboard completion, visible focus, meaningful names, dialog focus/return, sufficient contrast, non-color-only status, and reduced motion. Mobile targets are at least 44 × 44 CSS px; compact desktop controls may have smaller visible surfaces while preserving practical hit areas. A test tool alone does not establish compliance.

**Performance defaults to measure:** 60 fps target during desktop interaction, low-tier target ≥30 fps; interaction latency <200 ms; normal scenario first useful result ≤1.5 s and complete results ≤3 s on the recorded reference setup. The provider concurrency and delay schedule must be authored to meet these normal-case targets. Initial route JavaScript target ≤350 KiB gzip; deferred graphics target ≤500 KiB gzip. Record hardware/browser/dataset; do not claim universal performance or reduce approved features silently to meet a number.

## 13. Packaging, verification, and handoff

Root pnpm docker:up runs build, startup, initialization, readiness checks, and prints the web/admin URLs. Default URLs are http://localhost:4300/ and http://localhost:4300/admin/; TOROBTICKET_PORT overrides the host port. Compilation happens inside Docker. A direct Docker Compose command is also documented for reviewers without local Node/pnpm. Services: gateway/static frontends, API, PostgreSQL, plus a one-shot migration/seed initializer. Readiness waits for a healthy database and successful initialization. Restart does not erase data.

**Owner development refinement,2026-10-30 (decision0053):** `pnpm docker:dev` adds an explicit Compose development override. Consumer/admin Vite and the TypeScript API watcher run inside Docker behind the same loopback Caddy origin, with independent root/admin WebSocket paths and custom-port support. Read-only source mounts update both applications and imported shared libraries automatically. API compilation resolves workspace aliases and serializes server replacement only after a successful emit; errors retain the last working process. Atomic replacement saves are watched. Dependencies, emitted output, caches and the shared generated Prisma client remain in Linux container storage; the runner prepares only a missing empty ignored host mountpoint.

Development and packaged modes retain the same selected project's database, cookies and completed evidence. Frontend Fast Refresh retains the comparison and admin context identity. Rerun development startup after dependency/lockfile, Prisma schema/migration or runtime-tool changes; committed migrations and idempotent seeds apply without authoring migrations or resetting data. Native notifications are the default, with an explicit polling fallback. Returning to `docker:up` removes only the selected project's labelled development frontend containers after packaged readiness. Normal shutdown preserves data; explicit reset remains separately documented and destructive only for the selected project.

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
- CSS corner shaping: https://www.w3.org/TR/css-borders-4/#corner-shaping
- pmndrs BloomEffect: https://pmndrs.github.io/postprocessing/public/docs/class/src/effects/BloomEffect.js~BloomEffect.html
- SSE: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- Prisma seeding: https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding
- Compose readiness: https://docs.docker.com/compose/how-tos/startup-order/

Library references were consulted during architecture selection on 2026-10-24. Validate exact package compatibility during T01. Geographic/catalog sources and asset licenses are gathered during their owning tasks.
