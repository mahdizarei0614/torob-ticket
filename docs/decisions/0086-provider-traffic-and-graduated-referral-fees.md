# 0086 — Provider traffic and graduated referral fees

Date:2026-11-03. Owner business model and explicit question replies.

Revenue is based on qualified outbound referrals, independent of purchase.
Count every distinct recorded outbound operation; qualify at most once per
anonymous browser visitor/provider per rolling60minutes. Repeats stay visible
but do not extend the last-billable anchor. At exactly60minutes a new receipt
may qualify; replaying the same receipt never creates another operation/fee.

Pricing is graduated: the first100qualified referrals use tier1,101..1000tier2,
and1001onward tier3 by default; checkpoints/rates are configurable per provider.
Only later referrals get later rates, with no whole-month repricing. Counters
restart on Persian calendar month midnight in Asia/Tehran. Preserve the ledger,
all-type per-provider ordinal and hourly exclusion across the month boundary.
No commercial rates have been provided; default rates are unset, with explicit
unpriced counts. Zero is a valid configured rate. Record exact safe integer IRR,
display exact toman. Tariff changes affect future qualified events; earlier
known/unpriced fees remain immutable. This records referral fees, not invoices,
payments received, provider page-load confirmation or purchase conversions.

Existing referral confirmation precedes popup opening and remains immutable
accepted-offer evidence. A separate authenticated server GET for the confirmed
receipt records an idempotent redirect-issued row, then302 only to the authorized
placeholder https://zarei.xyz. No client destination/provider/rate/time override.
Blocked popups, cancellation, unavailable quotes, HEAD, receipt reads and duplicate
redirect retries do not inflate traffic. Preserve consent, synchronous popup retry,
opener severing, legacy receipt routes and no-store/no-referrer headers.

Reviewer workspace and visitor identity are distinct. Server-minted, signed,
namespace-bound anonymous browser cookies use a durable private random secret.
Ordinary authentication never writes cookies. Resumed bootstrap restores visitor state without rotating auth credentials. New
workspace/reset responses retain intentional auth rotation and include both auth
and visitor Set-Cookie headers. Namespace-specific names fence late old-workspace
responses. Browser-session lifetime follows existing auth,
bounded by live server namespace expiry/revocation. No person/device fingerprint
or cross-reviewer aggregation. Visitor sessions are not verified people and this
local model is not production anti-fraud or multi-tenant authorization.

Traffic becomes the business-first admin entry, preserving Providers, Searches,
Data quality and Referrals audit routes. One selected period/provider/type drives
all totals, provider rows, daily bins and event pages. Show visitor/outbound/
billable/repeat counts, priced fees/unpriced evidence and immutable drilldown.
Current-month progress uses all billable types for that provider; closed months
show historical counts/recorded fees without predicting from today's tariff.
The server supplies selected/current Persian month identity. Rate editing has
ordered checkpoints, an unbounded last tier, exact nullable fees and revision
conflict recovery. Keep English/LTR, existing semantic tokens, responsive and
accessible states. No arbitrary dashboard figures or purchase-dependent metrics.

Implementation evidence must cover actual redirect navigation and failed-popup
retry, multiple browser visitors in one isolated workspace, hourly/tier/month
boundaries, concurrency/idempotence, versioned rates/unknowns, filter coherence,
server-cookie/stale-reset invariants and actual UI. Tests use explicitly owned
reviewer/test databases only; no provider billing or external payment is executed.
