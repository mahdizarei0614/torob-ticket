# 0020 — Whole-party hotel stay authority and shared referral lineage

Status: implemented candidate; independent review and production evidence are tracked in T20.

T20 adds the hotel comparison backend and pure domain engine. The consumer modal, location-map UI, hotel cards and traveler handoff remain T21/T22. Hotels and providers are authored fiction; comparison/referral is the only transaction modeled.

## Stored source and explicit policy

The repository reads the session fixture's actual immutable Hotel and RoomRate rows. The relative nightlyTemplate is materialized against destination-local day0 from the frozen anchor. Its stored policy supplies the adult-per-room rule, required check-in child ages, maximum child age11 and standard14:00 check-in. A frozen HotelSearchRun records raw stored templates, materialized rates, policy/engine revisions, context, issues and source fingerprint. No module-global rate fallback, fabricated combined occupancy cap or fixture revision change is introduced.

Published adult, child and infant caps are independent. Positive infants may use a known noncounting rate subject to those caps; unknown counting semantics or counting without an authored combined limit remains unknown. A pure constructed policy can supply maxOccupants; the seeded policy does not. Known numeric failures and missing/zero-night inventory remain definite ineligibility even when other policy information is unknown. Stay childAgesAtCheckIn is independent of transport party.childAges; missing stay ages are never borrowed or fabricated from an allocation.

## Allocation and prices

The query is bounded to nine travelers and at most one occupied room per adult. Canonical backtracking partitions the exact party and explicit ages across the requested rooms, groups rates by one property/provider, and enforces each rate's minimum inventory over every requested night. Rate/occupancy ordering removes room permutations; equal rate multisets have the same authored room-night price and material terms, so retain one valid deterministic party partition. All material rate combinations remain available. No arbitrary search/output cap discards the cheapest allocation.

Check-in is inclusive and checkout exclusive. Every occupied room is priced for every night with BigInt accumulation and checked safe integer-rial conversion. Published complete room-night prices already contain known mandatory charges and are summed once. Missing mandatory fee evidence produces a typed incomplete diagnostic and explicitly named knownSubtotal, never a final total or selectable quote. Only complete, eligible allocations become immutable HotelQuoteSnapshots. Per-room details preserve exact rate/type/caps, all terms, policy and provenance. Aggregate breakfast/refund/cancellation promises are conservative when rooms differ.

Public optional-compatible roomDetails/results fields keep older contract fixtures valid. T20 always fills them. Results carry property status/reasons, representative/alternative quote IDs and straight-line distances ornull. Snapshot cross-validation binds result/property/quote membership, complete eligible quotes, query identity, allocation and breakdown totals. A property's complete cheapest representative ranks before the diagnostic bucket. The four sorts use whole-stay total; stars descending or distance ascending precede total, unknown metrics sort last, and hotelID resolves remaining ties. Distances use the unrounded spherical great-circle approximation with mean Earth radius6371.0088km; no road distance/time is claimed.

## Dates and public API

POST `/api/v1/hotel-searches` takes HotelSearchQuery and returns201 HotelSearchSnapshot. Each explicit POST creates a fresh operation and fresh quote identities/observation; it does not renew/reuse an old quote. GET `/api/v1/hotel-searches/:id` returns the persisted exact public snapshot, with no repricing or expiry renewal. Foreign IDs and private recheck IDs receive404.

Hotel dates validate independently against destination-local nights0..119, permitting checkout at day120. Arrival-distance requires an actual airport/station/terminal in the destination city. Other sorts may lack an arrival reference. A custom reference accepts finite contract-valid coordinates without an invented city-radius restriction. The pure suggestHotelStay helper consumes the chosen canonical itinerary, actual destination zone and published standard check-in time; it suggests final outbound arrival and first return departure local dates without mutating a query. One-way/unchosen/same-day cases require unresolved dates to be chosen; they never receive an invented hotel night or early-access promise.

## Admission, persistence and recovery

Hotel searches and rechecks use HotelSearchRun private kind/phase evidence and Quote.hotelSearchId. A shared admission helper counts collecting transport/date/recheck SearchRuns plus running hotel work under the existing session row lock; at most two operations are admitted across both paths. No transaction spans a wait, no latency timer is added and processing returns when ready. A registered session owner cancels on reset/shutdown and fences the old sandbox. Interrupted public/private hotel work becomes failed evidence on readiness recovery; no resumed-job claim is made. Public interrupted search GET yields the stored failed snapshot; private rechecks stay private.

