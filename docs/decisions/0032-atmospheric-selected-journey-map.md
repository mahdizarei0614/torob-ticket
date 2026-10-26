# 0032 — Atmospheric selected-journey map

Owner request,2026-10-26: breathing dots with smooth pointer glow, stronger major-city dots, flight arcs/double rails/curved roads, glossy vehicle icons and a traveling light strand, dim shaded dark palettes, endpoint pop-ins and sequential stop/wait reveals after choosing a ticket.

This supersedes decision0031 only for selected endpoint/stop labels and route presentation. The map cannot edit cities. The compact title remains; no network labels, extra controls or footer panels return. Only an explicit ticket pin/selection draws the desktop route. Hover/focus metadata no longer changes the selected desktop journey or restarts its animation. Form edits still revoke the selection under existing ownership rules.

The renderer samples a pure presentation timeline in canonical segment order, separate from quote/referral state. Known stop waits count up to the source value; unknown stays unknown. Glass vehicle/light motion does not imply a booked journey. Endpoints use selected transport places when available, otherwise selected city coordinates. Major-city emphasis is an authored cartographic choice, not a population or inventory assertion.

All colors remain semantic tokens. Dark surfaces are dimmed with layered gradient haze. New ambient motion uses the existing single app clock/context; it pauses while covered, hidden or reduced-motion. Reduced-motion and unavailable-GPU presentations show the selected route and exact labels without animation. Hotel street-map selection and mobile timelines retain their existing behavior.

This is a focused owner-requested adjustment, not completion of M7's remaining acceptance, accessibility, performance or lifecycle audits. Verification and independent review are recorded under docs/evidence/adjustments/atmospheric-map.

Additional owner steering during implementation: remove the map/content divider; use side-view train and bus icons; gently fit the international map to selected endpoints before ticket selection and expand to include a chosen itinerary's outlying stops; thicken route lines and make the directional shooting-star strand clearer. Camera easing must share the existing renderer clock, align DOM annotations, and settle directly under reduced motion.

The owner also requested less scrolling in the right-hand controls through layout, without reducing fonts. On desktop, origin/destination/class share a row, traveler counts and search action share a row, date arrows sit beside a five-row wheel, and price evidence sits beneath the chart. Date rows retain44px targets with the same typography; wheel interaction math uses the same44px row height. Smaller screens keep the existing flow and may scroll normally. Expanded passenger-age requirements and errors remain visible rather than being hidden to force a fixed page height.
