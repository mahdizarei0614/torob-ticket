# 0094 — Populated Docker reviewer workspaces

Owner instruction, 2026-11-07: the data must also be present for reviewers after
`docker:up`, with all preparation on main. This supersedes decision0093's
explicit-only bootstrap rule for the gated local Docker reviewer runtime.
Manual import remains authenticated, scoped, atomic and idempotent.

Compose defaults `TOROBTICKET_REVIEWER_ACTIVITY=true`. It additionally requires
`TOROBTICKET_LOCAL_REVIEW=true` and the existing HTTP-loopback origin checks.
Opt-out and nonloopback environments do not create automatic history. Existing
workspaces are unchanged; an owned pending initialization may retry. Failures
remain failures rather than silently completing with an empty reviewer view.

Prepare an internal, non-authenticatable template before API startup completes.
Its identity includes both history format versions, fixture/catalog/mapping
revisions and the current Tehran date/Persian month. Templates expire after48h;
a new date uses a new template. No browser credential or enrollment exposes it.

New workspaces receive independent PostgreSQL copies through explicit history
table/column and audit-kind allowlists. Never copy credentials, identities, SSO
clients, provider overrides, saved searches or internal housekeeping. Serialize
the destination and hold a compatible shared source lock for the entire atomic
copy, preventing expiry collection from deleting a source mid-copy. The imported
history marker commits with the copy. Separate append-only setup/completion
records allow retries without rewriting audit evidence. Publish fresh/reset auth
and visitor cookies only after all workspace initializers complete. A failed
initialization may leave an unreachable scope for normal expiry collection; it
must not issue a resumable empty workspace. Refuse intervening
outbound activity or configured pricing without replacing either.

Fresh browser workspaces and admin reset receive populated copies. Bound a full
reset with a25s SQL deadline and30s transaction timeout, as with collection;
ordinary mutations keep their existing defaults. Migrations0008–0009 add missing
child-side quote/intent/receipt/search-predecessor lineage indexes: the measured multi-reviewer
expiry cascade otherwise exceeded its25s SQL deadline. Test actual concurrent copies,
private pricing, interruption/rollback/retry, origin/opt-out gates, preservation,
reset and collection during a source lock. The clean packaged browser check must
observe populated traffic before any manual import request, three months, source
drilldowns and a separate independently enrolled reviewer.

The records/rates remain authored local fixtures, not external visits, purchases,
revenue, invoices or contracted rates. Existing SSO consent, identity disclosure,
acquisition evidence and pending external attribution remain authoritative.


Provider health must remain usable after several full reviewer clones. Resolve
public comparison membership once, read scoped provider metadata once, then
calculate exact status counts and retain the first50rows per provider in the
existing database timestamp/ID order. Read detail payloads only for those bounded
IDs. This avoids repeated snapshot-JSON joins whose measured packaged plan took
50.9s and failed the5s transaction deadline. Date inventory/private rechecks stay
excluded; source timestamps remain unknown when no actual event was recorded.
Verify this on full concurrent copies and in the clean packaged Providers UI.
