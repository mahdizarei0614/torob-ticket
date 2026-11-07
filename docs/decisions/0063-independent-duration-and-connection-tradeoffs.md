# 0063 — Independent duration and connection trade-offs

Date:2026-10-30. Owner asks whether fastest and fewest-stop lists are universally
identical, removing the latter only if redundant; otherwise make the inventory
and actual sort selection demonstrate the distinction.

Primary research disproves universal equality. Deutsche Bahn explicitly offers
fewer-transfer journeys taking longer than the fastest alternative; Google Matrix
documents separate Duration and Stops sorts and long-layover advisories. See the
research record.

Keep the existing honest ranking rules. Fastest compares full journey elapsed
minutes including waits, then price/connections. Fewest compares flight stops or
ground vehicle changes, then duration/price. Round trips sum both legs and exclude
destination stay. Dwell without changing vehicles is not a ground transfer. Do
not shuffle, change tie breaks or invent connections to force a visible change.
True same-count/aligned results may stay identical.

The pre-edit active-v4 audit covered18 query sets, each with12 canonical groups;
all full fastest/fewest orders matched. The backend and price-card comparators
were already separate. Correct the monotone authored schedules through new
source-v5-schedule-tradeoffs-2026-10-30, active for new v3 transport operations.
Selected London/Paris one-stop services have long authored hub waits, New York
has a shorter long-wait band, and well-timed multi-stop alternatives have shorter
connections. These are bounded source choices, not current airline timetable or
minimum-connection guarantees. All routes, carriers and flying minutes stay;
dependent segment/stop instants and IDs retime cumulatively before feasibility.
Preserve twelve services and seller overlap, explicit waits and both-date fares.
Domestic/ground/other unselected schedules are unchanged, with honest equal
transfer-count rankings. Do not invent through trains or unsupported ground hops.

Current London November2 one-way leaders are815min/two stops under fastest and
995min/one stop under fewest. A November2→9 return has1775min/five total stops
versus1945min/two stops. These demonstrate the authored comparison rather than
claiming current operating availability.

Before editing, freeze136v4 raw search/recheck hashes plus catalog/policy hashes.
Keep original default/base, v1/v2 and v4 source generation exact, including the
previous asymmetric round-trip and directional fare rules. New search/date caches
freeze v5; old selections recheck their recorded source. Advance the frontend
date-policy identity because changed timing can change date-pair eligibility.
No session/schema/catalog migration or reset. Update tests that assert the active
revision while keeping explicitly recorded-v4 tests pinned to historical data.

Sort selection remains local to received results: same priced-card set/amounts,
same selected quote/map pin, stable focus, no new search/date/referral request,
and unchanged immutable source query. Actual browser evidence must verify the
different complete orders and truthful equal-count case. Record independent
reviews, exact local commits and master/SDD/exports; no external publication.

Task and evidence.
