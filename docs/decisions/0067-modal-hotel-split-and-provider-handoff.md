# 0067 — Hotel split view, provider backdrop and dark surfaces

Date:2026-10-31. Explicit owner adjustment, including final clarification that
only backgrounds/dark surfaces become darker; primary colors stay unchanged.

Desktop hotel discovery uses a substantial persistent street map beside square
hotel cards with their own scroll area. Four sort choices remain segmented;
capacity sits beside them and changes actual one-room occupancy/eligible rates.
Capacities1–3 match current authored room inventory; retain larger historical
parties as selected values without inventing rates. Children/infants remain
authoritative. Automatic destination-local arrival check-in and one-night stay
remain, as do the real arrival pin and two-way hotel selection. Remove only the
redundant visible airport/station/date summary. One-room/one-night prices say per
night, while old multi-room/night snapshots keep their whole-stay scope.

Capacity is an optional backwards-compatible checkpoint field. It participates
in request/revision/cancellation and referral leases; changes never edit the
transport intent. Hydration validates both the hotel query party and selected
quote against that capacity. Pending requests remain replaceable.

An App-level handoff boundary owns the fullscreen blurred backdrop and large
loader. Unchanged rechecks auto-confirm; changed versions still require explicit
acceptance, and unavailable/failed quotes never open a provider tab. The exact
confirmed receipt opens https://zarei.xyz in a new tab, with opener severed before
external navigation, then the backdrop exits. Original comparison/history and
hotel selection stay present. No blank tab is reserved before confirmation.
Browsers that block asynchronous popups expose a synchronous same-receipt retry;
no extra confirmation or referral is created. Cancellation, deadlines, source
replacement and unmount reject delayed work. Legacy local receipt routes remain
compatible; this deliberately supersedes the old same-tab presentation, without
changing server receipt contracts or implying real provider/booking integration.

Use one shared28px SVG close control in existing44px targets across modal,
profile, filters and suggestion dismissal. Keep portal surfaces/backdrops in
the resolved active palette. The shared navy overlay was causing the visual blue
cast; add themed overlay values without adding portal ThemeProviders or resetting
the root owner. Dark canvas/surface/disabled-background/haze values become dimmer;
primary/text/price/status/border/route/dot/highlight values are unchanged. Existing
foreign brand-token edits are preserved in the workspace and excluded from this
decision's commit projection.

Meaningful author and independent behavior checks, current native screenshots,
viewport/capacity/theme/popup evidence, exact source manifests and scoped local
commits belong in docs/evidence/adjustments/modal-hotel-handoff. M7 remains partial,
29/35 tasks complete with T30 active; this adjustment does not close the outstanding
quality-gate matrix. No reset, rebuild, schema/inventory rewrite, push or deployment.
