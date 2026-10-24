# T09 — Durable bounded search orchestration and recovery

Date: 2026-10-24. Scope: API search orchestration and contract-only browser recovery. Controller approved these rulings before implementation. No schema migration, external provider, runtime LLM, referral, date-inventory job, deployment, or UI feature is introduced.

## Admission, ownership, and frozen input

`SearchService.startSearch(session, request, predecessorId?)` persists the run before provider work. Managed admission explicitly uses the repository's `enforceLimit` option; the existing low-level repository create seam remains usable by prior evidence tests. A `DemoSession FOR UPDATE` transaction serializes the two-active-run admission limit, scoped predecessor checks, and explicit supersession. `SEARCH_LIMIT` is HTTP 429 with the existing error shape and `retryable: true`. Generation strings never identify work to cancel. Only `supersedesSearchId` explicitly targets another scoped run; unrelated same-session tabs remain active.

`ProviderService.createContext` is called once per run. Actual fixture/catalog identity, seed, anchor, scenario/revision, mapping/aliases, overrides, participating provider IDs, policy definitions, operation ID and deadline are saved in `search-context` audit evidence. Each adapter uses this same frozen context. Participating providers are selected from catalog mode/scope capabilities and the explicit provider filter. Missing registry members fail initialization; there is no invented coverage or hidden nearby-date retrieval.

There are two provider workers per run, a 3500 ms individual mock-provider timeout, and a 5000 ms whole-run deadline. Work uses the original deadline even after stream disconnect. Queued providers do not start after abort. Workers settle together after errors, with an abort fence preventing later queued work. Session reset and expiry fence old namespace writes via the same scoped transaction lock. Session shutdown waits for registered work before disconnecting Prisma.

## Evidence, quotes, and projections

The T06 atomic raw record / normalization trace / offer sink remains authoritative. Entered appends can commit before cancellation obtains the lock; later appends cannot write to a terminal run. Rejected and ambiguous normalization traces remain intact. Failed batch delivery never changes the provider outcome to success. Actual provider offer counts derive from committed scoped offer rows, including a successful append before a later trace-sink failure.

Each projection reads persisted offer/source evidence and immutable quote versions in its transaction, derives eligible/incomplete/rejected evaluations, groups and ranks, then saves quotes, provider rows, full comparison audit context, snapshot and ordered events atomically. The per-session lock serializes simultaneous completions and event sequence allocation. Original quote observation comes from that offer's original normalization observation. Regrouping reuses an existing immutable quote payload; it never extends the same quote ID/version's ten-real-minute lifetime. Whole-party gross totals and provenance are untouched.

Every `search-projection` audit retains evaluation/exclusion decisions, current query/groups, frozen comparison identity, truthful expected/status coverage, quote ID/version/offer references, explanations and suggestion output. `nearbyDates` is explicitly empty until T10. Same-query faster suggestions use T08. `search-terminated` retains cancellation/interruption state and points back to prior immutable projection evidence. All explanations resolve the current cheapest baseline and target quote/version.

Terminal classification: all expected providers succeed and any displayable groups exist → `complete`; all succeed and no groups exist → `empty`; terminal unavailable provider(s) and useful groups → `partial`; terminal unavailable provider(s) and no groups → `failed`; explicit cancellation → `cancelled`; API restart or stopped work after a storage failure → `interrupted`. Incomplete-only groups remain explicitly unpriced, do not create cheapest claims or referral eligibility, and count as displayable groups. Pending work cannot create `empty` or `complete` terminal state.

## HTTP and wire contract

Routes beneath `/api/v1/searches` use the opaque same-origin session cookie and SessionGuard:

- `POST /` accepts existing `{query, clientGeneration}` plus optional `supersedesSearchId`.
- `GET /:id` returns `SearchRecovery = {snapshot, sequence}`.
- `POST /:id/cancel` returns the terminal recovery envelope; repeated cancellation is idempotent.
- `POST /:id/retry` accepts `{clientGeneration}` and creates a fresh ID with `predecessorSearchId`, explicitly superseding the scoped predecessor.
- `GET /:id/events` accepts `Last-Event-ID` (default 0), rejects malformed/unsafe/future cursors, and returns ordered SSE `id: N` plus `data: <SearchEvent JSON>` frames. It emits heartbeat comments, not named events.

