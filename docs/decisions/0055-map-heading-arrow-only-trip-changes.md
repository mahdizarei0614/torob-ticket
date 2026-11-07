# 0055 — Trip-type changes animate only the map arrows

Accepted and implemented2026-10-30. Source `205bbe3`. Specification1.26.
Owner reports city labels replaying when switching one-way/round-trip and wants
only the arrows to update.

Keep unchanged city-label nodes mounted and visible through a trip-type change.
Give the arrow its own finite fade/lift transition and a fixed inline footprint,
so switching←/↔ does not fade the labels or nudge their positions. Covered,
reduced and hidden motion policy settles directly.

The same continuity applies when a trip-type edit clears a selected itinerary.
Clear its airport codes/service details truthfully; retaining a city text node
does not retain revoked selected-ticket evidence. Genuine endpoint, stop,
direction and selected-service changes retain their appropriate transitions.

Verification must distinguish React rendering from visible remount/replay:
assert city DOM identity, uninterrupted effective opacity and stable geometry
for unchanged form routes, actual arrow intermediate frames, loaded-ticket→draft
behavior and reduced motion. Use fresh contexts without resetting reviewer data.
See the [task brief](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/map-heading-arrows/task-brief.md).

Source and native verification passed, with independent approval. Four actual
form toggles preserved both city labels at full opacity with0px movement;
only arrows had16–17 intermediate fade frames. A real cheapest three-city
itinerary→draft retained its endpoint nodes and cleared obsolete stop/code/service
facts; their removal legitimately changes spacing. Reduced motion settled with
zero intermediate arrow frames. See [checkpoint](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/map-heading-arrows/checkpoint.md).