The separate hotel fingerprint binds relevant fixture/catalog/seed/anchor/scenario/revision/mapping/provider overrides, stored property/template evidence, destination zone and engine/policy revisions. It deliberately excludes simulated identity, lastSeen and expiry; the existing transport fingerprint inputs are unchanged. Admission/commit/confirm reread current source under the same session lock and reject context races.

## Recheck and confirmation

HotelRecheck registers with the existing RecheckRegistry. Fresh recheck prices only the selected exact allocation/rates for all nights: no automatic room/provider/property substitution. It verifies scope, original public membership, latest version and frozen historical source; subsequent versions point to private recheck work retaining originHotelSearchId and the previous selection. Every unchanged or changed ready result stores a new immutable quote version with a ten-real-minute expiry and a two-minute acceptance intent. Material changes include per-room details as well as total, breakdown, allocation and aggregate terms.

Authored profiles derive afresh from immutable base inventory. Price-change applies floor(base nightly rials ×110/100) and toggles breakfast, with explicit fresh authored provenance and a recorded profile revision/rule; repeated recheck does not compound. Sold-out always targets the origin snapshot's first complete representative, independently of interaction history. Its exact selected allocation becomes unavailable while same-query complete current alternatives can recheck ready. Paused/failing providers cannot grant inventory. No base row is mutated.

Hotel confirmation extends the same ReferralRepository.confirm branch, intent/event storage, digest, receipt GET and idempotency lock used by transport. It revalidates hotel lineage, exact query/allocation/price/terms/source and deadlines. Same-key/same-payload replay returns the original receipt even after later expiry/context changes; changed input conflicts. A stale superseded version cannot fork lineage. An owned transport quote misselected as hotel remains unavailable; missing/foreign hotel quotes remain404. Guests can search/recheck/confirm; simulated login is irrelevant to eligibility and price authority. A referral is never called a purchase, booking or conversion.

## Verification boundary

Meaningful compiling domain assertion REDs and real HTTP404 REDs precede implementation. Focused tests cover allocation, all-night inventory, ages/infants, fees, terms, overflow, four sorts, date/distance edges and stay suggestions. Real local HTTP/PostgreSQL checks cover immutable reads/fresh POSTs, exact versions, changed terms, sold-out alternative success, shared confirmation/idempotency/scope/expiry/digest, mutable-source races, reset, admission and restart recovery. Tests use only the newly owned T20 *_test database/container at fixed localhost62320; credentials/cookies remain outside archived evidence. Full integration/affected gates, independent reviews and root-owned Docker/preservation evidence determine closure; this decision does not claim hotel UI, native WebGL coverage or publication.

## Self-audit correction

Constructed contract-valid IDs containing `|` exposed two delimiter-key collisions: distinct property/provider tuples could merge, and distinct rate multisets could drop the minimum-cost alternative. Two actual assertion REDs reproduce these failures. The allocator now serializes tuple/array keys structurally and orders groups deterministically. Authored seeded identifiers were unaffected; candidate and correction verification remain separately attributed.

An independent correction review reproduced a second identity edge: distinct composed/decomposed Unicode IDs compare equal under English collation. Permanent allocator and all-four-sort ranking REDs now cover source permutations. T20's group/rate/property/representative and hotel-only override ordering share a total comparator: English collation followed by raw-string comparison, with no identifier normalization. Existing transport ordering/fingerprint inputs are untouched.

## Recovery authority correction from independent review

An actual-class probe with only storage mocked reproduced two failures after a transient initial hotel reconciliation outage: SessionService had already marked base transport reconciliation complete, allowing an existing-cookie request to bypass the failed hotel barrier; a later failed owned hotel job could then invoke global startup interruption and fail a live peer. Permanent tests also cover an owned cleanup retry remaining pending after storage failure.

SessionService now distinguishes one-time base reconciliation from completion of all registered recovery callbacks. Authentication retries the complete callback barrier after any failed readiness attempt, and registering a recovery owner invalidates that barrier. HotelWorkOwner crosses initial readiness before direct internal work, and operation-failure cleanup drains only its own pending IDs; global interrupted-work reconciliation remains startup-only. This is a narrow recovery-authority correction, with unchanged cookie, identity, transport fingerprint and reset semantics. The original independent probes and permanent assertion REDs pass after the fix; full T04/T11/T19 regressions remain required before closure.

A fresh controlled-barrier review caught a lifecycle gap in that correction: the startup wait originally preceded controller/owned-work registration. Reset or teardown during the wait could miss the pending caller. Two permanent assertion REDs reproduce late admission after reset/owner destruction. The wait is now inside the registered try/finally; cancellation is checked before admission, a destroyed owner rejects later calls, and session shutdown waits for registered startup work before disconnecting storage. No transaction is held across the readiness wait.
