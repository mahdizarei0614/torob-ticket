# AI-assisted development log

This is an evidence-based account of how AI helped build TorobTicket. It is not
an invented transcript or a runtime-AI feature. The owner supplied the product
ambition, constraints and repeated interface feedback; AI coding assistants
helped research, propose alternatives, implement, inspect and verify the work.

The brief descriptions below are **summaries of documented work**, not verbatim
prompts. Exact model versions, token totals, cost, hours saved, user-study
participants and commercial outcomes are not asserted.

## Work and observable evidence

| Work brief, summarized | AI contribution and human decision | Inspectable result |
| --- | --- | --- |
| Turn a Torob-like ticket idea into a bounded product | Compared scope and architecture options, identified pricing/identity/recovery holes and produced a task plan. The owner selected Nx, comparison/referral only and Option A; quality took precedence over an artificial deadline. | [Specification](superpowers/specs/2026-10-24-torobticket-design.md), [master plan](superpowers/plans/2026-10-24-torobticket-master-plan.md), [foundation](decisions/0001-foundation.md) |
| Normalize unlike provider offers without inventing terms | Implemented deterministic source dialects, runtime validation, namespace-aware aliases and raw-to-normalized traces. Unknown fees/conditions remain unknown. | [Normalization](decisions/T06-provider-normalization.md), [fare evidence](decisions/T07-comparison-and-fare-evidence.md) |
| Make prices, dates and rankings describe the same trip | Implemented complete same-provider round trips, eligibility, stable grouping, linked date projections and factual sort explanations. Research showed fewest connections can differ from fastest, so that sort was retained with real authored trade-offs. | [Ranking](decisions/T08-ranking-facts-and-suggestions.md), [date authority](decisions/T10-date-price-projection-and-cache.md), [trade-off research](evidence/adjustments/ranking-tradeoffs/research.md), [decision 0063](decisions/0063-independent-duration-and-connection-tradeoffs.md) |
| Build a compact Persian experience with expressive graphics | Implemented semantic RTL controls alongside WebGL/GLSL geography, GPU particle motion, route vehicles, theme transitions and flat authored illustrations. The owner repeatedly adjusted density, motion, labels and card layout. | [Graphics host](decisions/0013-shared-graphics-host.md), [map decisions](decisions/0032-atmospheric-selected-journey-map.md), [performance/visual evidence](evidence/T32/checkpoint.md) |
| Make hotel discovery follow the journey | The owner chose the arriving facility, automatic arrival date and always one night. Research/curation added real OSM hotel geography while keeping room offers authored. The owner replaced key-dependent map options with a free street-map approach. | [Arrival-based discovery](decisions/0061-arrival-based-hotel-discovery.md), [real-property directory](../libs/fixtures/src/catalog/real-hotel-directory.README.md), [map/data notices](evidence/T34/submission-and-attribution.md) |
| Keep handoff facts inspectable | Implemented quote versions, explicit changed-fare consent, idempotent confirmation and session-isolated admin trails. The owner chose an external placeholder for the visible handoff; no purchase is inferred. | [Referral rules](decisions/T11-referral-recheck-and-handoff.md), [handoff presentation](decisions/0067-modal-hotel-split-and-provider-handoff.md), [factual analytics](decisions/0026-factual-referral-analytics.md) |
| Test behavior rather than polish alone | Separate author and reviewer roles inspected domain rules, browser behavior, accessibility, graphics resources and failure recovery; CLI/browser tools produced retained actual outputs. | [Behavioral acceptance](evidence/release/behavioral-matrix.md), [accessibility](evidence/release/accessibility.md), [graphics](evidence/release/performance.md), [T33 independent review](evidence/T33/review/actual-results-review.md) |
| Package a reproducible reviewer handoff | Corrected the plain-pnpm host-dependency trap, preserved strict verification, rehearsed offline/restart/reset behavior and created bounded reports. T34 organizes the guide, script, current official requirements and attribution facts. | [T33 checkpoint](evidence/T33/checkpoint.md), [reviewer guide](reviewer-guide.md), [walkthrough](walkthrough.md), [submission facts](evidence/T34/submission-and-attribution.md) |

Independent AI review means a separate task role inspecting source and evidence;
it is not an external human audit or a user study. Native subagents, actual
repository tools and isolated browser sessions supported the later work. No
runtime model call, AI recommendation API or model-derived live fare is simulated.

## Decisions that changed the direction

