# 0034 — Compact search and journey motion

Owner request, 2026-10-27. This adjustment supersedes prior presentation choices where specified; comparison/referral authority and the shared renderer remain intact.

| Owner item | Implementation decision |
|---|---|
| 1. Random-like Iran/world morph | Deterministically scattered particles move between the two geographic shapes, then settle into the existing airy dot lattice. Interruptions start from the displayed transition; reduced motion settles directly. |
| 2. Vehicle rotation and two wagons | Every vehicle follows its local path tangent. The train has a locomotive and two separate trailing wagons following the same route. |
| 3. Vehicle blur/fade | Departure and arrival use a soft shader blur/opacity envelope, including loop wrap. No new animation clock or framebuffer is introduced. |
| 4. Compact controls and default class | Preserve readable font sizes and usable targets. Keep compatible class choices; otherwise choose economy/seat/standard from the actual mode catalog, then its first valid choice. |
| 5. Endpoint fading | Retain outgoing endpoint visuals briefly for a fade; only current endpoints have semantic identity. Entry, exit, replacement and viewport culling respect motion policy. |
| 6. Remove hints | Remove the visible wheel instruction and routine drag guidance. Keyboard behavior and accessible names remain. |
| 7. Searchable cities | Search icons, clear actions, search placeholders and a quieter focus treatment make the combobox affordance explicit. Clearing still updates authoritative trip intent. |
| 8. Remove redundant labels | Hide the three segmented group labels visually while preserving accessible names. Remove the date-explorer heading and repeated traveler/trip/time-zone summary. |
| 9. Smaller calendar | Compact icon trigger and narrower calendar dialog/month grid; preserve priced dates, keyboard navigation and provisional Apply/Cancel semantics. |
| 10. Remove passenger calculator | New consumer transport searches compare one adult. Normalize new frontend intent at entry, presets, saved opens and new requests; preserve server contracts, original historical evidence and hotel eligibility. Old multi-party results cannot become selectable for a normalized draft. |
| 11. Remove desktop route placeholder | No standalone explanatory route card before selecting an itinerary. The small-screen timeline remains for a selected itinerary; medium/desktop layouts use ticket details. |
| 12. Hotel discovery below map | On wide desktop, a compact hotel card is docked below the map and enters upward with a fade once a valid complete route is selected. Narrow layouts retain an inline action. One mounted discovery model preserves modal/stay state across responsive placement. |

“Complete route” means a valid current transport draft, including both cities and its dates. Before a transport comparison exists, clicking hotel discovery establishes the ordinary comparison context first so the existing referral return checkpoint is available; it does not select a ticket. Opening a hotel still requires arrival-date confirmation without a selected itinerary. Editing the trip must not silently rewrite an already edited stay.

All authored UI/shader colors remain semantic tokens. Geography and motion are decorative; no real providers, booking/payment behavior, runtime AI, new external map service or credentials are added. M7 remains partial at 29/35; this is an owner-directed adjustment rather than completion of the broader acceptance matrix.

Evidence and independent review: `docs/evidence/adjustments/compact-journey/`.
