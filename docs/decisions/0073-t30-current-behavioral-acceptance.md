# 0073 — Resume T30 against current product behavior

Date:2026-11-01. Status: implementation ruling; acceptance remains active until
the master tracker records verified completion. Specification1.42 remains the
product authority. This is a correctness/harness ruling, not new product scope.

## Current acceptance contract

The owner resumed the master tracker after decision0072. Resume the complete
T30 task rather than the superseded October26 fast checkpoint. Use native
task-by-task subagents and independent review. T31–T35 remain separate work.

The consumer uses one adult; varied parties and age-policy eligibility remain
covered through actual API searches. The profile contains identity/logout.
Referral uses recheck/idempotent confirmation and the current new-tab provider
placeholder. Saved records and local receipt/history compatibility retain
server/unit coverage without restoring removed traveler controls. Hotel dates
are always one local arrival night, with room capacity1–4 and the four agreed
sorts. Current exact-price seller cards and automatic cheapest map selection
replace obsolete single-selection buttons.

Keep every maintained case meaningful. Replace specifically superseded
assertions with traceable current behavior rather than adding skips. Use the
full twelve-row mode/scope/trip matrix, cross-feature and hostile timing cases,
and the full default Nx e2e discovery. The two existing destructive M6 cases
retain their separate disposable-stack guard for T33.

## City replacement correctness

The new native rapid-query case found an actual shared-input bug. While an old
SSE delivery was held, replacing an already selected destination emitted the
typed query, then a null selection callback. The ComboBox wrapper manufactured
an empty input callback for that null selection and erased the query. The probe
observed a stable catalog identity throughout; catalog replacement was not the
cause of this native failure.

A null selection now invalidates the selected ID without manufacturing empty
query text. The explicit clear button continues to clear both text and ID.
The real blur-before-selection unit case fails before this change and passes
after it; the original native held/duplicated SSE case also passes afterward.

A separate composer/controller regression found that an unchanged catalog
object refresh could erase an uncommitted city query. Synchronize selected text
from the selected ID and its resolved label, rather than from catalog object
identity. Real ID/label changes still synchronize. No search-controller or
server changes are needed for either correction.

## Evidence and execution boundaries

Default e2e uses the existing loopback Compose origin and one worker. Explicit
development-server and graphics-lab modes remain supported. Feature evidence
and admin peers inherit the chosen run origin/root. Tests own new isolated
namespaces; cleanup is bounded and resets only those namespaces. Capture public
DOM/screenshots before cleanup on failure. Keep traces off and redact request
credential headers without changing failure status or dropping error facts.

Optional omitted age arrays and empty arrays are equivalent only for a category
with zero members; counts and nonempty age evidence remain exact. This avoids
mistaking harmless API normalization for a price-consistency defect.

Runs on the current hot-reload Compose stack bind to observed working source,
including preserved pre-existing changes. They do not establish a packaged
release, clean startup, deployment, external provider or booking. T33 retains
the clean-stack rehearsal. Source and execution evidence live in
`docs/evidence/T30/resume-2026-11-01/`; the final behavioral matrix and tracker
must retain diagnostic failures separately from final verification.

## Focused city-menu stability

A second native regression exposed two distinct dismissal behaviors. Controlled
custom input is retained on Escape, while the selected city ID stays null until
an actual option is committed; an exact city label alone cannot start a search.
This uses the public ComboBox allowsCustomValue contract without granting
free-text city authority.

Native public-event probes then showed the page scrolling while the same input
remained focused and visible. React Aria's ancestor-scroll dismissal closed the
suggestion list. Retain that list only during the actual synchronous ancestor
scroll dispatch when its enabled input remains focused and visible within both
the viewport and clipping ancestors. Reposition through public useOverlayPosition
and public controlled ComboBox state. Escape, outside interaction, blur, selection
and offscreen/clipped anchors retain dismissal authority. No reopening timer,
private imports, fake focus or query/controller changes are allowed.

The public hook's exact existing transitive version, react-aria3.53.1, becomes a
direct declared UI dependency using the existing locked snapshot. This local
acceptance uses validated cached module links in host/web/admin after offline
manager attempts were blocked by unrelated metadata and an unsafe modules-purge
prompt. No purge, network package installation, service restart or seed ran.
A clean install/image rehearsal remains T33; the dependency receipt records the
precise local resolution boundary.

## Development public-asset correctness

The original missing-public-asset check found Vite's SPA fallback returning
HTML200. A narrow shared development post-hook examines preserved originalUrl
and returns plain404 for unserved public asset/icon namespaces. Ordinary app,
source, HMR-client and API authority are retained.

Actual transformed admin head then exposed doubled /admin/admin/ icon paths.
A pre HTML transform marks only static public icon/apple/mask/manifest links
using %BASE_URL% with Vite's supported vite-ignore attribute. Vite still handles
ordinary module and stylesheet links. Both web/admin configs receive only the
additive shared plugin import/registration; existing foreign HTML and config
changes remain preserved. Two actual HTTP+minimalbuild fixtures and ten current
Docker public-head URL/type checks pass. This is not a full packaged release or
WebSocket hot-reload claim.

