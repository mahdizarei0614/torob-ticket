# TorobTicket Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Read the companion specification first. This plan authorizes no deployment, application submission, real provider integration, or external messaging.

**Owner workflow override:** Superpowers is disabled through `2026-10-26T07:16:38Z` / `10:46:38 Asia/Tehran`. During that interval use native task-by-task subagents, independent reviews and ordinary project decision/evidence records; do not invoke plugin skills, tools, scripts, templates or frozen bookkeeping. The original workflow instruction above resumes only after that interval, subject to newer owner instructions.

**Goal:** Build a polished, self-contained Torob-style travel comparison demo that demonstrates product judgment, UI/UX quality, reliable full-stack engineering, and an evidenced AI-assisted development process.

**Architecture:** Option A: an Nx/pnpm TypeScript monorepo with React/Vite consumer and admin applications, a modular NestJS API, and PostgreSQL/Prisma. Providers enter one validated normalization/comparison pipeline. A shared Three.js/React Three Fiber/GLSL renderer supports the map and visual effects while HTML provides accessible interaction.

**Tech Stack:** Nx, pnpm, TypeScript, React, Vite, React Router, TanStack Query, React Aria, CSS Modules, CSS custom properties, Zod, NestJS, PostgreSQL, Prisma, Three.js, React Three Fiber, selected Drei utilities, Motion, @internationalized/date, Vitest, Testing Library, Playwright, Storybook, Docker Compose, Caddy.

**Spec:** [TorobTicket Product and Architecture Specification](../specs/2026-10-24-torobticket-design.md), revision 1.46, 2026-11-02 (pulsing date-price loading and finite pending-to-ready transitions; prior route-label, hotel-map, product and referral decisions retained).

**Plan state:** Approved. Date-loading motion follow-up COMPLETE. General route-label clearance follow-up COMPLETE. Hotel-map reliability follow-up COMPLETE. M1–M8 complete; **35/35 tasks complete; T35 COMPLETE.** Canonical source and independent final reviews, all selected release gates, the actual manual reviewer journey and scoped cleanup/preservation are recorded. Explicit bounded limitations remain; video recording, publication and application submission are separate follow-ups.

**Delivery location:** This outputs directory contains the user-facing source documents. On repository creation, copy the spec to docs/superpowers/specs/2026-10-24-torobticket-design.md and this plan to docs/superpowers/plans/2026-10-24-torobticket-master-plan.md. Preserve the revision, task IDs, and decision authority, and rewrite the Spec link to ../specs/2026-10-24-torobticket-design.md.

## Global Constraints

- Demo-only comparison and referral. No direct selling, payment, booking confirmation, real OAuth, real provider credentials, or invented conversion/revenue metrics.
- Guest search, comparison, hotel discovery, and referral are fully supported.
- Consumer Persian/RTL; admin English; Latin route codes explicitly LTR.
- Domestic/international × flight/train/bus; one-way and round-trip; no multi-city or mixed-mode queries.
- Prices are eligible whole-party totals with known mandatory charges; round trips are complete same-provider offers.
- Wheel for nearby-date exploration; calendar for jumping ahead; chart shows minimum eligible offers by date, not historical prices.
- Cheapest is the initial sort. Ranking and referral revenue are independent.
- Fixed left desktop map; no main travel map below the specified breakpoint; mobile hotel location picker remains available.
- All UI animations are flat except shallow map/route depth. Vehicle completion means referral, never booking.
- All authored UI colors, SVG fills/strokes, chart colors, focus states, and shader uniforms use semantic CSS variables.
- Mandatory app-owned WebGL/GLSL visual system with semantic HTML fallbacks. Owner’s 2026-10-26 hotel-map exception uses official OSM vector styles with on-demand MapLibre GL JS, without an account or API key; keep a list/coordinate fallback and pause the transport renderer.
- One-command Docker startup; locally bundled runtime assets; no runtime external service or LLM requirement.
- Mock seeds, clocks, scenarios, and mapping revisions are reproducible; reviewer mutations are isolated on the server.
- Exact dependency versions are pinned after compatibility verification in T01. No version number in an unchecked example is an installation instruction.
- Preserve source provenance and unknown data; never infer missing taxes, baggage, cancellation, availability, or partner access.
- Scope changes update the specification and this plan before implementation continues.

## Review Focus

These five failure classes must have owning tests, not just prose:

1. Local midnight, Jalali leap/month boundaries, overnight arrival, and same-day valid returns: preserve the traveler's intended day and actual segment order. Owners T03, T07, T16, T20.
2. A late/reconnected provider event races a changed query or frozen result list: never replace the active search or silently change the user's selected quote. Owners T09, T15, T17, T28.
3. Cheaper-looking but incomparable offers: mixed money units, missing mandatory totals, different airport/class/baggage, incomplete round trips, and insufficient hotel occupancy must not win comparison. Owners T03, T06–T08, T10, T20.
4. Another reviewer, a guessed resource ID, a repeated click, or a stale acceptance intent: isolate sessions and prevent duplicated or incorrect referrals. Owners T04, T11, T22, T23, T26, T30.
5. Context loss, reduced motion, small screens, or a modal over the shared canvas: keep forms/keyboard use functional, release GPU resources, and restore the user's prior state. Owners T12–T14, T18, T21, T27, T31–T32.

## 1. Locked decision register

This table is the implementation index of the complete decisions in the companion specification. Defaults are identified separately in section 2.

| ID | Agreed behavior | Owning tasks |
|---|---|---|
| D01 | Independent demo, compare/referral only; tracked clicks; no paid ranking | T11, T22, T26, T34 |
| D02 | Nx, two React/Vite apps, modular NestJS, PostgreSQL/Prisma; Option A selected over Next.js | T01, T04, T29 |
| D03 | Persian/RTL consumer, English admin, LTR codes, Jalali-first dates | T03, T12, T15–T17, T23, T31 |
| D04 | All six mode/scope combinations; supported network; preserve compatible inputs | T02, T05, T15, T30 |
| D05 | One-way/round-trip, party eligibility, complete same-provider return fares | T03, T06–T07, T15, T20 |
| D06 | Equivalent journeys grouped; fare variants and unknown conditions preserved | T06–T08, T17, T25 |
| D07 | Cheapest/fastest/fewest stops-or-transfers with deterministic tie breakers | T08, T17 |
| D08 | Factual explanations, truthful coverage, one meaningful contextual suggestion | T08, T10, T17 |
| D09 | Progressive collection; freeze order on interaction; explicit updates; recheck referral | T09, T11, T17, T22, T28 |
| D10 | Wheel previews then settles; chart linked; calendar applies; stale queries discarded | T10, T15–T16 |
| D11 | Date prices share eligibility; fixed opposite return leg; missing prices are gaps | T03, T07, T10, T16 |
| D12 | Fixed display-only desktop dotted map, start→end title, selected endpoints/stops only, explicit ticket pin, stable camera | T13–T15, T18 |
| D13 | Arced flight/double rail/curved road, staged stops, glass vehicles and light strand; separate referral authority | T14, T18 |
| D14 | Hotel modal/full-page modal, state restoration, arrival-local stay dates | T20–T21 |
| D15 | Eligible whole-stay/room totals, four sorts, mode-aware arrival point, custom point | T20–T21 |
| D16 | Hotel dates independent; early check-in caveat; direct hotel referral | T20–T22 |
| D17 | Guest path; optional explicitly simulated Torob identity and saved preferences | T04, T19, T22 |
| D18 | Six fictional providers, authored showcase cases, seeded surrounding inventory | T05–T06, T20 |
| D19 | Normal/slow/failed/changed/sold-out/conflicting/empty cases, controllable per reviewer | T05–T06, T09, T11, T23, T28 |
| D20 | Real admin provider, matching, search, and referral evidence; meaningful mutations | T23–T26 |
| D21 | CSS variables throughout six palettes; GLSL beyond map; flat animation; reduced motion | T12–T14, T16, T21, T27, T31–T32 |
| D22 | Local assets, one-command start, immediate reviewer access, optional tour/presets | T05, T15, T23, T29, T33–T34 |
| D23 | Real simulated provider handoff with exact payload; no purchase completion | T11, T22, T26 |
| D24 | AI-assisted creation/evaluation evidenced honestly; deterministic runtime comparison | T08, T25, T34 |
| D25 | No deadline shortcut; measurable visual, behavioral, accessibility and performance gates | T30–T35 |

## 2. Explicit implementation defaults

These fill implementation holes. They may be tuned with evidence and a documented decision; they are not silently attributed to the user.

| Area | Initial value or rule |
|---|---|
| Party | One adult; total ≤9; at least one adult; infants ≤adults; provider-owned age rules |
| Date horizon | 90 departure days, day zero through day 89; valid same-day returns allowed by timetable |
| Wheel | Five visible rows; 250 ms settle target; pointer cancellation restores committed date |
| Desktop map | Width breakpoint 1120 CSS px; approximately 46% of content width |
| Vehicle states | 0%, 35%, 70%, 100% for endpoints/comparison/selection/referral |
| Suggestion | ±3 days; saving ≥10% and ≥200,000 toman, or ≥90 minutes faster for ≤10% extra |
| Mock catalog | 12 domestic +10 international cities; six hero searches; 12–20 hotels per covered destination |
| Normal delays | P01 150 ms, P02 300 ms, P03 450 ms, P04 600 ms, P05 900 ms, P06 1200 ms |
| Failure timing | Slow 2400 ms; provider deadline 3500 ms; search deadline 5000 ms |
| Concurrency | Maximum two provider operations per search; two active searches per session |
| Quote lifecycle | Quote TTL 10 real minutes; recheck acceptance intent TTL two real minutes |
| Session | Opaque cookie, 24-hour inactivity expiry, explicit session-only reset |
| Local entry point | http://localhost:4300/ and /admin/ by default; TOROBTICKET_PORT overrides the host port |
| Hotel sorts | Stars descending; distance ascending; secondary stay total, then hotel ID |
| Hotel inventory | Nights through anchor day 119; checkout through day 120; one adult per room under mock policies |
| Theme motion | 260 ms reveal; reduced motion and unsupported API use direct update |
| Graphics | WebGL2; shared clipped views; DPR cap 1.75 desktop /1.5 mobile; adaptive low tier |
| Fonts | Locally bundled Vazirmatn and Inter, with licenses |
| Performance | Reference desktop 60 fps target; low tier ≥30 fps; interaction <200 ms; first useful normal result ≤1.5 s; normal completion ≤3 s |
| Bundles | Initial route JS ≤350 KiB gzip target; deferred graphics ≤500 KiB gzip target |
| Walkthrough script/rehearsal | Target 4:30, always below five minutes; video capture is a later deliverable |

Initial implementation uses one API instance. In-process search work is bounded and persisted snapshots survive restart; interrupted work is retried as a new search. There is no Redis, separate queue, microservice, external tile server, or live LLM in this release.

## 3. Project and file ownership

Paths in this plan are repository-relative planned paths. They do not describe files that already exist. The repository itself is created only when implementation starts.

~~~text
apps/
  web/src/                 Consumer routes, feature composition, demo handoff
  admin/src/               English admin routes and inspection tools
  api/src/                 Nest modules and application orchestration
libs/
  contracts/src/           Zod wire schemas and public DTOs
  domain/src/              Pure normalization, matching, ranking, money/time rules
  fixtures/src/            Versioned catalog, raw examples, seeded inventory
  provider-adapters/src/   Mock provider adapters and transport boundary
  data-access/src/         Prisma repositories and scoped persistence
  client/src/              Typed HTTP/SSE client and cache keys
  ui/src/                  Tokens, headless primitives, shared styling
  graphics/src/            Shared renderer, projections, scenes, GLSL
tests/e2e/                 Playwright project; not a fourth shipping application
prisma/                    Schema, migrations, seed entry point
assets/                    Local geographic/font/art source assets and provenance
tools/                     Build, seed, verification, packaging and measurement scripts
infra/                     Dockerfiles, Caddy config, init/health scripts
docs/                      Decisions, evidence, AI work log, walkthrough
~~~

Nx tags use scope:web/admin/server/shared and type:app/ui/graphics/domain/contracts/data/fixtures/provider/test. Contracts may import no application/domain/runtime code. Domain may depend on contracts and date utilities only. Browser projects may depend on client, UI, graphics, contracts, and browser-safe pure helpers, never data-access/provider-adapters. Shared code never imports an application. Fixtures and adapters are server/test-only. Keep package versions aligned and enforce these rules with ESLint.

Domain unit tests construct small cases in libs/domain/src/testing and do not import the fixtures project. Fixtures may import domain utilities; provider/API/e2e integration tests may use both. This prevents a domain → fixtures → domain cycle. Provider-specific raw decoding lives in provider-adapters and produces the domain-owned DecodedProviderRecord; domain normalization never imports an adapter. Pure clock interfaces live in domain, with runtime implementations in API. ProviderContext is filled by the API and does not import SessionContext or any application code. Repositories accept their own DataScope containing the guard-resolved sessionId, not an imported API SessionContext. UI theme helpers accept callbacks; UI never imports graphics to synchronize a transition.

### Public contracts owned by T02

The actual source must define and export every named type below. This inventory fixes names and wire semantics; implementations may split files further without changing ownership.

| File | Exports / responsibility |
|---|---|
| libs/contracts/src/common.ts | Mode, Scope, TripType, LocalDate, Money, GeoPoint, Party, Coverage, DataIssue, ISOInstant |
| libs/contracts/src/catalog.ts | CatalogSnapshot, ProviderCapabilities, supported city/place/connection/class metadata |
| libs/contracts/src/search.ts | TransportSearchQuery, EligibilityFilters, SortOrder, SearchRequest, SearchSnapshot, SearchStatus, SearchEvent, ProviderStatus |
| libs/contracts/src/offer.ts | Place, Segment, JourneyLeg, Itinerary, FareConditions, NormalizedOffer, QuoteSnapshot, ComparisonGroup, Explanation, Suggestion |
| libs/contracts/src/date-prices.ts | DatePriceQuery, DatePriceCell, DatePriceSnapshot |
| libs/contracts/src/hotel.ts | HotelSearchQuery, Hotel, RoomRate, RoomAllocation, HotelQuoteSnapshot, HotelSearchSnapshot |
| libs/contracts/src/referral.ts | ReferralSelection, ReferralIntent, RecheckResult, ConfirmReferralInput, ReferralReceipt |
| libs/contracts/src/admin.ts | DemoScenario, CreateDemoSessionInput, SessionInfo, RawProviderRecord, NormalizationTrace, MappingPatch, MappingPreview, AdminSearchDetail, ReferralMetrics |
| libs/contracts/src/saved-search.ts | SavedSearch, SaveSearchInput, DemoIdentity |
| libs/contracts/src/index.ts | Public exports only; no Prisma models or backend classes |

Required shape details:

~~~ts
type Mode = 'flight' | 'train' | 'bus';
type Scope = 'domestic' | 'international';
type TripType = 'one-way' | 'round-trip';
type SortOrder = 'cheapest' | 'fastest' | 'fewest-connections';
type LocalDate = string; // validated YYYY-MM-DD Gregorian wire value
type ISOInstant = string; // validated UTC ISO instant
type Money = { amountRial: number; currency: 'IRR' }; // nonnegative safe integer
type GeoPoint = { latitude: number; longitude: number };
type Party = {
  adults: number; children: number; infants: number;
  childAges?: number[]; infantAgesMonths?: number[];
};
type TransportSearchQuery = {
  mode: Mode; scope: Scope; tripType: TripType;
  originCityId: string; destinationCityId: string;
  departureDate: LocalDate; returnDate?: LocalDate;
  party: Party; classCode: string; filters: EligibilityFilters; sort: SortOrder;
};
type SearchRequest = { query: TransportSearchQuery; clientGeneration: string };
type SearchStatus = 'collecting' | 'complete' | 'partial' | 'empty' |
  'failed' | 'cancelled' | 'interrupted';
type SearchEvent = {
  searchId: string; sequence: number; clientGeneration: string;
  type: 'provider-status' | 'snapshot' | 'terminal';
  payload: ProviderStatus | SearchSnapshot;
};
type ReferralSelection =
  | { kind: 'transport'; quoteId: string; quoteVersion: number }
  | { kind: 'hotel'; quoteId: string; quoteVersion: number };
type ConfirmReferralInput = {
  intentId: string; acceptedQuoteVersion: number; idempotencyKey: string;
};
~~~

The source schemas must discriminate event type/payload together; the abbreviated inventory above is not permission to accept an incorrect payload. Use schema inference rather than manually maintaining duplicate wire interfaces. CatalogSnapshot includes fixtureVersion, catalogRevision, cities, places, supported connections by mode/scope, class choices, and provider capabilities. Temporary provider outages do not remove a structurally supported route from that catalog.

EligibilityFilters contains optional budgetMaxRial, departureWindow with startMinute/endMinute, providerIds, operatorIds, maxStopsOrTransfers, checkedBaggageMinKg, and refundableOnly. Define whether an absent filter differs from an empty list: absent/empty provider/operator lists both mean unrestricted and normalize to the same key. A departure window can cross midnight and constrains the outbound departure in its origin location's time zone. Round-trip labels explicitly say outbound; maximum stops/transfers applies to the complete-trip count and is labeled total for round trips.

Itinerary contains mode, origin/destination place IDs, outbound JourneyLeg, and an optional return JourneyLeg. A leg has ordered segments; stops identify connection/dwell/technical-stop/ground-transfer, wait minutes, and whether a vehicle change occurs. Segment timestamps use instants plus location time zone IDs. FareConditions retain per-leg differences. QuoteSnapshot includes quoteId, version, itineraryId, fareId, providerId, total, breakdown, completeness, eligibility, observedAt, expiresAt, and source/mapping/fixture revisions.

ComparisonGroup contains the itinerary, eligible quotes, incomplete-price offers, representativeQuoteId, and computed duration/connection counts. Explanation includes a reason code, numeric facts, baseline IDs, and coverage; the UI localizes text. Suggestion identifies the alternative, comparable baseline, delta, and dismissal scope.

DatePriceCell is a discriminated union: priced (minimum, supporting quote/offer references, coverage, observedAt), checking, no-match, outside-coverage, or unavailable (reason/retryability). Unavailable covers terminal retrieval failures or incomplete source prices; no-match requires adequate successful coverage. Unknown values are not encoded as zero or Infinity.

HotelSearchQuery contains destinationCityId, checkIn, checkOut, party, childAgesAtCheckIn when needed, rooms, sort (cheapest/stars/arrival-distance/location-distance), and optional arrivalPlaceId/customPoint. HotelQuoteSnapshot includes room allocation, total-stay breakdown, terms, version, expiry, and provenance. Hotel child ages are explicit local-stay values.

CreateDemoSessionInput optionally supplies a validated seed, anchorInstant, and scenario for a new sandbox. Without a cookie it creates a session; with a current cookie and no override it resumes. Conflicting overrides on an existing session require explicit reset and cannot silently replace its data. SessionInfo returns the effective seed, frozen demo clock, revisions, expiry, and simulated identity. Browser tests create fresh contexts and use this supported input; they do not require a hidden test-only production bypass.

### API and persistence contract

All application routes are under /api/v1. Health endpoints are /api/health/live and /api/health/ready. Same-origin session cookies authorize access; a request body or query parameter cannot select another session.

| Method / route | Purpose and response |
|---|---|
| POST /api/v1/demo/session | Create or resume reviewer session → SessionInfo |
| POST /api/v1/demo/reset | Reset only current session → SessionInfo |
| GET /api/v1/catalog | Mode/scope capabilities, cities, endpoints, places |
| POST /api/v1/searches | Validate SearchRequest → 202 with searchId and initial SearchSnapshot |
| GET /api/v1/searches/:id | Current SearchSnapshot, scoped to session |
| GET /api/v1/searches/:id/events | Ordered SSE; replay from Last-Event-ID; snapshot on gap |
| DELETE /api/v1/searches/:id | Best-effort cancellation; terminal cancelled state |
| POST /api/v1/date-prices | DatePriceQuery → cached snapshot or checking cells with poll cursor |
| GET /api/v1/date-prices/:id | Updated DatePriceSnapshot; close polling at terminal state |
| POST /api/v1/hotels/search | HotelSearchQuery → HotelSearchSnapshot |
| POST /api/v1/referrals/prepare | ReferralSelection → ready/changed/unavailable RecheckResult |
| POST /api/v1/referrals/confirm | ConfirmReferralInput → ReferralReceipt with local handoffPath |
| GET /api/v1/referrals/:id | Exact immutable handoff payload in current session |
| POST /api/v1/auth/demo-torob | Explicit simulation → DemoIdentity |
| DELETE /api/v1/auth/demo-torob | Return to guest; search context remains |
| GET/POST/DELETE /api/v1/saved-searches[/id] | Session identity-owned saved query intents |
| GET /api/v1/admin/providers | Session provider health summaries |
| PATCH /api/v1/admin/providers/:id | Scoped pause/latency/failure override |
| PUT /api/v1/admin/scenario | Select DemoScenario; invalidate current work explicitly |
| GET /api/v1/admin/searches[/id] | Paginated summary or detailed processing evidence |
| POST /api/v1/admin/searches/:id/replay | New search linked to predecessor, current mapping revision |
| POST /api/v1/admin/mappings/preview | MappingPatch → collision/impact MappingPreview |
| POST /api/v1/admin/mappings/apply | Apply valid revision; audit, do not rewrite old evidence |
| GET /api/v1/admin/referrals | Paginated trail and factual ReferralMetrics |

Errors have a stable code, localized-safe field paths, retryable flag, and requestId. Important codes: INVALID_QUERY, UNSUPPORTED_ROUTE, AGE_REQUIRED, SESSION_EXPIRED, NOT_FOUND, SEARCH_LIMIT, QUOTE_EXPIRED, QUOTE_CHANGED, OFFER_UNAVAILABLE, INCOMPLETE_PRICE, INTENT_EXPIRED, IDEMPOTENCY_CONFLICT, MAPPING_COLLISION.

Database entities: immutable FixtureVersion/Place/Hotel/RoomRate base records; DemoSession; session ProviderOverride and MappingRevision; SearchRun; ProviderRun; RawRecord; NormalizationDecision; OfferSnapshot; Quote; SearchEventRecord; DatePriceRun; HotelSearchRun; ReferralIntent; ReferralEvent; DemoIdentity; SavedSearch; AuditEvent. Session-owned rows carry sessionId and scoped indexes; unique constraints include session or the explicitly global immutable fixture key. Avoid copying the whole catalog for each reviewer. Raw records and versioned evidence are append-only.

Use explicit transactions for a quote version update plus event append, mapping revision apply plus audit, and referral confirmation plus idempotency record. The UI receives domain DTOs only. A startup reconciliation marks abandoned collecting runs interrupted.

### Interface ownership between tasks

~~~ts
// T03 — libs/domain/src/money.ts and time.ts
normalizeMoney(value: string | number, unit: 'IRR' | 'TOMAN'): Money;
toGregorianDate(value: string, calendar: 'persian' | 'gregory'): LocalDate;
elapsedMinutes(departure: ISOInstant, arrival: ISOInstant): number;

// T05 — libs/fixtures/src/generator.ts
generateProviderRecords(input: FixtureQuery): RawProviderRecord[];

// T06 — libs/provider-adapters/src/provider-adapter.ts
interface ProviderAdapter {
  search(query: TransportSearchQuery, context: ProviderContext): Promise<ProviderBatch>;
  dateInventory(query: DatePriceQuery, context: ProviderContext): Promise<ProviderDateBatch>;
  recheck(selection: ProviderQuoteSelection, context: ProviderContext): Promise<ProviderRecheck>;
}
// ProviderContext contains AbortSignal, session scenario/revision, fixture seed,
// demo clock, real clock, deadlines, and trace sink. Adapters never send SSE.

// T06 — libs/provider-adapters/src/raw-codecs.ts
decodeRawRecord(record: RawProviderRecord): DecodedProviderRecord;
// T06 — libs/domain/src/normalize.ts
normalizeRecord(record: DecodedProviderRecord, context: NormalizationContext): NormalizationResult;

// T07/T08 — libs/domain/src/comparison/
quoteOffer(offer: NormalizedOffer, query: TransportSearchQuery, context: ComparisonContext): QuoteEvaluation;
groupOffers(offers: NormalizedOffer[], query: TransportSearchQuery, context: ComparisonContext): ComparisonGroup[];
rankGroups(groups: readonly ComparisonGroup[], sort?: SortOrder): ComparisonGroup[];
explainGroup(group: ComparisonGroup, context: ExplanationContext): Explanation[];
chooseSuggestion(context: SuggestionContext): Suggestion | null;
// T08 contexts bind current filtered groups/query, exact quote IDs/versions,
// expected-provider/status evidence and frozen session/fixture/revision identity.
// Suggestions require matching all-success completed coverage; query sort is not price identity.
// Delta: amount=alternative-baseline; minutes=baseline-alternative; ratio=alternative/baseline.
// T09 supplies server-owned context and preserves referenced snapshots/versions/observations.

// T09 — apps/api/src/searches/search.service.ts
startSearch(session: SessionContext, input: SearchRequest, predecessorId?: string): Promise<SearchRecovery>;
getSearch(session: SessionContext, searchId: string): Promise<SearchRecovery>;
cancelSearch(session: SessionContext, searchId: string): Promise<SearchRecovery>;
retrySearch(session: SessionContext, searchId: string, clientGeneration: string): Promise<SearchRecovery>;
// SearchRecoverySchema binds {snapshot, sequence} atomically; SearchRequest optionally names supersedesSearchId.
// GET /:id/events replays Last-Event-ID; all paths use server-resolved cookie scope.
// T09 — libs/client/src/search-stream.ts
subscribeSearch(options: SubscribeSearchOptions): () => void;

// T10 — apps/api/src/date-prices/date-price.service.ts
startDatePrices(session: SessionContext, input: DatePriceQuery): Promise<DatePriceSnapshot>;
getDatePrices(session: SessionContext, id: string, view: DatePriceQuery | string): Promise<DatePriceSnapshot>;
cancelDatePrices(session: SessionContext, id: string, view: DatePriceQuery | string): Promise<DatePriceSnapshot>;
// POST /api/v1/date-prices; GET/DELETE /:id require clientGeneration.
// HTTP query view is canonical; generation remaps, quote observation/expiry never refresh.

// T11 — apps/api/src/referrals/referral.service.ts
prepareReferral(session: SessionContext, input: ReferralSelection): Promise<RecheckResult>;
confirmReferral(session: SessionContext, input: ConfirmReferralInput): Promise<ReferralReceipt>;
getReferral(session: SessionContext, id: string): Promise<ReferralReceipt>;
// POST /api/v1/referrals/prepare, POST /confirm; GET /:id is read-only.
// changed.previousQuote supplies old facts; intent.quote supplies accepted new facts.

// T20 — apps/api/src/hotels/hotel.service.ts
searchHotels(session: SessionContext, input: HotelSearchQuery): Promise<HotelSearchSnapshot>;
~~~

FixtureQuery belongs to fixtures. ProviderContext/ProviderBatch/ProviderDateBatch/ProviderQuoteSelection/ProviderRecheck belong to provider-adapters. DecodedProviderRecord/NormalizationContext/NormalizationResult/SourceFareEvidence/BoundSourceFareEvidence/ComparisonContext/ProviderFarePolicy/QuoteEvaluation/ExplanationContext/SuggestionContext belong to domain. These are not public wire contracts. DecodedProviderRecord retains rawRecordId and source provenance plus structurally decoded field candidates; normalizeRecord resolves identities, units, and conditions from those candidates. Malformed raw decoding also emits a persisted rejection trace. SessionContext is a backend-scoped type defined in T04. Each task must export the exact interfaces it owns before dependent work begins.

T07 implemented context: ComparisonContext supplies a real clock, places, explicit offer-to-raw/source bindings and authored provider fare policies. Missing evidence cannot produce eligible quotes. QuoteEvaluation retains eligible/incomplete/rejected outcomes and policy revision. T09/T11 must preserve each persisted quote ID/version's original observedAt/expiresAt while regrouping; a fixed original operation observation is supported, and combining operations requires reusing existing quote snapshots. Domain does not load stored versions or decode raw dialects.

T09 implements the contract-only subscribeSearch lifecycle and its default same-origin fetch transport. T10 implements searchKey/datePriceKey/hotelKey as browser-safe wrappers around shared pure identity logic. The remaining client composition helper is apiClient for typed REST. Committed search/filter state is URL-serializable. Hover, dragging, modal draft dates, pinned route, and staged result updates belong to typed UI reducers; animation frames do not round-trip through global React state.

T13 implements GraphicsProvider, GraphicsView, useGraphics/controller diagnostics and stable useThemeUniforms. UI publishes token subscribers before a generic beforePaint stage; no UI→graphics import. Children are arbitrary R3F nodes; declarative commits render automatically. Imperative changes use useThree(state => state.invalidate) or the host controller; package-global invalidate fan-out is outside this manual host. Motion is opt-in, and Activity suspends hidden/covered/offscreen callbacks. Required fallback/label and external semantic controls remain the scene author's responsibility. T21 owns native hotel-dialog composition; /graphics-lab is diagnostic only.

T14 implements RouteScene/RouteTimeline and LocationScene with canonical Place/Itinerary direction, explicit illustrative/empty seams, bundled dots/authored paths, shared ProjectionContext and fitKey/originKey camera intent. Public geometry includes projectPoint/unprojectPoint/projectRoute/fitRouteBounds/contextForPoints/buildRouteGeometry and progress helpers. Fetch `/geography/route-geometry.json` for authored-only geometry (36 ordered bus pairs, 326 canonical journeys checked); do not import fixtures into browser code or use lab schedules as search data. Keep projection fixed during previews; intentional context changes must accompany a deliberate fit/origin key. Camera overviews use the same projection, including seam fragments. LocationScene accepts destinationBoundary/landmarks/accommodations/customPoint and emits GeoPoint through onPointChange; mobile/DOM fallback remains usable. Rulings are recorded in docs/decisions/0014-dotted-route-scenes.md; /route-lab is diagnostic, with consumer binding T18; T21 uses the separately approved free street map for hotel selection.

T15 implements BrowserRouter consumer layout, SearchComposer and useSearchController in apps/web. The controller separates draft/preview/committed query and generation, exposes edit/preset/submit/reset, validity/accepted feedback and bounded-start capacity, and retains itinerary/modal seams. parseSearchUrl/serializeSearchUrl own canonical validated public intent; reload/history restore without selected-search POST and presets stay draft until Search. Runtime-validated apiClient currently exposes session/sessionSnapshot, catalog, reset, startSearch, snapshot and cancelSearch using actual SearchRecovery and POST cancel semantics. Date-price/hotel/referral methods are added by their feature-owning tasks using this transport pattern. A client-lifetime pool caps two unresolved starts across history/controller/QueryClient remounts; hold slots through stale cleanup and preserve the shared reset epoch. T16 must bind controlled date preview/settle without bypassing URL/generation/admission rules. Rulings: docs/decisions/0015-consumer-search-intent.md; detailed evidence: docs/evidence/T15/checkpoint.md. Real map binding, SSE/results and hotels remain T18/T17/T21.

T16 implements DateExplorer/DateWheel/DateCalendar in apps/web, PriceChartScene/shared day-spaced geometry in graphics and PriceChartFallback in UI. The browser-safe graphics/host entry owns the persistent host without eagerly importing Three.js. apiClient.startDatePrices/getDatePrices/cancelDatePrices use the existing T10 wire protocol; date-price semantic generations and original-observation cache freshness are separate from selected-search generations. Valid initial/history intent may retrieve inventory automatically, while selected searches require explicit Search or date commit. Preview, calendar month navigation and Cancel never authorize a selected search. commitDates uses the visible whole draft and may retain only one replaceable latest authorized intent under the shared two-start bound, with priority over passive retrieval. The controller-owned dateInteractions lease synchronously invalidates timers and provisional calendar drafts on history, edit, preset, commit, reset, leg change and unmount; preserve the external basis and lease when extending consumers. Expired/future complete receipts never appear current; mounted pricing expires at its original 60s boundary and the unmodified receipt may remain historical until explicit bounded refresh. Actual fixed-opposite-leg round-trip semantics and missing-price states remain authoritative. Rulings: docs/decisions/0016-date-exploration.md; evidence: docs/evidence/T16/checkpoint.md. T17 now supplies SSE/cards/staged adoption; actual map binding and hotel discovery remain T18/T21.

