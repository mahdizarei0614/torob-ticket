# T33 fresh startup and lifecycle rehearsal

Historical record: source IDs and artifact-retention statements describe the
original named run. Bulky raw artifacts were later removed at the owner's request;
see ../../history-rewrite.md. This is not a new test run.

Status: both canonical and corrected current-product clean-checkout
`pnpm docker:up` rehearsals passed. Canonical packaged HTTP readiness, consumer
and admin shells/assets, a priced comparison and fixture-version inspection also
passed. Intentional initializer failure, correction on the same owned volume,
and direct Compose restoration without host Node/pnpm also passed. The cold
offline core walkthrough, two-reviewer reset isolation and normal published-port
lifecycle recovery passed as individual browser cases. The final current-product
candidate also started cleanly after the reviewed QA/report corrections. Latest
canonical9d0769b9 and private current6d4802d1 both passed fresh plain startup;
the latest canonical HTTP smoke passed too. Final selected quality003 passed
all six selected gates; optional PostgreSQL was explicitly skipped. The approved
source is committed with the exact canonical built tree, owned rehearsal
resources are removed, the original stack/data are verified unchanged and the
tracker/export are synchronized. Earlier failed and superseded runs are retained
below.
The results below are read from root's actual retained command receipts; this
document's author did not rerun Docker or a browser.

The intended candidate is a separately owned Compose project, disposable named
database volume and nondefault loopback port. Root records both the canonical
committed checkout and the transparent current-worktree candidate. A clean
candidate snapshot must not be described as canonical-HEAD-only evidence when
it includes preserved prior working changes. Dependencies and compilation occur
inside Docker; host Node/pnpm availability is a separate startup path from the
documented direct Docker Compose command.

## Latest verified source, startup and image binding

The latest source manifest binds nine task-owned
source files to canonical task candidate
`9d0769b9db9712056453e9a0eec10f0c86548eb4` (tree
`259f85a2c0650953c7a1e63592da6eefbf144606`) and private current-product candidate
`6d4802d145abbe639555cd5b3678bb3cab369e7f` (tree
`f67a503582194ee2a1e503c0827d88429f5ce1d3`). These were clean task snapshots at
execution. The approved nine-file canonical source projection is now committed
as62b39ad0 with exactly the built canonical tree, as recorded below. The private
snapshot continues to enumerate preserved foreign product overlays separately;
those overlays are not claimed as part of that canonical source commit.

Both latest plain `pnpm docker:up` commands actually passed from fresh scoped
volumes/network/loopback ports, with clean source and no host `.env` or
`node_modules` before or afterward. Canonical4333 exited0 in37,618ms; private
current4334 exited0 in36,704ms. Both actual health responses were HTTP200 with
ready status/database/migrations/seed. Actual inspections found healthy
API/database/gateway and a successful exited initializer. See
canonical prestart002,
canonical actual002,
current prestart004 and
current actual004, with their matching logs.
Docker caches/mirrors were allowed; these are fresh source/data passes, not
cold-cache or offline builds.

The latest canonical HTTP/API/database smoke002,
captured2026-11-02T04:40:59.386Z, passed against9d0769b9. It served both real
packaged language-specific frontend shells and their local scripts, returned
all-ready health, completed search `8b62c386-68fa-4ef8-97f7-bca6bac293cf` with12
priced groups/48eligible quotes, read all four foundation/showcase fixture
versions, and reset only its newly owned reviewer. Earlier smoke001 remains a
real observation of9244daa, not the latest canonical source.

The latest current API image remains
`sha256:088b9eb213e37839cd084a5b74feec51b50dad53ac2d8d062c4bde9a9e9e4a86`
and gateway remains
`sha256:b7740a40241f3030ed3754134f4ce0bc5b3bad6672977d9ef11bb2a1c8b322b6`.
Those IDs are exactly identical to the actual earlier offline-core and normal-
network lifecycle runtimes; the corrected F8 host rehearsal source is unchanged.
The latest initializer is
`sha256:00177d50c4e5cec3274c37ed386edea78d851e4336bdedd0409a4866fa0fb281`
and is covered by its own successful current004 startup, not relabeled old
offline execution. The latest canonical initializer likewise has its own
successful002 image `sha256:50a4358369611dde3d1a282e46472ea6487685c84dfa9f79d61c4e9d43aaa0fd`.
Historical3d9/617/runtime and initializer identities below remain historical.