`SearchRecoverySchema` is an additive runtime contract. The GET response envelope is introduced with T09 (there was no earlier search HTTP endpoint). Its cursor and snapshot are read in one transaction and match the committed projection, including preceding provider-status events. The existing snapshot schema itself acquires no invented sequence field.

SSE replays immediately from PostgreSQL in batches of at most 50, then polls the durable log every 100 ms; no in-memory replay/live handoff can lose the terminal event. Heartbeats occur every 15 seconds, a blocked writer is released after 5 seconds, and terminal/reset/shutdown/disconnect ends stream resources. A detected stored sequence gap emits the current authoritative snapshot at its current cursor, letting clients use snapshot recovery. Disconnect never cancels the run. This intentionally favors a simple single-process demo over a pub/sub event bus; each open stream incurs a bounded small DB read every 100 ms while collecting.

## Client lifecycle

`subscribeSearch(options): unsubscribe` accepts only shared contracts and an optional injected `SearchTransport`. The default transport uses same-origin credentialed fetch streaming, explicit Last-Event-ID, incremental SSE framing and a 20-second idle boundary. It validates JSON/event/envelope IDs, deduplicates sequences, rejects other search/generation frames and fences callbacks from an aborted/replaced connection.

A sequence gap fetches the atomic snapshot/cursor and reconnects from it. After stream failures, retry delays are 250/500/1000 ms (three retries after the first attempt), then snapshot polling every 1000 ms. Snapshot requests abort after 5000 ms. An EOF also checks the snapshot so a lost terminal frame cannot hang the subscriber. Snapshot recovery calls `onSnapshot` when supplied, otherwise delivers a snapshot/terminal event to `onEvent`. A terminal event or polled terminal snapshot closes recovery. Unsubscribe aborts stream/recovery requests and clears owned timers, with late response guards.

## Storage failure and restart

There is one startup reconciler: `SessionService.ensureReady` calls `SearchRepository.interruptUnfinished`. A conditional terminal transaction makes concurrent/duplicate recovery harmless and preserves completed snapshots. Previously running work is never claimed to resume.

A persistence failure aborts and settles both provider workers, then attempts an interrupted terminal transaction. If storage still rejects it, the service retains only the admitted run ID and owning session in a pending-interruption map. There is no job resume or retry timer. Next scoped start/read/cancel/retry/stream or readiness maintenance flushes this map; new admission flushes it first. Entries are removed only after durable terminal recovery or confirmed deleted scope/run. Recovery callbacks do not recursively call readiness and unregister at shutdown. Process death falls back to the same persisted startup reconciliation.

## Downstream boundaries

T10 owns nearby-date inventory composition. T11 owns fresh recheck versions and referrals. Consumer ordering/focus staging and localized UI remain later tasks. Test container and actual default-gateway packaged verification are independent evidence states. No publication or production readiness claim follows from these tests.

## Independent review fix round 1

The default SSE fetch now has a separate cancellable5000ms connection deadline covering the initial await for headers. On headers/failure/unsubscribe it clears that deadline and removes the forwarding listener. This does not change the20000ms body idle timeout or5000ms snapshot request timeout. A stalled connection therefore enters existing recovery/retry/polling instead of waiting forever.

Provider-status events use the corresponding row from the validated derived snapshot, matching the persisted ProviderRun payload. Incoming adapter batch counts are not authoritative after partial trace-sink failure: a committed offer remains counted even when later delivery fails. Event/status/snapshot writes retain their existing transaction and ordered sequences.

Fix round2: rejected SSE responses (non-OK, missing body, or invalid MIME) explicitly abort the inner fetch and cancel their unused response body before entering recovery. This closes the resource path after the header forwarding listener is removed but before reader ownership exists. Cancellation rejection is handled without blocking recovery; established connection/body/snapshot timeouts remain unchanged.
