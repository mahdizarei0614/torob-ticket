# TorobTicket Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Read the companion specification first. This plan authorizes no deployment, application submission, real provider integration, or external messaging.

**Owner workflow override:** Superpowers is disabled through `2026-10-26T07:16:38Z` / `10:46:38 Asia/Tehran`. During that interval use native task-by-task subagents, independent reviews and ordinary project decision/evidence records; do not invoke plugin skills, tools, scripts, templates or frozen bookkeeping. The original workflow instruction above resumes only after that interval, subject to newer owner instructions.

**Goal:** Build a polished, self-contained Torob-style travel comparison demo that demonstrates product judgment, UI/UX quality, reliable full-stack engineering, and an evidenced AI-assisted development process.

**Architecture:** Option A: an Nx/pnpm TypeScript monorepo with React/Vite consumer and admin applications, a modular NestJS API, and PostgreSQL/Prisma. Providers enter one validated normalization/comparison pipeline. A shared Three.js/React Three Fiber/GLSL renderer supports the map and visual effects while HTML provides accessible interaction.

**Tech Stack:** Nx, pnpm, TypeScript, React, Vite, React Router, TanStack Query, React Aria, CSS Modules, CSS custom properties, Zod, NestJS, PostgreSQL, Prisma, Three.js, React Three Fiber, selected Drei utilities, Motion, @internationalized/date, Vitest, Testing Library, Playwright, Storybook, Docker Compose, Caddy.

**Spec:** [TorobTicket Product and Architecture Specification](../specs/2026-10-24-torobticket-design.md), revision 1.6, 2026-10-26 (selected-journey map atmosphere and choreography).