## First confirmed canonical clean startup (history)

On 2026-11-02 root ran the unchanged public command `pnpm docker:up` from
`/private/tmp/torob-ticket-t33-head-20261102`, a clean committed checkout at
`9244daa15059f5f5797bc1aa5f983ea4a6a6f5fc` (tree
`234911fd3fbe94f054509400295236a64689d2a6`). The owned project was
`torobticket-t33-head-20261102`, with loopback gateway
`http://127.0.0.1:4333`; the default application at4300 was not selected.
The source contains canonical baseline264a18ab plus the recorded narrow T33
changes. It does not include the separately enumerated current-worktree overlays.

The prestart receipt records no host `node_modules` or `.env`, and an absent
project database volume. The clean-checkout audit additionally records absent
generated Prisma, host caches and media output. The command exited0 in
117,114ms without timing out; host `node_modules` remained absent and the
checkout remained clean. This proves no host dependency installation was needed
for that startup. Host Node/pnpm were available to invoke the wrapper, so that
command alone does not establish the separately recorded Docker-only path.

The retained command log shows Docker building the API, consumer/admin gateway
and initializer; Nx completed three projects and eight dependency tasks, with
0/11 Nx cache hits. Compose created the owned network and empty database volume,
observed the database healthy, ran the initializer to exit, then observed API
and gateway healthy. It reported Web `http://localhost:4333/` and Admin
`http://localhost:4333/admin/`. These are actual build/start and Compose health
observations; direct HTTP checks and browser rendering have their own separate
receipts below.

| Built output | Image ID reported by this build log |
| --- | --- |
| Initializer | `sha256:545eaae1c4fc301797664462d706a6e1712276caf794c735581f6889496428f4` |
| API | `sha256:f24a1db3cd43dd22d6582865f426dbb380f334c4ac590b6728367fab77c04b8b` |
| Gateway | `sha256:a7529906d3fc404a4f00ec8025561ed8f7740a816b31b3710c89d07e7398d122` |

Build inputs included pinned Node24.17.0 and Caddy2.11.7 digest references. The
explicit npm mirror was `https://registry.npmmirror.com`; the Prisma engine
mirror was `https://npmmirror.com/mirrors/prisma`. Existing image/dependency
cache was allowed. Fresh source and a new database volume do not imply a cold
Docker cache, a no-network build or runtime external-network independence.

Receipts: prestart,
clean-checkout audit,
source and overlay manifest,
command result and
full build/start log.

The initial canonical command is also retained: source264a18ab, absent host
dependencies, exit1 after1,405ms, `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN` before Docker.
The reviewed workspace exception lets the Node-builtins Docker wrapper start
without host dependencies while the explicit release runner enforces strict
dependency checking for its verification children. The successful9244daa
receipt follows that fix; the earlier failure is not erased or described as an
application compilation failure. See
initial command result,
initial output and
independent source ruling.

## First confirmed canonical packaged HTTP and priced comparison (history)

Root's matching actual smoke receipt, captured
at2026-11-02T03:39:55.925Z, passed against canonical9244daa on4333. The real
`/api/health/ready` returned ready status/database/migrations/seed. Consumer `/`
and English admin `/admin/` returned the built language-specific shells without
the Vite development client; all four referenced local script responses were
nonempty and their hashes were retained. Actual container image inspection
matched the canonical initializer/API/gateway image IDs listed above.

A fresh owned reviewer with seed3330, normal scenario and fixture anchor
2026-10-29T06:00:00Z completed the actual Tehran→Mashhad domestic one-way economy
search for2026-11-02. Search `da52fb96-c7ef-4164-8307-1649532d351a` contains12
journey groups and48 eligible quotes, with actual quote IDs, versions, prices,
provenance and unknown conditions retained in the receipt. The database query
recorded `foundation-v1`, `showcase-v1`, `showcase-v2` and `showcase-v3` with their
catalog revisions. The reviewer was reset using only its fresh owned cookie jar.
This is real packaged HTTP/API/database smoke, not browser rendering, live
providers or offline proof. The earlier sandbox-limited partial smoke receipt
is retained separately in
canonical-smoke-sandbox-denied.json
and does not contain a passing result.

## Retained first current-candidate failure

