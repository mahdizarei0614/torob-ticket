# Independent automatic-data source review — 2026-11-07

Historical record: source IDs and artifact-retention statements describe the
original named run. Bulky raw artifacts were later removed at the owner's request;
see ../../../../../history-rewrite.md. This is not a new test run.

Existing independent reviewer /root/external_provider_review approved the final
source. Its retry finding was fixed: fresh/reset auth and visitor cookies are
withheld until all initialization finishes. Unit create/reset and actual HTTP
begin-failure regressions cover the no-cookie failure and populated retry.

The reviewer checked the explicit history/audit allowlist, target/source lock
lifetime, internal non-authenticatable template, immutable setup/completion,
expiry key identity, migration0008/0009 child-side indexes, scoped reset timeout,
opt-out/existing-workspace preservation and revised reset copy. No remaining
source blocker. Final PG acceptance subsequently passed6owning cases; session
regressions22/4files and credential/service units17/2files passed. Earlier failed
runs are retained; the last packaged clean-Docker/browser checks are pending.
