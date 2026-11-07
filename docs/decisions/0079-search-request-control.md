# 0079 — Bound repeated ticket searches and cancel obsolete starts

This canonically records the owner-approved 2026-10-30 search-control change.
Its original uncommitted working document used ID 0057, which collides with the
committed four-control row/travel-direction decision. That existing 0057 retains
its meaning. Historical evidence mentioning search-control 0057 refers to this
same change; the working file remains locally preserved. No behavior is changed
by this identifier reconciliation.

- Normal submit compares validated canonical query identity synchronously.
  Ignore an identical unresolved start and an identical accepted comparison
  still collecting providers. Terminal comparisons remain refreshable. Explicit
  recovery/referral refresh can replace a collecting snapshot when its stream
  failed; it still cannot duplicate an unresolved identical POST.
- A changed valid query can submit while the earlier query is pending. Starting
  its replacement aborts obsolete browser starts. Existing generation fences and
  late-ID cancellation remain, as do client-wide capacity and server two-job
  admission. Slots remain reserved until their actual owner settles.
- HTTP start responses own disconnect cleanup until delivery. A close before
  delivery, including an already-destroyed connection after authentication,
  cancels the admitted durable ID when available. Normal delivered responses and
  later SSE disconnects retain their durable-run behavior. Other tabs' jobs are
  not cancelled.
- Admit at most five transport starts per authenticated session per rolling
  ten seconds. Count durable creation timestamps for all statuses under the
  existing session row lock, before superseding any prior run. Retries use the
  same path. Return retryable SEARCH_LIMIT/429 and localized rate/capacity
  feedback. Limits survive API replacement and cannot be bypassed by cancellation;
  other sessions retain independent capacity. This is transport work admission,
  not a global request firewall or IP quota.

No schema migration, new dependency, external integration, publication or
market-build version change. See the original
[checkpoint](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/search-request-control/checkpoint.md) and
[independent review](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/search-request-control/independent-review.md).