The first clean private snapshot of the current product,
`08937e78e52cf8fa7ed265717d5b428edc7dcff3` (tree
`26d56350ee3b0bcd69474aa36be3c8e2de380514`), did not pass its packaged build.
The actual `pnpm docker:up` attempt for owned candidate4334 exited1 in50,637ms,
without timing out. Its log reports `Stale brand exports:
libs/ui/src/styles/tokens.css; run pnpm brand:generate` from the current
candidate's `brand:verify` build prerequisite. This is a stale source-input
fingerprint in the preserved branding overlay, not a successful runtime, an
offline result or proof that the unchanged canonical build failed.

The checkout remained clean with no host dependencies or `.env`. The corrected
candidate below separately records regenerated metadata and a real retry; it
does not overwrite or relabel this first failure. See
actual result,
actual build log and the
original source manifest.

## Confirmed corrected current-product startup

The corrected private candidate is
`3d9e4a46a3576c8eebffe2c7a35d7bcb166efc52` (tree
`7b9ce991e6887be696d8480d9c6cd0d56b94a5c5`). Actual Chrome generation and branding
verification both exited0; every listed visual export remained byte-identical,
with no added/removed asset or master-style change. Only the branding manifest's
stale tokens input fingerprint and actual exporter browser-version metadata
changed. The receipt hash changed from
`435c1ce72b4d3a95d6af9b7ae87c9ce0704c2d940644047f913800b37acccff3` to
`9827d9958f2430c1962659e5707398b48fe6ab8fdcb3761b104d7f8607eeb9d8`;
the recorded tokens.css hash remained
`fbc917247a465034a6e6984a7ed8e62ea36243f40afe17a903c78f27658cb59a`.
See actual generation/verification receipt
and the second source manifest.

Root's actual second plain `pnpm docker:up` exited0 in58,187ms without timing out.
The clean private checkout began without host dependencies or `.env`, and with
the scoped volume/network/loopback4334 absent; it remained clean with host setup
still absent afterward. The selected project was
`torobticket-t33-candidate-20261102`, owner
`t33-12e70a34-d1ca-4f00-a869-911e10528c52`, on `http://127.0.0.1:4334`.
The real gateway readiness response was HTTP200 with ready
status/database/migrations/seed. Actual four-container inspection showed a
successful exited initializer and healthy API/database/gateway.

| Current candidate service | Actual inspected image ID |
| --- | --- |
| Initializer | `sha256:0ec871ae318c16514c4dbad0c7a186e2a62dc4d587c1fd28b78a0a7857ff2a10` |
| API | `sha256:088b9eb213e37839cd084a5b74feec51b50dad53ac2d8d062c4bde9a9e9e4a86` |
| Gateway | `sha256:b7740a40241f3030ed3754134f4ce0bc5b3bad6672977d9ef11bb2a1c8b322b6` |
| PostgreSQL | `sha256:8942ba4a60918c2b98bcad5c842453a765898854a9fec87f64ec816bf44559be` |

Receipts: prestart ownership/Compose fingerprint,
second command/HTTP/container result and
actual second build/start log. These are the
audited current-worktree snapshot's results, not canonical integration. Mirrors
and Docker cache were allowed; no cold-cache or no-network build is claimed.

## QA binding and third current-product startup (superseded by latest receipts)

The actual first browser rehearsal exposed a QA locator error: the calendar's
visible text is “تقویم و تاریخ” but its accessible name is “تقویم جلالی و انتخاب
تاریخ”. The new test alone was corrected to the actual accessible label already
used by existing browser coverage. No application runtime source or outage
assertion was changed. The archived
second source manifest retains the earlier
identities; the third source manifest binds
the corrected test SHA256
`f8badb99c0e730dfc4323697913862bb34eb2b8df1cfb99a6b1efd8591c004ca` to
canonical `593fec4626b5ddd9c243b099241534c8a4b8ecc2` (tree
`f7264313b5931b0a3350e56584266ac39fb3ba5b`) and private current candidate
`617af6585787ed25841473259108b3d41c121096` (tree
`a74787cd418f4f1218908e7ec7d76728577e9d74`). Earlier canonical startup/HTTP
receipts remain observations of9244daa, not renamed observations of593fec.

