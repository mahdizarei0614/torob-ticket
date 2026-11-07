# 0062 — Viewport filters and directional round-trip fares

Date:2026-10-30. Owner requests viewport-safe ticket filters, independently routed
outbound/return travel, and return-date prices that vary correctly and agree
across chart, wheel, calendar and corresponding complete ticket results.

Filters use the existing React Aria portalled Popover to flip/shift inside12px
viewport margins and cap available height. A fixed close header remains reachable;
only the body scrolls. Apply/Clear/Cancel stay in ordinary form flow so they do
not cover fields in short views. Preserve native focus, outside/Escape dismissal,
finite entrance/exit and each open's action identity. Retiring forms are inert;
old submit/input/clear/dismiss callbacks cannot affect a later open or comparison.
Do not shrink readable type or use page clipping to conceal overflowing content.

A round trip is one complete same-provider offer with two independent supplied
legs. Its stops, carriers, facilities, services and timing can differ in each
direction. Existing contracts, canonical details and graphics already retain the
actual return geometry; do not replace it with a reversed outbound. Show separate
labeled outbound/return map chains instead of implying an unsupplied connecting
segment across the destination stay. Compact cards label each route and expose
a distinct return carrier. Keep actual different endpoint airports and fit both
directions; no new city/leg configuration or invented connector is needed.

The old v3 source multiplied a departure-only fare by1.82, so the return day did
not influence gross price. New transport operations in showcase-v3 opt into
`source-v4-directional-fares-2026-10-30`, independently of the unchanged immutable
showcase-v3/catalog-v3 identity. The source supplies one complete gross using both
local dates, direction/service price bands and bounded deterministic calendar
demand with its bundle factor. Some services retain a matching return family;
others supply a different return service family and actual stop sequence. This
is source-authored inventory, never a UI sum of unrelated one-way seller quotes.

Keep old default generation and recorded source revisions byte-identical. Before
editing, capture112v3 raw search/recheck hashes plus catalog/policy hashes. New
search/date contexts explicitly select and freeze the active source map; date
server cache identity includes it. Historical frozen operations and rechecks use
their original recorded source, including selected quote provenance. Old snapshots,
quotes, dates and receipts remain immutable and usable in the same session.
No session/catalog migration/reset or database schema change is needed. Legacy
v1/v2 remain frozen. The owner's observed current session is already v3.

Frontend date identity includes the directional-pricing policy revision, retiring
old in-memory estimates after this code update without periodic repricing. Return
exploration holds the outbound date fixed and shows the complete whole-party
round-trip total, using the same provider/eligibility authority as selected-date
results. Wheel/chart use exact toman; compact calendar prices retain their visible
thousand-toman caption and exact accessible amount. Compare raw integer-rial minima
across all eligible complete quotes, independently of displayed ranking.

No new dependency, broad graphics rewrite, runtime provider/LLM, payment, booking
claim or external publication. Test databases must pass the existing explicit
_test connection guard; actual browser checks use fresh isolated sessions without
resetting/deleting the normal application's data.

Task and evidence.