## Comparison start quota distinguishes internal evidence

Decision0057's five comparison starts per rolling ten seconds accidentally
counted private date-price and referral-recheck SearchRun parents. A real
PostgreSQL regression on a uniquely owned `_test` database fails at the first
comparison after eight internal parents on the old source, then all four cases
pass after correction. Count all statuses of actual comparisons, excluding
same-session date-parent membership and the trusted private recheck kind. Keep
the exact ten-second boundary, independent namespaces and unchanged shared
two-active-job admission. Check the quota before superseding prior work; a
rejected sixth start must preserve the exact previous collecting row/events.
The four existing admission regressions also pass; their thirty unselected
integration cases were not executed by that diagnostic.

A slower standalone native calendar diagnostic did not reproduce the earlier
429. It admitted two comparisons and eleven date jobs; only three date parents
were in the final start's recent window. Preserve that non-reproduction: the
source-counter defect has deterministic database proof, while the exact branch
of the earlier native429 is not uniquely attributed.

## Recovery discovery avoids transferring completed history

Every date-price poll used to retrieve all retained date payloads before a
JavaScript kind/status filter. Read-only aggregate observation found331 rows,
about3.9MB serialized JSON and no checking rows at that observation. Recovery
now selects only identities whose persisted kind/status indicate checking date
evidence. Inside the existing session lock, re-read the current record and
parent and revalidate both latest kind and status before interruption. Preserve
live work, completed/unknown history, the parent's actual interruption timestamp,
scoped expiry handling and idempotent audit evidence.

Two real PostgreSQL regressions fail before and pass after this change. They
observe actual delivered rows from the real query, verify identity-only delivery
and exact retained history/live state, and interleave kind/terminal changes after
discovery. The two existing cancellation/storage-recovery cases also pass; their
fifteen unselected cases were not run. This proves avoided historical payload
transfer/deserialization, not absence of every PostgreSQL row scan or a proven
cause of earlier provider timeouts. No index, migration, deadline, capacity,
automatic retry or original-database cleanup was introduced.

Search persistence failure diagnostics record a fixed event and technical code,
without raw error messages, provider payloads, headers or credentials. The
existing abort/interruption/finally path remains authoritative. Normal provider
partial/interrupted evidence remains a failure of strict completion acceptance
until a later actual passing run; it is not relabeled as complete.

## Stable date identity across foreground metadata refresh

The first final unfiltered attempt ran all226 cases:220passed,4failed and2
existing M6guards skipped, with no not-run, flaky, interrupted or global errors.
All32 new acceptance cases passed. Retain that failed run as its own result.

A real foreground SessionInfo update with unchanged date identity could restart
an errored date job, bypassing the hook's one automatic retry. It also discarded
an open provisional calendar because ownership serialized the entire SessionInfo.
Two actual unit regressions fail before correction; the complete related date
folder later passes50cases/eight files. Extract the exact existing seven public
identity fields and pricing-policy marker into one pure helper; retain byte-equal
existing keys. Bind acquisition to that semantic key and a consistent latest
request/session pair, and bind calendar ownership to draft plus semantic identity.
Expiry/identity metadata alone preserves pending edits; actual scenario/mapping
revisions still revoke old work, cancel its exact late ID and discard stale edits.

A controlled native probe holds a real foreground GET until retry2 has failed
and the current generation visibly returns from checking to unavailable. The
actual GET200 retains all seven identity fields and changes expiry by215ms.
Old source makes an unwanted third date POST; corrected source stays at two,
then a deliberately dispatched public online event permits exactly one fresh
priced request. Both have zero transport POSTs. This proves the controlled
metadata path, not the exact uninstrumented order of the earlier full-run failure
or a real network reconnection. The unchanged original maintained recovery case
also passes afterward. No periodic60-second foreground GET is claimed.

## Native resize and finite motion observations

Indicator geometry requires numerical readiness after viewport changes. Initial
indicator readiness and main-map disappearance do not certify a later resize.
The maintained chart case now requires exactly five known current form choices,
one native checked owner and visible indicator each, retired controls remaining
inert, finite positive rectangles and the unchanged strict error under1CSSpixel.
Bounded public numerical polling retains first/intermediate/final samples.
The corrected native case passes; its earlier instantaneous mismatch lacks saved
geometry, so a product cause is not claimed from the later aligned samples.

The scrollbar case reproduces the old canvas at x=-15,width1440 while wrapper
and labels are x=0,width1425. It converges in three actual animation-frame
samples over24.1ms to exact matching bounds. Preserve the original0.05px
alignment checks and wait for those observable dimensions before asserting.