Root's actual third current-product `pnpm docker:up` exited0 in37,766ms after
the prestart guard found no scoped volume/network/published4334 port. Source
was clean, host dependencies and `.env` were absent before and afterward, and
the actual HTTP200 health body reported ready status/database/migrations/seed.
The four owned containers were inspected. API and gateway IDs were byte-for-byte
the same image IDs as the earlier isolated3d9e4a46 build; PostgreSQL also matched.
The initializer image changed to
`sha256:9ca385c3e402a954d4bac9d08f35a756b10d7ccee6bffa3317a66c454f4fe480`
and actually exited0. See third prestart receipt,
third actual result and
third log.

This provides a precise join to the cold core browser result: that browser ran
the corrected host test against runtime checkout3d9e4a46, and the later617af658
API/gateway images are identical to those it exercised. It does not pretend the
earlier browser ran from the later checkout or certify the later initializer
through the earlier offline run. Its distinct real startup is recorded above.

## Actual cold core and reset isolation browser evidence

The cold-core summary records
one actual single-attempt Chromium case passed in12,176ms, with no retries,
skips, flakes or global errors. Its explicit input receipt
identifies runtime3d9e4a46/tree7b9ce991 and the corrected host-test hash. All four
owned containers remained on an actual internal-only network; backend/gateway
external DNS/direct-IP probes failed, and the cold browser separately aborted
both the external hotel-map style request and placeholder navigation. The local
round-trip/date/calendar/hotel/room/coordinate/referral/admin walkthrough
passed. Exact network, image and interaction limits are recorded in
[offline-runtime.md](offline-runtime.md).

The reset case independently passed in4,959ms within the otherwise failed
lifecycle-003 summary.
Its actual scoped reset evidence
confirms only newly owned reviewer A was reset, guessed cross-reviewer resources
returned404, and reviewer B's exact search/hotel/receipt and control authority
were structurally unchanged. Only inactivity expiry is excluded from control
comparison. The full three-case run failed; this individual success does not
turn that run into a pass.

Retained failures distinguish coverage from harness limits. The old calendar
locator prevented the first cold case from reaching the remaining walkthrough;
it passed only after correction. The first lifecycle outage case actually
stopped the API but observed connection state `live` through the evidence-only
raw TCP bridge, so it failed without weakening the assertion. The later normal
published-port result is recorded below. Whether the bridge's FIN handling
caused the earlier behavior remains a hypothesis, not an isolated root-cause
finding. The
quality-001 report also failed its first health
gate by timeout; its source-quality and browser gates were `not_run`, and its
unselected PostgreSQL gate was skipped. It is a retained failed preflight,
not quality, source or browser acceptance evidence.

The next quality002 report reached real source
verification but failed: Nx recorded48tasks,47successful and one failed
`web:test`; the detail run recorded two failed calendar-related unit tests.
Tool-contract and browser-critical gates were `not_run`, PostgreSQL was not
selected, and stale “Not reached.” reason strings remained even on passed
earlier gates. This report is retained as failed. Four independently reviewed
QA/report fixes corrected the unit expectations, requested static Nx output and
cleared misleading passed-gate reasons; they did not alter product runtime.
The focused result records18UI tests and19
runner contracts passed, plus scoped lint of all four corrected files. The
initial focused failure is also retained. These focused checks and latest fresh
boots are not a full quality pass. The separate actual quality003 result is
recorded below; these earlier failures remain retained.

## Confirmed final selected quality profile

The actual quality003 report passed from
2026-11-02T04:41:57.319Z through04:45:04.376Z against ordinary loopback4334,
using Node24.17.0 and Chrome. All six selected gates passed, with clean child
completion and bounded sanitized logs:

| Selected gate | Actual result |
| --- | --- |
| Health | Real live/ready HTTP checks passed |
| Packaged assets | Both built language-specific frontends, local scripts and checked-in font/theme/geography hashes passed |
| Strict dependencies | `pnpm --config.verify-deps-before-run=error exec node --version` exited0 |
| Source quality | `pnpm --config.verify-deps-before-run=error verify --parallel=1 --output-style=static` exited0;48uncached lint/typecheck/test/build tasks in94,743ms |
| Tool contracts | Recorded `node --test --test-concurrency=1` six-file tool suite exited0;60of60passed in19,713ms |
| Critical browser journeys | Recorded actual Playwright command exited0;7of7Chrome cases in72,107ms, each exactly one successful attempt |

