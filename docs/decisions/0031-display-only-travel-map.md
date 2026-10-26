# 0031 — Compact display-only travel map

Owner requested2026-10-26: the main travel map must not change start/end cities; remove city labels and extra map data, leaving only the top start→end title and the map. Search-form controls alone edit endpoints. Remove consumer city-choice generation and chooseCity capability rather than hiding editable labels. No new search, pricing, routing or provider logic is introduced.

Desktop composition contains the compact current-route title and existing route scene. It omits the endpoint target controls, city dropdown/labels/leader lines, visible zoom toolbar, progress/status footer and duplicated route details/direction toolbar. Existing internal selection/progress/camera ownership and rendering are retained. Pin/preview still follows ticket inspection; gesture zoom does not edit endpoints. Mobile route timeline/direction controls and the hotel street-map location picker retain their existing behavior.

RouteScene/SceneSurface accept optional showControls, defaulttrue for all existing callers; consumer passesfalse. labelsVisiblefalse omits labels in both DOM and portal paths, with no dangling aria-controls. Generic lab/local picker defaults and vendor hotel map remain unchanged. Asset retrieval failure still has an actionable recovery state.

Earlier map-interaction evidence and screenshots describe the previous accepted design. This owner ruling supersedes endpoint editing/city-label/desktop extra-control requirements without claiming unfinished M7 audits are complete. Independent source review and focused native checks are under docs/evidence/adjustments/read-only-map.