T17 implements ResultsPage/ResultsList/JourneyCard/ProviderOffers, ResultFilters, localized Explanation, useResults, the adopted/latest results reducer and bounded scroll-anchor helper in apps/web. It consumes the existing atomic SearchRecovery and subscribeSearch protocol; the server/domain still owns ranking, eligibility and factual claims. ResultsPageProps requires a live isCurrent() function. The controller exposes resultIsCurrent(expectedGeneration, expectedSearchId), previewResultItinerary(idOrUndefined, generation, searchId) and pinResultItinerary(id, generation, searchId); these authorize the exact accepted pair, separately from the ID retained for supersession. Do not replace that predicate with a rendered boolean or direct old-result reducer dispatch. QuoteSelection is {groupId, quoteId, version}; onSelectQuote receives the current exact quote and itinerary, with expiry/latest-authority safety. Initial collection adopts order; inspection stages later updates; explicit adoption retains a valid fare and DOM anchor. Filter Cancel/Escape/toggle/fresh opening restores committed conditions; Clear ignores discarded draft validation. Unapplied composer edits permit committed-result inspection but disable refinement. Original timestamps and immediate current-clock checks remain binding. Rulings: docs/decisions/0017-comparison-results.md; complete evidence: docs/evidence/T17/checkpoint.md. T18 owns real map binding, T21 hotel discovery and T22 referral/return context; query-only history/reload does not automatically create another selected search.

T18 implements TripMap/useTripMap/mapReducer and the consumer RouteTimeline/RouteDirectionControl. The API catalog owns City/Place support; accepted canonical itineraries own timetable facts. Display priority is hover, focused result, explicit pin, then unpriced draft illustration. Results preview callbacks carry `(itinerary?, source?: 'hover' | 'focus', leavingId?)`; forward all metadata under the live accepted-pair guard. The controller's `currentIntent()` advances synchronously through the same searchReducer/action path; map sends reconcile against it, preserving coherent same-turn committed inspection without granting obsolete operations access. Passive consumed quote intents cannot resurrect cleared choices; explicit same-fare reselection remains possible. Camera callbacks retain draft/fit/scene leases and saved logical intent; viewport frame changes do not authorize a fit. Consumer dots fetch only `/geography/consumer-geography.json`; authored paths remain non-navigation. Below1120px the map/portal unmount and the canonical DOM timeline remains. Repeated stops join by ordered occurrence plus known arrival/departure instants; unknown/conflicting/unmatched facts stay explicit. Future T22 calls `bindAcceptedQuote(previous,quote,itinerary)` only after ready or explicit changed-version acceptance, then supplies its actual server receipt to `confirmReferral`; exact quote/version/itinerary/current owner and original validity interval gate100. No completion simulator is implemented. Shared host/finite motion, same-basis historical inspection and portal behavior are documented in docs/decisions/0018-consumer-trip-map.md; complete evidence: docs/evidence/T18/checkpoint.md. T19/T21/T22/T27/T32/T33 retain their planned scope.

T19 implements AccountRepository, DemoAuthModule/SavedSearchModule and AccountPanel/useDemoAccount/DemoLogin/SavedSearches. Required migration `0003_demo_identity_state` adds DemoIdentity.signedIn; sign-out retains identity/saves, reactivation is idempotent, reset/expiry cascades the sandbox. Account authorization is rechecked under the same session row lock as mutation/read. Identity-required403 and saved-limit429 are explicit; signed-in peer IDs return404. Saves are normalized full TransportSearchQuery intent plus name/creation metadata, never quotes; canonical duplicates update names under a20-distinct cap. apiClient publishes authState/signIn/signOut/listSavedSearches/getSavedSearch/saveSearch/deleteSavedSearch with runtime schemas and same-origin single-send transport. The account hook is separate from bootstrap SessionInfo; do not replace that controller prop on auth updates. Methods have rendered operation/sandbox entry leases, explicit layout lifecycle publication for StrictMode and true-unmount fences. AccountPanel wraps child actions with dialog-cycle/date authority and exact provisional SaveTransaction identity; use fresh current render handlers, not callbacks stashed across ownership changes. `controller.openSavedSearch(query)` restores exact fields and uses normal admission for fresh prices, with invalid/capacity feedback and no implicit queue. Theme stays local/guest-accessible. Optional `Dialog.stickyHeader` defaultsfalse and AccountPanel opts in so its20-row mobile list retains Close/title while scrolling. Calendar/account coverage composes in the same host/map; T21 must add hotel coverage without replacing these owners. Guest comparison/referral remains unrestricted; actual handoff UI is still T22. Rulings: docs/decisions/0019-optional-demo-account.md; complete evidence: docs/evidence/T19/checkpoint.md.

T21 implements HotelEntry/HotelDialog/useHotelDiscovery and a typed startHotelSearch/getHotelSearch client over T20 HotelSearchSnapshot. Hotel stay/rooms/check-in ages remain independent from accepted transport intent. Current canonical selection supplies arrival-local suggestions; required arrival confirmation/one-way checkout and explicit trip-update acceptance preserve unknowns and user edits. Cards use complete all-room/all-night totals, exact source conditions and server ordering; local quote selection remains the T22 handoff seam. Actions bind lifecycle/view/action/edit/trip/picker authority; fresh search clears parent selection synchronously and rejected retained entry presses cannot mutate retained refs. Root/fresh review close R1/R2/F1/F2. Owner's final free-map override uses pinned MapLibre6.16.0 + official OSM vector Colorful/Shadow without keys/accounts. Only vendor SDK/CSS/local worker load on picker open; the small wrapper stays mounted so optional loading failure retains list/coordinates. One owned provider map is allowed while the original transport renderer pauses; cleanup tombstones old imports/listeners/markers/observers. Custom authored marker targets measure44px; vendor style/UI attribution is preserved. T21 is complete atdd09ee5 after actual OSM streets/Persian labels/native pin/theme-camera proof. A stable44px mobile disclosure/placeholder slot prevents preview clearing from moving the hotel action mid-press; expanded timelines keep natural height. Controlled SDK/offline checks remain distinct from the final live-map proof. Rulings: docs/decisions/0021-hotel-discovery-and-foreground-map.md; current checkpoint: docs/evidence/T21/checkpoint.md. T22 completion is recorded below.

## 4. Execution and tracking rules

- Each task below is independently reviewable; follow dependencies rather than assuming numerical order is mandatory.
- All tasks inherit global constraints and the full specification.
- Checkboxes are the detailed progress source. Parent status is TODO, ACTIVE, BLOCKED, REVIEW, or DONE; DONE requires its acceptance evidence, not just written code.
- Record implementation owner and evidence/commit links in the master table during execution. Do not insert invented hashes or test results now.
- Behavioral tasks start with a meaningful failing test. Reversible styling/content work uses visual inspection and existing behavioral coverage rather than tests that restate CSS.
- Each task ends with its focused checks and a small commit. Stage explicit changed files, not unrelated workspace changes.
- Do not start a dependent task against an undocumented interface change. Update the owning interface and its consumers together.
- Use one active integration owner. Isolated implementation branches/worktrees and subagents are execution choices, not created by this planning deliverable.
- Visual review gates inspect the actual running UI at the required widths; screenshots alone do not establish drag, keyboard, or referral correctness.
- Baseline fixture seed, demo clock, scenario, viewport, browser, theme, and motion preference are recorded with every reproducible visual/e2e result.

### Master task and subtask table

Each row indexes the detailed checkbox steps in section 6. DONE requires independent review and recorded verification evidence.

**Progress:** 35 tasks · 183 subtasks · 21 implementation tasks complete.