The source log records skipped Nx cache
and successful lint/typecheck/test/build targets. The
tool log records60tests with zero
failures, skips or cancellation. The
actual browser summary
records7passed, zero failed/flaky/skipped/not-run/interrupted, no retries or
global errors, and `discoveryOnly:false`. Its exact selected scope is three
current accessibility/keyboard journeys, two immutable receipt-refresh
journeys, and both release-core cases. It does not include the lifecycle tag;
the independent normal-network lifecycle pass above covers that scope. Complete
actual child arguments, logs and durations are retained in the report.

The optional PostgreSQL gate is explicitly `skipped`: it was not selected and
no test database was created or reset. Prior PostgreSQL evidence elsewhere is
not silently treated as a new execution here. The report deliberately retains
`completeReleaseProof:false`, excludes Docker provisioning/lifecycle and
physical-device/speech/full visual-performance coverage, and labels its scope
as partial verification. Its source provenance truthfully reports the main
working tree at264a18ab with31tracked changes and1050untracked entries; this is
not claimed as a clean checkout. Separate immutable source manifests and actual
clean startup receipts above provide those distinct source/runtime bindings.

This is a passed selected quality profile, not full release certification. The
existing [T31 accessibility limitations](accessibility.md), including the
owner-skipped VoiceOver check, are unchanged. Final source integration,
default-stack/data preservation, owned-resource cleanup and tracker receipts
are recorded in the closure section below.

## Confirmed normal published-port lifecycle and persistence

The actual normal lifecycle coordinator report
passed from 2026-11-02T04:25:22.542Z through 04:26:10.782Z. The real
ordinary published-loopback gateway was 4334 with inspected `Internal:false`
before and after; no raw TCP bridge was used. The runtime commit/tree are final
617af658/a74787cd and the host test hash is the corrected f8badb99, bound in the
current canonical 593fec source manifest. The
browser execution summary
records exactly one lifecycle case passed in 44,601 ms with no failed, flaky,
skipped, not-run or interrupted case, no retries and no global errors.

All four actual owned operations completed successfully and in order:
`api-stop`, `api-start`, `stack-down`, `stack-up-no-build`. The first operation
issued a real SIGKILL to the freshly validated owned API while its actual search
was collecting. The browser independently observed HTTP 502 during that outage,
and its unchanged 5-second assertion observed a non-live recovery connection
state while the same form/search remained visible. API restoration produced
ready status/database/migrations/seed, and the old search became durable
`interrupted`, not a resumed in-memory job.

The traveler UI then created a fresh comparison. Separately, the real explicit
retry endpoint and actual admin Replay UI created new complete search IDs with
the interrupted predecessor. The old interrupted evidence remained structurally
equal. Full owned stack down/up recreated the network/containers without build,
pull or data deletion, retaining volume
`torobticket-t33-candidate-20261102_database`, CreatedAt 2026-11-02T04:24:30Z.
Ready health returned, and exact equality assertions passed for the complete
search/quotes, hotel snapshot, confirmed referral, interrupted search, explicit
retry and admin replay. The browser reloaded the real persisted admin evidence.

The actual lifecycle artifact
retains completed search `c21fbc8c-0abb-4f49-90fb-0f3c2512a040`, interrupted
search `e658e589-c81c-4f68-9fe5-e30affb0c760`, explicit retry
`37e79db7-1510-455b-a029-9f08b6e0114d`, admin replay
`6f7a6643-20ae-43de-bdc9-fe088275ef86`, hotel snapshot and exact receipt payloads.
The actual post-restart admin screenshot
supports the rendered local inspection. Observed stack downtime recorded no
HTTP response (status 0). These are real normal-network lifecycle observations,
separate from internal-network cold-core proof and the selected quality profile.

## Confirmed initializer failure, recovery and Docker-only restoration

The actual failure-and-Docker-only receipt,
captured at 2026-11-02T03:47:03.844Z, is scoped to separate project
`torobticket-t33-badinit-20261102` on `http://127.0.0.1:4335`, with the same
explicit T33 owner and a fresh scoped volume. It binds clean private source
3d9e4a46/tree7b9ce991 and the exact current initializer/API/gateway image IDs
listed above. No image was rebuilt during these image-reuse rehearsals.