These owner choices are paraphrased from the working conversation and the linked
records:

- Keep the wheel for nearby exploration and the calendar for jumping ahead;
  compare the same eligible inventory in both. [Date exploration](decisions/0016-date-exploration.md).
- Use normal production-style copy in consumer/admin while keeping technical
  documentation truthful about the mock implementation. Do not add visible
  demo badges or a forced reviewer tour. [Presentation ruling](decisions/0022-production-style-presentation.md).
- Remove the general word-scramble experiment after the owner rejected its feel;
  a later route-heading scramble was also withdrawn. Retain the useful finite
  motion instead. [Rollback 0060](decisions/0060-remove-word-scramble.md),
  [plain heading 0070](decisions/0070-hotel-reference-reactivation-and-plain-heading.md).
- Keep fastest and fewest stops as different objectives once source research
  demonstrated the distinction. Adjust the authored inventory to expose the
  trade-off instead of changing the ranker to manufacture an answer.
- Use one night for every hotel discovery, including a round trip. Keep sourced
  names/points separate from invented rates or service policies.

## Corrections are part of the evidence

Successful output was not accepted solely because an assistant said it worked.
T31 retained a real transient accessibility residual and the owner's decision
not to run VoiceOver. T32 reverted marginal optimization experiments, measured
actual startup bytes/resources and kept its limited-device conclusions explicit.
T33 retained failed clean starts, a stale asset receipt, transport experiments
and two unit tests that asserted before lazy calendar content loaded. Their
corrections were checked and independently reviewed; failed runs were not
relabeled as passes.

For example, T33's final selected quality profile contains 48 source tasks,
60 tool contracts and seven real single-attempt Chrome cases. Its optional
PostgreSQL gate is explicitly skipped. Those are recorded engineering outcomes,
not a fabricated productivity percentage, live marketplace metric or universal
quality guarantee. See [limitations](limitations.md) and the underlying receipts.

T34 also tested its presentation operator against the real interface. Failures
exposed operator assumptions about accessible city names, hidden native radio
inputs, calendar Apply already starting a search, and asynchronous popup
navigation. Corrections stayed in the operator; product behavior and assertions
were not weakened to make the story pass. The ordinary fresh-reviewer check and
a passing functional dry run are distinct from a paced presentation duration.
Their receipts, intentional holds and retained failed attempts belong with the
walkthrough record rather than a claim of human usability testing or app latency.
The final paced browser rehearsal passed at 4:30.006, with declared presentation
holds and separately measured setup; it followed the actual fare version 1 → 2
consent, receipt and admin trail. [Measured phases](evidence/T34/rehearsal-paced-002/artifacts/reviewer-walkthrough-T34-r-4c10b-handoff-and-source-evidence/walkthrough-measurement.json)
keep this result distinct from spoken narration, a captured video or submission.

The [walkthrough](walkthrough.md) distinguishes a script and measured rehearsal
from any later application-video recording. These documents do not claim that a
video was uploaded, an application was submitted, or a hiring outcome occurred.

T35 used native task subagents for separate domain, UX/operations and traceability
reviews, then independent review of the exact source and staged fixes. It did
not invoke the owner-restricted Superpowers plugin. The reviews inspected current
code and evidence, mapped25decisions/16acceptance areas, and integrated99previously
preserved branding/search-control overlays into canonical source. An unconnected
automatic nearby-date savings banner was explicitly narrowed to the implemented
faster-journey advice; manual date exploration remains available.

The final PostgreSQL gate first failed180pass/3fail. Two assertions lagged the
actual source-v5 catalog and four-capacity hotel inventory; their corrections
retained exact identities and full coverage. A real large-calendar persistence
delay also exceeded existing deadlines. The first negotiated-batch repair still
failed at2064/2112records, so it was not accepted as done. The final repair moves
pure immutable preparation outside the reviewer session lock and negotiates96-row
chunks only for the actual capable repository, retaining the custom32-row default,
4MiB bound, atomic authority checks and original deadlines. A separate reviewer
checked cancellation, foreign-session/error precedence and boundary tests.
Focused47/47 and final189/189real PostgreSQL cases then passed.