**Plan state:** Approved. M1–M6 and T29 packaging are complete with independent reviews and packaged acceptance evidence. **29/35 tasks complete; M7 PARTIAL, T30 ACTIVE.** Owner requested a fast checkpoint before substantial design/logic changes: finish durable harness checks now; full T30 matrix and T31–T33 audits/rehearsal remain unfinished. M8 retains its planned scope.

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
| [T30 — Complete behavioral regression and multi-reviewer acceptance](#t30) | T30.1 Build stable e2e fixtures<br>T30.2 Exercise the full matrix<br>T30.3 Exercise cross-feature journeys<br>T30.4 Exercise hostile timing and isolation<br>T30.5 Verify and commit | T19, T22, T24, T25, T26, T28, T29 | ACTIVE | Partial harness675c409; independent4 config probes; full matrix deferred before redesign |
| [T31 — Accessibility, RTL, responsive behavior, and browser compatibility](#t31) | T31.1 Define representative coverage<br>T31.2 Run semantic checks<br>T31.3 Inspect visual accessibility<br>T31.4 Run browser coverage<br>T31.5 Fix, verify, and commit | T27, T28, T30 | TODO | Unassigned / — |
| [T32 — Graphics performance, visual regression, and resource budgets](#t32) | T32.1 Capture controlled visual baselines<br>T32.2 Measure real interaction performance<br>T32.3 Measure bundles and idle work<br>T32.4 Stress lifecycle and fallbacks<br>T32.5 Verify and commit | T27, T28, T30 | TODO | Unassigned / — |
| [T33 — Fresh-start, offline-runtime, reset, and restart rehearsal](#t33) | T33.1 Rehearse a fresh environment<br>T33.2 Verify external-network independence<br>T33.3 Rehearse lifecycle failures<br>T33.4 Finalize verification runner<br>T33.5 Verify and commit | T29, T30, T31, T32 | TODO | Unassigned / — |
| [T34 — Reviewer guide, AI evidence, walkthrough, and submission-ready materials](#t34) | T34.1 Write the immediate-start guide<br>T34.2 Write an evidence-based AI log<br>T34.3 Prepare the timed walkthrough<br>T34.4 Review submission facts and licenses<br>T34.5 Verify and commit | T25, T26, T30, T31, T32, T33 | TODO | Unassigned / — |
| [T35 — Independent final review and release checkpoint](#t35) | T35.1 Review against the product<br>T35.2 Resolve material findings<br>T35.3 Reconcile the tracker<br>T35.4 Run the final critical path<br>T35.5 Record the release checkpoint | T34 | TODO | Unassigned / — |

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
- `tests/e2e/six-mode-journeys.spec.ts`
- `tests/e2e/roundtrip-pricing.spec.ts`
- `tests/e2e/reviewer-isolation.spec.ts`
- `tests/e2e/full-walkthrough.spec.ts`
- `docs/evidence/release/behavioral-matrix.md`

**Interfaces:**

- Consumes: Complete running product, deterministic seed/scenario clock, existing focused suites.
- Produces: Full six-combination one-way/round-trip matrix, guest/identity/hotel/referral/admin walkthrough, isolation and idempotency release evidence.

- [ ] **T30.1 — Build stable e2e fixtures**

Create isolated browser contexts/sessions and explicit seed/anchor/scenario setup through supported demo APIs. Tests wait for observable state, not arbitrary sleeps. Never share mutable session state between parallel cases.

- [ ] **T30.2 — Exercise the full matrix**

Run six mode/scope combinations in one-way and round-trip, varied parties, all sorts, meaningful filters, different provider fares, date/chart consistency, and correct direction/transfer timelines.

- [ ] **T30.3 — Exercise cross-feature journeys**

Cover guest referral, optional saved search, hotel custom-location/room selection, changed fare acceptance, sold-out recovery, normalization correction/replay, and the admin referral trace.

- [ ] **T30.4 — Exercise hostile timing and isolation**

Use two reviewer contexts, delayed and duplicated events, rapid query changes, two simultaneous confirmations, reset during a running query, and guessed IDs. Assert no cross-session effects or duplicate referrals.

- [ ] **T30.5 — Verify and commit**

Run pnpm nx run e2e:e2e against the Compose stack and relevant unit/integration suites after any fixes. Record actual results and remaining limitations in behavioral-matrix.md; commit acceptance coverage.

**Acceptance:** The entire agreed product works coherently across modes, parties, failures, and independent reviewer sessions.

**T30 fast partial checkpoint — 2026-10-26:** Owner requested a very quick finish before substantial design/logic changes. Source `675c409` adds isolated external Compose execution, evidence/peer origin binding, custom touch context baseURL/CDP ownership and current admin assertions; no product logic/design changes. Types/lint pass. Actual default Nx smoke4PASS/1obsolete-heading failure is retained; corrected admin-only run1PASS separately. Four independent config probes approve the narrow three-source delta. Full12-row matrix, broad acceptance and T31–T33 audits/rehearsal remain unfinished; **29/35 complete, M7 PARTIAL, T30 ACTIVE**. Owned4329 stack/volume/image tags removed; default4300 remains ready. [Fast checkpoint](../../evidence/release/m7-fast-checkpoint.md), [independent partial review](../../evidence/T30/review/report.md).

---

<a id="t31"></a>

### Task 31: T31 — Accessibility, RTL, responsive behavior, and browser compatibility

**Milestone:** M7 · **Depends on:** T27, T28, T30 · **Spec:** §3, §5–§8, §12

**Files — create unless introduced by a dependency; then modify:**

- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/responsive-rtl.spec.ts`
- `tests/e2e/playwright.config.ts`
- `docs/evidence/release/accessibility.md`
- `docs/evidence/release/browser-matrix.md`

**Interfaces:**

- Consumes: Complete UI and recovery states; keyboard and motion policies; supported browsers.
- Produces: Automated accessibility checks plus documented manual keyboard/screen-reader/contrast review; Chromium/Firefox/WebKit and responsive acceptance.

- [ ] **T31.1 — Define representative coverage**

Select landing/composer, wheel/calendar, results/provider details, route timeline, hotel/location dialog, recheck/handoff, and admin inspection. Cover 390×844, 768×1024, 1280×800, and 1440×900, including the map breakpoint boundary.

- [ ] **T31.2 — Run semantic checks**

Add axe-based checks for representative states, then manually complete the journey by keyboard. Inspect focus visibility/order, dialog focus return, text alternatives, live announcements without spam, and code-route LTR isolation.

- [ ] **T31.3 — Inspect visual accessibility**

Measure text/control contrast in six palettes; check touch targets, 200% zoom, long Persian strings, unknown prices, reduced motion, and fallback charts. Verify a no-map small-screen user receives all route information.

- [ ] **T31.4 — Run browser coverage**

Run pnpm nx run e2e:e2e --grep '@a11y|@responsive|@dates|@hotels|@referral' in Chromium, Firefox, and WebKit. Manually record actual assistive-technology/device checks performed; distinguish browser emulation from a real device.

- [ ] **T31.5 — Fix, verify, and commit**

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

- [ ] **T32.1 — Capture controlled visual baselines**

Record seed, clock, viewport, browser, theme, quality tier, and reduced-motion settings. Wait for fonts/data/render readiness. Review at least 24 key captures: six palettes × desktop/mobile × search/results-or-hotels; add admin/reference screens.

- [ ] **T32.2 — Measure real interaction performance**

Record reference hardware/browser. Measure date drag, chart synchronization, route preview/pin, scroll, modal open, and theme toggle. Use the <200 ms, 60/30 fps, first-result and completion targets; report p95/frame behavior and measurement method.

- [ ] **T32.3 — Measure bundles and idle work**

Run node tools/measure-bundles.mjs. Verify initial/deferred graphics gzip targets, lazy loading, no repeated canvas/context allocation, bounded material/geometry counts, and no continuing animation after scenes settle or the tab is hidden.

- [ ] **T32.4 — Stress lifecycle and fallbacks**

Repeatedly open/close hotels, change modes/themes, resize across breakpoint, simulate context loss/restoration and WebGL unavailability. Inspect memory/resource trends and shader compilation errors. Essential forms/selection must survive every graphics fallback.

- [ ] **T32.5 — Verify and commit**

Run pnpm nx run e2e:e2e --grep '@visual|@graphics-lifecycle|@performance'. Inspect screenshots manually with sensible cross-GPU tolerances. Fix measured bottlenecks and rerun relevant checks; record actual budgets/limitations and commit.

**Acceptance:** The GLSL-heavy identity remains responsive, stable, and resource-bounded, with evidence from a recorded environment.

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

- [ ] **T33.1 — Rehearse a fresh environment**

Create a disposable named volume and run pnpm docker:up from a clean checkout. Record initial build and ready times, exact commands, seed versions, URLs, and health status. Do not delete the user's unrelated Docker resources.

- [ ] **T33.2 — Verify external-network independence**

After images/dependencies are available, block nonlocal requests during the walkthrough. Confirm the core journey requires no remote font, image, analytics, OAuth, or model call. The approved on-demand hotel street map is the explicit external tile/style/glyph/sprite exception: block that service and verify the local list/coordinates and referral remain usable with an honest unavailable state. Do not claim the street map is bundled offline. Exercise the direct Compose startup path without host Node/pnpm.

- [ ] **T33.3 — Rehearse lifecycle failures**

Restart API during collection, restart the stack with existing data, fail initialization intentionally, and reset one of two reviewer sessions. Confirm interrupted-retry behavior, preserved completed evidence, actionable failures, and isolation.

- [ ] **T33.4 — Finalize verification runner**

Implement pnpm verify:release to run agreed health/build/test checks and produce a bounded report; keep destructive reset separate. Include clean shutdown instructions and known port/architecture troubleshooting.

- [ ] **T33.5 — Verify and commit**

Run the final release rehearsal and save actual outputs. Resolve failures before marking done, then commit packaging/evidence corrections.

**Acceptance:** A reviewer can reproduce the demo without hidden setup, and routine restart/reset operations behave exactly as documented.

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

- [ ] **T34.1 — Write the immediate-start guide**

Lead README with what the product demonstrates, the one-command startup, app/admin URLs, simulated-data identity, and the prepared reviewer path. Link architecture, test commands, and known limitations without hiding the main launch action.

- [ ] **T34.2 — Write an evidence-based AI log**

Record actual research/design/coding/data/testing assistance, useful prompts or summaries, rejected suggestions, human decisions, and verification. Do not invent model calls, user tests, metrics, or a live AI feature.

- [ ] **T34.3 — Prepare the timed walkthrough**

Write a script/storyboard and rehearse approximately 4:30: nearby date/calendar → grouped provider comparison → route/hotel → changed-fare referral → admin source/referral evidence. Use stable presets and record seed/date and measured duration. Actual video capture is a separately requested application artifact; do not claim a recording exists.

- [ ] **T34.4 — Review submission facts and licenses**

Recheck the current official challenge requirements before preparing final submission artifacts. Verify asset/font/geography attribution, clear simulation labels, accurate limitations, and links to actual evidence. No application is submitted by this task.

- [ ] **T34.5 — Verify and commit**

Follow the README in a fresh session, time the walkthrough, check links/commands, and commit documentation. Clearly distinguish the completed script/rehearsal from any future video recording.

**Acceptance:** Reviewers can understand, run, and assess the demo quickly, with truthful evidence of both engineering quality and AI-assisted work.

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

- [ ] **T35.1 — Review against the product**

Use the requesting-code-review skill and a fresh reviewer to inspect the whole implementation against the specification, focusing on pricing/grouping/time/session/referral correctness and actual UX. Review all changed code and meaningful evidence, not only the demo script.

- [ ] **T35.2 — Resolve material findings**

Fix critical/high-impact issues in their owning tasks and run the relevant regression checks. Record justified lower-impact limitations explicitly. A written explanation does not substitute for fixing a broken required journey.

- [ ] **T35.3 — Reconcile the tracker**

Verify every D01–D25 requirement and acceptance-matrix row has implementation/evidence. Update task status, owners, commits, and checkboxes. Record any unperformed real-device checks as limitations; do not equate emulation with a device test. Video submission remains a separate follow-up.

- [ ] **T35.4 — Run the final critical path**

Run pnpm verify:release after review fixes and manually complete the timed reviewer journey. Confirm the final README, screenshots/video, seed, and behavior describe the same build.

- [ ] **T35.5 — Record the release checkpoint**

Commit the accepted implementation and evidence with no unrelated changes. Report the runnable locations, exact verification outcomes, and material limitations. Do not publish, deploy, merge, or submit an application without the user's separate instruction.

**Acceptance:** The complete agreed scope is implemented, review findings are resolved, evidence matches the build, and the repository is ready for a reviewer.

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
