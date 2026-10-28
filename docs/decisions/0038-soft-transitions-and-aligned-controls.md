# 0038 — Soft transitions and aligned controls

Owner adjustment, 2026-10-28. Current task brief: seven presentation and selected-route synchronization requests. M7 remains partial, 29/35; T30 active.

- Switching flight/train/bus interpolates resolved semantic colors over approximately 760ms, including the page atmosphere, controls, SVG and GPU uniforms. It does not use the appearance clip. Rapid mode changes begin from the visible intermediate palette. Initial load, reduced motion, hidden/inactive ownership and forced-color fallbacks settle directly; finite callbacks release resources.
- Light/dark keeps the circular reveal around the toggle and slows to approximately 780ms, after CSS/GPU synchronization. Latest preference and mode ownership win interruptions.
- Align the origin/destination/class fields. Class uses the existing accessible segmented control with mode-compatible options and a selected default. Narrow screens retain practical targets.
- Shorten the wheel to three 44px rows. Put the full-width calendar control below it with an 8px gap; the chart plot matches their combined 184px height. Preserve wheel navigation and provisional calendar Apply/Cancel.
- Loading uses reserved skeletons. Replacements, details, selected seller rows and map headings receive finite fade/up transitions; stable list keys support insertion, removal and reordered position animation. Exiting visuals become inert and hidden immediately. Motion does not grant authority, delay validation or replay indefinitely, and settles under reduced/hidden/covered policy.
- The map heading follows the pinned canonical itinerary and direction, including its ordered route and compact actual service/departure context. Same-city tickets can therefore show their selected service change. Hover and results scrolling do not replace a pinned heading. Draft endpoint edits still revoke stale ticket authority immediately.
- Keep Persian/RTL, readable type, semantic colors, historical evidence and the exact quote recheck/consent/referral flow. No provider integration or booking behavior is added.

Use scoped implementation agents and independent review. Record actual source/native checks and limitations under `docs/evidence/adjustments/soft-transitions/`, update the tracker/SDD/specification and local exports. No remote push or publication.
