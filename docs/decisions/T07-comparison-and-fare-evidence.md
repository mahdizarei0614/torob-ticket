# T07 — Comparison identity and explicit fare evidence

2026-10-24. Implementation defaults approved by the controller before production behavior was written. Product scope is unchanged: fictional provider comparison/referral only.

## Additive domain context

The abbreviated plan signatures did not carry the source party/stock evidence, authored policy, real clock, or place-to-city data needed to price a fare safely. `quoteOffer(offer, query, context)` returns a discriminated `QuoteEvaluation`; `groupOffers(offers, query, context)` returns `ComparisonGroup[]`. Their names and first two arguments are retained. Context is required and contains:

- `realClock: RealClock` from the domain's existing clock interface.
- `places: readonly Pick<Place, 'id' | 'cityId' | 'timeZone'>[]`.
- `sourceByOfferId: Record<string, BoundSourceFareEvidence | undefined>`, keyed by the operation-scoped normalized offer ID. Each entry contains `rawRecordId` and the explicit `SourceFareEvidence` returned alongside that offer by normalization.
- `policiesByProviderId: Record<string, ProviderFarePolicy | undefined>`.

Binding validates the operation raw ID and source/mapping/fixture revision consistency against provenance. Domain never interprets raw payloads or `provenance.sourceValue`. A preexisting `eligibility: eligible` is not proof of price applicability. Missing/invalid source or policy evidence produces rejection reasons. Known source ineligibility and unknown reasons other than the normalizer's `fare-evaluation-required` remain blocking.

`QuoteEvaluation` is `eligible` with a complete quote, `incomplete` with the original incomplete offer and reasons, or `rejected` with reasons. The policy revision is retained in evaluation evidence (when available on a rejection), and contributes to quote identity. T09 must retain these evaluations for admin exclusion evidence; `groupOffers` itself only returns displayable groups.

## Explicit fictional policies

`fixtures/catalog/providers.ts` exports `mockFarePolicies`, typed against the domain interface using the already permitted fixtures-to-domain dependency. All six providers use `mock-fares-v1`, their existing mode/scope/class capabilities, required child/infant ages, child ages 2–11 years, infant ages 0–23 months, and seat demand adult/child/infant = 1/1/0.

Current source rows retain party counts but omit ages. Their explicit `sourceAgeBasis: category-counts` means the gross price applies to those category counts after the query's ages pass the authored ranges. This is a fictional policy, not an inferred real carrier rule. An `exact-ages` policy instead requires matching source age multisets; missing ages are not guessed. Empty categories need no source ages and treat empty arrays as equivalent to omission.

Stock must cover all required seats. Source party counts must match the query. Source gross price already covers the full party and both supplied directions, including known mandatory charges, so no multiplication or fee addition occurs. Complete breakdown amounts must sum exactly to the gross total, using integer arithmetic.

## Journey and filters

Journey identity includes direction, ordered canonical services/operators, locations and time zones, UTC instants, and explicit stop/transfer requirements. Seller-specific itinerary/segment IDs, raw instance IDs, fares and prices do not split equivalent travel. IDs use deterministic 128-bit FNV-1a over canonical serialized values; these are content identifiers, never security tokens. Quote identity additionally includes the operation offer/raw namespace, fare/provider, explicit source evidence, revisions, policy, query party/dates/filters, total and terms. Sort does not alter identity.

Both requested directions and fare terms must occur inside one supplied provider offer. The domain never combines one-way sellers. Validate local dates, city/place/zone evidence, segment continuity, stop timing, vehicle changes and return departure at or after final outbound arrival. Equality and feasible same-day returns remain valid.

The supported exception to a flight's segment mode is an explicit supplied bus transfer with a ground-transfer/vehicle-change marker and continuous geometry/timing. Operator filters constrain the queried mode's operators, so selecting an airline does not require also selecting the ancillary bus operator. Unknown baggage/refundability does not satisfy affirmative filters. No mixed-mode query is introduced.

Elapsed travel includes within-direction waits. Sum the directions and omit destination stay; round up once to the existing whole-minute comparison DTO. Original source instants retain their precision. Flight stops are explicit stop entries (including marked airport transfers); ground dwell counts only when there is a vehicle change. A changed service/operator cannot silently claim no vehicle change.

Incomplete mandatory totals may remain separate only after non-price eligibility passes. They cannot satisfy a budget constraint and never produce a quote or representative. Fare variants and both directions' known/unknown terms remain visible. Representative is the cheapest eligible complete quote, with quote ID as the stable tie breaker. Group ordering is stable identity order; T08 owns ranking.

## Observation and downstream lifetime

A newly constructed quote uses the supplied real audit clock and expires exactly 10 real minutes later, at version 1. Source observedAt/provenance stay unchanged. `groupOffers` samples the clock once for its batch. The context can carry a frozen operation observation via `{ now: () => new Date(operationObservedAt) }`.

**T09 must freeze and retain the comparison observation for an operation/search and reuse it during regrouping.** Re-ranking or late provider updates must not refresh an existing persisted quote ID/version's original observedAt or expiresAt. If grouping multiple operation observations, preserve/reuse each existing persisted quote's timestamps rather than replacing them with a later call's clock. The pure function does not own persistence or version transitions. T11 owns explicit recheck version/acceptance lifecycles and must supply fresh operation-scoped source evidence, retaining history. No persistence implementation is added in T07.