| Task | Subtasks | Dependencies | Status | Owner / evidence |
|---|---|---|---|---|
| [T01 — Runnable Nx foundation and dependency boundaries](#t01) | T01.1 Pin compatible tooling<br>T01.2 Create the minimal workspace<br>T01.3 Enforce imports<br>T01.4 Establish verification targets<br>T01.5 Verify and commit | None | DONE | implement_t01 / 6600079 + 6db0420; independent review clean; builds, PostgreSQL, browser smoke, boundaries and regressions passed |
| [T02 — Runtime contracts and stable API vocabulary](#t02) | T02.1 Pin invalid-input behavior<br>T02.2 Run the contract tests red<br>T02.3 Implement schemas and exports<br>T02.4 Wire validation and errors<br>T02.5 Verify and commit | T01 | DONE | implement_t02 / 17a9d91; independent review approved; 88 tests, HTTP validation, lint, typechecks and builds passed |
| [T03 — Money, local dates, party eligibility, and pure time rules](#t03) | T03.1 Specify arithmetic and boundary cases<br>T03.2 Run focused tests red<br>T03.3 Implement pure helpers<br>T03.4 Implement eligibility<br>T03.5 Verify and commit | T02 | DONE | implement_t03 / 932ded9; independent review approved; 85 domain tests and checks passed; process chronology disclosed in report |
| [T04 — Database, isolated demo sessions, clocks, and lifecycle](#t04) | T04.1 Pin isolation and persistence behavior<br>T04.2 Run integration tests red<br>T04.3 Create schema and scoped repositories<br>T04.4 Implement lifecycle and clocks<br>T04.5 Verify and commit | T02 | DONE | implement_t04 / a0d055e + f7d5552; independent review clean; PostgreSQL isolation, transactions, recovery and compiled health checks passed |
| [T05 — Curated catalog, geographic assets, and deterministic fixture generator](#t05) | T05.1 Define catalog invariants<br>T05.2 Run catalog tests red<br>T05.3 Author showcase data and source geometry<br>T05.4 Implement seeded generation<br>T05.5 Verify seeded inventory<br>T05.6 Review and commit | T03, T04 | DONE | implement_t05 / ebbb773 + 8081656; independently approved; fixtures30/PG26, immutable seed twice, packaged catalog/assets verified; docs/evidence/T05 |
| [T06 — Provider adapters, normalization traces, and controlled failures](#t06) | T06.1 Pin raw-format and fault cases<br>T06.2 Run adapter tests red<br>T06.3 Implement adapters and normalization<br>T06.4 Implement bounded scenario timing<br>T06.5 Verify and commit | T03, T05 | DONE | implement_t06 / 64ec3dc + 4b3f0ef; independently reviewed; domain97/adapters44/providerPG8, packaged migration/session/data preservation verified; docs/evidence/T06 |
| [T07 — Journey grouping, fare eligibility, and complete round-trip quotes](#t07) | T07.1 Pin comparable and noncomparable cases<br>T07.2 Run grouping tests red<br>T07.3 Implement stable identity and fares<br>T07.4 Implement full-party and round-trip evaluation<br>T07.5 Verify and commit | T03, T06 | DONE | implement_t07 / 4557af6 + 95db776; independently reviewed; domain151/adapters59, amended32 checks and packaged12-hero comparison/inventory preservation verified; docs/evidence/T07 |
| [T08 — Deterministic ranking, factual explanations, and bounded suggestions](#t08) | T08.1 Pin exact sort and suggestion thresholds<br>T08.2 Run ranking tests red<br>T08.3 Implement comparators and factual reasons<br>T08.4 Implement contextual suggestion selection<br>T08.5 Verify and commit | T07 | DONE | implement_t08 / 2241795; independent review approved; domain226, root tests, affected40 and packaged ranking/facts/suggestion pass; docs/evidence/T08 |
| [T09 — Search orchestration, persistent evidence, SSE, and recovery](#t09) | T09.1 Pin partial, race, and reconnect behavior<br>T09.2 Run orchestration tests red<br>T09.3 Implement bounded search runs<br>T09.4 Implement the stream and fallback<br>T09.5 Implement restart/cancel cleanup<br>T09.6 Verify and commit | T04, T06, T08 | DONE | implement_t09 / 4d6f595 + 40e1a14 + 3230073; independently reviewed; integration48/search16/client14, affected checks and packaged gateway/restart/audit/preservation pass; docs/evidence/T09 |
| [T10 — Consistent date-price projection and scoped caching](#t10) | T10.1 Pin date/result equivalence<br>T10.2 Run projection tests red<br>T10.3 Implement bounded projection<br>T10.4 Implement cache identity and invalidation<br>T10.5 Verify and commit | T09 | DONE | implement_t10 / 0a39241 + 3dd0d0a; independent spec/quality approved, no blocking findings; domain239/client17/API66, root12+tools20, affected34 and packaged equivalence/cache/isolation/restart/preservation passed; docs/evidence/T10; T10-M1 readability retained |
| [T11 — Recheck, quote versions, idempotent referrals, and handoff data](#t11) | T11.1 Pin changed-price and idempotency cases<br>T11.2 Run referral tests red<br>T11.3 Implement prepare and acceptance<br>T11.4 Implement atomic confirmation<br>T11.5 Verify and commit | T04, T07, T09 | DONE | implement_t11 / 3abdd5e + cb77ce2 + 301119d; independently reviewed, I1 closed by scoped re-review; integration81/amended53, root12+tools20, affected34/16 and packaged ready/change/soldout/idempotency/restart/preservation pass; docs/evidence/T11 |
| [T12 — Design tokens, accessible primitives, typography, and component gallery](#t12) | T12.1 Define the visual foundation<br>T12.2 Implement accessible primitives<br>T12.3 Pin interaction behavior<br>T12.4 Build the state gallery<br>T12.5 Verify and commit | T01 | DONE | implement_t12 / 6e0071c + 581f834; review clean; UI13 tests, browser28 audit/startup6/native race2 and builds passed |
| [T13 — Shared WebGL renderer, typed uniforms, and graceful fallback](#t13) | T13.1 Define lifecycle behavior<br>T13.2 Build the shared host<br>T13.3 Implement uniforms and scheduling<br>T13.4 Implement fallback and recovery<br>T13.5 Verify and commit | T12 | DONE | implement_t13 / 1b83a74 + e2c5df1 + e43bf0e; independent review/correction approved, I1/I2 closed; units8/browser10/final affected26, root12+tools20 and packaged GL/lazy/theme/modal/preservation pass; docs/evidence/T13 |
| [T14 — Dotted geography and mode-specific route scenes](#t14) | T14.1 Pin geographic and route invariants<br>T14.2 Run geometry tests red<br>T14.3 Implement map and route shaders<br>T14.4 Implement camera and location primitives<br>T14.5 Verify and commit | T05, T13 | DONE | implement_t14 / 92139d8 + 08acee9 + d79be42 + bc25aca; independent review P2 corrected and fresh review approved; graphics 22, initial affected 38 / correction 27, combined browser 15 + final route 6, Docker/production GL/bundle/data preservation pass; docs/evidence/T14 |
| [T15 — Consumer shell, search composer, URL state, and reviewer entry](#t15) | T15.1 Pin query and navigation behavior<br>T15.2 Run state tests red<br>T15.3 Implement shell and composer<br>T15.4 Implement state ownership<br>T15.5 Implement reviewer entry<br>T15.6 Verify and commit | T02, T04, T05, T12 | DONE | implement_t15 / 52f66c4 + evidence 5426f4d + correction 8c52bc4; independent P2 fixed and fresh review approved; web 21/client 23, affected 48, original browser 23/final composer 5, tools 20+cache; corrected Docker/production isolation/navigation/bundles/preservation pass; docs/evidence/T15 |
| [T16 — Date wheel, Jalali calendar, linked GLSL chart, and apply behavior](#t16) | T16.1 Pin preview/commit and date rules<br>T16.2 Run date tests red<br>T16.3 Implement the wheel and calendar<br>T16.4 Implement chart and cache wiring<br>T16.5 Verify physical interaction<br>T16.6 Review and commit | T03, T10, T13, T15 | DONE | implement_t16 / source 4ba35d8 + evidence 1525c60 + correction 310a882 + report 8f4a340; three independent P2 findings fixed and fresh review approved; web46/client25/UI16/graphics22, affected48, correction browser14 and corrected Docker/price equivalence/history/isolation/GL/bundles/preservation pass; docs/evidence/T16 |
| [T17 — Compact comparison results, provider groups, filters, and stable updates](#t17) | T17.1 Pin stable ordering and selection<br>T17.2 Run reducer and e2e tests red<br>T17.3 Implement dense cards and details<br>T17.4 Implement sorting and filters<br>T17.5 Implement staged arrival adoption<br>T17.6 Verify and commit | T08, T09, T15 | DONE | implement_t17 / d9feb83 + evidence 83566f5 + fix ba1835d + report 4ce2fd6 + precision dde5b6c; three P2s fixed and fresh independent review approved; web79/client25, affected19, documented browser closures and corrected Docker/comparison/filter/history/isolation/bundle/preservation proof pass; docs/evidence/T17 |
| [T18 — Link map selection, route details, camera, and referral progress](#t18) | T18.1 Pin the map state machine<br>T18.2 Run map-state tests red<br>T18.3 Wire the scene and timeline<br>T18.4 Wire vehicle progress<br>T18.5 Verify and commit | T14, T17 | DONE | implement_t18 / source342e68d + harness89c2a16 + fixesbb37d01/4e07347;3P2s addressed by fresh review18checks; web104/graphics26/affected38, final native5consumer+6lab and Docker/GL/camera/mobile/bundles/database proof PASS; docs/evidence/T18 |
| [T19 — Optional simulated identity, saved searches, and preferences](#t19) | T19.1 Pin guest and identity behavior<br>T19.2 Run identity tests red<br>T19.3 Implement simulated identity<br>T19.4 Implement saved intent and preferences<br>T19.5 Verify and commit | T04, T12, T15 | DONE | implement_t19 / product9191eff/875fb02 + corrections58f4e58/8eec6b3 + evidencea022be9; twoP2s addressed by fresh20check review; web123/UI16/client27/API91/affected48/native4 and final Docker/account/modal/JS/database preservation PASS; docs/evidence/T19 |
| [T20 — Hotel eligibility, stay pricing, distance sorting, and recheck](#t20) | T20.1 Pin occupancy and total-stay cases<br>T20.2 Run hotel tests red<br>T20.3 Implement allocation and pricing<br>T20.4 Implement dates and four sorts<br>T20.5 Register recheck and persistence<br>T20.6 Verify and commit | T03, T04, T05, T11 | DONE | implement_t20 / cc4aea0; full/fresh reviews, pure484/API106/affected48 and root production/cleanup/archive pass; [checkpoint](../../evidence/T20/checkpoint.md) |
| [T21 — Hotel discovery modal, custom-location map, and trip-state restoration](#t21) | T21.1 Pin opening, edits, and restoration<br>T21.2 Run hotel UI tests red<br>T21.3 Implement hotel browsing<br>T21.4 Implement location selection<br>T21.5 Implement modal/canvas coordination<br>T21.6 Verify and commit | T12, T13, T14, T15, T20 | DONE | implement_t21 / OSM `50381c8` + L1 `dd09ee5`; reviews `241ee40`/`33a8c33`, evidence `e026bfd`; 38 affected, 5 native, 4 packaged checks PASS; [checkpoint](../../evidence/T21/checkpoint.md) |
| [T22 — Traveler referral UI and simulated provider landing page](#t22) | T22.1 Pin user-visible handoff behavior<br>T22.2 Run referral UI tests red<br>T22.3 Implement recheck UI<br>T22.4 Implement handoff and return<br>T22.5 Verify and commit | T11, T17, T18, T19, T21 | DONE | implement_t22; review_t22 approval76fa70a; runtime852cf02, policy-test31b388d, Dockerfc5ae78, native db7e0be; packaged99d5fed and exact-byte archive audit |
| [T23 — Admin shell, scenario controls, provider overrides, and session reset](#t23) | T23.1 Pin scoped control effects<br>T23.2 Run controls tests red<br>T23.3 Implement admin navigation and controls<br>T23.4 Implement revision and invalidation<br>T23.5 Implement reset recovery<br>T23.6 Verify and commit | T04, T12, T06 | DONE | e895f10 backend; fb5366d independent7; integrated264cdb4; real PG5/native PASS |
| [T24 — Provider health and inspectable search runs](#t24) | T24.1 Pin telemetry provenance<br>T24.2 Run inspection tests red<br>T24.3 Implement inspection APIs<br>T24.4 Implement admin views and replay<br>T24.5 Verify and commit | T09, T23 | DONE | 27868e0 backend; fb5366d review5 +e895f10 review4 +12e3d8a frontend6; integrated264cdb4; real PG7/native PASS |
| [T25 — Normalization workspace, alias preview, collision checks, and replay](#t25) | T25.1 Pin material correction behavior<br>T25.2 Run mapping tests red<br>T25.3 Implement preview and apply<br>T25.4 Implement the quality workspace<br>T25.5 Verify and commit | T06, T07, T23, T24 | DONE | fb5366d backend;27868e0 independent10; integrated264cdb4; real PG2/native correction-replay PASS |
| [T26 — Referral analytics and end-to-end provenance trail](#t26) | T26.1 Pin real metric counts<br>T26.2 Run analytics tests red<br>T26.3 Implement metrics and joins<br>T26.4 Implement the referral views<br>T26.5 Verify and commit | T11, T23, T24 | DONE | 264cdb4 backend/frontend; e895f10 independent8; full PG1 +corrected PG2/native actual referral PASS |
| [T27 — Flat artwork, coordinated motion, and all theme transitions](#t27) | T27.1 Author the visual assets<br>T27.2 Implement useful motion<br>T27.3 Implement theme coordination<br>T27.4 Verify motion and all palettes<br>T27.5 Review and commit | T12, T13, T14, T16, T17, T21 | DONE | Source6451d55; independent reviews and M6 packaged20+17 acceptance; [checkpoint](../../evidence/M6/checkpoint.md) |
| [T28 — Failure recovery and coherent state across features](#t28) | T28.1 Pin the scenario recovery matrix<br>T28.2 Run recovery cases red<br>T28.3 Implement recovery actions<br>T28.4 Reconcile stale selections<br>T28.5 Verify and commit | T09, T10, T16, T17, T18, T20, T21, T22, T24, T25 | DONE | Source6451d55; independent reviews and M6 packaged20+17 acceptance; [checkpoint](../../evidence/M6/checkpoint.md) |
| [T29 — Docker packaging, gateway, initialization, and one-command startup](#t29) | T29.1 Define container lifecycle<br>T29.2 Implement ordered initialization<br>T29.3 Implement gateway and assets<br>T29.4 Implement one-command runner<br>T29.5 Verify and commit | T01, T04, T05 | DONE | Sourcea0e8ab2; independentc5a47d4; [checkpoint](../../evidence/T29/m7-completion/checkpoint.md) |
| [T30 — Complete behavioral regression and multi-reviewer acceptance](#t30) | T30.1 Build stable e2e fixtures<br>T30.2 Exercise the full matrix<br>T30.3 Exercise cross-feature journeys<br>T30.4 Exercise hostile timing and isolation<br>T30.5 Verify and commit | T19, T22, T24, T25, T26, T28, T29 | DONE | Sourcecfcc3a9; actual unfiltered224PASS/0FAIL/2existingM6guards; independent5config+77UI+6PG PASS;1097frozen hashes preserved. [Checkpoint](../../evidence/T30/resume-2026-11-01/checkpoint.md) |
| [T31 — Accessibility, RTL, responsive behavior, and browser compatibility](#t31) | T31.1 Define representative coverage<br>T31.2 Run semantic checks<br>T31.3 Inspect visual accessibility<br>T31.4 Run browser coverage<br>T31.5 Fix, verify, and commit | T27, T28, T30 | DONE | Source`0ee7f30`; [accessibility](../../evidence/release/accessibility.md), [browser matrix](../../evidence/release/browser-matrix.md). Chrome22/22 +Firefox22/22 affected closure; configured WebKit43PASS/1existing skip +desktop1PASS; independent5/5. Finite vendor residual and VoiceOver waiver recorded. |
| [T32 — Graphics performance, visual regression, and resource budgets](#t32) | T32.1 Capture controlled visual baselines<br>T32.2 Measure real interaction performance<br>T32.3 Measure bundles and idle work<br>T32.4 Stress lifecycle and fallbacks<br>T32.5 Verify and commit | T27, T28, T30 | DONE | Source `c1f6085`; required8/8 + critical5/5, independent tools8/units4/native2 and exact budget audit pass. 24full/12map comparisons;349.894KiB initial/295.172KiB graphics. [Checkpoint](../../evidence/T32/checkpoint.md), [independent approval](../../evidence/T32/review/independent-verification.md). |
| [T33 — Fresh-start, offline-runtime, reset, and restart rehearsal](#t33) | T33.1 Rehearse a fresh environment<br>T33.2 Verify external-network independence<br>T33.3 Rehearse lifecycle failures<br>T33.4 Finalize verification runner<br>T33.5 Verify and commit | T29, T30, T31, T32 | COMPLETE | Source `62b39ad0`; clean boots37.6s/36.7s, isolated core/reset and normal restart/retry/persistence, initializer repair and Docker-only restoration.48source/60tool/7Chrome checks pass. [Checkpoint](../../evidence/T33/checkpoint.md), [independent review](../../evidence/T33/review/actual-results-review.md). |
| [T34 — Reviewer guide, AI evidence, walkthrough, and submission-ready materials](#t34) | T34.1 Write the immediate-start guide<br>T34.2 Write an evidence-based AI log<br>T34.3 Prepare the timed walkthrough<br>T34.4 Review submission facts and licenses<br>T34.5 Verify and commit | T25, T26, T30, T31, T32, T33 | COMPLETE | Materials `4a759379`; all eight guides/indexes, current submission/rights review, fresh README path and actual 270.006s rehearsal (254.532s declared presentation holds). Original stack/data preserved; independent review approved. [Checkpoint](../../evidence/T34/checkpoint.md), [walkthrough](../../walkthrough.md), [review](../../evidence/T34/review/final-review.md). |
| [T35 — Independent final review and release checkpoint](#t35) | T35.1 Review against the product<br>T35.2 Resolve material findings<br>T35.3 Reconcile the tracker<br>T35.4 Run the final critical path<br>T35.5 Record the release checkpoint | T34 | COMPLETE | Canonical integration `7bbf785b`, repair `d1e052ba`; final quality passes 48 uncached Nx tasks, 60 tool contracts, 189 real PostgreSQL cases and 7 critical Chrome journeys. Separate 16 browser cases pass; actual manual journey 136.058s. Independent reviews approve; owned resources removed, original stack/data preserved. [Checkpoint](../../evidence/T35/checkpoint.md), [final review](../../evidence/release/final-review.md), [checklist](../../evidence/release/acceptance-checklist.md). |

## 5. Milestones, order, and gates

| Milestone | Tasks | Exit evidence |
|---|---|---|
| M1 — Runnable foundation and contracts | T01–T04, T12; early T29 | COMPLETE: independent task and cross-task review, final WebStorm builds/Docker startup verified; evidence in docs/evidence/M1-checkpoint and M1-handoff |
| M2 — Credible comparison engine | T05–T11 | COMPLETE: T05–T11 independently reviewed. Provider normalization, complete round trips, ranking, durable streams, date/result equality and explicit versioned/idempotent referrals verified; T11 corrected lifecycle53 and packaged gateway/restart/preservation gates pass |
| M3 — Signature search experience | T13–T18 | COMPLETE: shared renderer, geography/routes, consumer composer, date exploration, streamed comparison and canonical map binding independently verified. Wheel/calendar/chart/map linked to real mock-provider API data; stable results/camera and desktop/mobile route details. |
| M4 — Complete traveler flow | T19–T22 | COMPLETE: optional identity/saves, hotel eligibility/discovery/custom point, explicit recheck consent, immutable handoff and exact authorized return context; independent review and final Docker/browser evidence pass. |
| M5 — Inspectable admin | T23–T26 | COMPLETE: session-scoped revisioned controls alter actual work; provider health/search source/ranking inspection; bounded material mapping preview/apply/replay; factual referral metrics/trail. Independent reviews, actual PG and four packaged browser journeys pass. |
| M6 — Visual finish and resilience | T27–T28 | All themes/modes, local flat artwork, coordinated motion, empty/partial/error recovery |
| M7 — Reproducible quality gates | T29–T33 | Clean Docker boot, browser journeys, accessibility audit, measured graphics/bundles, isolation/reset/restart evidence |
| M8 — Reviewer handoff | T34–T35 | <5-minute timed walkthrough script, honest AI evidence, final independent review, no unresolved critical/high-impact defects |

Recommended sequence: establish one working vertical slice early—session → one fixture provider → API search → one result → referral—while preserving the final contracts. Expand to all providers/modes, then polish the linked graphics, hotels, and admin. This is an implementation order, not a reduction of release scope.

**M1 checkpoint — 2026-10-24:** Five full tasks are DONE; early T29 is reviewed and runnable while its parent stays ACTIVE. The project is checked out at `/Users/mahdizarei/WebstormProjects/torob-ticket` on `codex/foundation`, with the requested GitHub origin. Cross-task review fixes close clean-CI initialization, equivalent-anchor handling, shared test-database guards, tool-test coverage and README accuracy. Final-path frozen install, 36 source checks, normal regressions, one-command Docker boot and compiled HTTP checks pass. T05 continues the next milestone.

**T05 checkpoint — 2026-10-24:** Rich deterministic inventory is complete at `ebbb773` + `8081656`: 22 cities, 90 places, 104 directed connections, six fictional providers, 308 hotels and 924 relative-night rate templates. Thirty fixture tests, 26 PostgreSQL/HTTP integration tests, normal regressions, seed idempotence and independent review/fix re-review pass. The packaged catalog, seed and geographic assets are verified through the running Docker gateway. Evidence: `docs/evidence/T05/`. Next task: T06.

Early T29 packaging is intentional: validate build/health/seed assumptions as soon as the foundation exists, then repeat the clean-start gate after all features land. Storybook, test projects and the tagged seed-tool composition project are development tools, not additional production services.

**Gate G1:** domain truth is testable before UI claims it.  
**Gate G2:** the signature date/map/result interaction is reviewed before multiplying visual treatments.  
**Gate G3:** each referral can be traced from source record to handoff.  
**Gate G4:** a fresh session and a clean Docker environment both complete the walkthrough.  
**Gate G5:** release evidence and limitations match actual behavior.

## 6. Detailed task specifications

<a id="t01"></a>

### Task 1: T01 — Runnable Nx foundation and dependency boundaries

**Milestone:** M1 · **Depends on:** None · **Spec:** §11, §13

**Files — create unless introduced by a dependency; then modify:**

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `nx.json`
- `tsconfig.base.json`
- `eslint.config.mjs`
- `apps/web/project.json`
- `apps/web/src/main.tsx`
- `apps/admin/project.json`
- `apps/admin/src/main.tsx`
- `apps/api/project.json`
- `apps/api/src/main.ts`
- `tests/e2e/project.json`
- `tests/e2e/playwright.config.ts`
- `.github/workflows/ci.yml`
- `docs/decisions/0001-foundation.md`

**Interfaces:**

- Consumes: Approved Option A and the global constraints.
- Produces: Buildable Nx projects web/admin/api; test project e2e; reusable library generators; standard lint/typecheck/build/test targets and API test-integration target.

- [x] **T01.1 — Pin compatible tooling**

Check current Nx/React/Nest/R3F/Prisma/Node LTS compatibility from official sources. Record exact versions and container architecture support in 0001-foundation.md; pin pnpm and commit its lockfile.

- [x] **T01.2 — Create the minimal workspace**

Scaffold the three applications and the shared library projects in section 3. Render a minimal semantic web/admin page and API health endpoint. Use normal repository initialization only after checking the destination and existing user files.

- [x] **T01.3 — Enforce imports**

Apply the documented Nx tags. Deliberately attempt a web → data-access import in a temporary verification file; lint must reject it. Remove the temporary violation after recording evidence.

- [x] **T01.4 — Establish verification targets**

Configure Vitest for pure/client/UI units, API unit and real-PostgreSQL integration targets, Playwright e2e, and CI lint/typecheck/test/build. Use Nx affected checks for changes and a full release target later.

- [x] **T01.5 — Verify and commit**

Run pnpm nx run-many -t lint,typecheck,build --projects=web,admin,api and the initial focused tests. Expect three successful builds and no boundary violations. Record exact commands in docs/evidence/T01/ and commit the foundation.

**Acceptance:** A fresh checkout has a pinned compatible toolchain, three buildable apps, documented commands, and enforced client/server separation.

---

<a id="t02"></a>

### Task 2: T02 — Runtime contracts and stable API vocabulary

**Milestone:** M1 · **Depends on:** T01 · **Spec:** §3–§11

**Files — create unless introduced by a dependency; then modify:**

- `libs/contracts/src/common.ts`
- `libs/contracts/src/catalog.ts`
- `libs/contracts/src/search.ts`
- `libs/contracts/src/offer.ts`
- `libs/contracts/src/date-prices.ts`
- `libs/contracts/src/hotel.ts`
- `libs/contracts/src/referral.ts`
- `libs/contracts/src/admin.ts`
- `libs/contracts/src/saved-search.ts`
- `libs/contracts/src/index.ts`
- `libs/contracts/src/contracts.spec.ts`
- `libs/contracts/src/test-inputs.ts`
- `apps/api/src/common/zod-validation.pipe.ts`

**Interfaces:**

- Consumes: Public contract inventory, API table, error codes, and default values in this plan.
- Produces: Zod schemas and inferred types for every listed DTO; structured ApiError; validation pipe; validSearchInput test factory.

- [x] **T02.1 — Pin invalid-input behavior**

Create contracts.spec.ts and validSearchInput in test-inputs.ts. Assert invalid types, dates, party bounds, money, coordinates, event discriminants, and missing return date are rejected.

~~~ts
expect(MoneySchema.safeParse({amountRial: 1.5, currency: 'IRR'}).success).toBe(false);
expect(TransportSearchQuerySchema.safeParse({...validSearchInput(), tripType: 'round-trip', returnDate: undefined}).success).toBe(false);
expect(GeoPointSchema.safeParse({latitude: 91, longitude: 0}).success).toBe(false);
~~~

- [x] **T02.2 — Run the contract tests red**

Run pnpm nx test contracts. Confirm failures name the missing schema behavior rather than a broken test environment.

- [x] **T02.3 — Implement schemas and exports**

Define all exact fields in section 3, including completeness/unknown unions, per-leg fare terms, hotel allocations, provenance, quote versions, session info, and admin patches. Validate safe integers and actual calendar dates, not only string patterns.

- [x] **T02.4 — Wire validation and errors**

Implement ZodValidationPipe(schema) and map validation failures to ApiError with code, field paths, retryable, and requestId. Reject unknown command fields where they could alter behavior.

- [x] **T02.5 — Verify and commit**

Run pnpm nx test contracts and pnpm nx run-many -t typecheck --projects=contracts,api,web,admin. Expect all schemas to pass their valid/invalid cases. Commit the contract baseline.

**Acceptance:** Frontend and backend share one checked wire vocabulary; unsafe or ambiguous inputs cannot enter domain processing.

---

<a id="t03"></a>

### Task 3: T03 — Money, local dates, party eligibility, and pure time rules

**Milestone:** M1 · **Depends on:** T02 · **Spec:** §3–§5, §7

**Files — create unless introduced by a dependency; then modify:**

- `libs/domain/src/money.ts`
- `libs/domain/src/time.ts`
- `libs/domain/src/party.ts`
- `libs/domain/src/filters.ts`
- `libs/domain/src/money.spec.ts`
- `libs/domain/src/time.spec.ts`
- `libs/domain/src/party.spec.ts`
- `libs/domain/src/filters.spec.ts`

**Interfaces:**

- Consumes: Money, LocalDate, Party, EligibilityFilters, ISOInstant and Mode from contracts.
- Produces: normalizeMoney; formatTomanParts; toGregorianDate; elapsedMinutes; validateParty(party, policy); matchesEligibility(offer, query).

- [x] **T03.1 — Specify arithmetic and boundary cases**

Pin rial/toman conversion, ambiguous units, unsafe numbers, Persian leap days, UTC/local-day distinctions, overnight intervals, midnight-spanning departure windows, and provider-specific age rules.

~~~ts
expect(normalizeMoney('2,500,000', 'TOMAN')).toEqual({amountRial: 25000000, currency: 'IRR'});
expect(toGregorianDate('1405-08-01', 'persian')).toBe('2026-10-23');
expect(toGregorianDate('1399-12-30', 'persian')).toBe('2021-03-20');
expect(elapsedMinutes('2026-10-24T23:30:00Z', '2026-10-25T01:00:00Z')).toBe(90);
~~~

- [x] **T03.2 — Run focused tests red**

Run pnpm nx test domain. Confirm the specific rule failures before implementing them.

- [x] **T03.3 — Implement pure helpers**

Use @internationalized/date and Intl behind time.ts. Inject clocks at orchestration boundaries. Keep whole-party amounts as safe integers, source units explicit, and date-only values independent of instants.

- [x] **T03.4 — Implement eligibility**

Apply class, known mandatory total, budget, local departure window, provider/operator, stops/transfers, refundability, and baggage predicates. Unknown conditions fail affirmative filters. Reject age-dependent queries with AGE_REQUIRED rather than guessing.

- [x] **T03.5 — Verify and commit**

Run pnpm nx test domain and pnpm nx typecheck domain. Include infant/adult ratios, maximum nine travelers, unknown baggage, and budget equal-to-boundary cases. Commit the pure rules.

**Acceptance:** Canonical arithmetic and date/eligibility rules can be used identically by search, calendars, hotels, and explanations.

---

<a id="t04"></a>

### Task 4: T04 — Database, isolated demo sessions, clocks, and lifecycle

**Milestone:** M1 · **Depends on:** T02 · **Spec:** §8–§11, §13

**Files — create unless introduced by a dependency; then modify:**

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/0001_initial/migration.sql`
- `libs/data-access/src/prisma.ts`
- `libs/data-access/src/scope.ts`
- `libs/data-access/src/session-repository.ts`
- `libs/data-access/src/search-repository.ts`
- `libs/data-access/src/referral-repository.ts`
- `apps/api/src/sessions/session.module.ts`
- `apps/api/src/sessions/session.guard.ts`
- `apps/api/src/sessions/session.service.ts`
- `apps/api/src/sessions/session-context.ts`
- `libs/domain/src/clocks.ts`
- `apps/api/src/common/clocks.ts`
- `apps/api/src/sessions/session.integration.spec.ts`
- `apps/api/vitest.integration.config.ts`

**Interfaces:**

- Consumes: SessionInfo and public DTOs; entity/index inventory in section 3.
- Produces: Backend SessionContext; data-access-owned DataScope; pure domain-owned DemoClock/RealClock interfaces and API implementations; create/resume/reset session endpoints; scoped repositories; idempotent seed lifecycle.

- [x] **T04.1 — Pin isolation and persistence behavior**

Use a real disposable PostgreSQL database. Create two cookie jars; create a search/audit record in A. Assert B receives NOT_FOUND for A's IDs, cannot reset A, and cannot choose sessionId in a payload. Assert restart preserves completed evidence and expires inactive sessions.

- [x] **T04.2 — Run integration tests red**

Run pnpm nx run api:test-integration with the test database. Expect missing session/repository behavior; never point this target at a user's unrelated database.

- [x] **T04.3 — Create schema and scoped repositories**

Create the listed entities, session-owned indexes, unique keys, foreign keys, immutable source revisions, and transactional helpers. Keep canonical fixture records global/immutable and mutations session-scoped. Repository methods accept DataScope built from the guard-resolved sessionId; never import API application classes into data-access.

- [x] **T04.4 — Implement lifecycle and clocks**

Implement HttpOnly same-origin cookie sessions, 24-hour inactivity expiry, frozen demo time plus real event/expiry time, cleanup, reset, and API startup reconciliation of collecting searches to interrupted. Reset cancels only that session's active controllers.

- [x] **T04.5 — Verify and commit**

Run migrations against empty PostgreSQL, seed twice, and rerun api:test-integration. Expect no duplicate fixture roots, isolated sessions, preserved history on restart, and deterministic recorded clocks. Commit schema and lifecycle.

**Acceptance:** Every mutable read/write is scoped server-side, base fixtures are shared safely, and session/reset/restart semantics are proven with PostgreSQL.

---

<a id="t05"></a>

### Task 5: T05 — Curated catalog, geographic assets, and deterministic fixture generator

**Milestone:** M2 · **Depends on:** T03, T04 · **Spec:** §3, §6–§7, §9, §12

**Files — create unless introduced by a dependency; then modify:**

- `libs/fixtures/src/catalog/cities.ts`
- `libs/fixtures/src/catalog/places.ts`
- `libs/fixtures/src/catalog/connections.ts`
- `libs/fixtures/src/catalog/providers.ts`
- `libs/fixtures/src/catalog/hotels.ts`
- `libs/fixtures/src/scenarios.ts`
- `libs/fixtures/src/generator.ts`
- `libs/fixtures/src/test-cases.ts`
- `libs/fixtures/src/generator.spec.ts`
- `libs/fixtures/src/catalog.spec.ts`
- `assets/geography/world.geojson`
- `assets/geography/iran.geojson`
- `assets/geography/destination-landmarks.geojson`
- `assets/provenance.json`
- `tools/seed-fixtures.ts`
- `apps/api/src/catalog/catalog.module.ts`
- `apps/api/src/catalog/catalog.controller.ts`
- `apps/api/src/catalog/catalog.service.ts`
- `apps/api/src/catalog/catalog.integration.spec.ts`

**Interfaces:**

- Consumes: Canonical money/time helpers; DB seed entry; six provider IDs/capabilities and catalog requirements.
- Produces: FixtureQuery, FixtureCase and fixtureCase(id); generateProviderRecords(input); versioned catalog seed; GET /api/v1/catalog; geographic assets and source/license manifest.

- [x] **T05.1 — Define catalog invariants**

Create tests for all six hero searches, reverse routes, supported mode/scope edges, at least three providers per hero itinerary, and 12–20 hotels per covered destination. Assert no endpoint is offered without its transport/hotel fixtures. Add deterministic fixtures for every Review Focus case.

- [x] **T05.2 — Run catalog tests red**

Run pnpm nx test fixtures. Confirm missing coverage and seed determinism fail before implementing the catalog.

- [x] **T05.3 — Author showcase data and source geometry**

Create 12 domestic and 10 international cities, place IDs/time zones, plausible fictional schedules, round trips, stop geometry, room inventories, and meaningful fare differences. Validate real geographic identifiers from authoritative sources; record licenses/provenance. Bundle local simplified map/landmark geometry.

- [x] **T05.4 — Implement seeded generation**

Implement generateProviderRecords(FixtureQuery): RawProviderRecord[] with stable seed/anchor/scenario/mapping inputs. Delays must not alter values. Emit each provider's distinct raw shape. Include empty/no-match days, discontinuities, overnight connections, technical stops, currency aliases, and incomplete prices. Serve the catalog/capabilities through GET /api/v1/catalog; its endpoint options must derive from the same connection graph.

- [x] **T05.5 — Verify seeded inventory**

Assert repeated input yields equal records, different scenario revisions yield only intended changes, all graph endpoints work, no invalid time order exists, and all hero round trips are supplied by their providers. Run pnpm nx test fixtures, pnpm nx run api:test-integration for catalog coverage, and seed twice.

- [x] **T05.6 — Review and commit**

Inspect one sample search per mode/scope and one hotel catalog for coherent conditions and Persian labels. Save coverage counts and provenance to docs/evidence/T05/; commit fixtures and assets.

**Acceptance:** The dataset is rich, coherent, reproducible, geographically plausible, clearly fictional, and complete for every selectable destination.

---

<a id="t06"></a>

### Task 6: T06 — Provider adapters, normalization traces, and controlled failures

**Milestone:** M2 · **Depends on:** T03, T05 · **Spec:** §3–§4, §9–§11

**Files — create unless introduced by a dependency; then modify:**

- `libs/provider-adapters/src/provider-adapter.ts`
- `libs/provider-adapters/src/provider-context.ts`
- `libs/provider-adapters/src/mock-registry.ts`
- `libs/provider-adapters/src/mock-provider.ts`
- `libs/provider-adapters/src/raw-codecs.ts`
- `libs/provider-adapters/src/provider-adapter.spec.ts`
- `libs/domain/src/normalize.ts`
- `libs/domain/src/normalization-types.ts`
- `libs/domain/src/aliases.ts`
- `libs/domain/src/normalize.spec.ts`
- `apps/api/src/providers/provider.module.ts`
- `apps/api/src/providers/provider.service.ts`

**Interfaces:**

- Consumes: FixtureQuery/generator; contracts RawProviderRecord/NormalizationTrace; pure money/time/clock interfaces; API supplies scoped context without an adapter importing application code.
- Produces: ProviderAdapter and six adapters; ProviderContext/Batch/DateBatch/QuoteSelection/Recheck; decodeRawRecord; domain-owned DecodedProviderRecord/NormalizationContext/Result and normalizeRecord; accepted/ambiguous/rejected traces.

- [x] **T06.1 — Pin raw-format and fault cases**

For all six providers, test raw success, malformed record, ambiguous alias, missing mandatory charge, duplicate, pause, timeout, cancellation, and changed/sold-out recheck. Assert Arabic/Persian character cleanup does not merge distinct place IDs.

- [x] **T06.2 — Run adapter tests red**

Run pnpm nx test provider-adapters and pnpm nx test domain. Each codec case must fail for its missing behavior, not merely because the registry is empty.

- [x] **T06.3 — Implement adapters and normalization**

Implement search/dateInventory/recheck with injected clocks, seed, AbortSignal, and trace sink. Decode provider-specific shapes in raw-codecs.ts to DecodedProviderRecord, then call pure domain normalizeRecord for units/identifiers/terms. Preserve raw payload and field-level decisions; malformed decoding also records a rejection and ambiguous identity remains unresolved. Domain must never import adapter codecs.

- [x] **T06.4 — Implement bounded scenario timing**

Use the prescribed provider delay schedule and configured failure profile. Respect abort/deadline signals; clear timers in finally. Paused/failed providers return status, not empty success. Never manufacture a lower complete total from missing mandatory charges.

- [x] **T06.5 — Verify and commit**

Run provider-adapters/domain tests with fake clocks for timing and the seeded raw payload matrix. Verify no hanging timers and trace links back to source revision. Commit adapters and normalization.

**Acceptance:** Every provider's raw input takes the same inspectable validation path; failures are controlled and bounded, not random.

---

<a id="t07"></a>

### Task 7: T07 — Journey grouping, fare eligibility, and complete round-trip quotes

**Milestone:** M2 · **Depends on:** T03, T06 · **Spec:** §3–§5

**Files — create unless introduced by a dependency; then modify:**

- `libs/domain/src/comparison/itinerary-key.ts`
- `libs/domain/src/comparison/quote-offer.ts`
- `libs/domain/src/comparison/round-trip.ts`
- `libs/domain/src/comparison/group-offers.ts`
- `libs/domain/src/comparison/group-offers.spec.ts`
- `libs/domain/src/comparison/round-trip.spec.ts`
- `libs/domain/src/testing/comparison-cases.ts`

**Interfaces:**

- Consumes: NormalizedOffer with provenance; bound SourceFareEvidence; explicit ProviderFarePolicy/places/real clock through ComparisonContext; TransportSearchQuery; pure filters and money/time.
- Produces: itineraryKey; quoteOffer(offer, query, context): QuoteEvaluation; groupOffers(offers, query, context): ComparisonGroup[]; complete same-provider round-trip validation and QuoteSnapshot.

- [x] **T07.1 — Pin comparable and noncomparable cases**

Construct small domain-local cases in testing/comparison-cases.ts for same-journey-different-provider, airport-change, baggage-variant, incomplete-roundtrip, ground-dwell, and same-day-return. Do not import the fixtures library into domain tests. Assert two providers group, distinct airports do not, fare terms stay visible, and return timing can be same-day when valid.

- [x] **T07.2 — Run grouping tests red**

Run pnpm nx test domain. Assert specifically that an unrelated outbound/return pair cannot become a complete quote.

- [x] **T07.3 — Implement stable identity and fares**

Key itinerary identity by canonical service, segment sequence, locations, instants, and direction. Exclude provider price from the journey key. Preserve distinct fare IDs/conditions. Derive deterministic quote IDs from source/query/revision and use supplied observedAt for TTL.

- [x] **T07.4 — Implement full-party and round-trip evaluation**

Apply rate/seat/age rules to the whole party, mandatory fee completeness, and both legs. Validate time ordering including transfers; sum travel durations without destination stay. Distinguish ground dwell from vehicle transfers and count flight stops explicitly.

- [x] **T07.5 — Verify and commit**

Run pnpm nx test domain. Confirm exact totals, stable grouping under shuffled input, no cross-provider fabricated return, same-day return acceptance/rejection by actual timing, and incomplete offers excluded from the representative quote. Commit the comparison model.

**Acceptance:** Groups describe equivalent travel while preserving material fare differences, and every priced quote is eligible and complete for the requested party.

---

<a id="t08"></a>

### Task 8: T08 — Deterministic ranking, factual explanations, and bounded suggestions

**Milestone:** M2 · **Depends on:** T07 · **Spec:** §4

**Files — create unless introduced by a dependency; then modify:**

- `libs/domain/src/comparison/rank-groups.ts`
- `libs/domain/src/comparison/explain-group.ts`
- `libs/domain/src/comparison/choose-suggestion.ts`
- `libs/domain/src/comparison/ranking.spec.ts`
- `libs/domain/src/comparison/explanations.spec.ts`
- `libs/domain/src/testing/comparison-cases.ts`

**Interfaces:**

- Consumes: ComparisonGroup with eligible representative quote and computed duration/connection counts.
- Produces: rankGroups; explainGroup; chooseSuggestion; ExplanationContext/SuggestionContext with baseline IDs, numeric facts, and coverage.

- [x] **T08.1 — Pin exact sort and suggestion thresholds**

Extend domain-local comparison-cases.ts with ranking tradeoffs. Assert all primary/tie orders, stable ID final tie, shuffled input determinism, incomplete-price exclusion, round-trip duration, ground dwell vs transfers, and no suggestion below either savings threshold. Construct belowThresholdContext from complete quotes saving 9.9% despite saving more than 200,000 toman.

~~~ts
expect(rankGroups(caseData.groups, 'cheapest').map(g => g.groupId)).toEqual(caseData.expected.cheapestIds);
expect(chooseSuggestion(belowThresholdContext)).toBeNull();
~~~
Also test a zero-priced baseline without division-by-zero or a fabricated percentage.

- [x] **T08.2 — Run ranking tests red**

Run pnpm nx test domain. Verify a wrong tie-break order and a fabricated coverage claim would fail.

- [x] **T08.3 — Implement comparators and factual reasons**

Use integer amounts/durations and stable IDs. Emit structured reason codes and facts for UI localization. Compute provider coverage from the current search, and label incomplete collection as provisional.

- [x] **T08.4 — Implement contextual suggestion selection**

Compare only equivalent party/filters/opposite-leg conditions and completed coverage. Apply the exact ±3-day /10% /200,000-toman or 90-minute /10%-premium rules, one result maximum, and the specified tie breaks. Do not call a model.

- [x] **T08.5 — Verify and commit**

Run domain tests including equal-price, equal-time, zero eligible groups, asymmetric round trips, and missing-data cases. Confirm explanations can be independently recomputed from their referenced quotes. Commit ranking.

**Acceptance:** Ordering is stable and auditable; every displayed explanation and suggestion is supported by the current comparison data.

---

<a id="t09"></a>

### Task 9: T09 — Search orchestration, persistent evidence, SSE, and recovery

**Milestone:** M2 · **Depends on:** T04, T06, T08 · **Spec:** §4, §9–§11

**Files — create unless introduced by a dependency; then modify:**

- `apps/api/src/searches/search.module.ts`
- `apps/api/src/searches/search.controller.ts`
- `apps/api/src/searches/search.service.ts`
- `apps/api/src/searches/search-stream.service.ts`
- `apps/api/src/searches/provider-scheduler.ts`
- `apps/api/src/searches/search.integration.spec.ts`
- `libs/data-access/src/search-repository.ts`
- `libs/client/src/search-stream.ts`
- `libs/client/src/search-stream.spec.ts`

**Interfaces:**

- Consumes: SessionContext/repositories, ProviderAdapter registry, grouping/ranking/explanations, SearchRequest/Event/Snapshot.
- Produces: startSearch/getSearch/cancelSearch; ordered event replay and snapshot fallback; subscribeSearch(options): unsubscribe; complete provider/run/source audit trail.

- [x] **T09.1 — Pin partial, race, and reconnect behavior**

Create integration cases with one slow provider, one timeout, all failures, zero offers, cancellation, duplicate event delivery, and reconnect after sequence N. Assert monotonic IDs, correct coverage, no lost final snapshot, and session isolation. Assert stale clientGeneration events are ignored.

- [x] **T09.2 — Run orchestration tests red**

Run pnpm nx run api:test-integration and pnpm nx test client. Expected failures must exercise event ordering and lifecycle, not just missing routes.

- [x] **T09.3 — Implement bounded search runs**

Persist the run before starting work. Apply provider concurrency two and session active-search limit two. Record raw payload, normalized decisions, quotes, coverage, and versioned snapshots transactionally. Distinguish complete/partial/empty/failed/cancelled/interrupted statuses.

- [x] **T09.4 — Implement the stream and fallback**

Serve ordered SSE with heartbeat, scoped authorization, Last-Event-ID replay, terminal close, and snapshot recovery on a sequence gap. Client reconnect uses a bounded retry policy, then polls the snapshot endpoint; never replay events into a different generation.

- [x] **T09.5 — Implement restart/cancel cleanup**

Cancel superseded work best-effort; abort timers and provider work on reset. A transient SSE disconnect does not erase a run; its deadline still bounds completion. On API restart mark unfinished work interrupted and expose a new-search retry.

- [x] **T09.6 — Verify and commit**

Run api integration/client tests with a PostgreSQL restart case, session limit case, and normal delay schedule. Confirm terminal events, no hanging streams/timers, complete evidence, and independent A/B sessions. Commit search orchestration.

**Acceptance:** The API produces useful progressive results and a durable explanation of what happened, including partial failure and reconnection.

---

<a id="t10"></a>

### Task 10: T10 — Consistent date-price projection and scoped caching

**Milestone:** M2 · **Depends on:** T09 · **Spec:** §4–§5

**Files — create unless introduced by a dependency; then modify:**

- `apps/api/src/date-prices/date-price.module.ts`
- `apps/api/src/date-prices/date-price.controller.ts`
- `apps/api/src/date-prices/date-price.service.ts`
- `apps/api/src/date-prices/date-price.integration.spec.ts`
- `libs/domain/src/comparison/project-date-prices.ts`
- `libs/domain/src/comparison/date-prices.spec.ts`
- `libs/client/src/query-keys.ts`
- `libs/client/src/query-keys.spec.ts`

**Interfaces:**

- Consumes: Provider dateInventory, shared normalization/grouping/eligibility pipeline, DatePriceQuery/Cell/Snapshot.
- Produces: getDatePrices; projectDatePrices; datePriceKey/searchKey/hotelKey; checking/snapshot polling endpoints.

- [x] **T10.1 — Pin date/result equivalence**

For representative dates and every transport mode, assert each priced cell equals the minimum eligible complete result under the same query. Add round-trip fixed-opposite-leg, filter/party changes, missing provider, mapping revision, same-day return, and no-match/outside-coverage cases. Terminal provider failure or incomplete prices must yield unavailable rather than false no-match or perpetual checking.

- [x] **T10.2 — Run projection tests red**

Run pnpm nx test domain, pnpm nx test client, and pnpm nx run api:test-integration. Assert sorting alone does not alter date minima.

- [x] **T10.3 — Implement bounded projection**

Fetch a provider's date inventory in one batched mock operation, normalize and evaluate with the same rules as selected-date searches. Do not issue ninety deliberately delayed searches. Return checking cells while work is incomplete and explicit coverage with priced cells.

- [x] **T10.4 — Implement cache identity and invalidation**

Normalize query keys over mode/scope/route/dates/party/ages/class/eligibility plus seed, anchor, scenario, provider override, and mapping revisions. Scope mutable cache state by session. Default snapshot freshness is 60 seconds; edits/reset invalidate affected entries.

- [x] **T10.5 — Verify and commit**

Run the three focused targets. Confirm incomplete total never yields a cheap cell, gaps remain null-state values, changing cheapest/fastest does not refetch minima, and another session's scenario cannot contaminate cached cells. Commit date projection.

**Acceptance:** Wheel, chart, calendar, and results share the same price meaning and cannot disagree because of a separate mock algorithm.

**T10 checkpoint — 2026-10-24:** Complete at source `0a39241` + report `3dd0d0a`; independent spec and quality review approved, no blocking findings. Domain239/client17/API66, root12 test targets plus20 tool checks, affected34 validation targets and packaged HTTP price equivalence/cache/isolation/reset/restart/preservation pass. Date retrieval uses one batched operation per participating provider and immutable same-ID internal evidence parents, shared max2 admission and frozen server context. Canonical responses and strict60s real freshness preserve price meaning; retryable unavailable snapshots permit a useful fresh retry. Test resources and exact probe namespaces are removed. Nonblocking T10-M1 persistence readability remains for next touch/final review. Evidence: `docs/evidence/T10/`. The visible wheel/calendar/GLSL chart remains T16; next task is T11.


---

<a id="t11"></a>

### Task 11: T11 — Recheck, quote versions, idempotent referrals, and handoff data

**Milestone:** M2 · **Depends on:** T04, T07, T09 · **Spec:** §8, §10

**Files — create unless introduced by a dependency; then modify:**

- `apps/api/src/referrals/referral.module.ts`
- `apps/api/src/referrals/referral.controller.ts`
- `apps/api/src/referrals/referral.service.ts`
- `apps/api/src/referrals/recheck-registry.ts`
- `apps/api/src/referrals/referral.integration.spec.ts`
- `libs/data-access/src/referral-repository.ts`

**Interfaces:**

- Consumes: SessionContext, provider recheck adapter, QuoteSnapshot, ReferralSelection/Intent/RecheckResult/Receipt.
- Produces: prepareReferral and confirmReferral; RecheckRegistry handler interface for transport now and hotels in T20; immutable local handoff payload.

- [x] **T11.1 — Pin changed-price and idempotency cases**

Test ready, changed total, changed baggage/refund terms, sold-out, expired/incomplete quote, expired intent, wrong accepted version, duplicate confirmation, and same idempotency key with a different payload. Assert B cannot prepare or view A's quote/referral.

- [x] **T11.2 — Run referral tests red**

Run pnpm nx run api:test-integration. A repeated confirm must not yield two ReferralEvent rows.

- [x] **T11.3 — Implement prepare and acceptance**

Call the relevant recheck handler; compare price and material conditions. Store a two-minute intent tied to session, selection, accepted version, and payload digest. A changed quote returns exact old/new facts for explicit acceptance.

- [x] **T11.4 — Implement atomic confirmation**

Validate version/expiry/eligibility inside a transaction, enforce idempotency uniqueness, create one referral record, and return /provider-demo/:referralId. Revalidate or reject an intent invalidated by a later scenario revision. Refreshing a handoff never increments clicks.

- [x] **T11.5 — Verify and commit**

Run integration tests with injected real clocks at TTL boundaries and concurrent duplicate confirmations. Assert exact whole-party payload and no booking/revenue event. Commit the referral engine.

**Acceptance:** Every handoff is explicit, current, exactly traceable, and protected against stale acceptance or repeated clicks.

**T11 checkpoint — 2026-10-24:** Complete at `3abdd5e` + report `cb77ce2` + lifecycle correction `301119d`. Independent full review found one Important I1: interrupted internal rechecks left provider evidence collecting. Three assertion RED cases reproduced it; shared transactional reconciliation now terminalizes unfinished children and preserves raw/terminal evidence. Fresh scoped re-review closed I1 with no new findings. Original integration81, amended four-file integration53, root12+tools20 and affected34/16 targets pass. Final packaged ready/changed/soldout, whole-party roundtrip, concurrent single-event confirmation, scoped404, read-only receipt, original-lineage/quote immutability, actual restart/replay and exact database/inventory preservation pass. Owned test resources and all probe namespaces are removed. Changed response includes exact previousQuote; registry supports transport now and hotel registration in T20. Explicit acceptance UI and provider page remain T17/T22; main rendering starts T13. Evidence: `docs/evidence/T11/`. Twelve of35 tasks are complete; T29 remains ACTIVE.


---

<a id="t12"></a>

### Task 12: T12 — Design tokens, accessible primitives, typography, and component gallery

**Milestone:** M1 · **Depends on:** T01 · **Spec:** §2, §12

**Files — create unless introduced by a dependency; then modify:**

- `libs/ui/src/styles/tokens.css`
- `libs/ui/src/styles/reset.css`
- `libs/ui/src/styles/typography.css`
- `libs/ui/src/theme/theme-provider.tsx`
- `libs/ui/src/components/button.tsx`
- `libs/ui/src/components/segmented-control.tsx`
- `libs/ui/src/components/combobox.tsx`
- `libs/ui/src/components/dialog.tsx`
- `libs/ui/src/components/tooltip.tsx`
- `libs/ui/src/components/status.tsx`
- `libs/ui/src/components/price.tsx`
- `libs/ui/src/components/primitives.spec.tsx`
- `libs/ui/src/components/primitives.stories.tsx`
- `libs/ui/.storybook/main.ts`
- `assets/fonts/LICENSES.md`

**Interfaces:**

- Consumes: Palette, layout, typography, focus, and language constraints.
- Produces: ThemeProvider/useTheme; shared React Aria-based Button/SegmentedControl/ComboBox/Dialog/Tooltip/Status/Price; six semantic token sets; local fonts and Storybook target.

- [x] **T12.1 — Define the visual foundation**

Create a compact type/spacing/radius/elevation scale, semantic color inventory, six transport/appearance palettes, English admin variant, and flat icon rules. Map all authored colors to tokens, including status, focus, border, SVG, and future shader uniforms.

- [x] **T12.2 — Implement accessible primitives**

Use React Aria semantics and local Vazirmatn/Inter assets. Keep component APIs controlled and language-aware. Define accessible labels, hit targets, loading/disabled/error states, focus return, and LTR code wrappers.

- [x] **T12.3 — Pin interaction behavior**

Test keyboard combobox selection, segmented controls, tooltip focus, modal escape/focus containment/return, and Price whole-total labels. Verify an unmounted dialog cannot steal focus. Use Testing Library assertions on user behavior rather than class names.

- [x] **T12.4 — Build the state gallery**

Create Storybook examples for every state in all palettes and Persian/English. Inspect 390 px and 1440 px layouts. The initial gallery is a design review surface, not a production route.

- [x] **T12.5 — Verify and commit**

Run pnpm nx test ui, pnpm nx build ui, and pnpm nx run ui:build-storybook. Inspect contrast/focus and verify no remote font fetch. Commit tokens/primitives with visual evidence.

**Acceptance:** Both applications share a distinctive, compact, accessible foundation, and visual states can be reviewed without exercising a full journey.

---

<a id="t13"></a>

### Task 13: T13 — Shared WebGL renderer, typed uniforms, and graceful fallback

**Milestone:** M3 · **Depends on:** T12 · **Spec:** §11–§12

**Files — create unless introduced by a dependency; then modify:**

- `libs/graphics/src/graphics-provider.tsx`
- `libs/graphics/src/graphics-view.tsx`
- `libs/graphics/src/render-scheduler.ts`
- `libs/graphics/src/theme-uniforms.ts`
- `libs/graphics/src/quality-policy.ts`
- `libs/graphics/src/context-lifecycle.ts`
- `libs/graphics/src/shaders/shared.glsl`
- `libs/graphics/src/graphics.spec.ts`
- `libs/graphics/src/graphics.stories.tsx`
- `tests/e2e/graphics-host.spec.ts`

**Interfaces:**

- Consumes: Theme tokens/provider and semantic DOM containers; Three.js WebGL2/R3F/Drei View.
- Produces: GraphicsProvider; GraphicsView; useThemeUniforms; graphics quality/fallback state; shared scene lifecycle and on-demand scheduling.

- [x] **T13.1 — Define lifecycle behavior**

Pin token-to-uniform conversion, quality caps, renderer disposal, visibility pause, context loss/restoration, and reduced-motion policy. Create an e2e scene with two clipped views plus a native dialog.

- [x] **T13.2 — Build the shared host**

Implement one persistent canvas and clipped views aligned to DOM rectangles. Lazy-load graphics; retain useful SVG/HTML until ready. Register event sources without blocking native controls; avoid one context or material per result card.

- [x] **T13.3 — Implement uniforms and scheduling**

Resolve CSS color tokens to renderer color space, update all active shader uniforms on theme changes, reuse resources, and invalidate only while needed. Apply DPR caps and measured low-tier policy; pause hidden/covered scenes.

- [x] **T13.4 — Implement fallback and recovery**

Detect unavailable WebGL2, shader failure, and lost context. Expose a fallback state to views; restore after context recovery without resetting selected query or camera intent. Cancel animation/observers and dispose resources on unmount.

- [x] **T13.5 — Verify and commit**

Run pnpm nx test graphics and pnpm nx run e2e:e2e --grep @graphics-host. Check actual GL compile/link logs, modal pointer/keyboard behavior, theme sync, and loss/recovery in a real browser. Save evidence; commit graphics foundation.

**Acceptance:** A bounded shared renderer supports multiple scenes while every essential UI action survives graphics failure.

**T13 checkpoint — 2026-10-25:** Complete at1b83a74 + report e2c5df1 + corrections e43bf0e. Independent review confirmed two Important generic-host issues (fallback input interception and stale nested R3F updates); actual browser REDs reproduced them, corrected bridges/fallback/DPR policy pass8units/10browser cases and26finalaffected targets. Fresh correction review closed both with no new blocker. Final Docker/production Chrome verifies lazy WebGL2, compiled one-program/two-view rendering, semantic theme sync, inert fallback, native dialog, and exact existing-data preservation. Root suite12targets+20tools and GLSL cache probes pass; shared Storybook builds. Actual hardware/context/hidden-tab/failure/DPR evidence retained in docs/evidence/T13. Known upstream Clock/rawchunk warnings remain T32-owned; opaque native hotel foreground composition remains T21. Thirteen of35tasks are complete; next T14. Superpowers paused by owner for24h at2026-10-25 07:16:38UTC; later work/reviews/tracker used standard tools.


---

<a id="t14"></a>

### Task 14: T14 — Dotted geography and mode-specific route scenes

**Milestone:** M3 · **Depends on:** T05, T13 · **Spec:** §6, §12

**Files — create unless introduced by a dependency; then modify:**

- `libs/graphics/src/geo/projection.ts`
- `libs/graphics/src/geo/route-geometry.ts`
- `libs/graphics/src/geo/route-geometry.spec.ts`
- `libs/graphics/src/scenes/route-scene.tsx`
- `libs/graphics/src/scenes/location-scene.tsx`
- `libs/graphics/src/shaders/map-dots.vert.glsl`
- `libs/graphics/src/shaders/map-dots.frag.glsl`
- `libs/graphics/src/shaders/route.vert.glsl`
- `libs/graphics/src/shaders/route.frag.glsl`
- `libs/graphics/src/sprites/vehicle.ts`
- `libs/graphics/src/scenes/route-scene.stories.tsx`
- `tests/e2e/route-scene.spec.ts`

**Interfaces:**

- Consumes: Bundled world/Iran/destination geography and canonical Place/Itinerary; shared GraphicsView.
- Produces: RouteScene(props: RouteSceneProps); LocationScene(props: LocationSceneProps); projectRoute; fitRouteBounds; mode geometry and flat pixel sprites.

- [x] **T14.1 — Pin geographic and route invariants**

Test projection bounds, antimeridian splitting, coincident points, long routes, ordered stops, and a required ground transfer. Flight geometry is curved/elevated, rail segmented, bus follows an authored winding polyline.

- [x] **T14.2 — Run geometry tests red**

Run pnpm nx test graphics. Confirm antimeridian and zero-length route cases cannot create NaN or world-spanning accidental lines.

- [x] **T14.3 — Implement map and route shaders**

Create instanced/point-based dotted geography, token-driven emphasis, route reveal, shallow route depth, and flat pixel vehicles. Use bundled coordinates and explicit illustrative-path metadata; no remote tiles or route service.

- [x] **T14.4 — Implement camera and location primitives**

Fit only on deliberate pin/origin changes, expose explicit zoom/pinch, and preserve camera state. LocationScene accepts landmarks/markers/custom point and emits onPointChange(GeoPoint); labels and controls remain DOM-based.

- [x] **T14.5 — Verify and commit**

Run graphics tests and pnpm nx run e2e:e2e --grep @route-scene. Inspect Iran/world, all modes/themes, stop ordering, and explicit controls. Confirm no auto-spin and no scene movement while unrelated content scrolls. Commit scenes.

**Acceptance:** The signature dotted map explains each mode's route accurately enough for the mock dataset and remains stable and legible.

**T14 checkpoint — 2026-10-25:** Complete at 92139d8 + report 08acee9 + correction d79be42 + report bc25aca. Independent review reproduced one P2: the domestic overview camera ignored a custom projection. Public-component/SSR REDs reproduced it; the fix now keeps all 3,212 Iran dots visible, including across a projection seam. Fresh correction review marks it ADDRESSED with no new actionable issue. Final 22 graphics tests, 27 correction-affected targets and six real-Chrome route scenarios pass; the initial 38 affected targets, 12 root test targets/tools and 15 combined T13/T14 browser scenarios remain recorded. Corrected production Docker/Chrome verifies one WebGL2 canvas, compiled shaders, lazy loading, preview/theme camera, transfer/mobile selection and 36 authored-only paths. Final JavaScript SHA256 matches live gateway bytes (101,596 startup / 255,757 deferred gzip9 bytes). The same database container and all inventory fingerprints are preserved; ports 4313/4314 are clear. Fourteen of 35 tasks are complete; T15 remains TODO. T29 remains ACTIVE. Native evidence/checkpoint: docs/evidence/T14. Superpowers remains disabled through 2026-10-26T07:16:38Z. No push, deployment or publication. Consumer binding, modal composition and full performance/accessibility audits remain T15/T18/T21/T32 work. Known Clock/raw-chunk and test-only Three CJS warnings remain visible.

---

<a id="t15"></a>

### Task 15: T15 — Consumer shell, search composer, URL state, and reviewer entry

**Milestone:** M3 · **Depends on:** T02, T04, T05, T12 · **Spec:** §3, §6, §10–§11

**Files — create unless introduced by a dependency; then modify:**

- `apps/web/src/app.tsx`
- `apps/web/src/routes.tsx`
- `apps/web/src/features/search/search-page.tsx`
- `apps/web/src/features/search/search-composer.tsx`
- `apps/web/src/features/search/search-reducer.ts`
- `apps/web/src/features/search/search-url.ts`
- `apps/web/src/features/search/search-url.spec.ts`
- `apps/web/src/features/search/search-reducer.spec.ts`
- `apps/web/src/features/demo/demo-menu.tsx`
- `libs/client/src/api-client.ts`
- `tests/e2e/src/search-composer.spec.ts`
- `apps/web/src/features/search/use-search-controller.ts`
- `apps/web/src/features/search/search-start-pool.ts`
- `apps/web/src/features/search/search-controller.spec.tsx`
- `apps/web/src/features/search/search.module.css`
- `libs/client/src/api-client.spec.ts`

**Implementation joins:** web Vitest discovery includes `.spec.ts` and `.spec.tsx`; the cache probe measures per-file setup execution. The UI ViewTransition ref narrows its type only. Existing foundation/lab navigation tests and the isolated Vite proxy configuration were updated and verified; dependency versions and backend semantics are unchanged.

**Interfaces:**

- Consumes: Catalog/SessionInfo/TransportSearchQuery contracts; shared primitives; planned typed API endpoints.
- Produces: Consumer router/layout; SearchComposer; useSearchController; canonical URL serialization; demo indicator/preset menu; typed apiClient.

- [x] **T15.1 — Pin query and navigation behavior**

Test selecting origin enables only supported endpoints; mode switches preserve compatible inputs and explain cleared destinations. Round-trip dates, party constraints, browser back/forward, malformed URLs, and restoration from a preset must be deterministic.

- [x] **T15.2 — Run state tests red**

Run pnpm nx test web. Assert a stale generation cannot become the current committed query and preview dates do not alter the URL.

- [x] **T15.3 — Implement shell and composer**

Create the Persian/RTL compact app, mode/scope/trip-type controls, origin/destination comboboxes, party/class controls, and the 1120 px desktop split layout. Obtain session and catalog through apiClient; keep the map placeholder fixed left.

- [x] **T15.4 — Implement state ownership**

Separate draft, preview, committed query, active search generation, pinned/preview itinerary, and modal draft states. Keep committed intent in the URL; transient hover/drag stays local. Gate the search until query validity is complete.

- [x] **T15.5 — Implement reviewer entry**

Show the subtle simulated-data indicator, optional preset/scenario/admin menu, and useful initial route. Do not auto-start a forced tutorial or require login. Reference fixtures through API catalog IDs, not duplicated browser inventory.

- [x] **T15.6 — Verify and commit**

Run web tests and pnpm nx run e2e:e2e --grep @search-composer. Check all six mode/scope selections, keyboard completion, URL reload/back, 390/768/1440 widths, and no horizontal overflow. Commit consumer shell.

**Acceptance:** The reviewer can immediately compose a valid search in all supported modes, and navigation restores intent without losing context.

**T15 checkpoint — 2026-10-25:** Complete at 52f66c4 + evidence 5426f4d + correction 8c52bc4. Independent review reproduced unbounded unanswered browser POSTs through Search→Back; a shared synchronous two-start pool, same-tick guard and reset epoch now preserve the bound across remounts, with visible capacity recovery. Fresh correction review marks P2 ADDRESSED with no new actionable finding. Final web21/client23, 48 affected tasks, five real-API composer journeys and targeted admission/recovery/reset proof pass; the original 23-case browser matrix and tools20/cache/assets/regeneration proof remain recorded. Corrected Docker/production Chrome passes real searches, URL/history/presets, two-session isolation/reset and lazy WebGL2. JavaScript matches gateway SHA256 (197,981 startup / 255,421 deferred gzip9 bytes); original DB container/inventory preserved; own test contexts reset/closed and 4313/4314 clear. Tablet capture artifact resolved with fresh/settled one-header proof, without app changes. Fifteen of 35 tasks complete; T16 remains TODO and T29 ACTIVE. Superpowers remains disabled through 2026-10-26T07:16:38Z. No push/publication/deployment. Basic date entry, schematic map and accepted-only request summary are deliberate T16–T18 seams. Full performance/accessibility and raw-chunk warnings remain T32/T33-owned.

---

<a id="t16"></a>

### Task 16: T16 — Date wheel, Jalali calendar, linked GLSL chart, and apply behavior

**Milestone:** M3 · **Depends on:** T03, T10, T13, T15 · **Spec:** §5, §12

**Files — create unless introduced by a dependency; then modify:**

- `apps/web/src/features/dates/date-explorer.tsx`
- `apps/web/src/features/dates/date-wheel.tsx`
- `apps/web/src/features/dates/date-calendar.tsx`
- `apps/web/src/features/dates/date-state.ts`
- `apps/web/src/features/dates/date-state.spec.ts`
- `apps/web/src/features/dates/date-price-jobs.ts`
- `apps/web/src/features/dates/use-date-prices.ts` and focused tests
- `apps/web/src/features/dates/date-interaction.ts` and focused tests
- `apps/web/src/features/search/use-search-controller.ts` and consumer integration
- `libs/client/src/api-client.ts`
- `libs/graphics/src/host.ts` plus browser-safe TS/ESLint alias
- `libs/graphics/src/scenes/price-chart-scene.tsx`
- `libs/graphics/src/shaders/price-chart.frag.glsl`
- `libs/ui/src/components/price-chart-fallback.tsx`
- `tests/e2e/src/date-explorer.spec.ts`
- `tests/e2e/src/date-corrections.spec.ts`

**Interfaces:**

- Consumes: getDatePrices/datePriceKey, DatePriceCell states, pure calendar helpers, GraphicsView, controlled search controller.
- Produces: DateExplorer with controlled preview/commit and controller-owned dateInteractions lease; DateWheel; DateCalendar with provisional apply/cancel; PriceChartScene/shared gap geometry and semantic SVG/DOM fallback; typed date-price transport, coalesced inventory jobs and original-observation freshness/cache lifecycle.

- [x] **T16.1 — Pin preview/commit and date rules**

Test one committed request after settle, no request per drag frame, pointer cancel restore, chart-point synchronization, all missing-price states, calendar apply/cancel, and focus return. Include same-day valid returns and invalidated return requiring reselection.

- [x] **T16.2 — Run date tests red**

Run pnpm nx test web and create @dates e2e cases. Use fake timers for the 250 ms target, and real pointer/keyboard events for the rendered component.

- [x] **T16.3 — Implement the wheel and calendar**

Implement five visible rows, edge fading, centered focus, snap on release, arrows/keyboard/click alternatives, and price/coverage text. Use React Aria plus the Persian calendar implementation; preserve local date-only values.

- [x] **T16.4 — Implement chart and cache wiring**

Render minimum eligible fares from DatePriceSnapshot with shared GLSL uniforms and semantic labels. Click selects the corresponding date. Gap missing states; preserve minima when sorting results. For return changes, keep the opposite leg in the query/cache key.

- [x] **T16.5 — Verify physical interaction**

Run pnpm nx run e2e:e2e --grep @dates. Inspect touch/pointer drag, wheel scrolling without trapping the page, month jumps, no-offer days, loading, RTL labels, Jalali leap boundaries, and keyboard focus at desktop/mobile sizes.

- [x] **T16.6 — Review and commit**

Compare the production interaction against the accepted throwaway wheel/calendar roles; do not copy prototype fake pricing or date restrictions. Record screenshot/interaction evidence and commit the date experience.

**Acceptance:** Nearby exploration and longer jumps work together, with truthful price states and exactly controlled query commits.

**T16 checkpoint — 2026-10-25:** Complete at source `4ba35d8`, original evidence `1525c60`, correction `310a882` and report `8f4a340`. Initial independent review reproduced three P2s: expired pricing, a wheel submission after same-date history navigation, and calendar Apply using an obsolete party/route. Fresh correction review marks all three ADDRESSED with no new actionable finding; four independent focused probes pass. Final focused tests pass (web 46, client 25, UI 16, graphics 22), along with 48 affected validation tasks across 13 projects (42 cached), original tools 20 and correction browser 14. Initial coverage comprises 32 distinct browser cases across documented closure runs. Corrected production Docker/Chrome proves one-way and complete-round-trip date/search minima equivalence (15,660,000 and 26,622,000 IRR), stable inventory batches, obsolete-calendar closure, same-date wheel cancellation, exactly three explicit searches, responsive/fixed-map bounds, native WebGL2 and two-session access/reset isolation. Every built JS asset matches gateway SHA256; gzip9 totals are 224,728 startup and 255,060 deferred bytes including theme bootstrap. The original database container and exact immutable inventory fingerprints remain preserved (2 fixture versions, 90 places, 308 hotels, 924 rate templates); owned contexts reset/closed and ports 4313/4314 clear. Sixteen of 35 tasks complete; T17 TODO, T29 ACTIVE. See [checkpoint](../../evidence/T16/checkpoint.md) and [packaged evidence](../../evidence/T16/packaged/README.md). Month-batch latency, full performance/accessibility audits and existing raw-chunk/Three warnings remain T32/T33-owned. No push, publication, deployment or application submission. Superpowers remains disabled through 2026-10-26T07:16:38Z.

---

<a id="t17"></a>

### Task 17: T17 — Compact comparison results, provider groups, filters, and stable updates

**Milestone:** M3 · **Depends on:** T08, T09, T15 · **Spec:** §3–§4, §12

**Files — create unless introduced by a dependency; then modify:**

- `apps/web/src/features/results/results-page.tsx`
- `apps/web/src/features/results/journey-card.tsx`
- `apps/web/src/features/results/provider-offers.tsx`
- `apps/web/src/features/results/result-filters.tsx`
- `apps/web/src/features/results/results-reducer.ts`
- `apps/web/src/features/results/explanation.tsx`
- `apps/web/src/features/results/results-reducer.spec.ts`
- `apps/web/src/features/results/use-results.ts` and focused tests
- `apps/web/src/features/results/scroll-anchor.ts` and ownership tests
- `apps/web/src/features/results/results-page.spec.tsx`
- `apps/web/src/features/results/result-filters.spec.tsx`
- `apps/web/src/features/results/results-ownership.spec.tsx`
- `apps/web/src/features/search/search-page.tsx` and controller integration/tests
- `tests/e2e/src/results.spec.ts`
- `tests/e2e/src/results-corrections.spec.ts`
- `tests/e2e/src/date-corrections.spec.ts` (asserted own-session cleanup helper)

**Interfaces:**

- Consumes: SearchSnapshot stream, ranked ComparisonGroup/Explanation/Suggestion, controlled search state.
- Produces: ResultsPage/ResultsList with live isCurrent() ownership; JourneyCard; exact provider/fare selection; adopted/latest staging reducer and bounded anchor helper; onPreviewItinerary/onPinItinerary/onSelectQuote callbacks. Controller resultIsCurrent/previewResultItinerary/pinResultItinerary guard the accepted generation/search pair; keep it separate from supersession ownership.

- [x] **T17.1 — Pin stable ordering and selection**

Test initial reorder, freeze after scroll/focus/open/select, staged update notice, explicit adoption, sort/filter reset, invalidated quote visibility, and no stale-generation overwrite. Assert choosing a provider updates all fare conditions and total.

- [x] **T17.2 — Run reducer and e2e tests red**

Run pnpm nx test web. Define @results fixtures with the slow provider cheaper than early offers so an accidental reorder is observable.

- [x] **T17.3 — Implement dense cards and details**

Show provider, whole-party price, local date/time, operator logo, duration, route codes, baggage/refund terms, and ordered stops. Airport names appear on hover and focus. Use DOM route timelines and keyboard-expandable provider groups.

- [x] **T17.4 — Implement sorting and filters**

Wire the three segments to deterministic server/domain order; change wording to stops for flights and transfers for ground modes. Localize factual explanations and one contextual suggestion. Keep unknown mandatory totals separate and non-actionable.

- [x] **T17.5 — Implement staged arrival adoption**

Keep visible order/selection stable after interaction. Show count/coverage of staged updates and an explicit apply action. Mark invalid quotes promptly even when the list order is frozen. Preserve scroll anchor when adopting.

- [x] **T17.6 — Verify and commit**

Run web tests and pnpm nx run e2e:e2e --grep @results. Validate price/conditions/tooltip behavior in all modes, late arrivals, empty/partial coverage, and whole-party labels. Commit results.

**Acceptance:** Results feel like a trustworthy comparison product and remain stable while the user inspects them.

**T17 checkpoint — 2026-10-25:** Complete at source `d9feb83`, original report `83566f5`, correction `ba1835d`, correction report `4ce2fd6` and evidence clarification `dde5b6c`. Independent review reproduced obsolete result pin/preview callbacks, retained canceled filter drafts and invalid-draft Clear; a fresh correction review marks all three P2s ADDRESSED, with seven independent focused cases passing and no new actionable finding. Final web 79 and 19 affected tasks (14 cached) pass; original client 25 and broader 426 assertions remain separately attributed. Browser evidence is documented run/closure unions, not invented single all-green executions; all six hero mode/scope complete RT queries, party four and 36 width/theme checks are retained. Corrected production Docker/Chrome passes real cheaper-late adoption (18,180,000→17,460,000 IRR; anchor delta 0.03125 px), two-adult complete RT provider/condition selection, keyboard sort, filter Cancel/Clear, native Back/reload without implicit search, responsive layout and two-session 404/reset isolation. Native Back had already detached the old DOM; direct same-turn callback fencing is proven by actual SearchPage focused probes, not that browser receipt. Reference production first useful/complete timings are 400.80 / 1,721.19 ms. Every JS asset matches gateway SHA256; gzip9 startup 237,948 / deferred 255,061 bytes including theme bootstrap. Original database container and exact immutable 2/90/308/924 fingerprints remain preserved; owned contexts reset 201/closed and ports 4313/4314 clear. Seventeen of 35 tasks complete; T18 TODO, T29 ACTIVE. [Checkpoint](../../evidence/T17/checkpoint.md) and [packaged evidence](../../evidence/T17/packaged/README.md) retain failures, legacy cleanup limitations, exact archives and evidence boundaries. Full audits and existing chunk/Three warnings remain T32/T33-owned. No push/publication/deployment/application submission; Superpowers remains disabled through 2026-10-26T07:16:38Z.

---

<a id="t18"></a>

### Task 18: T18 — Link map selection, route details, camera, and referral progress

**Milestone:** M3 · **Depends on:** T14, T17 · **Spec:** §6, §8

**Files — create unless introduced by a dependency; then modify:**

- `apps/web/src/features/map/trip-map.tsx`
- `apps/web/src/features/map/map-state.ts`
- `apps/web/src/features/map/map-state.spec.ts`
- `apps/web/src/features/map/route-timeline.tsx`
- `apps/web/src/features/map/route-direction-control.tsx`
- `tests/e2e/map-flow.spec.ts`

**Interfaces:**

- Consumes: RouteScene, search controller, result preview/pin/select callbacks, canonical itinerary.
- Produces: TripMap view model; route hover/focus/pin restoration; textual timeline parity; referral progress transition API.

- [x] **T18.1 — Pin the map state machine**

Assert dot/dropdown parity, origin endpoint activation, illustrative-to-actual route transition, hover preview restoring the pinned route, deliberate camera fit only on pin, and independent round-trip direction. Sorting and result scrolling must not change camera intent.

- [x] **T18.2 — Run map-state tests red**

Run pnpm nx test web. Use two itineraries with different connection cities to expose incorrect preview restoration.

- [x] **T18.3 — Wire the scene and timeline**

Pass one authoritative itinerary/direction to map and DOM timeline. Display city order, local arrival/departure, waits, vehicle/airport changes, and required transfer segments. Keep labels accessible and retain the main-map breakpoint.

- [x] **T18.4 — Wire vehicle progress**

Advance 0/35/70/100% at endpoint/comparison/selected-quote/confirmed-referral states. Failed or changed-quote checks do not complete the journey. Reduced motion places the sprite directly; a prior selection is not falsely confirmed.

- [x] **T18.5 — Verify and commit**

Run web tests and pnpm nx run e2e:e2e --grep @map-flow. Test pointer and focus previews, explicit zoom, round-trip direction, responsive hide/show, long scrolling, and unavailable selected offers. Commit map integration.

**Acceptance:** Map, result details, and referral progress describe the same journey without camera surprises or booking claims.

**T18 checkpoint — 2026-10-25:** Complete at source342e68d, native selector89c2a16 and correctionsbb37d01/4e07347. Initial independent review reproduced3P2s: same-turn map/controller split, lost mixed-input preview and repeated-stop duplication/order. A fresh correction reviewer marks all ADDRESSED with18independent checks passing, including its additional known-timestamp occurrence RED→GREEN. Final web104/graphics26, affected38targets(28cached), consumer5/5 and unchanged laboratory6/6 pass on4e07347. Root rebuilt Docker and independently verifies physical dot/dropdown selection,35/70/preview, native mixed-input ownership, canonical timeline, camera/direction/zoom/wheel/theme, mobile390px unmount/text/restore, native context loss/recovery and unchanged edited draft inspection. Final originalGL observation:1context/62compiled-linked programs/555draws/5framebuffer colors,noerrors; these are bounded observations, not universal performance claims. Every productionJS asset matches gatewaySHA256; gzip9startup244565/deferred256183bytes. Original database container/full-row immutable fingerprints preserved; final owned contexts reset201/closed and4313/4314free. The earlier single interrupted lost-cookie scope remains explicitly left to normal expiry; no guessed cleanup is claimed. Final traces redact transient owned demo headers; report/manifests retain the evidence correction and local-history boundary. Eighteen of35tasks and M3 complete; T19TODO,T29ACTIVE. [Checkpoint](../../evidence/T18/checkpoint.md), [fresh review](../../evidence/T18/task-18-correction-review.md) and [production evidence](../../evidence/T18/packaged/README.md). Referral UI remains T22; full audits/polish remain T27/T32/T33. No push, publication, deployment or application submission; Superpowers disabled through2026-10-26T07:16:38Z.

---

<a id="t19"></a>

### Task 19: T19 — Optional simulated identity, saved searches, and preferences

**Milestone:** M4 · **Depends on:** T04, T12, T15 · **Spec:** §8

**Files — create unless introduced by a dependency; then modify:**

- `apps/api/src/auth/demo-auth.module.ts`
- `apps/api/src/auth/demo-auth.controller.ts`
- `apps/api/src/saved-searches/saved-search.service.ts`
- `apps/api/src/saved-searches/saved-search.controller.ts`
- `apps/api/src/auth/demo-auth.integration.spec.ts`
- `apps/web/src/features/account/demo-login.tsx`
- `apps/web/src/features/account/saved-searches.tsx`
- `tests/e2e/guest-and-saved.spec.ts`

**Interfaces:**

- Consumes: SessionContext, DemoIdentity/SavedSearch schemas, search URL/controller, shared Dialog.
- Produces: Explicit demo Torob sign-in/sign-out endpoints; save/list/delete search intents; optional account UI with local theme preference.

- [x] **T19.1 — Pin guest and identity behavior**

Assert guest search/referral is unrestricted; saving can prompt simulated identity; login preserves current query/selection; reopening a saved search requests fresh prices. Another session cannot read saved searches.

- [x] **T19.2 — Run identity tests red**

Run pnpm nx run api:test-integration. Define @guest-saved e2e cases with no email/OTP/network dependency.

- [x] **T19.3 — Implement simulated identity**

Use clear Persian copy for Continue with Torob — demo, one-click simulation, and sign-out. Persist identity only within the reviewer sandbox. No password/email capture, real OAuth redirect, or third-party SDK.

- [x] **T19.4 — Implement saved intent and preferences**

Save normalized query intent with a display name; list/delete it; reopening restores inputs and executes a fresh search. Keep theme preference local and restore guest context on sign-out.

- [x] **T19.5 — Verify and commit**

Run API integration and pnpm nx run e2e:e2e --grep @guest-saved. Confirm reset removes session saves and the main journey never acquires a login gate. Commit optional identity.

**Acceptance:** Optional identity adds useful persistence while the entire core comparison/referral flow remains available to guests.

**T19 checkpoint — 2026-10-25:** Complete at product `9191eff` / formatting `875fb02`, corrections `58f4e58` / `8eec6b3`, and evidence `a022be9`. Initial independent review reproduced twoP2s: stale raw account methods after failed reset and row actions after dialog dismissal. Fresh correction review marks both ADDRESSED with20checks passing, including the subsequent same-dialog canceled/replacement form REDs, current retry/action controls and unmasked StrictMode/real-unmount checks. Root's native20-row mobile boundary exposed scrolling Close out of view; the account-only opt-in persistent header fixes it, with unchanged other-dialog defaults. Final web123/UI16/client27, realHTTP/PG91, affected48targets(32cached) and native4/4 pass. Backend/API/contracts/client/data/migration source is identical875fb02→8eec6b3; server proof retains that attribution. Root final Docker/Chrome verifies exact fare70/query/URL/camera preservation,2fresh identical saved reopens, theme/list reload/delete, covered renderer idle, mobile/Escape and20-row final action plus visible Close/title. Gateway JS SHA256matches localbuild; gzip9startup248216/deferred256192bytes. Original DB container and exact immutable fingerprints preserved, three migrations ready; final root/native scopes reset201/closed, exact owned test containers/volume/connection file removed and4313/4314/62311free. Test random-port restart failure was repaired only in the owned resource; raw failures remain separately redacted/attributed. Root verifies61archive members and15independent review artifact hashes. Nineteen of35tasks complete; M4inprogress,T20TODO,T29ACTIVE. [Checkpoint](../../evidence/T19/checkpoint.md), [fresh review](../../evidence/T19/task-19-correction-review.md), [production evidence](../../evidence/T19/packaged/README.md). No push/publication/deployment/submission; Superpowers disabled through2026-10-26T07:16:38Z. Hotel/handoff/polish/full audits retain their planned later scope.

---

<a id="t20"></a>

### Task 20: T20 — Hotel eligibility, stay pricing, distance sorting, and recheck

**Milestone:** M4 · **Depends on:** T03, T04, T05, T11 · **Spec:** §7–§9

**Files — create unless introduced by a dependency; then modify:**

- `libs/domain/src/hotels/allocate-rooms.ts`
- `libs/domain/src/hotels/price-stay.ts`
- `libs/domain/src/hotels/distance.ts`
- `libs/domain/src/hotels/rank-hotels.ts`
- `libs/domain/src/hotels/hotels.spec.ts`
- `apps/api/src/hotels/hotel.module.ts`
- `apps/api/src/hotels/hotel.controller.ts`
- `apps/api/src/hotels/hotel.service.ts`
- `apps/api/src/hotels/hotel-recheck.ts`
- `apps/api/src/hotels/hotel.integration.spec.ts`

**Interfaces:**

- Consumes: HotelSearchQuery/RoomRate/RoomAllocation/HotelQuoteSnapshot, seeded catalog, money/time rules, RecheckRegistry.
- Produces: allocateRooms; priceStay; straightLineKm; rankHotels; searchHotels; hotel recheck handler using the same referral lifecycle.

- [x] **T20.1 — Pin occupancy and total-stay cases**

Test all requested nights and rooms, rate inventory, required child ages, breakfast/refund variants, missing fees, early local arrival, same-day trip, different time zones, unknown stars/distances, and custom points. Assert a cheap two-person room cannot price a five-person one-room party.

- [x] **T20.2 — Run hotel tests red**

Run pnpm nx test domain and pnpm nx run api:test-integration. Use a fixture where the cheapest nightly rate is not the cheapest eligible stay total.

- [x] **T20.3 — Implement allocation and pricing**

Enumerate eligible room/rate allocations under the requested room count and policy, with bounded party size. Price every night and mandatory charge in integer rials. Return a concrete allocation, breakdown, eligibility reasons, and immutable quote version.

- [x] **T20.4 — Implement dates and four sorts**

Use destination-local arrival/check-out suggestions but validate hotel dates independently. Compare stars, lowest total, arrival-point distance, and custom-point distance with the documented tie breaks. Compute and label straight-line kilometers; unknown values sort last.

- [x] **T20.5 — Register recheck and persistence**

Persist HotelSearchRun and quotes, apply the same expiry/intents/idempotency as transport, and register the hotel handler in RecheckRegistry. Price-change/sold-out scenarios must affect hotels as well.

- [x] **T20.6 — Verify and commit**

Run domain/API integration tests, including multi-room child occupancy, last available night, stays outside coverage, a changed room term, and foreign-session quote access. Commit hotel engine.

**Acceptance:** Hotel comparisons show an actually eligible whole-stay allocation and participate in the same trustworthy referral process.

**T20 checkpoint — 2026-10-26:** Complete at product `4bb328e`, identity/order corrections `e63fca5`/`7c248da`, recovery/cancellation corrections `3d35a27`/`cc4aea0`, and evidence `2931eb7`/`e79e9ab`/metadata-free archive `9a3c426`. Exact-room/party/all-night source-backed stays preserve ages, unknown policies/fees and per-room terms; four sorts/date/distance helpers and fresh persisted snapshots participate in shared versioned/idempotent referral authority. Whole independent review and a different fresh reviewer close all C1–C4; ordering39/39 keeps7c248da attribution (source unchanged through finalcc4aea0), recovery6/6 is finalcc4aea0 with original243-case oracle. Final pure/server484, API/PG106, affected48(14cached), root14-property/42-rate exhaustive stay-price oracle, changed/soldout alternative/version/scope proofs and real pre-upgrade transport intent confirmation pass. Original DB container/immutable fingerprints and3migrations preserved; servedJS hashes match, gzip9startup249123/deferred256193bytes. Own contexts reset{}201/disposed; exact test container/volume/connection files removed,62320closed. Root verifies17review artifacts/7source hashes and53committed payloads in54actual metadata-free archive members; original108-member AppleDouble packaging failure retained separately. Twenty of35complete; M4inprogress,T21TODO,T29ACTIVE. [Checkpoint](../../evidence/T20/checkpoint.md), [fresh review](../../evidence/T20/task-20-correction-review.md), [production evidence](../../evidence/T20/packaged/README.md). No hotel UI/nativeGL claim, real provider/OAuth/payment/booking/LLM, push/publication/remote deployment/submission; Superpowers disabled through2026-10-26T07:16:38Z.

---

<a id="t21"></a>

### Task 21: T21 — Hotel discovery modal, custom-location map, and trip-state restoration

**Milestone:** M4 · **Depends on:** T12, T13, T14, T15, T20 · **Spec:** §7, §12

**Files — create unless introduced by a dependency; then modify:**

- `apps/web/src/features/hotels/hotel-entry.tsx`
- `apps/web/src/features/hotels/hotel-dialog.tsx`
- `apps/web/src/features/hotels/hotel-card.tsx`
- `apps/web/src/features/hotels/room-rates.tsx`
- `apps/web/src/features/hotels/hotel-dates.tsx`
- `apps/web/src/features/hotels/location-picker.tsx`
- `apps/web/src/features/hotels/hotel-state.ts`
- `apps/web/src/features/hotels/hotel-state.spec.ts`
- `tests/e2e/hotel-discovery.spec.ts`

**Interfaces:**

- Consumes: HotelSearchSnapshot, hotel query client, OSM-vector/MapLibre adapter, current trip arrival/return context, shared Dialog.
- Produces: Hotel entry action, desktop modal/mobile full-page modal, editable stay/room state, all four sorts, custom point picker, onSelectHotelQuote.

- [x] **T21.1 — Pin opening, edits, and restoration**

Test selected-itinerary arrival-local defaults, required arrival confirmation without a selection, required one-way checkout, optional return suggestion, and independent hotel edits. Closing must restore exact ticket scroll/filter/selection/camera and trigger focus.

- [x] **T21.2 — Run hotel UI tests red**

Run pnpm nx test web and define @hotels e2e scenarios. Include a trip-date change while an independently edited hotel stay exists.

- [x] **T21.3 — Implement hotel browsing**

Show eligible total stay for all rooms, secondary nightly figure, stars, conditions, room allocation, breakfast, cancellation, and fees. Add sorting and arrival-point selection when unknown; never default all modes to airport distance.

- [x] **T21.4 — Implement location selection**

Open a real official OSM vector street map on demand using MapLibre, with landmark search and provisional pin selection. Support it on mobile while the main travel map stays hidden. No account or key is required; verify real network-loaded styles/tiles. Keep a truthful unavailable state with landmark/list/coordinate selection when needed, never a dotted or fabricated basemap. Show straight-line units and preserve required attribution.

- [x] **T21.5 — Implement modal/canvas coordination**

Pause the underlying scene, preserve its state, and ensure native dialog focus/scroll/pointer semantics. Confirm trip changes through an update suggestion; never overwrite user hotel dates silently.

- [x] **T21.6 — Verify and commit**

Run web tests and pnpm nx run e2e:e2e --grep @hotels. Check desktop/modal and mobile/full-page forms, multi-room eligibility, early-arrival note, no-match recovery, keyboard focus, custom pin, and exact restoration. Commit hotel discovery.

**Acceptance:** Hotels feel integrated with the trip while remaining an optional, independent comparison flow.

**Historical T21 active checkpoint (superseded below) — 2026-10-26:** Source `d960359` with correction `69b518d`, core review `66136a1`, fresh review `d6770fc`/native-sizing annotation `a3732a1`, implementation evidence `ae788f4`. All four confirmed review findings are addressed; original5 and fresh6 independent behavior checks pass. Current web/client/graphics/UI216 tests, lint/types/builds pass; optional legacy verify:boundaries text matcher fails while rejecting both forbidden imports (recorded limitation, no rule weakened). Worker native5 cases yield3PASS/2live-map failures; every owned scope reset{}201. Corrected default Docker, gatewayJS/CSS SHA256, preserved original DB/container/immutable inventories and3migrations pass. Root packaged3 controlled-network-failure cases pass exact whole-stay/sorts/selection/scroll/camera/focus, mobile train references and genuine Back/Forward/explicit trip update. Native15marker targets measure44×44; independent reviewer confirms receipt. Startup/app-deferred JS gzip9 are262005/256190bytes; lazy map SDK293456 +worker147228 +CSS10102bytes are disclosed separately; aggregate JS958879/CSS20794bytes excludes variable remote tiles/fonts. Earlier styles200 then current host/browser requests time out; user-requested fresh recheck still reaches loading→unavailable. No real street/Persian-label/click/theme-camera acceptance is claimed. T21.4/.6 stay open,20/35tasks complete,T22TODO,T29ACTIVE. [Checkpoint](../../evidence/T21/checkpoint.md), [packaged proof](../../evidence/T21/packaged/README.md), [fresh review](../../evidence/T21/task-21-free-map-review.md). No account/key/billing changes, push, publication, remote deployment or submission; Superpowers remains disabled through2026-10-26T07:16:38Z.

**T21 complete — 2026-10-26:** Official OSM vector styles (`50381c8`) resolve the earlier host failures. Correction `dd09ee5` prevents a mobile route preview from shrinking during a hotel-button press; native geometry stays stable at 320/390/430px. Independent reviews `241ee40` and `33a8c33` approve the changes, with original failures preserved in evidence `e026bfd`. All 38 affected tasks, five hotel browser cases and four final Docker/Chrome cases pass. Real streets, Persian/local labels, theme/camera retention, native point selection, context loss, network retry and exact ticket/history restoration are verified. Served JS/CSS hashes and original database preservation pass; owned scopes reset explicitly and servers close. Startup/deferred application JS is 262,054 / 256,195 gzip9 bytes; vendor SDK/worker/CSS and variable remote traffic are disclosed separately. **21/35 tasks complete; T22 TODO, T29 ACTIVE.** [Checkpoint](../../evidence/T21/checkpoint.md), [packaged evidence](../../evidence/T21/resume-2026-10-26/README.md), [L1 review](../../evidence/T21/resume-2026-10-26/review/opening-adjudication.md). No remote publication or real booking/provider integration occurred.

---

<a id="t22"></a>

### Task 22: T22 — Traveler referral UI and simulated provider landing page

**Milestone:** M4 · **Depends on:** T11, T17, T18, T19, T21 · **Spec:** §8, §10

**Files — create unless introduced by a dependency; then modify:**

- `apps/web/src/features/referral/referral-controller.ts`
- `apps/web/src/features/referral/recheck-dialog.tsx`
- `apps/web/src/features/referral/provider-handoff.tsx`
- `apps/web/src/features/referral/referral.spec.ts`
- `apps/web/src/routes/provider-demo.tsx`
- `tests/e2e/referral-flow.spec.ts`

**Interfaces:**

- Consumes: Prepare/confirm endpoints, transport/hotel quote selections, map progress API, optional identity and router context.
- Produces: Shared referral controller; changed-term confirmation; sold-out alternatives; /provider-demo/:referralId route; restored return context.

- [x] **T22.1 — Pin user-visible handoff behavior**

Test guest success, unchanged quote, changed total/terms, explicit accept/cancel, expired intent, sold-out alternative, rapid double-click, browser refresh/back, and hotel referrals. A changed offer must never auto-confirm.

- [x] **T22.2 — Run referral UI tests red**

Run pnpm nx test web and define @referral e2e cases that assert the exact accepted price/version on the landing page.

- [x] **T22.3 — Implement recheck UI**

Show a bounded checking state, exact old/new price and material terms, explicit acceptance, and alternatives for unavailable quotes. Preserve context when cancelled or failed. Reuse the same flow for hotels and transport.

- [x] **T22.4 — Implement handoff and return**

Confirm with one stable idempotency key per intent, advance the vehicle only on confirmed referral, and navigate to the local simulated provider page. Show the immutable accepted payload with production-style copy under specification1.4; provide return-to-comparison without losing valid scroll/selection/modal origin.

- [x] **T22.5 — Verify and commit**

Run web tests and pnpm nx run e2e:e2e --grep @referral. Confirm no login gate, no real provider navigation, no duplicate click on refresh, and no booking/payment/confirmation claim. Commit handoff UI.

**Acceptance:** A reviewer can follow an exact, current offer through a complete referral and return to the comparison safely.

**Owner presentation amendment — 2026-10-26 (specification1.4):** Present all currently implemented and future consumer/admin surfaces as an ordinary production product. Remove visible demo/test/fictional copy and placeholder suffixes; preserve truthful technical documentation and the immutable mocked backend. This cross-cutting request is included before T22 closure and does not complete/start T23 or change the35-task denominator.

| Amendment | Scope | Status |
|---|---|---|
| PP1 | Pure metadata presentation helpers; source/unknown preservation | DONE (`c118d9d`;21 helper/39 UI checks) |
| PP2 | Customer shell/account/travel suggestions and English admin copy | DONE (`852cf02`) |
| PP3 | Results/map/hotel/referral presentation and accessible labels | DONE (`7904d4b`) |
| PP4 | Shared graphics/gallery examples and visible-copy audit | DONE (`7904d4b`; final browser labels audited) |
| PP5 | Independent review, regression/native/package evidence | DONE (`76fa70a`, `db7e0be`, `99d5fed`; archive audit PASS) |

**Historical T22 active checkpoint (superseded below) — 2026-10-26:** Core consent/client source `de35c29`, immutable receipt presentation `295dc48` and bounded UI checkpoint codec `8860e2d` are committed. Independent core review `b8f3d1` passes ten behavior probes; this does not approve routing, restoration or the complete task. Existing scoped API oracle passes six transport/hotel unchanged/changed/sold-out cases with explicit reset201 cleanup. Route integration and browser acceptance remain pending. T22 stays ACTIVE; 21/35 tasks complete, T23 TODO and T29 ACTIVE. [Task authority](../../evidence/T22/task-22-brief.md) and [current state](../../evidence/T22/work-state.json).


**T22 complete — 2026-10-26:** Final runtime `852cf02`, test-only policy correction `31b388d`, Docker mirror configuration `fc5ae78`, native evidence `db7e0be`, independent approval `76fa70a` and packaged evidence `99d5fed`. Explicit changed-version consent, same-key uncertain-confirm recovery, immutable transport/hotel receipts, guest referral and valid exact history/cold return are implemented. Hotel referral preserves existing transport progress; only an actual matching transport receipt advances the route. The owner's production-style UI rule is applied and recorded for future work; mock provenance and unknown conditions remain truthful technically. Independent44/44, isolated API/PG106, native9+4 in two runs and packaged9 cases pass. The affected852 run passes35/36 targets; its two obsolete web expectations are corrected by31b and all231 web tests/41files plus lint pass separately. Normal `pnpm docker:up` succeeds using configurable public npm/Prisma mirrors after recorded official-host failures. Final JS/CSS SHA256 matches the gateway; gzip9 startup/deferred app279417/256158bytes, with lazy vendor costs disclosed. Original database/container/2–90–308–924 immutable inventories and3migrations remain preserved; final owned contexts reset201/closed, temporary resources released and4313/4314/62322free. Root verifies450 committed payloads in451 metadata-free archive members,124 independent review/raw artifact hashes,31 native hashes and81 historical candidate source hashes. **22/35 tasks complete; M4 COMPLETE, T23 TODO, T29 ACTIVE.** [Checkpoint](../../evidence/T22/checkpoint.md), [packaged proof](../../evidence/T22/packaged/README.md), [independent review](../../evidence/T22/review/full-review.md), [archive audit](../../evidence/T22/archive-audit.json). Frozen historical sequences unavailable through the API use an explicit fresh-context fallback; legacy exact replay is a backend compatibility guarantee. No remote push/publication/deployment/submission or real provider/OAuth/booking/payment/LLM occurred.

---

<a id="t23"></a>

### Task 23: T23 — Admin shell, scenario controls, provider overrides, and session reset

**Milestone:** M5 · **Depends on:** T04, T12, T06 · **Spec:** §9–§11

**Files — create unless introduced by a dependency; then modify:**

- `apps/admin/src/app.tsx`
- `apps/admin/src/routes.tsx`
- `apps/admin/src/features/demo/scenario-drawer.tsx`
- `apps/admin/src/features/demo/reset-session.tsx`
- `apps/api/src/admin/admin.module.ts`
- `apps/api/src/admin/demo.controller.ts`
- `apps/api/src/admin/demo.service.ts`
- `apps/api/src/admin/demo.integration.spec.ts`
- `tests/e2e/admin-scenarios.spec.ts`

**Interfaces:**

- Consumes: SessionInfo/Scenario schemas, scoped provider registry, UI primitives, session lifecycle.
- Produces: English admin layout and demo-only access; provider/scenario override APIs; revisioned configuration and audit events; reset UX.

- [x] **T23.1 — Pin scoped control effects**

Test pausing/slow/timeout overrides change actual search participation and timing; scenario change increments revision; reset clears only current session. Inspect two browser contexts so one reviewer's controls cannot affect the other.

- [x] **T23.2 — Run controls tests red**

Run pnpm nx run api:test-integration and create @admin-scenarios e2e cases.

- [x] **T23.3 — Implement admin navigation and controls**

Build the four admin areas and compact scenario drawer. Explain that controls affect the current session, using ordinary production-style copy under specification1.4; no credential prerequisite. Expose normal/slow/timeout/price-change/sold-out/conflicting/no-results presets.

- [x] **T23.4 — Implement revision and invalidation**

Persist scoped overrides and audit before applying them. Cancel active affected searches with an explicit reason; invalidate date/hotel caches and expired intents. Existing evidence stays immutable. New searches/rechecks use the new revision. Consumer refresh/focus retrieves updated session configuration.

- [x] **T23.5 — Implement reset recovery**

Explain the reset scope, execute the current session reset, and return to the default preset. Preserve immutable fixtures and other sessions. A recoverable admin error keeps the prior controls visible.

- [x] **T23.6 — Verify and commit**

Run integration tests and pnpm nx run e2e:e2e --grep @admin-scenarios. Compare actual provider run traces before/after a control change. Commit the admin shell and controls.

**Acceptance:** Admin actions have observable backend effects and remain safe for independent concurrent reviewers.

---

<a id="t24"></a>

### Task 24: T24 — Provider health and inspectable search runs

**Milestone:** M5 · **Depends on:** T09, T23 · **Spec:** §10

**Files — create unless introduced by a dependency; then modify:**

- `apps/api/src/admin/provider-health.service.ts`
- `apps/api/src/admin/search-inspection.service.ts`
- `apps/api/src/admin/search-inspection.controller.ts`
- `apps/api/src/admin/search-inspection.integration.spec.ts`
- `apps/admin/src/features/providers/provider-health.tsx`
- `apps/admin/src/features/searches/search-list.tsx`
- `apps/admin/src/features/searches/search-detail.tsx`
- `tests/e2e/admin-searches.spec.ts`

**Interfaces:**

- Consumes: Persisted SearchRun/ProviderRun/raw/normalized/quote/event evidence and current session.
- Produces: Scoped provider summaries, paginated search list/detail, immutable event timeline, new-run replay API and UI.

- [x] **T24.1 — Pin telemetry provenance**

Create a known normal and timeout run. Assert displayed response durations/status/counts derive from recorded events, failed providers are not empty successes, and a zero-activity session has no invented chart points.

- [x] **T24.2 — Run inspection tests red**

Run pnpm nx run api:test-integration. Assert pagination and foreign-session IDs cannot leak raw records.

- [x] **T24.3 — Implement inspection APIs**

Return bounded, paginated summaries and a selected run's coverage, rank inputs, exclusion reasons, source/normalization links, revisions, and request IDs. Raw content is plain data, never executable HTML.

- [x] **T24.4 — Implement admin views and replay**

Build compact tables, filters, detail panels, and event timelines. Replay creates a new search linked to the old one using current settings; old evidence remains unchanged. Show normal/partial/interrupted states clearly.

- [x] **T24.5 — Verify and commit**

Run integration tests and pnpm nx run e2e:e2e --grep @admin-searches. Trace a chosen consumer result to its provider records and explain its order using admin facts. Commit inspection views.

**Acceptance:** The comparison pipeline can be understood from real evidence, including its timing, exclusions, and ranking.

---

<a id="t25"></a>

### Task 25: T25 — Normalization workspace, alias preview, collision checks, and replay

**Milestone:** M5 · **Depends on:** T06, T07, T23, T24 · **Spec:** §4, §10

**Files — create unless introduced by a dependency; then modify:**

- `apps/api/src/admin/mapping.service.ts`
- `apps/api/src/admin/mapping.controller.ts`
- `apps/api/src/admin/mapping.integration.spec.ts`
- `apps/admin/src/features/quality/normalization-list.tsx`
- `apps/admin/src/features/quality/normalization-detail.tsx`
- `apps/admin/src/features/quality/mapping-editor.tsx`
- `tests/e2e/admin-normalization.spec.ts`

**Interfaces:**

- Consumes: NormalizationTrace/Result, MappingPatch/Preview, versioned source records, replay API.
- Produces: Scoped mapping preview/apply endpoints; raw→normalized→group inspection; immutable mapping revisions and reprocessing.

- [x] **T25.1 — Pin material correction behavior**

Use a rejected alias fixture. Preview a valid canonical mapping and an invalid cross-entity/colliding mapping. Assert only valid preview can apply; revision changes affect a replay but do not mutate the old quote or source trace.

- [x] **T25.2 — Run mapping tests red**

Run pnpm nx run api:test-integration. Assert stale preview revisions require refresh before apply.

- [x] **T25.3 — Implement preview and apply**

Scope alias keys by provider namespace/entity type. Return affected record IDs, before/after normalized fields, candidate grouping changes, and collision issues. Apply in a transaction with audit/revision and invalidate relevant cached queries.

- [x] **T25.4 — Implement the quality workspace**

Display source fields beside normalized fields, reasons, unknown values, and grouping outcome. Let reviewers preview/apply a correction and explicitly replay. Render hostile-looking provider strings safely as text.

- [x] **T25.5 — Verify and commit**

Run integration tests and pnpm nx run e2e:e2e --grep @admin-normalization. Show one rejected record becoming valid in a new search while historic evidence remains unchanged. Commit normalization workspace.

**Acceptance:** Reviewers can demonstrate and audit a real data-quality correction without a hidden or destructive rewrite.

---

<a id="t26"></a>

### Task 26: T26 — Referral analytics and end-to-end provenance trail

**Milestone:** M5 · **Depends on:** T11, T23, T24 · **Spec:** §8, §10

**Files — create unless introduced by a dependency; then modify:**

- `apps/api/src/admin/referral-inspection.service.ts`
- `apps/api/src/admin/referral-inspection.controller.ts`
- `apps/api/src/admin/referral-inspection.integration.spec.ts`
- `apps/admin/src/features/referrals/referral-list.tsx`
- `apps/admin/src/features/referrals/referral-detail.tsx`
- `tests/e2e/admin-referrals.spec.ts`

**Interfaces:**

- Consumes: ReferralEvent/Intent and immutable quote/search/source evidence; session scope.
- Produces: Factual ReferralMetrics and paginated trail linking source, search, selection, recheck, accepted version, and handoff.

- [x] **T26.1 — Pin real metric counts**

Create one successful transport referral, one hotel referral, a changed-price cancellation, and a duplicate confirmation. Assert only two confirmed referrals, no duplicate landing-refresh count, and no booking/revenue inference.

- [x] **T26.2 — Run analytics tests red**

Run pnpm nx run api:test-integration. Include a second session with independent counts and safe empty-state output.

- [x] **T26.3 — Implement metrics and joins**

Count recorded events with precise definitions; expose provider/type/time filters and exact price/condition versions. Join through immutable evidence IDs. Missing conversion reporting stays unknown rather than zero bookings.

- [x] **T26.4 — Implement the referral views**

Show concise counts, provider distribution, event table, and a source-to-handoff detail panel. Include changed/cancelled/unavailable recheck states without mislabeling them as outbound clicks.

- [x] **T26.5 — Verify and commit**

Run integration tests and pnpm nx run e2e:e2e --grep @admin-referrals. Complete a consumer referral and locate its exact record in admin. Commit referral evidence.

**Acceptance:** Monetization-related evidence is accurate, bounded to recorded clicks, and traceable to the accepted offer.


**M5 complete — 2026-10-26:** T23backend `e895f10`, T24backend `27868e0`, T25backend and independent reviews `fb5366d`, T24frontend review `12e3d8a`, integrated frontend/T26/assembly `264cdb4`. All21 T23–T26 subtasks close. Operational controls persist scoped revisions/audits, stop affected live work, preserve completed evidence and detect foreground namespace changes. Search/provider views expose actual bounded processing evidence and new terminal-run replay; city-alias preview/apply/replay materially fixes authored rejected data without rewriting history. Referrals use recorded event counts, independent filtered tables and exact accepted offer/source lineage, with no invented conversions. Independent T23seven, T24five+four+six across separate runs, T25ten and T26eight probes approve current scope. Final48/48 affected checks, real PostgreSQL121/16files plus corrected T26two cases in a separate run, normal Docker startup and four actual packaged Chrome journeys pass. Evidence commit `ae3939f` retains201 committed payloads in202 verified metadata-free archive members. Original DB/container/full immutable2/90/308/924 inventories and3migrations remain preserved; consumer/admin served JS/CSS SHA256 match builds. Owned test DB/volume removed; scoped browsers reset201/closed,4313/4314/62325free. Desktop/dark/mobile admin was visually checked; all original harness/source failures remain attributed. Preview caps500 public-comparison evidence rows/runs/revisions explicitly; only effective city-alias operations are offered. **26/35 tasks complete; M5 COMPLETE, T27 TODO, T29 ACTIVE.** No owner inputs required. [M5 checkpoint](../../evidence/M5/checkpoint.md), [packaged acceptance](../../evidence/M5/packaged/README.md), [archive audit](../../evidence/M5/archive-audit.json), task checkpoints [T23](../../evidence/T23/checkpoint.md), [T24](../../evidence/T24/checkpoint.md), [T25](../../evidence/T25/checkpoint.md), [T26](../../evidence/T26/checkpoint.md). No remote push/publication/deployment/submission or real provider/OAuth/booking/payment/LLM occurred.

---

<a id="t27"></a>

### Task 27: T27 — Flat artwork, coordinated motion, and all theme transitions

**Milestone:** M6 · **Depends on:** T12, T13, T14, T16, T17, T21 · **Spec:** §6, §12

**Files — create unless introduced by a dependency; then modify:**

- `libs/ui/src/illustrations/empty-route.tsx`
- `libs/ui/src/illustrations/provider-delay.tsx`
- `libs/ui/src/illustrations/hotel-stay.tsx`
- `libs/ui/src/icons/transport-icons.tsx`
- `libs/ui/src/theme/theme-transition.ts`
- `libs/ui/src/motion/motion-policy.ts`
- `libs/graphics/src/shaders/ambient.frag.glsl`
- `assets/provenance.json`
- `tests/e2e/theme-motion.spec.ts`

**Interfaces:**

- Consumes: Six token palettes, scene lifecycle/uniform bridge, established app feature states.
- Produces: Local flat illustration/icon set, meaningful microinteraction policy, synchronized View Transition theme update, reduced-motion behavior.

- [x] **T27.1 — Author the visual assets**

Create flat city/travel/empty/loading illustrations and fictional provider/operator marks consistent with the compact interface. Prefer tokenized SVG for themeable artwork. If raster art is needed, use the image-generation skill and bundle approved outputs/provenance locally.

- [x] **T27.2 — Implement useful motion**

Use Motion for list/detail/modal transitions and flat vehicle/interface accents; GLSL for route/chart/selected atmospheric emphasis. Preserve layout stability and avoid animating large lists on every provider arrival.

- [x] **T27.3 — Implement theme coordination**

Apply persisted/system appearance before first paint. Preserve animation:none and mix-blend-mode:normal on old/new root View Transition pseudo-elements. Implement runThemeTransition(nextTheme, {onApplied?: () => Promise<void>}) in UI; the web app supplies the graphics callback so UI does not import graphics. Update CSS tokens and GPU uniforms before the new frame; use the 260 ms reveal or direct fallback.

- [x] **T27.4 — Verify motion and all palettes**

Run pnpm nx run e2e:e2e --grep @theme-motion. Inspect all three transport modes in light/dark, interrupted rapid toggles, reduced motion, unsupported View Transition, and WebGL fallback. Verify no stale shader color flash.

- [x] **T27.5 — Review and commit**

Inspect actual desktop/mobile interactions and token coverage; document the purposeful motion rules. Commit artwork/motion with screenshots and asset provenance.

**Acceptance:** The product has a coherent flat visual identity, rich but purposeful motion, and fully coordinated CSS/GLSL themes.

---

<a id="t28"></a>

### Task 28: T28 — Failure recovery and coherent state across features

**Milestone:** M6 · **Depends on:** T09, T10, T16, T17, T18, T20, T21, T22, T24, T25 · **Spec:** §4–§10

**Files — create unless introduced by a dependency; then modify:**

- `libs/ui/src/components/recovery-state.tsx`
- `libs/client/src/error-policy.ts`
- `apps/web/src/features/recovery/search-recovery.tsx`
- `apps/web/src/features/recovery/stay-recovery.tsx`
- `apps/admin/src/features/recovery/admin-recovery.tsx`
- `tests/e2e/recovery-scenarios.spec.ts`

**Interfaces:**

- Consumes: Stable API error codes, terminal search states, snapshot fallback, all demo scenarios.
- Produces: Consistent partial/empty/error/expired/interrupted recovery flows, retry policy, and precise Persian/English recovery copy.

- [x] **T28.1 — Pin the scenario recovery matrix**

Create one e2e case for each scenario plus session expiry, interrupted API restart, broken SSE with working REST, unsupported route from a URL, and a scenario revision changed in another tab.

- [x] **T28.2 — Run recovery cases red**

Run pnpm nx run e2e:e2e --grep @recovery. Identify which current state loses query intent or implies missing providers returned no offers.

- [x] **T28.3 — Implement recovery actions**

Offer retry, apply updated results, change date, relax only the chosen filter, select a supported route, or choose another quote as appropriate. Keep user intent visible. Do not silently change dates/filters or reset hotel edits.

- [x] **T28.4 — Reconcile stale selections**

On scenario/mapping/session changes, refresh metadata, invalidate only affected caches, label retained evidence, and require a fresh quote before referral. Detect disconnected/recovered transport without false all-provider success.

- [x] **T28.5 — Verify and commit**

Run the recovery suite plus affected client/web tests. Confirm all actions work by keyboard and no blank/error-only dead end remains. Commit coherent recovery.

**Acceptance:** Every seeded failure has an honest explanation and an actionable way forward without hidden changes to the user's trip.

**M6 complete — 2026-10-26:** T27 artwork/motion290f24e, themes833f4df/db5d170; T28 core7b92720; integrated compositionc10da8b; final credential/copy correction6451d55; independent correction review1e41193; acceptance assertionsa23dd5f. All10 T27–T28 subtasks close. Shared finite motion and semantic CSS/GLSL themes retain one renderer/scheduler and camera intent. Recovery preserves edited trip/hotel/admin intent while revoking obsolete quote/referral authority. Ordinary responses never echo/clear credentials; explicit bootstrap/reset alone issues a browser-session cookie, with PostgreSQL24h inactivity authoritative. Final affected40/40, native M6 twenty and separate referral/account/admin seventeen cases pass. Dedicated actual HTTP/lifecycle20pass; fullPG125/126 with only an obsolete cookie-header assertion corrected and its9-case auth file passing separately. Independent combined T27eight plus five-source binding review, T28core8 then14, UI13 and final cookie8/copy2 probes approve their exact candidate boundaries. Original DB/container/full immutable2/90/308/924 inventories and3migrations remain preserved; served JS/CSS and compiled session service match local bytes. Temporary owned stacks, volume and image tags removed;4300 remains healthy and4313/4314/4327/62328 free. Initial native18/20, corrected catalog expectation, cookie race, copied-harness syntax error and lint/type failures remain attributed in raw evidence. **28/35 tasks complete; M6 COMPLETE, T29 ACTIVE.** No owner input required. [M6 checkpoint](../../evidence/M6/checkpoint.md), [T27](../../evidence/T27/checkpoint.md), [T28](../../evidence/T28/checkpoint.md), [review hash audit](../../evidence/M6/review-hash-audit.json). Evidence snapshot `3248cc3` archives309 committed payloads in310 verified metadata-free members; [archive audit](../../evidence/M6/archive-audit.json). Full M7 acceptance/performance/accessibility remains planned. No push/publication/deployment/submission or real provider/OAuth/booking/payment/LLM occurred.


---

<a id="t29"></a>

### Task 29: T29 — Docker packaging, gateway, initialization, and one-command startup

**Milestone:** M7 · **Depends on:** T01, T04, T05 · **Spec:** §11, §13

**Files — create unless introduced by a dependency; then modify:**

- `compose.yaml`
- `infra/Dockerfile`
- `infra/Caddyfile`
- `infra/init.sh`
- `infra/healthcheck.mjs`
- `tools/docker-up.mjs`
- `tools/docker-reset.mjs`
- `.dockerignore`
- `.env.example`
- `package.json`
- `docs/run-locally.md`

**Interfaces:**

- Consumes: Pinned toolchain, web/admin builds, API readiness, Prisma migrations/idempotent fixtures.
- Produces: pnpm docker:up/down/reset scripts; production-style local containers; same-origin /, /admin, /api, /provider-demo routing; direct Compose fallback.

**Packaging checkpoint:** Early packaging independently approved at `747c5f5` + `939bb44`; T05 rich seed and local geography are integrated and verified at `8081656`. Lifecycle, ordered initialization and runner are complete. Current assets and prior lifecycle checks are verified. T09 actual gateway SSE delivery, replay, interruption/retry and preservation are verified at `3230073`; T10 date-price equality/cache/restart and exact inventory preservation are also packaged-verified at `0a39241`; T11 referral/idempotency/restart and final data preservation are verified at `301119d`. Future artwork and complete T33 acceptance remain pending. Parent T29 stays ACTIVE. Evidence: `docs/evidence/T29/`, `docs/evidence/T05/packaged/` `docs/evidence/T09/packaged/` `docs/evidence/T10/packaged/` and `docs/evidence/T11/packaged/`.

- [x] **T29.1 — Define container lifecycle**

Use gateway/static frontend, API, PostgreSQL, and one-shot initializer services. Build all app assets inside Docker. Keep database/API ports internal by default; expose one configurable loopback demo port. Record supported arm64/amd64 build paths.

- [x] **T29.2 — Implement ordered initialization**

Wait for PostgreSQL health, then run migrations and versioned seed to successful completion before API readiness. Seed is idempotent. Startup never deletes a volume; reset is a separate explicit local command.

- [x] **T29.3 — Implement gateway and assets**

Serve web/admin with correct route bases and independent SPA fallbacks. Proxy API without replacing errors by HTML; stream SSE without buffering. Bundle fonts/geography/art and give immutable hashed assets appropriate caching.

- [x] **T29.4 — Implement one-command runner**

pnpm docker:up must build/start, wait for health, print exact web/admin URLs, and exit nonzero with actionable logs on failure. Document docker compose up --build --wait as the Node-free equivalent. No prerequisite manual migration, seed, or login.

- [x] **T29.5 — Verify and commit**

Run the root startup command on a new named test volume and again without deleting it. Check /, /admin/, deep links, health, SSE first-event delivery, and preserved session data. Record command output; commit packaging. Repeat full clean-start acceptance in T33.

**Acceptance:** One documented command starts every required service and a seeded, ready demo with no manual setup sequence.

**T29 complete — 2026-10-26:** Current gateway/assets and fresh-volume/repeated-start acceptance pass at `a0e8ab2`, independent review `c5a47d4`. Exact assets/SPA/API/cache/statuses, actual progressive SSE/replay and session/completed evidence persistence through recreation are verified. Default DB/full immutable inventories preserved; owned4329 stays available for subsequent M7 work, not yet removed. Nine independent HTTP subcases plus three runner behavior cases pass in separate runs. **29/35 tasks complete; T30 ACTIVE.** [Checkpoint](../../evidence/T29/m7-completion/checkpoint.md). Full offline/lifecycle failure/release rehearsal remains T33.

---

<a id="t30"></a>

### Task 30: T30 — Complete behavioral regression and multi-reviewer acceptance

**Milestone:** M7 · **Depends on:** T19, T22, T24, T25, T26, T28, T29 · **Spec:** §3–§11, §13

**Files — create unless introduced by a dependency; then modify:**

- `tests/e2e/fixtures.ts`
- `tests/e2e/src/acceptance/six-mode-journeys.spec.ts`
- `tests/e2e/src/acceptance/roundtrip-pricing.spec.ts`
- `tests/e2e/src/acceptance/reviewer-isolation.spec.ts`
- `tests/e2e/src/acceptance/full-walkthrough.spec.ts`
- `tests/e2e/src/acceptance/party-and-eligibility.spec.ts`
- `docs/evidence/release/behavioral-matrix.md`

**Interfaces:**

- Consumes: Complete running product, deterministic seed/scenario clock, existing focused suites.
- Produces: Full six-combination one-way/round-trip matrix, guest/identity/hotel/referral/admin walkthrough, isolation and idempotency release evidence.

- [x] **T30.1 — Build stable e2e fixtures**

Create isolated browser contexts/sessions and explicit seed/anchor/scenario setup through supported demo APIs. Tests wait for observable state, not arbitrary sleeps. Never share mutable session state between parallel cases.

- [x] **T30.2 — Exercise the full matrix**

Run six mode/scope combinations in one-way and round-trip, varied parties, all sorts, meaningful filters, different provider fares, date/chart consistency, and correct direction/transfer timelines.

- [x] **T30.3 — Exercise cross-feature journeys**

Cover guest referral, compact identity/logout and retained legacy saved-search records, hotel custom-location/room selection, changed fare acceptance, sold-out recovery, normalization correction/replay, and the admin referral trace.

- [x] **T30.4 — Exercise hostile timing and isolation**

Use two reviewer contexts, delayed and duplicated events, rapid query changes, two simultaneous confirmations, reset during a running query, and guessed IDs. Assert no cross-session effects or duplicate referrals.

- [x] **T30.5 — Verify and commit**

Run pnpm nx run e2e:e2e against the Compose stack and relevant unit/integration suites after any fixes. Record actual results and remaining limitations in behavioral-matrix.md; commit acceptance coverage.

**Acceptance:** The entire agreed product works coherently across modes, parties, failures, and independent reviewer sessions.

**T30 fast partial checkpoint — 2026-10-26:** Owner requested a very quick finish before substantial design/logic changes. Source `675c409` adds isolated external Compose execution, evidence/peer origin binding, custom touch context baseURL/CDP ownership and current admin assertions; no product logic/design changes. Types/lint pass. Actual default Nx smoke4PASS/1obsolete-heading failure is retained; corrected admin-only run1PASS separately. Four independent config probes approve the narrow three-source delta. Full12-row matrix, broad acceptance and T31–T33 audits/rehearsal remain unfinished; **29/35 complete, M7 PARTIAL, T30 ACTIVE**. Owned4329 stack/volume/image tags removed; default4300 remains ready. [Fast checkpoint](../../evidence/release/m7-fast-checkpoint.md), [independent partial review](../../evidence/T30/review/report.md).

**T30 resumed full diagnostic — 2026-11-01:** [Decision0073](../../decisions/0073-t30-current-behavioral-acceptance.md), [live evidence](../../evidence/T30/resume-2026-11-01/continuation-status.md), [behavioral matrix](../../evidence/release/behavioral-matrix.md). Initial unfiltered Nx on development Compose:164PASS/60FAIL/2existing M6 guarded skips,0notrun/0globalerrors; all32 new acceptance cases PASS. Phase2 residual61:45PASS/16FAIL. Phase3 residual16:13PASS/3FAIL; original SSE/mobile/brand regressions pass. Shared city query/Escape/scroll corrections now have43 focused unit passes and6 separate native open/aligned observations with ownedreset201. Actual HTTP/build2checks and10 live web/admin head URLs pass. A deterministic PostgreSQL regression proves internal date/recheck evidence wrongly consumed the transport rolling budget: old1FAIL/3PASS→corrected4PASS, plus4existing admission cases pass (30 other integration cases were filtered, not claimed executed). Normal ground comparisons now pass complete-provider/source/price/layout checks after bounded recovery reads and measured subpixel reconciliation (phase6 pair2PASS); their earlier actual partial/interrupted evidence is retained. The next full unfiltered226 re-run finished220PASS/4FAIL/2existing guarded skips,0notrun/globalerrors; all32 acceptance cases pass. Retained failures concern date retry/session metadata, mobile indicator measurement, RTL scrollbar alignment and sampling a flight-loop fade. Date identity fixes pass50 related unit cases and controlled native before/after proof; the three observer closures pass together and the unchanged original retry case passes separately. Full unfiltered226 rerun2 finished222PASS/2FAIL/2existing guarded skips, all32acceptancePASS and all1097source hashes unchanged. The two failures are a rounded referral geometry comparison and generic GPU-link labels across intentional context loss; controlled diagnostics and reviewed corrections remain explicitly pending final native verification. The owner-reported missing map arrow glyph is corrected with stable inline SVG;11 heading unit cases and web types pass, with native toggle closure PASS (decision0074). The seven selected date/referral/GPU/arrow cases pass together and preserve all1097 source hashes. Full unfiltered226 rerun3 finished223PASS/1FAIL/2existingM6guardedSKIP, zero other error categories, all32acceptancePASS and all1097source hashes unchanged. The only failure is GraphicsHost reduced-motion report.frames22→33 after fixed80/180ms; native delivery/draw/report-commit diagnostic precedes any correction. Independent final execution and acceptance remain pending. Independent frozen review and owned commits remain. **29/35 complete; M7 PARTIAL, T30 ACTIVE.** Existing foreign work and default stack/data remain preserved; T31–T35 are not complete.

**T30 COMPLETE — current final result:** source `cfcc3a9`; actual unfiltered224PASS/0FAIL/2existingM6guardedSKIP, all32newacceptancePASS and1097source hashes unchanged. Independent5config/77UI/6PG PASS; actual staged80source paths reviewed and committed. Exact owned test DB removed; original containers healthy. Earlier fast/resumed diagnostics above are historical. [Final checkpoint](../../evidence/T30/resume-2026-11-01/checkpoint.md). **30/35complete; T31next.**

---

<a id="t31"></a>

### Task 31: T31 — Accessibility, RTL, responsive behavior, and browser compatibility

**Milestone:** M7 · **Depends on:** T27, T28, T30 · **Spec:** §3, §5–§8, §12

**Files — create unless introduced by a dependency; then modify:**

- `tests/e2e/src/accessibility.spec.ts`
- `tests/e2e/src/responsive-rtl.spec.ts`
- `tests/e2e/src/a11y-helpers.ts` and `tests/e2e/src/city-menu-focus.ts`
- `tests/e2e/playwright.config.ts`
- `docs/evidence/release/accessibility.md`
- `docs/evidence/release/browser-matrix.md`

**Interfaces:**

- Consumes: Complete UI and recovery states; keyboard and motion policies; supported browsers.
- Produces: Automated accessibility checks plus documented manual keyboard/screen-reader/contrast review; Chromium/Firefox/WebKit and responsive acceptance.

- [x] **T31.1 — Define representative coverage**

Select landing/composer, wheel/calendar, results/provider details, route timeline, hotel/location dialog, recheck/handoff, and admin inspection. Cover 390×844, 768×1024, 1280×800, and 1440×900, including the map breakpoint boundary.

- [x] **T31.2 — Run semantic checks**

Add axe-based checks for representative states, then manually complete the journey by keyboard. Inspect focus visibility/order, dialog focus return, text alternatives, live announcements without spam, and code-route LTR isolation.

- [x] **T31.3 — Inspect visual accessibility**

Measure text/control contrast in six palettes; check touch targets, 200% zoom, long Persian strings, unknown prices, reduced motion, and fallback charts. Verify a no-map small-screen user receives all route information.

- [x] **T31.4 — Run browser coverage**

Run pnpm nx run e2e:e2e --grep '@a11y|@responsive|@dates|@hotels|@referral' in Chromium, Firefox, and WebKit. Manually record actual assistive-technology/device checks performed; distinguish browser emulation from a real device.

- [x] **T31.5 — Fix, verify, and commit**

Fix defects in their owning feature files and rerun only affected checks plus the critical journey. Save evidence without claiming a complete compliance certification from automated results. Commit accessibility/responsive corrections.

**Acceptance:** Essential tasks remain usable across input methods, RTL layouts, viewport sizes, reduced motion, and the browser matrix.

---

<a id="t32"></a>

### Task 32: T32 — Graphics performance, visual regression, and resource budgets

**Milestone:** M7 · **Depends on:** T27, T28, T30 · **Spec:** §6, §12

**Files — create unless introduced by a dependency; then modify:**

- `tools/measure-bundles.mjs`
- `tests/e2e/visual-regression.spec.ts`
- `tests/e2e/graphics-lifecycle.spec.ts`
- `tests/e2e/performance.spec.ts`
- `docs/evidence/release/visual-review.md`
- `docs/evidence/release/performance.md`

**Interfaces:**

- Consumes: Shared graphics lifecycle, finalized tokens/art, seeded stable views and complete UI.
- Produces: Measured bundle/frame/interaction results, visual baselines, GPU failure/recovery evidence, idle/resource cleanup gate.

- [x] **T32.1 — Capture controlled visual baselines**

Record seed, clock, viewport, browser, theme, quality tier, and reduced-motion settings. Wait for fonts/data/render readiness. Review at least 24 key captures: six palettes × desktop/mobile × search/results-or-hotels; add admin/reference screens.

- [x] **T32.2 — Measure real interaction performance**

Record reference hardware/browser. Measure date drag, chart synchronization, route preview/pin, scroll, modal open, and theme toggle. Use the <200 ms, 60/30 fps, first-result and completion targets; report p95/frame behavior and measurement method.

- [x] **T32.3 — Measure bundles and idle work**

Run node tools/measure-bundles.mjs. Verify initial/deferred graphics gzip targets, lazy loading, no repeated canvas/context allocation, bounded material/geometry counts, and no continuing animation after scenes settle or the tab is hidden.

- [x] **T32.4 — Stress lifecycle and fallbacks**

Repeatedly open/close hotels, change modes/themes, resize across breakpoint, simulate context loss/restoration and WebGL unavailability. Inspect memory/resource trends and shader compilation errors. Essential forms/selection must survive every graphics fallback.

- [x] **T32.5 — Verify and commit**

Run pnpm nx run e2e:e2e --grep '@visual|@graphics-lifecycle|@performance'. Inspect screenshots manually with sensible cross-GPU tolerances. Fix measured bottlenecks and rerun relevant checks; record actual budgets/limitations and commit.

**Acceptance:** The GLSL-heavy identity remains responsive, stable, and resource-bounded, with evidence from a recorded environment.

**T32 COMPLETE — 2026-11-02:** Source `c1f6085`,69independently approved paths (33source/test/tools +36PNG baselines). Required actual Nx selection8/8 and five affected keyboard/calendar/hotel/immutable-return journeys pass. Independent tool8/ownership4/native2 and separately recomputed emitted graph pass. Initial349.8936KiB (109bytes headroom), graphics295.1719KiB; optional SDK/worker and full union disclosed. Actual24full/12map no-update comparisons and manual desktop/mobile/hotel/admin/world review pass. On the recorded headless Chrome/M3 reference, steady maps submit approximately60fps with measured bloom enabled; all six four-sample interaction-family p95 values are below200ms. GPU resources plateau and all7hotel workers close; postGC heap rises3.8% across five repeats, not a leak-free guarantee. Literal materials, actual low-tier/physical-display timing, desktop max-DPR attainment and existing clipped scroll labels remain explicit limits. [Checkpoint](../../evidence/T32/checkpoint.md), [performance](../../evidence/release/performance.md), [visual review](../../evidence/release/visual-review.md), [independent review](../../evidence/T32/review/independent-verification.md). **32/35 tasks complete; M7 PARTIAL; T33 next.**


---

<a id="t33"></a>

### Task 33: T33 — Fresh-start, offline-runtime, reset, and restart rehearsal

**Milestone:** M7 · **Depends on:** T29, T30, T31, T32 · **Spec:** §8–§11, §13

**Files — create unless introduced by a dependency; then modify:**

- `tools/verify-release.mjs`
- `package.json`
- `docs/evidence/release/docker-rehearsal.md`
- `docs/evidence/release/offline-runtime.md`

**Interfaces:**

- Consumes: Final Compose build, complete acceptance suites, local assets, session/restart rules.
- Produces: Repeatable release verification command and evidence of fresh startup, external-network independence at runtime, and non-destructive restart.

- [x] **T33.1 — Rehearse a fresh environment**

Create a disposable named volume and run pnpm docker:up from a clean checkout. Record initial build and ready times, exact commands, seed versions, URLs, and health status. Do not delete the user's unrelated Docker resources.

- [x] **T33.2 — Verify external-network independence**

After images/dependencies are available, block nonlocal requests during the walkthrough. Confirm the core journey requires no remote font, image, analytics, OAuth, or model call. The approved on-demand hotel street map is the explicit external tile/style/glyph/sprite exception: block that service and verify the local list/coordinates and referral remain usable with an honest unavailable state. Do not claim the street map is bundled offline. Exercise the direct Compose startup path without host Node/pnpm.

- [x] **T33.3 — Rehearse lifecycle failures**

Restart API during collection, restart the stack with existing data, fail initialization intentionally, and reset one of two reviewer sessions. Confirm interrupted-retry behavior, preserved completed evidence, actionable failures, and isolation.

- [x] **T33.4 — Finalize verification runner**

Implement pnpm verify:release to run agreed health/build/test checks and produce a bounded report; keep destructive reset separate. Include clean shutdown instructions and known port/architecture troubleshooting.

- [x] **T33.5 — Verify and commit**

Run the final release rehearsal and save actual outputs. Resolve failures before marking done, then commit packaging/evidence corrections.

**Acceptance:** A reviewer can reproduce the demo without hidden setup, and routine restart/reset operations behave exactly as documented.


**T33 COMPLETE — 2026-11-02:** Source `62b39ad0` has the exact9-path tree of the clean canonical boot; the private current-product snapshot retains99 audited pre-existing overlays separately. Actual plain Docker startup passes in37.6s/36.7s without host dependencies or .env. Fully isolated cold core, two-reviewer reset, real API interruption/linked retry/admin replay/full-stack evidence preservation, intentional initializer failure/repair and no-host-Node Docker restoration pass. Final selected quality profile passes48uncached source tasks,60tool contracts and7single-attempt Chrome cases; optional PostgreSQL is explicitly unperformed. Independent19runner contracts pass. All6 original containers and5 full inventory/migration fingerprints remain unchanged after removing only3task-owned stacks/data and2clean temporary worktrees. Images/cache/private provenance refs remain. [Checkpoint](../../evidence/T33/checkpoint.md), [Docker rehearsal](../../evidence/release/docker-rehearsal.md), [independent review](../../evidence/T33/review/actual-results-review.md). **33/35 tasks complete; M7 COMPLETE; T34 next.**

---

<a id="t34"></a>

### Task 34: T34 — Reviewer guide, AI evidence, walkthrough, and submission-ready materials

**Milestone:** M8 · **Depends on:** T25, T26, T30, T31, T32, T33 · **Spec:** §1–§2, §10, §13

**Files — create unless introduced by a dependency; then modify:**

- `README.md`
- `docs/reviewer-guide.md`
- `docs/walkthrough.md`
- `docs/ai-development-log.md`
- `docs/architecture.md`
- `docs/limitations.md`
- `docs/decisions/README.md`
- `docs/evidence/release/README.md`

**Interfaces:**

- Consumes: Implemented product, real evidence, selected architecture, actual AI-assisted work history.
- Produces: Concise startup/reviewer documentation; 4:30 target walkthrough script/storyboard and timed rehearsal; honest AI/process evidence; limitations and attribution. Video capture remains a separate follow-up.

- [x] **T34.1 — Write the immediate-start guide**

Lead README with what the product demonstrates, the one-command startup, app/admin URLs, simulated-data identity, and the prepared reviewer path. Link architecture, test commands, and known limitations without hiding the main launch action.

- [x] **T34.2 — Write an evidence-based AI log**

Record actual research/design/coding/data/testing assistance, useful prompts or summaries, rejected suggestions, human decisions, and verification. Do not invent model calls, user tests, metrics, or a live AI feature.

- [x] **T34.3 — Prepare the timed walkthrough**

Write a script/storyboard and rehearse approximately 4:30: nearby date/calendar → grouped provider comparison → route/hotel → changed-fare referral → admin source/referral evidence. Use stable presets and record seed/date and measured duration. Actual video capture is a separately requested application artifact; do not claim a recording exists.

- [x] **T34.4 — Review submission facts and licenses**

Recheck the current official challenge requirements before preparing final submission artifacts. Verify asset/font/geography attribution, clear simulation labels, accurate limitations, and links to actual evidence. No application is submitted by this task.

- [x] **T34.5 — Verify and commit**

Follow the README in a fresh session, time the walkthrough, check links/commands, and commit documentation. Clearly distinguish the completed script/rehearsal from any future video recording.

**Acceptance:** Reviewers can understand, run, and assess the demo quickly, with truthful evidence of both engineering quality and AI-assisted work.


**T34 COMPLETE — 2026-11-02:** Materials commit `4a759379` delivers the eight reviewer/architecture/AI/evidence documents and scoped attribution notices. A fresh owned current-product snapshot starts with plain `pnpm docker:up` in 37.741s without host dependencies or .env; cached build layers are explicit. Ordinary fresh-browser README path passes 1/1. Actual paced rehearsal passes 1/1 in 270.006s with 254.532s intentional presentation holds, separate setup and interaction/wait remainder; no video/audio recorded. Dates/calendar, grouped comparison/local ranking, round-trip map, live hotel basemap, exact changed-fare v1→v2 consent, blocked placeholder-tab attempt and matching admin/source lineage are measured. Earlier operator failures are retained. Official challenge and mixed/uncleared transport-mark rights are documented; no public submission/deployment or blanket licence claim. Only the exact owned T34 stack/data and clean worktree were removed; original 6 containers and 5 full inventory/migration fingerprints remain unchanged. [Checkpoint](../../evidence/T34/checkpoint.md), [walkthrough](../../walkthrough.md), [independent review](../../evidence/T34/review/final-review.md). **34/35 tasks complete; M8 PARTIAL; T35 next.**

---

<a id="t35"></a>

### Task 35: T35 — Independent final review and release checkpoint

**Milestone:** M8 · **Depends on:** T34 · **Spec:** All sections

**Files — create unless introduced by a dependency; then modify:**

- `docs/evidence/release/final-review.md`
- `docs/evidence/release/acceptance-checklist.md`
- `docs/superpowers/plans/2026-10-24-torobticket-master-plan.md`

**Interfaces:**

- Consumes: All implemented tasks, current code, spec, acceptance matrix, measured evidence, and reviewer materials.
- Produces: Resolved independent review, accurate completed tracker, release checkpoint commit and explicit remaining limitations.

- [x] **T35.1 — Review against the product**

Use the requesting-code-review skill and a fresh reviewer to inspect the whole implementation against the specification, focusing on pricing/grouping/time/session/referral correctness and actual UX. Review all changed code and meaningful evidence, not only the demo script.

- [x] **T35.2 — Resolve material findings**

Fix critical/high-impact issues in their owning tasks and run the relevant regression checks. Record justified lower-impact limitations explicitly. A written explanation does not substitute for fixing a broken required journey.

- [x] **T35.3 — Reconcile the tracker**

Verify every D01–D25 requirement and acceptance-matrix row has implementation/evidence. Update task status, owners, commits, and checkboxes. Record any unperformed real-device checks as limitations; do not equate emulation with a device test. Video submission remains a separate follow-up.

- [x] **T35.4 — Run the final critical path**

Run pnpm verify:release after review fixes and manually complete the timed reviewer journey. Confirm the final README, screenshots/video, seed, and behavior describe the same build.

- [x] **T35.5 — Record the release checkpoint**

Commit the accepted implementation and evidence with no unrelated changes. Report the runnable locations, exact verification outcomes, and material limitations. Do not publish, deploy, merge, or submit an application without the user's separate instruction.

**Acceptance:** The complete agreed scope is implemented, review findings are resolved, evidence matches the build, and the repository is ready for a reviewer.

**T35 COMPLETE — 2026-11-02:** Independently reviewed integration `7bbf785b` and persistence repair `d1e052ba` make the tested current product canonical. Specification 1.43 explicitly retains faster-only automatic advice; nearby-date exploration remains manual. Fresh clean-source/fresh-data Docker startup002 passed in 38.221s with caches; 1050 application/build inputs match Git and the exact final images. Final quality002 passes all seven selected gates: 48 uncached Nx tasks, 60 tool contracts, 189 actual PostgreSQL cases/27files including the owned database restart, and 7 critical Chrome journeys. Separate 12 trip combinations + 4 branding cases pass; 61 assets/2 metadata contracts pass separately. The real large-calendar evidence loss was fixed without extending deadlines or reducing coverage; failed attempts remain. The actual concise manual CUA journey took 136.058s after a retained 562.528s over-target exploratory run; explicit v1→v2 consent, confirmed handoff and raw/normalized admin lineage were inspected. External hotel basemap tiles were unavailable in both manual attempts; no live basemap success is claimed. D01–D25 and all16acceptance rows are mapped. Exact owned release/test resources and clean checkout were removed; original six containers/five full immutable table fingerprints match and ready200. VoiceOver, physical-device/nativeSafari, finite graphics/heap/bundle/label limits, uncleared marks and automatic nearby-date advice remain explicit. No video/audio, push, publication, deployment or application submission. [Checkpoint](../../evidence/T35/checkpoint.md), [independent review](../../evidence/release/final-review.md), [acceptance](../../evidence/release/acceptance-checklist.md). **35/35 complete; M1–M8 COMPLETE.**

## 7. Release acceptance matrix

| Area | Required acceptance |
|---|---|
| Inventory | Every selectable origin/destination has a supported mode/scope path; all destination hotel catalogs exist; six hero journeys have meaningful comparisons |
| Pricing | Whole-party and whole-stay totals; exact currency conversion; unknown mandatory charges cannot win or hand off |
| Matching | Same itinerary groups across providers; distinct airports/services/fare terms remain distinguishable; no invented round trips |
| Ranking | All three orders and ties; waits included; destination stay excluded; dwell vs transfer handled correctly |
| Dates | Wheel snap, preview/commit split, chart sync, Jalali calendar apply/cancel, same-day valid returns, opposite-leg consistency |
| Results | Honest coverage, no stale-query overwrite, stable order after interaction, explicit late-update adoption |
| Map | Fixed left desktop layout; form-owned endpoints and read-only map; selected endpoint labels; explicit pin-only route with ordered stops/waits; stable selection on hover; eased international fit; no camera resets while scrolling |
| Hotels | Correct arrival-local dates, independent edits, occupancy/all-room totals, all sorts, custom point, straight-line units, modal state restoration |
| Referral | Guest works; changed terms require acceptance; sold-out recovery; expiry and idempotency; exact local handoff without purchase claims |
| Admin | Real telemetry, scoped provider/scenario changes, mapping preview/collision checks/replay, factual referral counts |
| Appearance | Six palettes, all authored colors tokenized, local fonts/art, flat animation except map depth, compact readable layout |
| Accessibility | Keyboard full journey, visible focus, focus restoration, RTL/LTR correctness, reduced motion, contrast audit, no color-only state |
| Graphics | GL compile/link success, theme uniform sync, context-loss fallback/recovery, responsive modal layering, idle and hidden pause, cleanup |
| Packaging | One command; successful health/init dependencies; no real credentials; runtime works with external network blocked; non-destructive restart |
| Isolation | Two reviewer sessions cannot read/change/reset each other's state; guessed IDs fail; historic evidence remains immutable |
| Reviewability | Stable documented presets, walkthrough <5 minutes, AI evidence, measurement reports, actual known limitations |

## 8. Evidence and risk register

| Risk | Mitigation and gate | Owner |
|---|---|---|
| Shared canvas clips or intercepts a modal incorrectly | Prototype renderer layering early; real pointer/keyboard checks and screenshot matrix | T13, T21, T31 |
| Graphic flourishes consume the interaction budget | Lazy-load graphics, on-demand loop, bounded DPR, frame/heap measurements on recorded hardware | T13, T27, T32 |
| Calendar prices diverge from result quotes | One eligibility/pricing pipeline and source revision in keys; date-result invariant tests | T07, T10, T16 |
| Reconnected events or mapping updates mutate old evidence | Immutable snapshots/revisions, monotonic sequences, replay as a new search | T09, T25 |
| Rich fixtures become incoherent | Catalog constraints, timezone/geography checks, curated hero snapshots and deterministic generation | T05–T07, T20 |
| API/package versions drift before execution | Verify compatibility and pin lockfile/images in foundation; record exact matrix | T01, T29 |
| Fake “AI” or performance claims weaken the submission | Record real prompts/decisions/checks, label mocks, separate build assistance from runtime behavior | T34–T35 |
| Cold start/reset breaks a review | Clean-machine/volume tests, migrations once, idempotent seeds, restart reconciliation | T04, T29, T33 |

Evidence paths are docs/evidence/<task-id>/ and docs/evidence/release/. Each includes commands, environment, seed/scenario/time, expected outcome, actual output, screenshots where useful, and limitations. Never mark a task DONE with only a generated explanation of what should happen.

## 9. Completion and change control

At each completed milestone, update the master table, checklist, decision log, and reviewer walkthrough if behavior changed. Record any accepted deviation with reason, affected decision IDs, tasks, and tests. Do not silently remove requested modes, hotels, graphics, admin functions, or failure scenarios to finish sooner.

Before release, all tasks are DONE or an explicit approved scope change removes them; no critical or high-impact open defects remain. Final artifacts are a reproducible repository, local demo, verification reports, reviewer guide, and walkthrough recording/storyboard as available. Publication or application submission is a separate explicit user action.

### Planning verification record

- Written specification checked by a fresh independent builder reviewer: “nothing important left.”
- Master-plan self-review: coverage, interfaces, dependencies, step granularity, and review-focus ownership checked before delivery.
- Task/table counts and local document references validated by a planning audit script.
- No implementation test, browser regression, package build, performance result, deployment, or submission is claimed by this record.

## Owner adjustment — compact travel map,2026-10-26

Desktop travel map is display-only: start→end title and existing route scene, no city labels/endpoint controls/duplicate map panels. Only the search form edits cities. Internal route/pin/progress/camera semantics, mobile route panel and interactive hotel picker remain. [Decision0031](../../decisions/0031-display-only-travel-map.md), [checkpoint](../../evidence/adjustments/read-only-map/checkpoint.md). This is an owner-directed adjustment; M7 remains partial29/35 and unfinished acceptance is not reclassified.

## Owner adjustment — map atmosphere and selected-journey choreography,2026-10-26

The subsequent request supersedes the previous all-labels-hidden and pre-ticket illustrative-route behavior: show only selected endpoint names and sequentially revealed stop names/waits; draw a connecting route only after explicit ticket selection. Preserve read-only endpoint editing. Dim shaded dark themes, breathing/pointer-responsive dots, emphasized major cities, distinct transport geometry, glossy vehicle icons and a traveling light strand share the existing renderer. [Decision0032](../../decisions/0032-atmospheric-selected-journey-map.md). M7 remains partial29/35.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Map atmosphere | Dim semantic palettes and gradients; breathing/proximity dots; major-city emphasis | DONE | `a602193`; native shader/pointer checks and six palettes; [checkpoint](../../evidence/adjustments/atmospheric-map/checkpoint.md) |
| Selected journey | Pin-only route; endpoint pop-ins; staged stop names/wait counts; mode-specific route and glass vehicle | DONE | `a602193`; canonical stop reveal, hover stability, reduced motion and fallback; 93 focused tests pass |
| Follow-up polish | Side-view ground vehicles; thicker comet trail; eased endpoint/stop framing; remove map divider | DONE | `a602193`; camera continuity, international fit and native screenshots verified |
| Compact controls | Shared desktop rows; date wheel/chart/evidence layout; preserve font sizes and 44px controls | DONE | `a602193`; final default-form fit at 1440×900, 1366×768, 1280×800 and 390px mobile check pass |
| Review and integration | Independent review; local packaged rebuild; browser captures; tracker/export sync | DONE | [Independent review](../../evidence/adjustments/atmospheric-map/review.md); 14 Nx tasks pass; native 15 passes plus corrected layout pass separately; local app healthy; M7 remains partial |

## Owner adjustment — world context, zoom density and map continuity, 2026-10-26

[Decision 0033](../../decisions/0033-world-map-context-and-scene-continuity.md) records faint international borders, sparse zoom-dependent city names, airy dot density with three crossfades, and a dim lingering mouse trail; fixes for duplicate endpoints, navigation presentation, and old flight selection after a train edit. M7 remains partial, 29/35.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| World context | Local country boundaries; capital/major-city hierarchy; selected-label priority and collision budget | DONE | `5789eb7`; local provenance, geographic clipping and sparse visible-label budgets verified; [checkpoint](../../evidence/adjustments/map-navigation/checkpoint.md) |
| Zoom density | Progressive land-clipped dot grids; crossfades; trackpad pinch; stable markers | DONE | `5789eb7`; native GPU records three world transitions and two domestic transitions within 1–8× at 1440px; no per-frame geometry rebuild |
| Soft cursor trail | Wider dot spacing; bounded geographic trace; gentle onset/decay; subdued glow and reduced-motion clearing | DONE | `5789eb7`; 16-sample trail, 150ms onset/1.8s lifetime; actual GPU history retains earlier positions, fades after exit and clears for reduced motion in both scopes |
| Scene continuity | Shared canvas/label viewport; no duplicate endpoints; navigation and responsive restoration | DONE | `5789eb7`; reserved-scrollbar alignment at three heights, one origin/destination, provider Back/Forward, home and responsive remount pass |
| Transport intent | Old evidence stays readable; edited trip cannot select/pin/continue old results; fresh train uses rail | DONE | `5789eb7`; synchronous stale-callback guards; native edited-flight rejection and fresh train GPU mode verified |
| Review and integration | Independent review; packaged rebuild; native regressions; tracker/export synchronization | DONE | [Independent review](../../evidence/adjustments/map-navigation/review.md); final 120 focused tests, 13 Nx tasks and 16 native checks pass; local app healthy; M7 remains partial |

## Owner adjustment — compact search and journey motion, 2026-10-27

[Decision 0034](../../decisions/0034-compact-search-and-journey-motion.md) maps all twelve owner requests to implementation boundaries. This adjustment preserves read-only map endpoints, explicit ticket selection, comparison/referral authority and historical evidence. M7 remains partial, 29/35; T30 is still active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Geographic transition | Deterministic scattered Iran/world particle morph; rapid reversal; shared clock; reduced-motion settling | DONE | `722d71c`; actual GPU records 1331 particles, progress/crossfade/reversal/reduced motion pass; [checkpoint](../../evidence/adjustments/compact-journey/checkpoint.md) |
| Vehicle and endpoint motion | Path-tangent rotation; locomotive plus two wagons; departure/arrival blur and fade; retained endpoint exits with unique current identities | DONE | `722d71c`; all three native vehicle modes, separate wagon matrices, blur/opacity envelope, 380ms endpoint exit and visible captures pass |
| Compact search | Hidden redundant labels/hints; city search/clear/focus; compatible class defaults; fresh one-adult intent with historical evidence intact | DONE | `722d71c`; final 406 tests pass; native defaults/normalization/clear-keyboard controls; desktop form 535px tall at scroll 0 |
| Compact date selection | Icon trigger; smaller priced month grid; Gregorian disclosure; unchanged wheel and provisional Apply/Cancel | DONE | `722d71c`; native Apply/Cancel/focus; 430px desktop calendar, 314px at 320px with 44.56×48px day targets |
| Hotel placement | Valid-route CTA below desktop map; upward finite entry; inline narrow layout; state/focus continuity; first explicit open establishes return context | DONE | `722d71c`; 5 focused tests and native first-open/resize/stay/focus/reduced-motion checks pass; hotel HTTP 201 complete |
| Integration and review | Packaged rebuild; native GPU/browser checks; independent review; tracker/SDD/export synchronization and local checkpoint | DONE | [Independent review](../../evidence/adjustments/compact-journey/review.md); 406 source tests, 9 Nx checks, 12 native scenarios plus 6 final affected repeats pass; local app healthy; M7 remains partial |

## Owner adjustment — compact ticket results and cheapest default, 2026-10-27

[Decision 0035](../../decisions/0035-compact-ticket-results-and-default-selection.md) maps all nine result-list requests. A fresh current completed search selects its cheapest eligible quote once and draws its itinerary; a manual choice wins. Compact cards preserve exact quote evidence and expose an explicit provider handoff only when selected. M7 remains partial, 29/35; T30 stays active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Compact result cards | Shared rows and readable type; native whole-card selection; selected styling; one details expansion with complete fare/return evidence | DONE | `35d4a1b`; 162.42px cards, three complete cards at 1366×768; [checkpoint](../../evidence/adjustments/compact-results/checkpoint.md) |
| Default selection and header | Terminal cheapest quote; manual-choice/restore/stale fences; no automatic referral/focus; actual seller count; compact update recovery | DONE | `35d4a1b`; 58 final result tests and native automatic-map/manual-selection checks |
| Handoff and suggestions | Provider-named selected CTA; existing recheck/recovery semantics; route-suggestion chooser at top | DONE | `35d4a1b`; exact handoff/no-write return and changed-price consent verified; edited hotel stay preserved until explicit arrival update |
| Integration and independent review | Source checks; packaged desktop/mobile/round-trip/map/referral verification; review; tracker/SDD/export sync | DONE | [Independent review](../../evidence/adjustments/compact-results/review.md); 431 integrated source tests, final 58 result tests, type/lint, seven native scenarios; local stack ready; M7 remains partial |

## Owner adjustment — continuous map background, 2026-10-27

[Decision0036](../../decisions/0036-continuous-map-background.md): unify desktop map/page atmosphere and softly fade geography at its edges. Presentation only; M7 remains partial29/35, T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Continuous backdrop | Shared viewport-aligned semantic-token shades; transparent map panel; preserve content layering | DONE | `c3578c8`; six transport/appearance palettes and desktop captures verified; [checkpoint](../../evidence/adjustments/map-blending/checkpoint.md) |
| Soft map edges | Actual GPU geography/morph fade and matching fallback; zoom-stable edge treatment; readable selected route | DONE | `c3578c8`; 100 focused tests; native shader, international zoom and SVG fallback checks pass |
| Review and integration | Native desktop themes/zoom/fallback checks; independent review; local packaging; tracker/export sync | DONE | [Independent review](../../evidence/adjustments/map-blending/review.md) approved; 9 Nx checks and 7 native scenarios pass; local stack healthy; M7 remains partial |

## Owner adjustment — price colors and same-price sellers, 2026-10-27

[Decision0037](../../decisions/0037-price-bands-and-same-price-sellers.md) maps the eight requested changes. M7 remains partial, 29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Compact date controls | Remove observation card/captions; full-width search; 150px chart; retain unchanged estimates; quiet bounded recovery without retry controls | DONE | `ed75038`, `e28b92a`; [checkpoint](../../evidence/adjustments/price-colors-sellers/checkpoint.md); original observation retention and 26 final date tests pass |
| Price bands | Shared comparable-range rule; semantic tokens; wheel/calendar/card amounts and SVG/GLSL chart | DONE | `ed75038`; source bands/theme checks and native dark/light/calendar/mobile/SVG evidence pass |
| Same-price sellers | Exact-total card projections; seller icon actions; fare variants; sort/scroll/focus and source authority | DONE | `ed75038`; same-price component fixtures plus native exact seller receipt/read-only return and changed-price consent verified |
| Integration and review | Independent review; packaged visual and referral checks; tracker/SDD/exports | DONE | [Review](../../evidence/adjustments/price-colors-sellers/review.md) approved; 365 integrated source tests, 26 final date tests, type/lint and 8 unique native cases pass; final single-provider/reduced-motion captures explicitly scoped; local stack ready; M7 remains partial |

## Owner adjustment — soft transitions and aligned controls, 2026-10-28

[Decision0038](../../decisions/0038-soft-transitions-and-aligned-controls.md) maps the seven owner requests. M7 remains partial, 29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Palette and appearance | Continuous vehicle palette interpolation through CSS/GPU; slower light/dark clip; interruptions and lifecycle cleanup | DONE | `c1f4a74`; 760ms palette / 780ms clip, actual intermediate GPU/CSS equality; [checkpoint](../../evidence/adjustments/soft-transitions/checkpoint.md) |
| Route/date controls | Aligned city/class row; class segments; shorter wheel; calendar below; equal combined chart height | DONE | `c1f4a74`; 46px aligned controls; wheel132 + gap8 + calendar44 = chart184; desktop/mobile and keyboard/calendar native checks pass |
| Content and selected heading | Skeletons, finite entry/exit/reorder, inert obsolete visuals, preserved details/focus; pinned service heading | DONE | `c1f4a74`, `5529c0d`; real Motion lifecycle/source regressions, selected route/sort/detail-preservation and visible heading above shared canvas pass |
| Integration and review | Independent review, source/native/packaged checks, tracker/SDD/export synchronization | DONE | [Review](../../evidence/adjustments/soft-transitions/review.md); 447 integrated source tests, 9 Nx checks, 4 native cases including provider return pass; local stack ready; M7 remains partial |

## Owner adjustment — compact profile, round trips and living dots, 2026-10-28

[Decision0039](../../decisions/0039-compact-profile-and-roundtrip-discovery.md) maps all five requests. M7 remains partial, 29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Compact intro and price bounds | Remove subtitle; align title/suggestions; bind min/max labels to their amounts in RTL/mobile | DONE | `fbb56e9`; native aligned centers and paired price gaps; [checkpoint](../../evidence/adjustments/roundtrip-profile/checkpoint.md) |
| Profile popover | Anchored nonmodal account; remove redundant/empty saved copy; preserve real records/leases; sticky accessible close | DONE | `fbb56e9`; 27 account tests and actual save/Escape/outside/mobile/20-item checks pass; removed/disabled-focus repair verified |
| Round-trip discovery | First-toggle bounded +3-day return; explicit later date reselection; complete fares and selected map playback | DONE | `fbb56e9`; all six native mode/scope combinations return complete eligible round trips and animate selected itineraries |
| Living dots | Bounded slow per-cell drift; common shader/CPU morph snapshots; fixed anchors and existing lifecycle | DONE | `fbb56e9`; 78 graphics tests; actual linked drift programs, completed morph/continued clock, covered freeze and reduced amplitude zero verified |
| Integration and review | Independent review; packaged source/native evidence; tracker/SDD/export synchronization | DONE | [Review](../../evidence/adjustments/roundtrip-profile/review.md) approved; final 487 source tests / 82 files, 9 Nx checks and 9 unique native cases pass across scoped runs; local stack ready; M7 remains partial |

## Owner correction — visibly moving map dots, 2026-10-28

[Decision0040](../../decisions/0040-visible-living-dot-motion.md) supersedes the imperceptible motion bound in decision0039. M7 remains partial, 29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Visible gentle float | Increase positional motion below5 CSSpx; varied phases; unchanged density, colors and canonical route anchors | DONE | `28c6dc1`; 79 graphics tests; native Iran802 centers median2.22px and world704 centers median2.75px over roughly2 seconds |
| Whole dots and morph landing | Neighbor-aware lattice; skip inactive levels; hold live clock while morph particles approach their matching target | DONE | `28c6dc1`; independent15 tests; actual linked initial/post-morph shader captures with identical camera matrices and geographic scale |
| Review and local preview | Independent review; focused native regression, coverage/reduced motion, normal Docker startup; documentation/SDD/export sync | DONE | [Review](../../evidence/adjustments/visible-dot-motion/review.md) approved; [checkpoint](../../evidence/adjustments/visible-dot-motion/checkpoint.md); 5 Nx checks, E2E type/lint, both native cases pass; preview refreshed; no push |


## Owner refinement — living map particles, 2026-10-28

[Decision0041](../../decisions/0041-living-map-particle-lifecycles.md) follows the owner corrections from local movement to wider random-looking drift, then appear→move→fade lifecycles. Earlier ellipse evidence is historical. M7 remains partial,29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Particle presence and wandering | Staggered entry/drift/exit; nonperiodic smooth waypoint curves; nine-pixel envelope; dim semantic colors and anchored route facts | DONE | `f7cf6ec`; 88 source tests/17 files; actual linked particle program and high-density native idle/morph/resume pass |
| Continuity and ownership | Shared CPU/GPU positions+opacity; bounded neighbor search and zoom cap; live morph snapshot; wall-time ambience and explicit visible loop ownership | DONE | `f7cf6ec`; actual GPU/CPU position+opacity agree over480 samples; independent review28 tests and lifecycle ownership regressions pass |
| Review and local preview | Actual idle/post-morph/resume pixels/video, HiDPI cadence, independent review, packaging, SDD and exports | DONE | [Checkpoint](../../evidence/adjustments/continuous-dot-motion/checkpoint.md), [review](../../evidence/adjustments/continuous-dot-motion/review.md); three final native cases across particle/parity/hotel scopes; local stack healthy; SDD/exports synchronized |


## Owner correction — overlay hotel banner, 2026-10-28

[Decision0042](../../decisions/0042-overlay-hotel-banner.md) removes the hotel dock from flex sizing. M7 remains partial,29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Stable desktop map | Absolute banner at24px side/bottom inset; retain upward entry and hotel model; preserve mobile inline branch | DONE | `49fe01c`; one CSS rule; no viewport/camera resizing due to banner |
| Independent/native verification | Show, remove, reappear, selected result and scroll; same camera/graphics bounds; mobile width/inline check | DONE | [Review](../../evidence/adjustments/continuous-dot-motion/hotel-overlay-review.md); all five desktop states x24/y110/580.359375×634, map scrollHeight768; native1/1 pass15.1s; cleanup201 |


## Owner refinement — chart, controls, airlines and results, 2026-10-28

[Decision0043](../../decisions/0043-chart-controls-and-result-refinements.md) maps all six requests. Task-scoped implementation agents and distinct independent reviews completed; M7 remains partial,29/35, T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Chart inspection | Animated exact-cell tooltip; bounded smooth3.25px ribbon; round ringed hover markers; persistent selected ring/guide; touch ownership; GPU/SVG parity | DONE | `fb1ef64`; [chart review](../../evidence/adjustments/chart-controls-results/chart-review.md); final native exact-value/finite tooltip and real GPU source/gap/resize proof pass |
| Sliding segments | Measured RTL/LTR position/width; finite interruption; responsive/font changes; reduced/covered/disabled policy; native radios | DONE | `d584be7`; [review](../../evidence/adjustments/chart-controls-results/segmented-review.md); actual intermediate x/width frames, exact final alignment and four mobile groups pass |
| Airline PNGs |52 identities/156 transparent variants; source/rights/hash registry; matching operator aliases; local images and neutral fallback | DONE | `7d78493`; [review](../../evidence/adjustments/chart-controls-results/airline-review.md); all156 independently decoded/verified;739,272 bytes; real list images load |
| Trip details | Finite height disclosure; stable trigger/card/focus/scroll; avoid competing list projection and stale anchor adjustments | DONE | `2485c1e`; first/middle/last of11 cards, six native open/close traces have0px trigger/cardTop/scroll movement and intermediate heights |
| Form and ranking | Clear old comparison on form choices; fence obsolete starts; remove generic card; retain local ranking through fresh/save/return paths | DONE | `2485c1e`; [results review](../../evidence/adjustments/chart-controls-results/results-review.md); same search/no start during sort, immutable query, form clear then fresh search; race/return/account regressions pass |
| Empty lists | Completed no-match/filter-empty; truthful incomplete/failure state; date/form/filter adjustment | DONE | `2485c1e`; actual no-match and budget-empty browser journeys pass; coverage/unknown/historical-action regressions pass |
| Assembly | Independent reviews and source/native checks; normal Docker startup; tracker/SDD/export sync | DONE | [Checkpoint](../../evidence/adjustments/chart-controls-results/checkpoint.md);550 integrated tests/88 files,9 Nx checks,5 unique native cases pass across scoped runs; original failures retained |


## Owner adjustment — round-trip motion, chart lifecycle and profile, 2026-10-28

[Decision0044](../../decisions/0044-roundtrip-chart-profile-and-corners.md) maps all eight requests. M7 remains partial,29/35; T30 active. Source commit `68c2d92`.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Round-trip vehicle | Actual outbound/return; distinct flat turns; two train wagons; final return-arrival fade; canonical headings/stops and policy | DONE | 23 scoped tests; independent12 probes +49 graphics/32 web map tests; all three native return/fade cases pass; [review](../../evidence/adjustments/roundtrip-chart-profile/review-map.md) |
| Chart lifecycle and labels | Eased draw/morph/exit/re-entry; interruption continuity; new-edge fade; lazy SVG/GPU parity; exact data/gaps; full min/max labels | DONE | 36 focused tests, independent3 probes;233 native fractional reveal/opacity pairs match frame store; actual width/gap/price buffer proof passes; [review](../../evidence/adjustments/roundtrip-chart-profile/review-chart.md) |
| Profile and notices | Identity/logout only; danger inline icon; remove saving/appearance UI and unused reads; concise card invalidation; silent incompatible-city clearing | DONE | 165 scoped tests +80 independent checks; real focus/mobile/logout/legacy20-record preservation and invalid-card native cases pass; [review](../../evidence/adjustments/roundtrip-chart-profile/review-profile-corners.md) |
| Shared corners | Semantic radius/native squircle variables; rounded fallback; preserve true circles, native focus and vendor styles | DONE | 107 final CSS declarations audited; actual card/control/indicator computed shapes, native fallback/circles and screenshots verified |
| Assembly and review | Independent reviews; source/native/package checks; specification/SDD/export checkpoint | DONE | [Checkpoint](../../evidence/adjustments/roundtrip-chart-profile/checkpoint.md):566 source tests/89 files,11 Nx checks,11 unique native cases across scoped runs; original10/1 run retained; Docker healthy; preview refreshed; no push |


## Owner adjustment — staggered particles and adaptive bloom, 2026-10-29

[Decision0045](../../decisions/0045-staggered-particles-and-adaptive-bloom.md), specification1.19. M7 remains partial,29/35; T30 active. Feature `e5ad5d7`; packaging prerequisite `6b3ff24`.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Staggered scope morph | Independent delays/durations; per-anchor land handoff; interruption parity; stable shader/material ownership | DONE | Independent10,240native samples/zero seed mismatches;14 focused tests + lifecycle review; [morph review](../../evidence/adjustments/staggered-particles-bloom/review-morph.md) |
| Brighter particles | Modest semantic dark-dot adjustment; preserve light contrast, edge blending and dim background | DONE | Roughly15%dark RGB; actual source/packaged captures; native alpha boundaries preserved |
| Adaptive pmndrs bloom | Map-only effect; bounded targets; actual cadence/submission/GPU trial; fresh timing/degradation; isolated chart/context cleanup | DONE | Independent10probes; packaged3/3 native cases;72001lit map pixels/zero outside pixels; [bloom review](../../evidence/adjustments/staggered-particles-bloom/review-bloom.md) |
| Readiness prerequisite | One bounded expired-owner batch; immediate auth expiry; rollback/locking/live peer/restart retention | DONE | Author/independent18integration +5reviewer PG probes,3unitcases; actual25s cancellation; normalDockerstartuphealthy; [review](../../evidence/adjustments/staggered-particles-bloom/review-readiness-recovery.md) |
| Assembly and device check | Final package performance; source/static checks; evidence/spec/SDD/export checkpoint | DONE | [Checkpoint](../../evidence/adjustments/staggered-particles-bloom/checkpoint.md):577tests/92files,11Nxchecks,API/data-access checks; actualM3Pro worldGPUmedian3.966ms/p958.268ms and16.7ms submittedcadence; one context, noerrors, no push |


## Owner adjustment — continuous particle morph and pointer repulsion, 2026-10-29

[Decision0046](../../decisions/0046-continuous-morph-and-pointer-repulsion.md), specification1.20. Source73499d8. M7 remains partial,29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Continuous morph | Live4.6s independently staggered field; terminal position/velocity join; actual camera; interrupted residual wander; covered pause | DONE | `73499d8`; [review](../../evidence/adjustments/continuous-morph-repulsion/review-morph.md):1,545GPU observations/2probes,≤0.000382CSSpx mismatch; immutable active-pointer rebase and policy tests |
| Pointer response | Soft bounded flee/return from visible particles; stable seeds; stronger local light; strength-scaled candidate budget | DONE | [review](../../evidence/adjustments/continuous-morph-repulsion/review-pointer.md):3source probes,11.74px away,1.208×prior local light,46.43px zoom-stable radius;45actualGPU neighborhood comparisons match |
| Assembly | Integrated/final-focused/static; normal Docker; native map/bloom; device performance; spec/SDD/export sync | DONE | [Checkpoint](../../evidence/adjustments/continuous-morph-repulsion/checkpoint.md):587integrated/18final-focused,11Nxchecks,3packagednative; bothDPRbloom-enabled/onecontext,16.7–16.8ms steady submissionp95; startup stalls retained separately |


## Owner adjustment — faster morph, provinces and bounded glow, 2026-10-29

[Decision0047](../../decisions/0047-faster-morph-provinces-and-bounded-glow.md), specification1.21. Source6289787; M7 remains partial29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Faster morph |2s, all delays0; arrival1.08–1.72s; live join, interrupted parity | DONE | `6289787`; [independent review](../../evidence/adjustments/faster-morph-provinces/review-independent.md):3nativeprobes/1545GPU observations, all64 sample departures nonzero by1% |
| Wider pointer | Up to110px force, separate48px illumination; same bounded12px excursion and soft release | DONE | Actual app110px force versus46.43px illumination, zoom/camera/budget tests; reviewed without route/city displacement |
| Iran provinces |75sourced features/39KB; sequential300ms exit/1s enter; bounded validation, retained resource/policy handling | DONE | Exact pinned-source/hash reproduction;3338province vertices/native sequential draw alpha/max2owners; retirement hazard fixed;29focused tests |
| Restrained glow | Bound seeded pulse0.58–.80; geography tint avoids pale highlight; preserve selected semantic emphasis | DONE | Major-city sprite cause closed;12native raster cases maxRGB158/255/highlight perturbation0bytes, semantic positive-control136bytes;25focused tests |
| Assembly | Integrated/static, normal Docker, native/device/visual proof, spec/SDD/exports | DONE | [Checkpoint](../../evidence/adjustments/faster-morph-provinces/checkpoint.md):599tests/96files,11Nxchecks,3packagednative; stable16.7–16.8ms submissionp95, adaptiveDPR2bloomfallback truthfully retained |


## Owner adjustment — GPGPU fluid particle scatter, 2026-10-29

[Decision0048](../../decisions/0048-particle-scatter-and-momentum.md), specification1.22. Feature5bbfab2, idle8595bc5; M7 remains partial29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| GPU fluid motion | Genuine low-resolution ping-pong advection/curl/pressure and integratedD/V; stroke eddies/momentum/return | DONE | [Review](../../evidence/adjustments/particle-momentum/review-independent.md): GPUdisplacementRMS4.44→11.69→.00391px afterrelease,5936carry/5571turncells, actualpressure/curl;12tinycompute draws/≤1MiB |
| Particle integration | Shared land/morph/major flow, actualcamera, captured-sourceC0, event-only snapshot and neighborhood cap | DONE | Native4/4GPU/CPU tests; realapp0ordinaryreads/1scopeinterruptread, sharedtextures, identicalDPR1/1.75state; old radialshader removed |
| Policy and performance | Exactphysical/logicalstate; lazy/sleep/visibility/reduced/context/resource guards, StrictMode/Activity owners | DONE | 11finalengine tests; actualappcalendarpause/reveal/contextrestore, zeroidlework; device16.7–16.8ms submissionp95, optionalDPR2bloomfallback recorded |
| Assembly | Integrated/static, normalDocker, native/device/visual recording, spec/SDD/exports | DONE | [Checkpoint](../../evidence/adjustments/particle-momentum/checkpoint.md):608integrated/98files,11Nxstatic,11finalfocused; verified3packagedbloom+realappflow+recordingPASS; originalqualificationfailures retained |

## Owner adjustment — travel research, richer catalog and compact controls, 2026-10-29

[Decision0049](../../decisions/0049-travel-research-catalog-and-compact-controls.md), specification1.23. Source`4f80ac0`; M7 remains partial29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Compact controls | Horizontal date/price rows; shared segmented padding; larger carrier identity | DONE | Native320/390/1366, liveindicator/RTLkeyboard/font/fit checks; final320pxdatewrap repair preserves alltext/fonts |
| Provider research and assets | Primary market fields/prices/types; authentic transparent PNG ground operators; provenance | DONE | 8queries/32cardobservations;23groundidentities/69PNGs, independentdecode/hash/rights approval; existingairlinesunchanged |
| Versioned realistic inventory | Distant cities; coherent2/3-stop fares; immutablev1 replay andv2 insert-only seed | DONE | 33cities/112places/122connections;144exactlegacy/264v2independentrecords;131PGtests,restart,versionlineage/referrals/doubleseedPASS |
| Map presentation | Actual city/place codes; double-arrow roundtrip heading; repeating vehicle; clearer provinces | DONE | 3/3nativeallmodecanonicalreturn/fade/secondcycle; actual.52/.32GPUboundarystrength;4/4newcatalogcaseswith2/3stopLAX/camera/date-line/4+4RT/hotels/groundPNG |
| Assembly | Independent reviews; native/package checks; master/spec/SDD/export checkpoint | DONE | [Checkpoint](../../evidence/adjustments/realistic-travel-catalog/checkpoint.md):1227source/145files,131PG/19files,affectedstatic/boundaries/geometrychecks; normalDockerhealthy,14assetparity,originalDBretained; no push |

## Owner adjustment — form, profile and route-light polish, 2026-10-29

[Decision0051](../../decisions/0051-form-profile-and-route-polish.md), specification1.24, source`7e73dd0`. Concurrent0050 branding is preserved. M7 remains partial29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Quiet form feedback | Remove routine expiry card/passive hints; actual field errors/shake/focus on attempt; icon+calendar label; preserve true guards | DONE | Focused form/controller checks and independent packaged pointer/Enter/repeat/correction/reduced/covered/expiry proof pass |
| Account and selected card | Remove toolbar tagline; circular avatar; full-width danger logout; stable logical selected edge | DONE | Packaged320/390/1366, focus/logout, RTL/LTR4pxborder and unchanged content inset pass |
| Route-light lifecycle | Fade/re-enter with vehicle; keep base and stop facts; all modes/RT/reduced/static policy | DONE | Four source-preview GPU cases and two packaged flight GPU cases;29fadelevels, zero strand/head mismatch, source train/bus parity, static base retained |
| Assembly | Independent reviews; package/source/static; spec/SDD/export sync | DONE | [Checkpoint](../../evidence/adjustments/form-profile-route-polish/checkpoint.md), packaged6/6, source/static gates shared with0052; no push |

## Owner adjustment — rich near-realistic ticket coverage, 2026-10-29

[Decision0052](../../decisions/0052-rich-inventory-coverage.md), specification1.24, source`1cbdbe2`. Includes completed0051 refinements. M7 remains partial29/35; T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Coverage audit | Actual distinct journeys/sellers, all modes/classes/date/OWRT; isolate normal blackout/root cause | DONE | Independent2680baseline route/class+2160hero90day cases; sparse positive queries had3services and periodic normal gaps;400common v1/v2 comparisons prevent false attribution |
| Rich inventory | Immutablev3,12services/four sellers;156non-Tehran directions; ordinary-date coverage; distance/class fares and explicit rail transfers | DONE | 34cities/114places/348directions/476hotels/1428rates;6304initial matrix+624rail/32road/24hero closure; [coverage summary](../../evidence/adjustments/rich-inventory-coverage/coverage-summary.md) |
| Immutable compatibility | Frozenv1/v2 raw/catalog/normalization/policy/hotels; all-version insert-only seed and packaged lineage | DONE | Exact old catalog+536replay checks; two actual immutable reseeds; read-only packaged comparison of all3versions; original normal DB container/volume retained |
| Runtime scale | Bounded atomic evidence/date chunks; original quote observations; one calendar projection; exact scoped quote reads; replay unchanged | DONE | Actual29final PG cases:672/2112/2112records, all4successful,12groups/48selectedquotes and exact calendar minimum;167unique API PG cases across scoped runs plus3independent probes |
| Assembly | Independent reviews; source/static/tools; normal Docker; all-mode native journeys; tracker/SDD/export sync | DONE | [Checkpoint](../../evidence/adjustments/rich-inventory-coverage/checkpoint.md);1327unique source tests across scoped runs,24Nxchecks/toolsPASS; Dockerhealthy;10catalog native cases +6UI/route cases PASS; all3immutable packaged roots exact; temporary resources cleaned |

## Owner clarification — Docker serves the complete app, 2026-10-29

Existing architecture confirmed; [decision0029](../../decisions/0029-foundation-docker.md).
M7 remains partial29/35 and T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Docker-hosted serving | Start Docker; run normal `docker:up`; verify packaged consumer/admin assets, API and deep routes; prioritize Docker in README | DONE | [Checkpoint](../../evidence/adjustments/docker-serving/checkpoint.md);13 HTTP checks, exact image/served HTML hashes, healthy services, original database retained; independent static review; no runtime source change |

## Owner adjustment — Docker hot reload, 2026-10-29

[Task brief](../../evidence/adjustments/docker-hot-reload/task-brief.md).
[Decision0053](../../decisions/0053-docker-development-hot-reload.md), source `365cef1`, specification1.25. M7 remains partial29/35 and T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Development runtime | Dev Compose/gateway; read-only source mounts; Linux caches/dependencies/generated client; explicit `docker:dev` command | DONE | [Checkpoint](../../evidence/adjustments/docker-hot-reload/checkpoint.md); same4300 origin and custom4350, fresh mountpoint, all services ready |
| Source updates | Web/admin/shared-library Fast Refresh; real TypeScript API emit/alias/restart; atomic saves; last-good error recovery | DONE | Actual5 source edits restored byte-for-byte; all6 container/image IDs stable, zero page errors, retained quote/map/admin context; final16 tool and49 controller/admin checks pass |
| Assembly | Independent review; safe project-owned lifecycle; data preservation; docs/export/commit | DONE | Independent approval; original DB/container/volume and exact48-quote snapshot retained; disposable reverse-mode rehearsal/cleanup passed; default4300 left DEV; no reset/push/deploy |

## Owner adjustment — smooth large ticket lists, 2026-10-29

[Task brief](../../evidence/adjustments/results-scroll-performance/task-brief.md).
[Decision0054](../../decisions/0054-ticket-list-rendering-performance.md), sources `9ade6c6`, `42a4065`, `2897063`, specification1.25. M7 remains partial29/35 and T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Rendering workload | Native offscreen rendering above24cards; finite list fade; memoized rows/formatters/context; suppress pointer previews hidden by pin | DONE | [Checkpoint](../../evidence/adjustments/results-scroll-performance/checkpoint.md);36–37 of48 contents skipped, every card retained; bounded render-only eligibility with live action authority |
| Behavior | Retain focus/details, exact-price/referral authority, sort/frozen order/scroll anchors; fix StrictMode disclosure replay | DONE |106 result source cases, focused map/motion checks and final3 headed native cases pass; six disclosure sequences have30–31 intermediate frames and0px geometry/scroll spread; independent approval |
| Performance and assembly | Actual desktop/mobile before/after and DEV checks; source/package parity; docs/export/commit | DONE | Final normal-pointer DEV p95 **9.3/9.2ms**, zero long tasks/errors on recorded48-card workload; scoped lint/types pass,12 package source hashes exact; all earlier failures retained. Callback cadence, not physical FPS/universal device claim |

## Owner correction — arrow-only trip-type changes, 2026-10-30

[Task brief](../../evidence/adjustments/map-heading-arrows/task-brief.md), [decision0055](../../decisions/0055-map-heading-arrow-only-trip-changes.md), source `205bbe3`, specification1.26. M7 remains partial29/35 and T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Heading identity | Keep unchanged city labels mounted on one-way/round-trip changes; isolate finite arrow animation and stable width | DONE | [Checkpoint](../../evidence/adjustments/map-heading-arrows/checkpoint.md); stable label/text/code owners,220ms arrow reveal, fresh epoch for genuine selected-service changes; stale facts clear truthfully |
| Regression and assembly | Focused source review; actual form and selected-fare toggles; docs/export/commit | DONE | Author12/12 and independent33/33 source cases; final headed native six phases PASS11.5s, normal form0px movement/opacity1/16–17 arrow frames, connected service revocation and reduced motion; lint/types pass, existing Docker DEV/data retained |

## Owner adjustment — compact search controls and error tooltips, 2026-10-30

[Task brief](../../evidence/adjustments/search-controls-tooltips/task-brief.md), [decision0056](../../decisions/0056-search-controls-and-validation-tooltips.md), source `f4782bf`, specification1.27. M7 remains partial29/35 and T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Empty city focus | Native options-on-focus, with selection/typing/clear/Escape and disabled destination preserved | DONE | [Checkpoint](../../evidence/adjustments/search-controls-tooltips/checkpoint.md); actual empty origin/destination focus opens options without choosing a city; correction and no invalid search POST verified |
| Compact date controls | Portal existing owned outbound/return segments beside class; remove fixed-leg hint, retain price units | DONE | Desktop tracks exactly aligned;390/320px fit and44px targets; leg switching leaves URL/search intent untouched, calendar cancel/apply and invalid-return auto-selection preserved |
| Validation overlays | Above whole field/label, stable heights, accessible descriptions, focus/hover/Escape, finite feedback | DONE | Final field/form/input height deltas0px at1366dark/390light; hoverable tip and generic calendar anchor pass. Author28 focused+final13 UI cases, independent71 checks, four unique native scenarios and scoped lint/types pass; original failures retained, independent approval |

## Owner correction — four controls on one row, 2026-10-30

[Task brief](../../evidence/adjustments/search-four-controls-row/task-brief.md), [decision0057](../../decisions/0057-four-controls-row-and-travel-direction.md), source `f35e8e9`, specification1.28. M7 remains partial29/35 and T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Single row | Origin, destination, class and outbound/return in one physical line, readable type and aligned labels | DONE | [Checkpoint](../../evidence/adjustments/search-four-controls-row/checkpoint.md); eight final native snapshots have0px label/control-top spread,54px surfaces and no page overflow; intrinsic overflow stays local |
| Leg visibility | Keep one-way outbound visible; label «جهت سفر»; calendar stays below wheel | DONE | Final19 focused source cases, independent59-case checkpoint and five unique native cases pass; final label/geometry rerun passes5.2s. Leg/URL/calendar identity preserved, source/static/independent review approved |

Owner exact-copy correction,2026-10-30: the outbound/return control label is **جستجو بر اساس**. Visible and accessible names and existing regression selectors updated; layout/behavior unchanged.

## Owner adjustment — vehicle filters and text motion, 2026-10-30

[Task brief](../../evidence/adjustments/vehicle-filter-text-motion/task-brief.md), [decision0058](../../decisions/0058-vehicle-filter-and-text-motion.md), source `ea4d6aa`, specification1.29. M7 remains partial29/35 and T30 active.

| Adjustment | Subtasks | Status | Evidence |
|---|---|---|---|
| Dynamic controls | Eased mode-dependent option width/reflow/words; native authority/focus, selected indicator and four-field row | DONE | [Checkpoint](../../evidence/adjustments/vehicle-filter-text-motion/checkpoint.md); actual1366/390px Chrome traces show11/14 intermediate-width and11/12 opacity frames;44px targets, same-row tops, no page overflow and0px indicator mismatch |
| Text rollout | Bounded current/outgoing whole-phrase transitions on meaningful control/result/filter/empty/hotel surfaces | DONE | Native47 seller-word frames; Persian shaping/current semantics and input DOM preserved;48 cards with0 per-card MotionText; finite panel entry/exit with stale-generation guards |
| Verification | Independent source/authority/policy review, actual desktop/mobile/rapid/input/panel checks, documentation/exports | DONE | Independent86/86 source cases PASS after test-only appearance timing repair; UI/web/e2e types and scoped lint pass;3 unique native cases have passing receipts, original failures retained; concurrent request-control/branding excluded |

## Owner refinement — selective word scramble, 2026-10-30

[Task brief](../../evidence/adjustments/word-scramble-motion/task-brief.md), former decision0059 (withdrawn), source `1223274`, specification1.30. M7 remains partial29/35; T30 active.

| Adjustment | Status | Evidence |
|---|---|---|
| Selective text effect | REVERTED | [Checkpoint](../../evidence/adjustments/word-scramble-motion/checkpoint.md); class options/comparison heading decode with immediate real semantics and fixed final-phrase geometry; existing finite Motion policy, no dependency |
| Verification and assembly | REVERTED | Independent63/63 PASS; actual1366/390Chrome2/2PASS,6/4 class and7 heading intermediate frames,0px reserved-width spread,48cards/0 per-card scramble; types/lint pass, initial test-double failure retained; source/review/exports recorded |

Owner rejected the effect and requested rollback; [decision0060](../../decisions/0060-remove-word-scramble.md) restores the previous fade/lift implementation. The verification above describes the withdrawn source.

## Owner correction — remove word scramble, 2026-10-30

[Task brief](../../evidence/adjustments/undo-word-scramble/task-brief.md), [decision0060](../../decisions/0060-remove-word-scramble.md), source `1f52395`. Restores specification1.29; M7 remains partial29/35, T30 active.

| Adjustment | Status | Evidence |
|---|---|---|
| Restore prior motion | DONE | Seven files restored byte-exactly to71d0624; two scramble-only tests removed; no scramble APIs/opt-ins, earlier0058 ease/fade/filter motion retained |
| Verify and assemble | DONE | [Checkpoint](../../evidence/adjustments/undo-word-scramble/checkpoint.md); independent36/36 PASS, refreshed desktop/mobile Chrome2/2PASS12.2s, web/e2e types PASS; source/review/exports recorded |

## Owner redesign — arrival-based hotel discovery, 2026-10-30

[Task brief](../../evidence/adjustments/arrival-hotel-discovery/task-brief.md), [decision0061](../../decisions/0061-arrival-based-hotel-discovery.md), source `e02c233`. Owner chose always one arrival-local night; specification1.31. M7partial29/35,T30active.

| Work | Status | Evidence |
|---|---|---|
| Automatic arrival model | DONE | Exact selected airport/station/terminal and destination-local date+one calendar day; no configuration; auto-load/abort/StrictMode/unknown and historical-return fences; complete quote/higher-version authority preserved |
| Street map and selection | DONE | Actual named hotel pins/static arrival, two-way card selection, all four orders and inline repeatable point selection; keyed canvas/markers, collision leaders, native focus and retained-exit/lazy ownership; truthful map failure |
| Square cards and responsive composition | DONE | Five desktop/two phone/one tiny-screen columns, readable names/prices, selected details/compact handoff;390→320 no overflow with deferred ticket rendering retained; finite current/exit fades |
| Review and native assembly | DONE | [Checkpoint](../../evidence/adjustments/arrival-hotel-discovery/checkpoint.md), [independent approval](../../evidence/adjustments/arrival-hotel-discovery/independent-review.md);146/146 source cases across20files PASS5.27s; final headedChrome7/7PASS1.1m, all-mode overnight/roundtrip/sort/map/fallback/handoff/GET-return checks; types/lint PASS; exact source scope/local exports recorded |

## Owner correction — viewport filters and round-trip pricing, 2026-10-30

[Task brief](../../evidence/adjustments/roundtrip-pricing-and-filter/task-brief.md), [decision0062](../../decisions/0062-viewport-filters-and-directional-roundtrip-fares.md), source `2e3dcc6`. Specification1.32; M7partial29/35,T30active.

| Work | Status | Evidence |
|---|---|---|
| Viewport-safe filters | DONE | Portalled flip/shift/available-height bounds; fixed close header and inner body scroll; normal-flow actions, native focus/per-open stale exits; targeted1366/390/320×480native PASS10.6s |
| Independent return routes | DONE | Separate labeled outbound/return map chains and compact card routes/return carrier; existing actual return geometry retained; native two-stop outbound/three-stop return LAX animation verified |
| Directional source and price authority | DONE | New recorded transport source under immutablev3, both dates/directions/service bands, exact date/search whole-total parity; old-source replay/cache/recheck/receipt continuity; author78source+2context+35PostgreSQL cases |
| Review and assembly | DONE | [Checkpoint](../../evidence/adjustments/roundtrip-pricing-and-filter/checkpoint.md), [independent approval](../../evidence/adjustments/roundtrip-pricing-and-filter/independent-review.md);246sourcecases/30files PASS,35guardedPostgreSQLcases PASS; final headedChrome5/5PASS1.4m with exact prices, asymmetric return animation and bounded1366/390/320×480filters; exact28path source/exports recorded |

## Owner correction — fastest and fewest-connection trade-offs, 2026-10-30

[Task brief](../../evidence/adjustments/ranking-tradeoffs/task-brief.md), [primary research](../../evidence/adjustments/ranking-tradeoffs/research.md), [decision0063](../../decisions/0063-independent-duration-and-connection-tradeoffs.md), source `4a70916`. Specification1.33; M7partial29/35,T30active.

| Work | Status | Evidence |
|---|---|---|
| Keep independent criteria | DONE | Primary DB/Google documentation confirms separate duration/connection objectives; actual18-query pre-edit v4 audit matches every order; existing comparators/local sorting remain correct and unchanged |
| Meaningful source trade-offs | DONE | New recorded v5 supplies selected long-haul long versus short hub waits with unchanged routes/carriers/flying minutes;136v4+112base raw hashes and old-source rechecks preserved; honest ground equality remains |
| Verify selection and parity | DONE | [Independent approval](../../evidence/adjustments/ranking-tradeoffs/independent-review.md);163sourcecases/17files PASS,2guardedPostgreSQLcases PASS6.57s, finalChrome4/4PASS43.8s; different London leaders/full48cardorders, same prices/selection/map/focus/query and0POSTs; directtrain equality and return-price parity |
| Local assembly | DONE | [Checkpoint](../../evidence/adjustments/ranking-tradeoffs/checkpoint.md); exact14source/test paths, types/lint, local commits, SDD and byte-exact master/spec exports recorded; unrelated work preserved |

## Owner correction — real hotel geography and hover names, 2026-10-30

[Task brief](../../evidence/adjustments/real-hotel-directory/task-brief.md), [decision0064](../../decisions/0064-real-hotel-geography-and-hover-pins.md). Specification1.34; M7partial29/35,T30active. Source `c6d6c30`; [checkpoint](../../evidence/adjustments/real-hotel-directory/checkpoint.md) and [independent approval](../../evidence/adjustments/real-hotel-directory/independent-review.md).

| Work | Status | Evidence |
|---|---|---|
| Real directory | DONE |301 sourced properties across all34 selectable destinations; genuine names/primary OSM identities and geometry, known-unknown stars/address, selected official corroboration, ODbL licence and reproducible acquisition; no fictional coverage padding |
| Map interaction | DONE | Hover/focus-only names and true44px anchors; honest count clusters/zoom, selected-card reveal, stable renderer/keyed markers, viewport-visible focus handoff, reduced motion; independent34map cases PASS and final desktop native hover/focus/two-way/four-sort case PASS |
| Source/history compatibility | DONE | New recorded source/separate authored prices, explicit unknown check-in, ordinary old-source retirement/incompatible-response fence, validated historical receipt retention; independent146source+178web cases PASS, guarded PostgreSQL5/5PASS10.02s including actual301/all34 service pricing and legacy/current history |
| Native review and assembly | DONE | Independent APPROVED; full headedChrome8/8PASS1.2m plus stronger19.1s native-view reference-hover proof (actual:hover/opacity1 before+after); all-mode/distant/mobile/fallback/handoff GET-return verified. Exact29source paths committed, unrelated work preserved; source/docs/SDD and byte-exact exports recorded |

## Owner correction — directional route halos and shared lanes, 2026-10-31

[Task brief](../../evidence/adjustments/route-direction-halo/task-brief.md), [decision0065](../../decisions/0065-directional-route-halos-and-overlap-lanes.md). Specification1.35; M7partial29/35,T30active. Source `6395454` and foreground `16154d2`; [checkpoint](../../evidence/adjustments/route-direction-halo/checkpoint.md), [halo approval](../../evidence/adjustments/route-direction-halo/independent-review.md) and [foreground approval](../../evidence/adjustments/route-direction-halo/vehicle-foreground-review.md).

| Work | Status | Evidence |
|---|---|---|
| Smooth line direction | DONE | Existing-ribbon soft tapered waves/chevrons follow canonical arc length; restrained semantic colors, screen-aware1–6spacing and original vehicle/comet behavior retained |
| Both-leg round trips | DONE | Both revealed directions glow; theme-related return tint,3.8pxper-side matched-fragment lanes with exact endpoint taper, union/resampling/stop-segmentation/seam handling; actual asymLAXsplit.4442146 verified |
| Motion and fallback | DONE | Existing permitted clock; coverage/resume and reduced fixed-phase cues, both-leg SVG arrows/tint/lanes. Foreground extends existing compositor with one bounded final scene draw; no new renderer/clock/dependency. Hidden-clock policy source-reviewed, native hidden-state limit recorded |
| Vehicle foreground | DONE | Head and both wagons excluded from bloom input, drawn once after map/light; explicit ordinary ordering and state/failure cleanup. Real4/4ChromePASS40.9s roles0/2/3,3,1, no depth,0offscreen vehicles; live bloom gate chose insufficient-headroom, compositor tests cover successful bloom order |
| Review and assembly | DONE | Independent81/8source casesPASS1.63s, graphics/E2Etypes+lint. Earlier halo native6/6PASS1.4m and current foreground4/4PASS40.9s are separate evidence runs. Exact9+5source paths committed (13unique), source/docs/SDD/local exports recorded; unrelated changes retained |

## Owner correction — bloom performance recovery, 2026-10-31

[Task brief](../../evidence/adjustments/bloom-performance/task-brief.md), [decision0066](../../decisions/0066-bloom-performance-recovery.md). Specification1.36; M7partial29/35,T30active. Source `1d7d43a`; [checkpoint](../../evidence/adjustments/bloom-performance/checkpoint.md) and [independent approval](../../evidence/adjustments/bloom-performance/review-independent.md).

| Work | Status | Evidence |
|---|---|---|
| Actual rejection cause | DONE | M3Pro/Chrome33.4ms with domesticCPU/GPU1.4/.75ms and world1.1/2.17ms; fresh blank-page/app preflight also delivers30Hz; Low Power Mode1 recorded. Absolute23ms cutoff rejected it and old policy latched failure |
| Safe recovered qualification | DONE | Deliberate cadence-rule revision: stable baseline reference + frozen no-regression trial at30/60/120Hz, CPU8/GPU10unchanged. Active5/10/20/30sbackoff,24+180recovery and24+90trial; terminal faults, diagnostics and GPU epochs retained |
| Remove invisible/repeated work | DONE | Omit3212/3888hidden base points while preserving actual geography/major/semantic cohorts; memoized context cities, no empty timer polls. CSS-resolution glow with pass-aware point sizes; completed morph draws0. Current full graphics197/28PASS19.21s |
| Real map performance and ownership | DONE | Four current native contexts PASS: domestic/world and RetinaDPR2 keep actual bloom/foreground at p90submitted16.7ms; Retina baseDPR1.7496, GPU7.86ms, source580×616. Controlled10×CPU rejection/1×recovery, covered/reduced pause and morph positive-work retirement verified |
| Independent review and assembly | DONE | Independent197tests/28suites PASS8.04s, graphics types/scoped lint and10frozen source hashes PASS; native/source/visual APPROVED. Exact10source paths committed `1d7d43a`, decision/spec/master/SDD/evidence/local exports updated; foreign work retained |

## Owner correction — hotel split view and provider backdrop, 2026-10-31

[Task brief](../../evidence/adjustments/modal-hotel-handoff/task-brief.md), [decision0067](../../decisions/0067-modal-hotel-split-and-provider-handoff.md). Specification1.37; M7partial29/35,T30active. Source `6762635`; [checkpoint](../../evidence/adjustments/modal-hotel-handoff/checkpoint.md) and [independent approval](../../evidence/adjustments/modal-hotel-handoff/review-independent.md). Primary accents remain unchanged under the owner's final clarification.

| Work | Status | Evidence |
|---|---|---|
| Hotel map and square-card split | DONE | Persistent663×774desktop map beside208×208cards in observed1440×900view; stacked390/320portrait, short844×390inner scroll reaches sort/cards with close/dock available; actual map/card two-way selection retained |
| Capacity and nightly prices | DONE | Actual1/2/3adult eligibility and1.8/2.7/3.6m nightly toman verified against rendered/server quotes; optional checkpoint capacity, late-response/selection fences, unchanged transport intent, historical stay-total fallback; author101hotel cases PASS |
| Confirmed provider backdrop | DONE | Fullscreen22pxblur/152pxloader in observedChrome; current confirmed receipt opens authorized zarei.xyz new tab with nullopener, original comparison retained, blocked same-receipt retry with exactlyoneprepare/confirm; author114referral cases PASS |
| Close controls and dark surfaces | DONE | Shared28pxSVG/44pxtarget including final native profile fix; six calendar/hotel/filter theme combinations and12live morph inheritance samples PASS. Independent audit29bg/surface/haze/overlay declarations, primary/text/prices/borders unchanged |
| Independent review and assembly | DONE | Independent328cases/40suites, web/UI/admin types/scopedlint PASS; finalCSS-only44pxminimum separately native-verified. Native matrix3checks+binding+targetedvisual/profile supplements PASS,0pageerrors;32owned sourcepaths committed, scopedtokenprojection excludes prior9brandlines/foreignUIindex; docs/SDD/full exports recorded |

## Owner correction — gold suggestions and hotel map polish, 2026-10-31

[Task brief](../../evidence/adjustments/gold-suggestions-hotel-polish/task-brief.md), [decision0068](../../decisions/0068-gold-suggestions-and-hotel-map-polish.md). Specification1.38; M7partial29/35,T30active. Global primary colors and organic ranking stay intact. Source `586e06d`; [checkpoint](../../evidence/adjustments/gold-suggestions-hotel-polish/checkpoint.md) and [independent approval](../../evidence/adjustments/gold-suggestions-hotel-polish/review-independent.md).

| Owner item | Status | Evidence |
|---|---|---|
|1 Gold faster-arrival surface | DONE | Separate semantic gold banner and exact qualifying price card; primary/price/status palettes unchanged |
|2 Reveal cue | DONE | Exact active card focus/scroll,3second fading cue with persistent gold identity; repeat/revocation/policy cleanup; author114results cases PASS |
|3 Sponsorship documentation | DONE | Owner opportunity recorded in spec/decision, preserving truthful organic comparison and no current paid-campaign claim |
|4 Hotel overflow fade | DONE | Hidden scrollbars, observed bottom gradient only with more below; desktop/short-landscape/all-fit native checks PASS |
|5 Map-heading scramble | DONE | ActualGSAP3.15one-second RTL words, exact accessible text/unchanged codes, reserved final width and no unchanged/arrow-only replay; root48map cases PASS |
|6 Particle halo | DONE | Slight bounded halo refinements in steady land, marker and morph shaders; RGB/core/alpha cap/gate/renderer unchanged; focused11world/cohort cases PASS |
|7 Capacity control and room data | DONE | No visible caption, exact1–4ordinary options, matching54pxtrack, real append-only4adult rates;112hotel/fixture cases and guardedPG6/6PASS |
|8 Reference map interaction | DONE | Bare-map/pin/cluster picking, ordinary zoom/selection, cancellation and authority-key/epoch fences; actual bare-map,14hotelcluster mean, exact hotel-pin point/cancel/ordinary zoom PASS |
|9 Shared sliding hotel segments | DONE | Shared moving/resizing indicator remains active through pending replacement; actual intermediate widths and zero gaps verified |
| Review and scoped assembly | DONE | Independent471cases/64suites; web/UI/fixtures/graphics/E2Etypes and scopedlint PASS, APItypesPASSinDEVgeneratedclient environment; five final Chrome groups PASS with0pageerrors; actual270bloom/1452world draws, GPUp905.526ms and16.7ms submission in this run. Focused11case final-world followup overlaps471. Exact28sourcepaths committed; package/tokenprojections preserveforeignwork; docs/SDD/full exports recorded |

## Owner correction — metallic recommendation finish, 2026-10-31

[Task brief](../../evidence/adjustments/metallic-gold/task-brief.md), [decision0069](../../decisions/0069-metallic-recommendation-finish.md). Specification1.39; M7partial29/35,T30active. Source `f81189a`; [checkpoint](../../evidence/adjustments/metallic-gold/checkpoint.md) and [independent approval](../../evidence/adjustments/metallic-gold/review-independent.md).

| Work | Status | Evidence |
|---|---|---|
| Neutral metallic appearance | DONE | Current-theme faces, subtle champagne reflection and thin multi-stop rim replace amber/brown warning fill; price/status/transport palettes untouched |
| Border sheen and cue | DONE |9sCSSglint follows squircle rim; pointer-pass, existingpolicy pause/staticreduced/forced fallback;3sreveal/persistentidentity retained |
| Review and assembly | DONE |31existingresultscases/webtypes/ownedlint PASS; native dark/light/mobile/cue/policy PASS0errors; exact3sourcepaths committed, frozen/tokenprojection verified; docs/SDD/full exports recorded |

## Owner correction — plain heading and repeatable hotel reference, 2026-10-31

[Task brief](../../evidence/adjustments/hotel-reference-reselection/task-brief.md), [decision0070](../../decisions/0070-hotel-reference-reactivation-and-plain-heading.md). Specification1.40; M7partial29/35,T30active. Source `e358b62`; [checkpoint](../../evidence/adjustments/hotel-reference-reselection/checkpoint.md) and [independent approval](../../evidence/adjustments/hotel-reference-reselection/review-independent.md).

| Work | Status | Evidence |
|---|---|---|
| Plain route labels | DONE | Prior plain city/stop labels, finite fade and stable arrow/bdi behavior restored; unusedGSAPcomponent/tests/dependency removed, root44mapcasesPASS |
| Intrinsic hotel controls | DONE | Fit-content track389.06px in663pxdesktop row, room gap149.94px, both54pxhigh; mobile nooverflow, unchanged sliding indicator |
| Repeated reference selection | DONE | Before-fix secondcheckedpointerfailure captured; guardedonReselect/idempotentpointentry, savedpointreturnfromstars, pointer/touch/Space/Space/Enter/cancel/reopen and actualpin/clustercoords PASS |
| Review and assembly | DONE | Independent171/21+web/UItypes/lintPASS, strengthenedcontrolledkeyboard8/1overlappingPASS;4nativegroups+2settledcapturesPASS0pageerrors. Source14paths including2intentional deletions committed; packageprojection/frozenbytesverified, docs/SDD/full exports recorded |


## Owner correction — dock motion and dual gold glow, 2026-10-31

[Task brief](../../evidence/adjustments/dock-motion-dual-gold-glow/task-brief.md).
[Decision0071](../../decisions/0071-dock-presence-and-dual-gold-glow.md), specification1.41; M7 remains partial29/35,T30active. Source `16e5c6e`; [checkpoint](../../evidence/adjustments/dock-motion-dual-gold-glow/checkpoint.md) and [independent approval](../../evidence/adjustments/dock-motion-dual-gold-glow/review-independent.md).

| Work | Status | Evidence |
|---|---|---|
| Restore shared finite entries | DONE | Real StrictMode regression repaired; running/held/settled ownership, stale completions and policy no-replay covered |
| Dock entry, replacement and exit | DONE | One inert retiring visual, latest city entry and live action guards;132/18 author cases PASS, native six presence groups PASS with17 unchanged camera-bound samples |
| Two visible metallic border glints | DONE | Owner-refined short9s light streaks,1px core/3px local halo; final light/dark/390pxmobile, actual keyboard rings, pointer-state thin decoration and policy/cue checks PASS |
| Independent review and assembly | DONE | Independent98/15PASS6.70s, web/UI types/six-filelint and8hashes PASS; native8groups PASS0errors. Exact8source paths committed `16e5c6e`; decision/spec/master/SDD and full local exports updated; foreign work retained |


## Owner correction — brighter sparse-map bloom, 2026-11-01

[Task brief](../../evidence/adjustments/sparse-map-bloom/task-brief.md), [decision0072](../../decisions/0072-brighter-sparse-map-bloom.md). Specification1.42; M7partial29/35,T30active. Source `f9adb19`; [checkpoint](../../evidence/adjustments/sparse-map-bloom/checkpoint.md) and [independent approval](../../evidence/adjustments/sparse-map-bloom/review-independent.md).

| Work | Status | Evidence |
|---|---|---|
| Bounded particle-light extraction | DONE | Semantic dark .45/.008/.018, light .16/.025/.04 and3mips; ordinary particle shaders/colors/density and device gate unchanged; root60/5/type/lint PASS |
| Iran/world sparse-view comparison | DONE | Four naturally qualified before/after same-frame capture pairs; sampled halo mean2.3–3.6×baseline,0outside-scissor changes; native images independently accepted with live-phase/heuristic limits |
| Performance, themes and pauses | DONE | Separate4steady route/zoom windows onDPR1/DPR2 within actualCPU/GPU/cadence guards; genuine light, vehicle foreground, native dark/light themes and calendar/reduced/mobile pause+resume PASS0errors |
| Independent review and assembly | DONE | Independent199/28PASS8.17s, graphics types/two-filelint and three hashes/token projection PASS; all96 steady runtime snapshots enabled. Exact3source paths committed `f9adb19`; decision/spec/master/SDD/full exports updated, foreign work preserved |

## Owner correction — font-independent map heading arrows, 2026-11-01

[Decision0074](../../decisions/0074-font-independent-map-heading-arrows.md) corrects the visibly missing-font box above the map using an explicit left one-way SVG arrow and paired opposing round-trip arrows. Semantic color, stable icon footprint, finite motion and arrow-only trip-type changes preserve city/code owners. Actual user Chrome HMR shows the round-trip icon;11 related unit cases and web types pass. Maintained native arrow/label-identity verification passes with the other six closure cases. The map-arrow case also passes in full3; its separate GraphicsHost reduced-policy failure and independent final review remain pending; M7partial29/35,T30active.


**T30 graphics closure — 2026-11-01:** full3failed223/1/2 with1097unchanged/all32newacceptancePASS. Reviewed live reduced-motion draw-boundary correction passes9graphics units, graphics types/lint and unchangedwhole10caseGraphicsHost nativefile with1097unchanged. See decision0073 and graphics-policy-closure evidence. Full4 actualunfiltered226 run is RUNNING on binding4; independent final execution/commits remain. T30ACTIVE29/35.


**T30 final full execution — 2026-11-01:** actual full4 unfiltered Nx224PASS/0FAIL/2existingM6guardedSKIP, zero flaky/not-run/interrupted/global errors, all32newacceptancePASS; all1097source hashes and21literalforeign+4projections unchanged. All five prior full/selected failure boundaries remain in the behavioral matrix. Independent final5config/77UI/6PG and source/evidence assembly are pending; T30ACTIVE29/35.


**T30 COMPLETE — 2026-11-01:** source `cfcc3a9`,80exact independently approved source paths. Actual unfiltered full4:224PASS/0FAIL/2existingM6guards, all32newacceptancePASS, zero flaky/not-run/interrupted/global errors;1097source hashes match. Independent5configuration probes,77UI cases/nine files and6PostgreSQL cases pass. Exact owned test DB removed and original five container IDs remain healthy. Prior failed runs and causal limitations retained. [Checkpoint](../../evidence/T30/resume-2026-11-01/checkpoint.md). **30/35tasks complete; M7PARTIAL,T30DONE; T31next.**

## T31 completion — 2026-11-02

Implementation committed as `0ee7f30` after independent source review and native
verification. Accessibility and browser evidence is recorded in
[the final run index](../../evidence/T31/final-verification-summary.json),
[accessibility report](../../evidence/release/accessibility.md) and
[browser matrix](../../evidence/release/browser-matrix.md).

- Chrome and Firefox each pass all22 affected semantic/referral/hotel/keyboard
  checks on the final source. Their earlier full44 runs and corrections remain
  separate. Configured WebKit passes43 with one existing Chromium-CDP touch
  guard, plus its final desktop keyboard case. The independent reviewer passes5.
- Measured fixes cover names/roles, visible wheel contrast and focus,44px mobile
  targets, keyboard hotel coordinates and scrolling, native menu dismissal,
  stable pending account identity and readable map attribution/navigation.
  Actual200percent Chrome zoom, RTL/reflow, six palettes and fallback/no-map
  route facts retain their exact observation limits.
- VoiceOver is NOT PERFORMED at owner request. A separate real vendor-announcement
  residual produces two temporary orphan references after profile close; they
  retire naturally after about7seconds. Focus and current identity remain usable;
  this is an explicitly accepted lower-impact follow-up, not a clean immediate
  scan or screen-reader certification. The manual zoom alias reset/tab closure
  remains NOT CONFIRMED, distinct from verified zoom restoration and automated
  fixture cleanup.
- All1102 bound source/config/test/assets remain unchanged through verification;
  all26 pre-existing modified tracked paths are preserved, with only scoped
  T31 projections committed from shared files. No push or deployment performed.

**Progress:31/35 tasks complete. M7 remains PARTIAL; T32 and T33 are pending.**


## Hotel map reliability follow-up — 2026-11-02

Owner-authorized correction after the completed35-task baseline. Source/proof commit `4db021cd`. [Decision0082](../../decisions/0082-hotel-map-provider-and-tile-resilience.md), [checkpoint](../../evidence/adjustments/hotel-map-resilience/checkpoint.md), [independent review](../../evidence/adjustments/hotel-map-resilience/review/final-evidence-review-001.md). Historical T35 unavailable-map attempts remain unchanged.

| Step | Status | Evidence / owner |
| --- | --- | --- |
| Diagnose actual requests and SDK behavior | DONE | Actual Chrome CORS MissingAllowOriginHeader; exact-Origin HTTP probes; pinned MapLibre6.16 error/style behavior inspected. |
| Repair provider/readiness/recovery | DONE | Single free OpenFreeMap Bright/Dark; current-style primary vector features required; recoverable errors retain map;15s truthful fallback. Independently reviewed code committed `4db021cd`. |
| Focused checks and live browser verification | DONE | 39 tests/3 files; consumer/browser types, scoped lint and frontend build pass.3 single-attempt Chrome journeys pass,0 failures/skips/retries/globalerrors; real domestic/international streets, pins/card binding, all4orders and controlled outage/sprite/retry. Native dark/light/selection/close/reopen verified separately. |
| Independent final review and scoped commit | DONE | Separate source/evidence and exact53-path stage reviews approved; accepted54-path source/proof commit above. Tracker/spec exports synchronized; unrelated working master edits preserved through canonical projection. Closing receipt records the documentation commit separately. |

External service availability remains best-effort; current readiness proves initial supported urban content, not every future pan/tile. Existing cards/reference fallback, prior T35 failed observations and accessibility/device/graphics/rights limits remain explicit. No Docker rebuild/restart, dependency/backend/data change, public push/deployment/submission or recording. Baseline remains **35/35 tasks complete**; this corrective increment is **COMPLETE**.

## General route-label clearance follow-up — 2026-11-02

Owner requires readable city/wait labels clear of drawn routes for every vehicle type, not a Tehran/Isfahan-only offset. Accepted source/proof commit `4c6a75f3`. [Decision0083](../../decisions/0083-route-aware-city-and-stop-labels.md), [brief](../../evidence/adjustments/route-label-clearance/task-brief.md).

| Step | Status | Evidence / owner |
| --- | --- | --- |
| Diagnose and design general geometry clearance | DONE | Prior layout ignores paths; exact WebGL/SVG lane/projection/stroke envelope inspected. Native THR→IFN→MHD case opened. |
| Implement measured route-aware annotation layout | DONE | Full both-leg presentation paths,15px clearance and9px entry envelope; full measured facts, stable bounded placement and passive caption yielding. Separate source review approved. |
| Verify all vehicles, return legs, zoom/resize and fallback | DONE | 23focused tests; graphics/web/E2E types, lint and frontend build pass. Chrome0038/8,20settled DOM/path samples with0collisions/missing visible facts. Native dark IFN120wait separately inspected. [Checkpoint](../../evidence/adjustments/route-label-clearance/checkpoint.md). |
| Independent review, exports and scoped commits | DONE | Separate source, pure-entry, test-correction, runtime/visual, final evidence and exact221-path stage reviews approved; accepted223-path source/proof commit `4c6a75f3`. Spec/export1.45 synchronized; unrelated working master body preserved by canonical projection. Final documentation commit is recorded separately. |

All4follow-up steps are **COMPLETE**. Baseline remains **35/35 tasks complete**. [Checkpoint](../../evidence/adjustments/route-label-clearance/checkpoint.md), [source receipt](../../evidence/adjustments/route-label-clearance/source-commit.json) and [tracker transaction](../../evidence/adjustments/route-label-clearance/tracker-update.json) retain exact source, actual results and preservation scope. No Docker restart/rebuild, backend/data change, push, publication, deployment or submission. Reduced/settled samples and one native normal-motion view do not establish a continuous frame/device/performance audit.

## Date-loading motion follow-up — 2026-11-02

Owner requests pulsing pending chart/wheel feedback, then loading fade-out and real-data fade-in. Accepted source/proof `bd5fc5cc`. [Decision0084](../../decisions/0084-date-price-loading-motion.md), [checkpoint](../../evidence/adjustments/date-loading-motion/checkpoint.md). [Brief](../../evidence/adjustments/date-loading-motion/task-brief.md).

| Step | Status | Evidence / owner |
| --- | --- | --- |
| Implement chart skeleton and pending-to-ready motion | DONE | Neutral reserved chart skeleton;1.45s pending-opacity breathing,240ms retained exit, ready entry. Existing shared GPU/SVG lifecycle and current fact/motion authority preserved; task agent and independent source review. |
| Focused verification and real browser observation | DONE | 31tests/6files; web/E2E types, lint and frontend build exit0. Chrome0012/2: actual low-high-low pulse, lifecycle data fade, real-price/aria parity, finite cleanup and184px bounds; reduced static. Controlled hold of a real response, no fake prices. |
| Independent review and scoped closure | DONE | Separate source, runtime/visual, final evidence and exact36-path stage reviews approved;38-path source/proof `bd5fc5cc`. Spec/master exports synchronized and unrelated master body preserved through canonical projection. Documentation commit recorded separately. |

All3date-loading follow-up steps are **COMPLETE**; baseline remains **35/35 tasks complete**. [Source receipt](../../evidence/adjustments/date-loading-motion/source-commit.json) and [tracker transaction](../../evidence/adjustments/date-loading-motion/tracker-update.json) record actual local commits/export preservation. Controlled response holds verify motion and actual prices, not provider speed or native GPU pixel/uniform output. No Docker rebuild/restart, backend/data change, push, deployment or publication.
