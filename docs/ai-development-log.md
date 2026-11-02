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
