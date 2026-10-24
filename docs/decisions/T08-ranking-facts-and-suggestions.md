# T08 — Deterministic ranking and evidence-bound comparisons

Date: 2026-10-24. Scope: pure domain functions; T09 owns orchestration and persisted search evidence.

## Rankings

`rankGroups(groups, sort)` copies the collection and uses the specification's exact priority order:

- Cheapest: amount, duration, connections, group ID.
- Fastest: duration, amount, connections, group ID.
- Fewest connections: connections, duration, amount, group ID.

Amounts are integer rials; duration/counts are the already-computed complete-trip T07 values. The function does not reconstruct fares, eligibility, durations or quote lifetime. Missing, mismatched, incomplete or ineligible representative quotes cannot create price claims; their groups remain after qualified groups in stable group-ID order. Empty input is valid. The task brief's `itinerary.id` example is stale; the actual DTO uses `groupId` and `itinerary.itineraryId`.

## Internal comparison context

`ComparisonSnapshot` contains the current filtered groups, query, `CoverageEvidence` and frozen `ComparisonIdentity`. Identity includes session ID, fixture version/seed, mapping/scenario/policy revisions and a per-provider source revision map. These are domain interfaces, not additional public wire schemas. Canonical structural comparison reuses T07's `canonicalValue`.

`ExplanationContext` adds an exact baseline group/quote/version reference and optional selected quote/version. Targets are resolved from current context groups, so a stale copied group argument cannot supply new facts. Defaults use the representative; explicit current eligible fare selection uses that fare's price and per-leg conditions. Baselines state a comparison to their exact referenced quote, and never assert an arbitrary quote is the cheapest. Quotes must match their group itinerary, query party, fixture/mapping/source revision and provenance. The main itinerary mode, round-trip leg presence and each leg's origin-zone local departure date must match the query. Auxiliary bus segments inside a supplied flight itinerary remain allowed. Full fare/filter/route eligibility remains T07's responsibility.

Explanations contain ordered `baselineIds: [baselineQuoteId, targetQuoteId]`. Every reason carries `baselineQuoteVersion`, `targetQuoteVersion` and numeric `provisional` (0/1), enabling independent resolution of both immutable snapshots. Price facts use **target minus baseline rials**; time facts use **baseline minus target minutes**. Connection counts are stated individually. No percentage is invented for a zero-priced baseline.

Baggage facts preserve each leg (`legIndex`: outbound 0, return 1) and kind (`baggageKind`: checked 0, cabin 1). `baselineKnown`/`targetKnown` distinguish missing evidence; the corresponding kilogram fact is omitted when unknown. `kilograms` exists only when both allowances are known and means target minus baseline. UI resolves provider/fare identity and unknown-condition reasons through the referenced quotes; no provider ID is coerced into a numeric fact.

## Coverage

Coverage is derived from the search's explicit expected provider IDs and status rows, never from offer count or fixture maxima. Successful zero-offer responses count as responding providers. Missing/pending/running statuses remain pending. Failed/timeout/paused/cancelled statuses are terminal unavailable and appear in failed provider IDs. Paused rows retain their actual status in the caller's evidence.

Duplicate expected IDs, duplicate status rows or unexpected provider IDs are contradictory evidence and suppress claims. Coverage is complete only when collection is declared complete and no provider remains pending. All facts are provisional while coverage is incomplete; complete coverage can still report failures. This describes the current searched provider set, never the whole travel market.

## Suggestions

`SuggestionContext` contains a current snapshot, nearby-date snapshots, current search ID and optional dismissed search ID. Baseline selection always derives the current cheapest complete representative, independent of user sort. Candidate snapshots must have exactly matching frozen identity, normalized party and filters, route, scope, mode, class and trip type. Empty restriction lists normalize to absence, restriction order/duplicates normalize through the query contract, age order is immaterial and sort does not affect price identity.

Nearby dates change exactly one local calendar date by 1–3 inclusive days; the opposite leg remains fixed. Dates are compared with calendar-date arithmetic. Each snapshot's actual itinerary local departure dates are checked, so changing its query label cannot relabel a current itinerary. Candidates must save at least 2,000,000 rials (200,000 toman) **and** at least 10%. Prefer greater proportional saving, then nearest date, then quote ID. Because every candidate uses the same baseline, lower candidate price is exactly the same proportional ordering.

If no date qualifies, a same-query journey may save at least 90 minutes at no more than 10% premium. Prefer greatest minutes saved, then lowest price, then quote ID. BigInt cross multiplication enforces exact percentage thresholds at safe-integer monetary bounds; output remains ordinary finite JSON numbers. Return at most one result.

Conservative MVP ruling: suggestions require nonempty, all-success completed coverage on both snapshots with identical expected/successful sets. Any pending, failed, paused or otherwise incomparable coverage suppresses suggestions. Even matching failure sets are insufficient. A zero-priced baseline suppresses percentage-based suggestions entirely.

Wire delta semantics: `amountRial = alternative - baseline`; `minutes = baseline - alternative`; `priceRatio = alternative / baseline` (0.9 is a 10% saving; 1.1 is a 10% premium). IDs reference the exact chosen quotes. Existing wire contracts have no suggestion quote-version fields: T09 must preserve the immutable current/candidate quote snapshots and context that resolve those IDs/versions. Dismissal matches the exact current search ID and lasts for that search.

## Ownership and evidence

No quote total, source evidence, eligibility, observation, expiry or version is changed by these functions. T09/T11 retain the T07 quote-lifetime and persisted source-association requirements. T09 must persist candidate/query/coverage/exclusion/ranking context for later admin audit. T08 does not claim HTTP orchestration, date-price retrieval, UI localization, booking, publication or deployment.

Assertion RED, wrong-tie and fabricated-coverage mutation failures, focused GREEN, root test and affected validation evidence are retained in `docs/evidence/T08`. Independent review remains a controller gate after the implementation commit.