Final quality002also passes48uncached Nx tasks,60tool contracts and7critical
Chrome cases; separate12trip combinations/4branding cases and61asset/2metadata
checks pass on the same canonical application images. The actual manual journey
first exceeded five minutes, then a concise pass took2:16.058. Both hotel basemap
attempts were unavailable; the evidence does not turn this into live map success.
Actual changed-fare acceptance and matching admin/raw/normalized source lineage
were inspected. [Final review](evidence/release/final-review.md) and
[checkpoint](evidence/T35/checkpoint.md) retain these failures, corrections,
measurements and limits rather than claiming an error-free AI development run.

The hotel-map follow-up captured the next failure in native Chrome: a200style
response lacked the required CORS header. A separate implementation subagent
found that our generic MapLibre error handler also destroyed maps after ordinary
recoverable tile/sprite failures. An independent reviewer checked the public API
readiness boundary and warned that default style diffing could accept old streets
as proof of a new style. The accepted change uses a single free OpenFreeMap
provider, actual current vector content and bounded recovery; no proxy or fake
map hides the failure.39focused tests and3actual Chrome journeys pass, including
an explicitly controlled outage and sprite failure with real provider recovery.
Native dark/light, two-way selection and close/reopen were also inspected.
[Decision0082](decisions/0082-hotel-map-provider-and-tile-resilience.md) and the
[checkpoint](evidence/adjustments/hotel-map-resilience/checkpoint.md) keep the
diagnosis, source review, operator correction and actual proof separate from
T35's earlier unavailable-map observations and from a full release recertification.


The route-label follow-up replaces anchor-only scoring with full actual path/lane
clearance and measured final Persian facts. A task implementation agent and
independent reviewer caught a coarse-grid narrow-corridor miss and passive-caption
overflow; both were corrected without shrinking selected text or moving geography.
Root's browser regression uses independent segment/actual-DOM-box intersection,
then was strengthened to wait for responsive observer settlement and require every
in-frame fact. Earlier failures remain recorded rather than relabelled as passes.
23focused tests and final Chrome0038/8/20settled geometry samples pass; native
dark normal-motion IFN120wait was separately inspected. A mistyped build-config
recheck failed before building and the correct project config passed.
[Decision0083](decisions/0083-route-aware-city-and-stop-labels.md) and the
[checkpoint](evidence/adjustments/route-label-clearance/checkpoint.md) bind source,
actual checks, reviewer scope and limits; no full-release recertification is inferred.


The date-loading follow-up adds a neutral reserved chart skeleton and shared-policy
opacity breathing for actual pending chart/wheel facts. Independent review caught
that a DOM opacity wrapper cannot fade the shared GPU canvas; the implementation
retains the existing common lifecycle as curve/marker authority and fades only HTML
metadata separately.31focused tests and2first-attempt Chrome cases pass, observing
real computed pulse/entry values and exact API prices after a controlled response
hold. [Decision0084](decisions/0084-date-price-loading-motion.md) and the
[checkpoint](evidence/adjustments/date-loading-motion/checkpoint.md) distinguish
actual observations, static screenshots and the limits of shared lifecycle proof.


The owner clarified that chart loading should itself look like a gray chart and
have a moving line. The narrow follow-up replaces the three bars with two exact
SVG waveform tiles for seamless CSS drift, preserves breathing/policy boundaries
and fades a nonpulsing surface with the retained placeholder to cover the shared
GPU guide. Initial presence now permits entry. Actual data keeps its existing
shared lifecycle; the strengthened browser regression observes wave movement,
loader fade-out, real entry and flight-to-train real exit/new-placeholder entry
using held original responses. [Decision0085](decisions/0085-moving-gray-chart-placeholder.md)
and the task evidence distinguish a decorative skeleton from real price facts.


## Provider traffic and referral-fee model — 2026-11-03

The owner clarified that providers pay for customers sent onward regardless of
purchase, then locked a rolling-hour visitor/provider exclusion, graduated
checkpoints and Persian calendar month reset in Tehran time. The implementation
separates immutable accepted-offer receipts from actual server-issued redirects.
Independent review identified that existing confirmation can precede a blocked
popup, that reviewer workspace and browser visitor are different identities, and
that signed visitor state needs a durable private secret and namespaced cookies
without ordinary authenticated-response cookie writes. These are explicit
engineering boundaries, not a claim of verified people or production anti-fraud.

A separate backend task owns the redirect ledger, exact integer-IRR graduated
fees and prospective tariff snapshots. The admin task makes Traffic the entry
point while preserving technical audits, exact toman editing, unpriced history,
filter coherence and server-current month authority. A historical-month review
caught an incorrect next-tier prediction from today’s tariff; closed months now
show recorded counts instead. The owner has supplied no commercial rates, and
no invented earnings, purchase conversion, invoice or collected payment is added.