The actual incorrect initializer database password caused Prisma P1000
authentication failure. `pnpm docker:up` exited1 after5,907ms; the database was
healthy, initializer exited1, and dependent API/gateway remained `created`,
not running. The readiness request had no HTTP response (recorded status0).
The real wrapper printed the failed initialization, scoped inspection/log
commands and corrective rerun guidance. Its retained
failure diagnostics are sanitized, bounded
command output, not a fabricated failure or exposed credential dump.

Removing only the fault and rerunning the same command exited0 after14,586ms.
The same owned database volume was retained, and actual gateway HTTP200 returned
ready status/database/migrations/seed. See
corrected command log. This verifies
genuine dependent-service readiness gating and correction without a data reset.

The helper then ran the actual direct command
`docker compose up -d --no-build --pull never --wait --wait-timeout 60` after an
ordinary scoped down without volume deletion. The exact child PATH was
`/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin`;
a real availability probe under that same PATH confirmed host Node and pnpm
were unavailable and resolved Docker to
`/Applications/Docker.app/Contents/Resources/bin/docker`. Restoration exited0
after14,270ms and all four containers were recreated on the retained volume,
with actual ready HTTP200. See down log and
Docker-only up log.

This is a successful Docker-only startup from previously built exact images,
not a cold build. It used the separate ordinary network on4335 with no ingress
relay. It does not establish external-network independence, browser behavior
or persistence of completed immutable comparison/referral evidence; those are
separate remaining gates.

## Actual lifecycle protocol

`@release-lifecycle` executes only with an explicit owned `torobticket-t33-*`
project, nondefault gateway origin, unique coordination nonce and an existing
coordination directory inside the selected evidence root. Ordinary unfiltered
runs without a coordinator may skip it truthfully; explicitly selecting the
release lifecycle without configuration fails before any namespace is created.
No browser test runs shell commands, chooses arbitrary Docker arguments or
mutates the default stack.

The root-owned coordinator must already be polling before the test starts.
Requests are atomic `request-<UUID>.json` files containing protocol
`torobticket-t33-lifecycle-v1`, nonce, requestId, project, origin, action, sequence,
requestedAt and public evidence facts. Allowed actions are exactly:

1. `api-stop`: stop the owned API promptly after an actual collecting response.
2. `api-start`: start that same project's API without rebuilding/resetting data.
3. `stack-down`: stop only the selected project, retaining its database volume.
4. `stack-up-no-build`: restore only that project with its retained volume and
   already-built images, waiting for real initialization/readiness.

The coordinator validates actual Compose/container ownership and writes atomic
`ack-<UUID>.json` only after its real operation finishes. The acknowledgment
repeats protocol/nonce/requestId/project/origin/action, with completed/failed
status, exitCode and completedAt; a public command-log path/container IDs may be
included. The browser rejects stale/mismatched acknowledgments and independently
observes genuine gateway/API downtime and subsequent ready status. The normal
whole-search deadline is5seconds, so a slow manual response is not a reliable
way to interrupt collection; root must automate prompt coordination.

The case preserves a completed round-trip search, exact quote evidence, hotel
snapshot and immutable confirmed receipt in one fresh namespace while another
owned namespace is interrupted. It observes `interrupted`, retains the travel
form, and exercises the traveler's explicit new comparison. That action is
distinct from the linked API retry and the actual admin replay UI, both of which
must create a new ID with the interrupted predecessor. The old interrupted
record remains immutable. Full stack down/up then preserves completed, retried,
replayed, hotel and referral evidence in the same cookie jars/owned volume.

A separate `@release-core` case creates two independent reviewers, changes only
one provider configuration, confirms scoped evidence and resets only reviewer A.
Reviewer B's exact search/hotel/referral/config must remain unchanged; guessed
cross-session IDs stay unavailable. Fixture cleanup resets only newly created
namespaces, not the user's default reviewer.

## Actual receipt

