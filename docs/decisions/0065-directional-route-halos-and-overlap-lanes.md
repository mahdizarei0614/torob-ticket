# 0065 — Directional route halos and shared-section lanes

Date:2026-10-31. The owner requests smooth halo/shadow direction cues along flight,
train and bus/road lines. Two subsequent owner instructions explicitly require
both directions to glow on round trips, a slightly different return color within
the theme, and a little separation where sections completely overlap.

Use a restrained repeated tapered light cue along canonical arc length, with a
leading tip and a softer trailing halo. Preserve flight curves, double rails,
curved road styling and actual transfer modes. Keep existing vehicle/comet motion
and its fade intact; the new line cue may remain independently readable. First
reveal still follows the supplied itinerary and stops. Both round-trip legs glow
once their geometry is visible; an earlier provisional active-leg-only idea is
superseded by the explicit owner instruction. Return tint derives from existing
semantic theme colors, preserving coherent mode/theme changes.

Detect actual fully shared polyline fragments across the two supplied legs,
including reversed or differently sampled equivalents. Shared endpoints, narrow
crossings and nearby parallel routes are insufficient. Offset matching display
sections into slightly spaced lanes and taper to their exact endpoints/stops.
Keep unshared alternatives unchanged, including asymmetric return legs and
seam-separated fragments. Preserve input geometry, actual route facts, distances,
heading/selection, camera fitting, stop chronology and referral semantics. The
lane change is a local rendering treatment, not a changed operating route.

Reuse the existing active accumulated renderer clock. Do not introduce a RAF,
renderer, postprocessing chain or dependency. Covered/hidden/disabled motion
pauses; reduced motion retains stationary direction cues, and static SVG fallback
uses actual path tangents, both-leg tint and the same overlap rules without a
clock. All colors derive from semantic theme inputs. Keep contrast restrained
and preserve the dark spatial mood.

Verify actual shader compilation/draws and uniform progression, both directions,
return tint, fully shared versus unshared sections, endpoint taper, reveal/seams,
transfers, reduced/covered/hidden ownership and static fallback. Native evidence
must include all three modes, a shared ground round trip and an asymmetric return.
Additional owner correction: the plane, bus, locomotive and both wagons always
render in the foreground, above route strokes, emitted light, geography and
borders. Explicit transparent-mesh ordering handles the ordinary path. Bloom
input excludes these vehicles; one final foreground draw follows its additive
composite in the same renderer. Keep original glass shapes, opacity/blur and
canonical vehicle motion. Restore camera and renderer state on every success or
failure path, including effect failure and untagged/simple views. Native driver
draw-order evidence must cover all modes, wagons and unsupported bloom; review
state-restoration and lifecycle tests independently.

Record independent review, scoped local commits and master/SDD/exports; preserve
unrelated branding/search/token/infra work. No reset, rebuild, market build,
push/deploy or Superpowers plugin.

[Task and evidence](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/adjustments/route-direction-halo/task-brief.md).
