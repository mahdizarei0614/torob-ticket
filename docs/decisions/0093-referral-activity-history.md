# 0093 — Explicit reviewer activity history

Owner resumed the unfinished activity-history work on2026-11-07 and authorized
completion, local commits, updating main, clean-checkout Docker verification and
pushing main for reviewers. The original2026-11-04 brief remains the scope.

Configuration → Load activity history is an explicit authenticated operation for
the current reviewer workspace. Reads/bootstrap never import activity. The server
creates deterministic authored visits over the current and two previous Persian
months, six providers, shared browser visitors, transport/hotel sources, excluded
repeats, graduated sample rates and historical unknown rates. The normal empty
workspace keeps unset tariffs. These fixtures do not establish real provider
delivery, purchase, revenue or an agreed commercial price.

Prepare sources outside the write transaction, yielding between bounded chunks
so other requests can finish authentication. Import all linked source, quote,
intent, receipt, fee and provenance records atomically under the existing session
lock. A final batch marker makes retries idempotent. Existing outbound activity
or tariffs without this marker cause a typed conflict. Recheck under the write
lock; never rewrite existing records or another workspace. Preserve searches,
accepted receipts without outbound activity, and SSO installations.

Use the existing billing helpers, chronological last-billable anchors across
month boundaries, and provider/month ordinals across both referral types. Only
eligible visits advance the anchor/ordinal. Fee and tariff snapshots remain
immutable. Later real reviewer actions continue the same counters prospectively.
Intent creation cannot precede quote observation; expiry is capped at two minutes
from creation and the quote's validity.

Provider status payloads retain their strict schema; fixture provenance lives in
raw/audit metadata. Historical hotel imports have an explicit read-only kind:
the normal hotel read endpoint can show their snapshot, while active selection
and recheck still require a genuine HotelRun. Build sources using each supported
immutable fixture root, with current real-property inventory or its own legacy
room templates. Intentionally unresolved source aliases remain rejected; choose
another deterministic eligible authored record/route. Do not invent mappings,
migrate or relabel legacy provenance. Verify the full plan for every fixture root.

Resolve exact source provider-run/raw/offer IDs before reading referral and search
evidence. This avoids correlated source scans timing out after a large import,
while retaining session scoping, exact counts and bounded detail pages. Check the
raw, normalization and quote tabs on a full imported dataset in the packaged UI.

Admin locks duplicate actions, retains the configuration/error on conflict, and
refreshes the overview only after success. Verification must cover source reads,
fee aggregates, concurrent imports/tariffs, rollback/retry, preservation, later
outbound actions and actual fresh-reviewer packaged UI. The reviewer release is
tested from committed clean source and fresh isolated data; retain the owner's
existing services/data and unrelated working changes.