The optional Mobbin reference search refused a paid-plan gate. No reference image
was inspected or cited; the separately authorized product work uses its existing
design system and owner requirements. Root owns runtime, migration and browser
verification. [Decision0086](decisions/0086-provider-traffic-and-graduated-referral-fees.md)
and its task evidence record actual source/check outcomes separately from this
implementation account and the older T35 release results.

## 2026-11-04 — Direct Login

Implemented the owner-requested local issuer, provider SDK, reference provider,
partner enrollment/consent, private prior-account proof transport and acquisition
ledger. Independent review drove fixes for callback recovery, revocation races,
all-channel enrollment witnesses, trust-origin isolation and exact fee totals.
Actual HTTP/PostgreSQL, SDK/component and desktop/mobile browser evidence is in
`docs/evidence/adjustments/direct-login/verification.md`. The default independent
verifier rejects external attestations, and phone delivery remains a scoped local
admin inbox. No external integration or provider payment is claimed.

## 2026-11-04 — Separate provider and traveler signup

Implemented owner-requested standalone provider website with an actual backend SDK
SSO round trip, escaped approved-claims JSON and its own persistent accounts.
Added explicit traveler scope, phone-bound primary-traveler data, trip-derived
identity-document requirements and immutable consent snapshots. Independent review
identified installation revision and consent-route races; both were fixed with
regressions. Chrome exposed null-Origin logout forms under no-referrer; a
session-bound CSRF token fixed them. See decision0088 and the owning verification
record for tests, local runtime evidence and external verification limits.


## 2026-11-05 — Separate application containers and ports

Split the main and admin serving images and ports in both Compose modes while
retaining the provider's own container and hostname. Separate frontend builds no
longer depend on API/Prisma/Debian downloads. Exact admin origin checks, canonical
reference defaults and cross-app redirects preserve scoped reviewer/SSO behavior.
Only the old owned gateway is retired; permanent frontends and data volumes are
retained across lifecycle operations. Independent review and actual development/
packaged browser checks are recorded with decision0089 and the owning evidence.


## Ready-to-use reviewer SSO — 2026-11-06

The owner requested a connected provider and a reviewer flow that works after
`pnpm docker:up`. Decision0090 adds a generic post-commit workspace initializer
and a local-review installer using the actual one-use backchannel handshake.
Persisted ownership/revision guards allow retries and protect manual/disabled
clients; each reviewer receives independent credentials. Prices and traveler
identities are left for explicit input. Packaged123456 requires exact opt-in and
HTTP-loopback gates at issuance and redemption. README/reviewer guide cover both
account states, profile consent and pending independent attribution.

Independent review caught descriptor-based permissions and OpenSSL trust-path
requirements, both corrected. An archived committed source without `.env` or host
dependencies passed the actual packaged Docker startup and fresh-reviewer Chrome
SSO journey, including created/existing account reuse and reviewer isolation.
49PostgreSQL cases,29source units and38tools pass; existing reference/external
browser regressions pass after a test-selector correction. Actual logs, initial
failed checks, cleanup and scope review are kept in the [verification record](evidence/adjustments/reviewer-sso/verification.md). Current provider data survived
its entrypoint update byte-for-byte. No deployment or commercial verification is
claimed.


## Provider presentation and local discovery — 2026-11-06

The owner requested a more complete example provider site. The final local design
has provider-owned flight/destination browsing, authored one-adult sample fares,
native details/help and a readable profile from actual approved SSO claims. The
owner corrected the initial outbound-discovery assumption: TorobTicket sends users
to the provider. Rendering now accepts no issuer-origin parameter, discovery stays
local, and only an incoming-referral SDK sign-in uses TorobTicket authentication.
No prices or histories are inserted into accepted referrals or user records.

Independent review corrected greeting wrapping and self-reported-document wording.
Final source `2c311c835a5998d72250baa76d3dec621e884153` follows first layout5160beca.9provider cases, build/types/
lint/E2E types and actual cross-host browser0022/2 plus targeted0031/1 pass. The
latter verifies same-origin links and retained ref before SSO. Native320 layout,
48px details, local disclosures and viewport restoration were checked. Initial
navigation captures and lint correction are retained in the [verification record](evidence/adjustments/provider-presentation/verification.md). No deployment.