The flight round-trip case records20 same-itinerary first-pass return-arrival
frames across316.7ms with travel1, opacity0.000 and blur1.000 together, before
completion. Polling for one current transient attribute missed this interval.
Observe the actual ordered frame tape, retain exact projected return endpoint,
turn/return/repeated-loop facts, and save the tape before failure cleanup. This
is public DOM/timeline evidence, not numerical GPU pixel-alpha measurement.
The three native observation corrections pass together; they introduce no
product route/map changes, tolerance increases or longer motion deadlines.
Final unfiltered verification and independent source-bound review remain required.

## Full second attempt and deliberate context-loss observation

The second unfiltered226-case run completed222PASS/2FAIL/2existing M6 guarded
skips, with zero flaky/not-run/interrupted/global errors and all32 acceptance
cases passing. All1097 before/after source hashes match. Its retained failures
are the rounded referral footprint comparison and four generic link-failure
labels in the intentional context-loss case. Neither is silently accepted.

A passive lifecycle diagnostic repeats the original graphics sequence and passes:
86actual LINK_STATUS queries are true, one canvas/context loses and restores,
and composite programs/draws resume. It does not reproduce or explain the four
earlier labels. A separate controlled read of an already valid actual program
and its attached shaders returns true before loss, null during confirmed native
loss, then true for newly created restored-generation handles. The test adds no
compile/link calls, shader faults or extra context. The recorded deletion flag
describes observed deleteProgram calls, rather than independent native status.

The maintained observer now records raw status/logs, context/generation/object
identity, explicit loss intent and native lost state before/after the query.
Only null with explicit intent for that exact context and both native lost
observations is unavailable. False always fails, as does any nontrue result
while live/restored. Restore clears intent before producer handlers. This is an
API-state distinction proven by the controlled read, not an attribution of the
original four labels. All three maintained graphics cases and pixel/resource/
pause/rebuild assertions remain. The restored receipt is saved before its final
assertions so another failure retains its actual facts.

Two date retry cases now release the exact retry generation after public
checking state and retirement of the old alert, then require that request's
failure and current unavailable state before quiet-time/online checks. Their
original counts, timers and exact cells remain. Response readers bind requests
to document epoch at dispatch and join all owned reads, retaining unexpected
errors and deadlines. These are observation corrections to a genuinely failed
full run; final maintained native and unfiltered acceptance are still pending.

Owner steering also replaces missing-font heading arrows with explicit SVG;
decision0074 records that rendering change and its separate verification.


The reviewed footprint closure now measures unrounded rectangles after only
relevant finite entry ancestors settle, retaining raw pre-baseline samples and
failure-safe receipts. The1440/390/320 native cases all pass with zero settled
delta for form/explorer/wheel/button, exact132px wheel, exact scroll0/76/153,
no horizontal overflow and zero transport starts. Small entry translation was
observed before the1440/390 baselines; that does not independently establish the
cause of the old full2rounded mismatch. The strict raw<.5CSSpx budget replaces
the brittle equality of independently rounded tenths; unrelated fixed geometry
checks are unchanged. Together with date2, SVG arrows and maintained GPU policy
restoration, the seven selected native cases pass. This selected closure is not
a substitute for the currently running unfiltered full3.


## Live reduced-motion state at the draw boundary

Full3 executed226 cases:223PASS/1FAIL/2existing guardedM6SKIP, all32newacceptancePASS, zeroothererrorcategories and all1097before/afterhashesequal. OnlyGraphicsHost116 failed, frames22→33 across its fixed80/180ms. An ordinary reviewed diagnostic passes without reproducing it (18→18; native draws32→32). A separately labeled callback-delay control fails its exact-one-held-callback guard with zero queued callbacks: the planned intervention never happened. Its actual trace instead records cached host MQL.matches=true with no host change callback, committed reports29→41 and native draws54→78. This observed missed-delivery path is distinct from proof of the original full3cause.

The scheduler now optionally samples live reduced motion before each already-scheduled draw. Driver supplies its existing cached reduced.matches. Both drawing-time scene invalidation and repeat decisions use that refreshed policy. Ordinary external one-off frames still work; callers without a reader retain prior policy behavior. No timer, background polling or extra RAF owner is added. A fake-clock regression changes the live value without calling setPolicy: oldsource fails; corrected strengthened test includes scene-driven invalidation and all9graphics cases pass. Graphics types/lint pass. The unchanged whole GraphicsHost file passes10native cases, including original strict pause windows, recovery, fallback, pointer/keyboard, DPR and imperative invalidation. All1097source hashes match during that closure. Full4 unfiltered acceptance and independent final execution remain pending.


Final root run full4 executed all226 cases and passed224 with only the2existing
M6guards skipped. Zero flaky/not-run/interrupted/global errors; all32acceptance
cases pass. All1097source hashes match before/after. This is one actual
unfiltered passing run, separate from earlier failed and selected runs. Final
independent execution and scoped commits remain pending in the checkpoint.


Final independent actual5configuration/77UI/6PG checks passed, all exit0 on Node24.17.0. Actual80source paths were independently approved and committed as cfcc3a9; no source bytes changed. The exact owned_testDB is removed and all five original Docker containers remain healthy. T30 complete, master30/35; T31 next. No push/deployment.