| Gate | Result |
| --- | --- |
| Canonical committed task checkout build/start | Latest9d0769b9 passed37,618ms; clean/nohostsetup/freshdata; earlier9244daa history retained |
| Transparent candidate snapshot/build/start | Latest6d4802d1 passed36,704ms; clean/nohostsetup/freshdata; earlier617/3d9 and089 failure retained |
| Direct Compose path without host Node/pnpm | Passed on separate4335; actual no-Node/pnpm PATH, exact prebuilt images, retained volume, HTTP200 |
| Canonical command duration and advertised URLs | Latest37,618ms; Web4333/Admin4333; earlier117,114ms history retained |
| Canonical packaged HTTP/API/database smoke | Latestsmoke002 passed on9d0769b9: health/two shells/local scripts/12groups/48quotes/4fixture versions/owned reset |
| Candidate HTTP readiness and actual container images | Passed HTTP200 all-ready and four owned containers; exact IDs above |
| Cold offline core browser walkthrough | Passed1/1,12,176ms; oldruntime3d9 + corrected hosttest, exact finalAPI/gateway image join above |
| Intentional initializer failure and recovery | Passed: real P1000, exit1/API+gateway gated; corrected exit0/HTTP200 on same volume |
| Real interrupted API collection and explicit recovery | Passed normal lifecycle1/1,44,601ms; HTTP502 and unchanged5second non-live-state assertion |
| Retry/admin replay predecessor lineage | Passed actual API retry and admin Replay new IDs linked to interrupted predecessor |
| Full restart with completed immutable evidence preserved | Passed exact complete/hotel/referral/interrupted/retry/replay equality after real same-volume recreation |
| Two-reviewer reset/isolation | Individual case passed4,959ms; exact peer evidence and404 boundaries retained in failedlifecycle-003 run |
| Selected release quality profile | Finalquality003 passed six selected gates;48uncached source tasks/60tool contracts/7single-attempt Chrome cases; optional PostgreSQL skipped |
| Original default stack/data preservation | Passed post-cleanup: all six container identities/images/states/start times unchanged; all five immutable table counts/SHA256 match; default4300 ready HTTP200 |
| Owned cleanup/shutdown | Passed only three owner-labeled projects/volumes/networks and two exact clean worktrees removed; images/cache/private refs retained |

## Actual source integration, preservation and scoped closure

The source commit receipt records main source commit
`62b39ad0a6006a3a6e24e39f33997ec5b07a449b`, tree
`259f85a2c0650953c7a1e63592da6eefbf144606`: an exact tree match to the actually
built canonical9d0769b9 candidate. Only the nine approved source paths were
committed; the index was empty afterward. The separately enumerated private
product overlays are not silently folded into that claim.

The actual owned cleanup receipt, captured at
2026-11-02T04:57:43.268Z, records successful guarded removal of exactly the
head/candidate/badinit T33 projects, each project's disposable named data volume
and network, and the two task-created clean worktrees at their expected exact
commits. It verifies those containers/volumes/networks absent afterward. Private
candidate refs, image/dependency cache and built images were retained. No global
prune, remove-orphans or original torobticket project mutation occurred.

After cleanup, actual original-stack preservation
at2026-11-02T04:59:43.108Z confirms all six original container IDs, image IDs,
states and start times exactly match baseline. Default4300 returned ready
HTTP200 with ready database/migrations/seed. The complete immutable-table
count/SHA256 pairs match baseline for FixtureVersion4, Place316, Hotel1246,
RoomRate3738 and three Prisma migrations. The original reviewer's mutable data
was neither inspected nor reset; this is not a claim that the owner made no
concurrent UI changes.

The first preservation observer used an insufficient16MiB output buffer and
hashed truncated RoomRate output. Its retained diagnostic note
and complete re-observation
record that the table emits32,246,011bytes; the corrected bounded128MiB read,
with subprocess error/signal checks, returned all3738rows and the exact original
SHA256. No write occurred. The final post-cleanup full-table comparison above
passed; the earlier observer error is not presented as a data change.

The tracker synchronization receipt records the
working master and exported master with identical SHA256,33of35tasks complete,
M7 COMPLETE and T34 next. The foreign master body was preserved; its canonical
projection excludes unrelated prior working changes. Documentation staging and
independent review remain a separate root-controlled step; this section records
the actual source, runtime, preservation, cleanup and tracker outcomes only.

Ordinary shutdown retains the selected project's data. Explicit destructive reset
is a separate command; verification must never invoke it automatically. Cleanup
may remove only the newly owned rehearsal resources after their labels, project
and volume ownership have been verified. Existing databases, unrelated images,
Docker build cache and the user's running application remain outside that scope.
