# Referral history and reviewer startup — 2026-11-07

Historical record: source IDs and artifact-retention statements describe the
original named run. Bulky raw artifacts were later removed at the owner's request;
see ../../../history-rewrite.md. This is not a new test run.

Owner authorized completing history, preparing main, clean Docker acceptance and
pushing main. Later steering requires the data on reviewers' ordinary docker:up.
Decisions0093–0094 record manual import and gated automatic private copies.

## Behavior

Default Docker startup prepares a sealed daily history template before the API
becomes ready. Each new reviewer gets independent activity, tariffs and SSO
installation. Three Persian months contain 7,908 authored outbound records, six
providers, repeats, graduated example rates and historical unpriced fees. Reads
remain read-only; existing workspaces keep their data. Explicit repeat imports
are idempotent. Opt-out: TOROBTICKET_REVIEWER_ACTIVITY=false with a fresh browser.

Source/quote/receipt lineage is persisted and inspectable. These are authored
local fixtures, not observed external visits, purchases, revenue or agreed rates.
SSO phone/passport/Latin-name consent and acquisition evidence remain separate.
An external provider's account status does not prove a billing exemption.

## Source acceptance

- 6 owning automatic-data PostgreSQL cases; 22 session regressions/4files;
  17 service/credential units/2 files; 16 uncached Nx tasks passed.
- Provider-health scale correction passed 13 PostgreSQL cases/2 files (six owning
  plus seven existing search-inspection cases),8repository units, API types and
  scoped lint. The13overlap the earlier six and are not an extra19unique cases.
- Earlier import acceptance: 57 PostgreSQL cases/6 files; 16 post-import drilldown
  cases/3files overlap that batch. Source regressions and 18 static tasks are
  retained in resume-20261107/source-checks.json, without double-counting.
- Independent source reviews approved import, automatic setup and health fix.

Source checkpoints: 6ed721b5(import),35358ae7(source inspection),a070c68d(automatic
reviewer history),9e5eca17(readiness assertion),f1f207ef(full-history provider health).

## Clean packaged acceptance

Final runtime is built from committed clean main f1f207ef with fresh volumes under
an explicitly isolated Compose project. No `.env`, host `node_modules`, manual seed,
provider credentials, API key or admin installation is supplied. Ordinary
`pnpm docker:up` uses default 4300/4301/4310 ports. Pre-browser and full browser
acceptance receipts are under resume-20261107/automatic. The clean stack had one
sealed template, zero public reviewers, 7,908 outbound records and six tariffs
before the first browser opened.

Final application acceptance has six unique Chrome journeys across two runs:
`browser-release-001` passed five SSO journeys (reference acquisition, separate
provider new/existing/logout/denial, international passport/Latin-name new and
existing accounts, domestic-profile completion for international travel, automatic
reviewer installation/isolation). Its one activity failure was a test assertion
against a closed history disclosure. `browser-history-release-002` passed the
corrected activity journey in 17.513s: automatic populated first view before any
manual population POST, all months/tiers/charts/filters, raw/normalization/quote
source tabs, provider history, unchanged SSO, idempotence and a populated peer with
its own SSO client. This is six accepted unique cases, not a single six-pass run.

After multiple reviewer copies, two real provider-health reads returned HTTP200
in 2.576s and 2.669s, with six providers and 5,558 actual provider runs. The earlier
failing query took 50.922s/49.971s. Final E2E types and scoped lint passed. Final
independent source/evidence/visual review approved; see
resume-20261107/automatic/final-evidence-review.md.

The earlier first clean application build and five SSO journeys passed; retained
activity failures found an early bootstrap assertion, numbered navigation names
and an actual provider-health query timeout. The final source avoids repeated
snapshot joins and reads bounded details. Failed observations are retained.

## Reset incident

An unguarded command after a failed assertion deleted the original local
TorobTicket database/provider volumes. This was disclosed. Read-only recovery
investigation found no trustworthy restore path; no data was recovered. The
owner explicitly authorized rebuilding fresh data, finishing checks and pushing
main. A protected private forensic disk copy is retained outside Git/Docker
contexts. Later lifecycle operations validate exact project/volume ownership and
execute fail-closed. Do not describe the original data as preserved or restored.

Unrelated master-plan hunks, untracked media, other projects and private local
configuration remain outside this release change.
