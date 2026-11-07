# 0061 — Arrival-based hotel discovery

Date:2026-10-30. Owner replaces hotel setup with a street map of the actual
arriving airport/station/bus terminal and named nearby hotel pins, followed by
square hotel/price cards with selection bound both ways. The four orders stay.
In follow-up the owner explicitly chose **always one night** for every trip.

Use the final selected outbound segment's destination place and destination-local
arrival date. Check-out is the next calendar day, room count one, and the normal
consumer's normalized party is retained. Return departure does not extend this
stay, including same-day returns. Remove normal consumer date/room/age/arrival
configuration and the manual hotel-submit step. An unbound/unknown arrival never
produces guessed hotel dates or a fabricated hub. First hotel click may start
the ordinary transport comparison; hotel loading waits for its selected arrival.

Automatically fetch on open and current valid ticket changes, with one physical
admission per identity, abort/view/revision/session fences and explicit retries
for failures. Keep hotel inspection identity separate from valid quote authority.
Cards and map pins inspect the same hotel; a priced selection binds its current
representative complete eligible quote. Unknown/incomplete hotels may be viewed
but cannot be referred at an invented price. Preserve selected hotel over sorting
when still present; never downgrade an accepted current higher quote version.

Retain cheapest, stars, arrival distance and chosen-location distance with server
ranking/ties. Third sort uses the exact arriving hub. Fourth sort picks a point
inside the same map and applies immediately; an explicit change-point action can
repeat it, with Cancel retaining the old reference. All distances are straight
line, with unknowns distinct. No geolocation permission or extra setup page.

Use the existing key-free OSM/MapLibre renderer on every hotel-dialog open, with
one live map, static distinct arrival marker, named hotel buttons and controlled
selection. Preserve marker/focus/camera ownership through ordering and selection;
fit arrival/hotels initially, and ease only an offscreen selected hotel. Collision
layout moves labels in screen space with leaders, never the geographic points;
compact maps prioritize selected/focused names. Close/retained exit/late SDK
resolution/reopen, style changes, resize and context failure cleanly retire owners.
No replacement dotted map. Known coordinates and cards remain usable on failure.

Keep the map above square cards and room/referral details in a compact selected
bar. Preserve readable type, semantic colors/corners, native keyboard focus and
finite fades; no scramble. The map stays outside result replacement animations.
Referrals remain exact version recheck/consent/idempotent handoff, with original
room/fee/unknown facts available. No payment or booking claims.

Use five card columns on wide desktop, two on ordinary narrow screens and one
at360px or below, preserving square bounds and readable text rather than clipping
names/prices. Reference instructions/actions sit outside the map so they cannot
cover real pins. Native hotel clicks explicitly focus the current button because
MapLibre prevents default mousedown focus; retired owners cannot focus it.
The background ticket grid uses an explicit minmax(0,1fr) track so deferred rows
can shrink after resizing an open modal. Keep content-visibility/deferred rendering.
An actual current empty snapshot is required before showing no hotel availability;
initial waiting and failed retrieval cannot claim an empty result.

Historical receipts and backend generic multi-night/multi-room contracts remain
truthful and unchanged. Incompatible old hotel snapshots cannot appear under a
new one-night summary: refresh the automatic query without rewriting old facts.
A compatible one-night return can retain verified higher-version quote lineage.
No immutable fixtures, provider adapters or backend pricing changes are needed.

[Task and evidence](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/arrival-hotel-discovery/task-brief.md).
