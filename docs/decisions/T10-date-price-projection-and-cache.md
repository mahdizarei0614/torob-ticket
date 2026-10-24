# T10 — date-price projection, evidence, and scoped caching

Date-price minima are projections of the same normalized source-backed complete eligible quotes used by selected-date results. They are whole-party totals; incomplete totals never supply a minimum. This task does not implement the wheel, chart, calendar UI, rechecks or referrals.

## Authority and integration rulings

The controller approved these implementation choices before production behavior:

- `DatePriceRun` uses a same-ID `SearchRun` as its explicitly marked internal evidence parent. This preserves existing scoped provider/raw/normalization/offer/quote foreign keys without a migration. Public search reads, streams, cancel, retry, predecessor and supersession reject date-parent IDs. Provider and restart/storage recovery seams can use the parent.
- `DatePriceRepository.admit` uses the session transaction lock to freeze identity, mapping ancestry, scenario, overrides and current session/catalog details atomically with lookup/admission. Execution receives that exact frozen snapshot through `ProviderService`; it cannot reread later edits under an earlier key. Active date batches and selected-date searches share the existing two-run session bound. Identical simultaneous requests share one checking run.
- One `dateInventory` operation per participating provider receives the complete canonical valid date batch. The existing two-worker scheduler and provider 3500 ms / whole-run 5000 ms controls remain. No per-date delayed search is issued. Each date substitutes the inspected leg and retains the opposite leg.
- Add `invalid-date-pair` with reason `return-before-departure` as an explicit disabled, nonretryable calendar cell. Same-day dates remain valid structurally; actual journey chronology decides eligibility. Each departure must lie in its own city's local day-zero through day-89 window. Arrival may lie later.

## Projection states

| Evidence | Cell |
| --- | --- |
| Structurally invalid date pair | `invalid-date-pair` |
| Either departure outside its local 90-day window | `outside-coverage` |
| At least one eligible complete quote | `priced`, with actual pending/failed/successful coverage |
| No complete quote, collection unfinished | `checking` |
| Interrupted, no complete quote | `unavailable/interrupted` |
| Terminal failed/missing/empty provider coverage | `unavailable/retrieval-failed` |
| Adequate all-success coverage but only incomplete eligible candidates | `unavailable/incomplete-price` |
| Adequate nonempty all-success coverage and no eligible/incomplete candidate | `no-match` |

The snapshot remains `checking` until collection is terminal even if some cells are already priced. Such prices are provisional and coverage is not a whole-market claim. Missing values have no numeric minimum; only an actual eligible zero quote yields zero.

`projectDatePrices` receives request, anchor and city zones, committed normalized offers, source bindings and policies, original observation times, persisted immutable quotes and per-date coverage. It indexes observations by the inspected local departure date, then calls `groupOffers` and `quoteOffer` on relevant offers. Original quote versions/observations/expiry are retained on every projection and cache reuse. Stored date-price quotes support audit only; T11 must not treat them as fresh selected-offer/referral authorization.

## Identity and wire view

Pure domain `datePriceIdentity`, `searchIdentity` and `hotelIdentity` own canonicalization. Client `datePriceKey`, `searchKey`, `hotelKey` re-export these helpers; API never imports client transport code. Identity includes all query eligibility/party/class/route/mode/scope data, fixed opposite date, unique sorted inspected dates, fixture/catalog/seed/anchor/scenario/mapping, actual override values, source revisions and fare-policy revisions. Set restrictions and age multisets are normalized. Date minima exclude sort and client generation and replace the inspected leg's placeholder date; search and hotel identity retain ordering. Hotel identity retains its arrival/custom-point sort reference and separately supplied ages at check-in.

Owning session is an independent server query scope, never a client authorization field. A client must invalidate its local query cache on session reset and mutations; hidden override values remain server authority. Key helpers can receive the relevant revision identity but do not discover session state.

Completed snapshot freshness is strictly less than 60 real seconds from completion. At exactly 60 seconds a new observation run is admitted. Quote expiry remains ten real minutes from original observation. Scenario/mapping/override/seed/anchor edits change identity while preserving historic rows; reset deletes only that session's evidence and cancels registered work. Completed snapshots containing a retryable unavailable cell are excluded from reusable cache hits: the same POST starts a fresh observation while the old ID and evidence stay inspectable. In-flight retries still coalesce. Usable priced partial coverage retains normal freshness. An incomplete source total is nonretryable with unchanged conditions; it remains explicit until source/condition identity changes or freshness expires. DELETE does not mutate completed history.

All responses use a canonical query view: `cheapest` sort, unique sorted dates, normalized party ages/restrictions, and the first structurally valid inspected date as query placeholder (or the fixed leg's date when every candidate is structurally invalid). Fixed opposite dates never move. This view is identical for initial POST, cache hit, and GET. The requested validated `clientGeneration` is echoed in both snapshot and nested query. `pollCursor` is the persisted snapshot revision, not a cache key or event cursor. Consumers still reject responses for inactive generations.

Endpoints (behind same-origin session cookie guard):

- `POST /api/v1/date-prices` with `DatePriceQuery` starts or reuses a snapshot.
- `GET /api/v1/date-prices/:id?clientGeneration=...` returns its canonical snapshot.
- `DELETE /api/v1/date-prices/:id?clientGeneration=...` cancels active work; terminal historic data stays immutable.

Missing generation/unknown selectors fail validation. There is no SSE endpoint for dates and no implicit in-memory resumption after restart.

## Durability and recovery

The awaited existing normalization sink commits source evidence before projection. A failed batch may still have committed offers; those can price their actual date with failed coverage. Provider/per-date status and error codes are retained separately. Projection reads evidence and atomically writes immutable quotes, snapshot, cursor and audit. Storage failure aborts queued work and enters interruption recovery. Session startup first interrupts collecting evidence parents, then date recovery reconciles matching checking snapshots. Repeated recovery does not duplicate terminal evidence. Shutdown without database configuration remains lazy; an interrupted write is reconciled after storage returns or at next startup.

No default demo database or volume was used for tests. The test restart helper now requires explicit container name and owner, validates a simple `_test` URL, verifies label/database/loopback port against inspection, and restarts that exact container ID. The old T09-only hardcoded resource was already removed.
