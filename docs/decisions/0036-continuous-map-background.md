# 0036 — Continuous map background

Owner request, 2026-10-27. The desktop map is part of the page atmosphere: it must not read as a differently colored rectangular panel. Dots should soften toward the scene edges and blend toward the right-hand content.

- Use one viewport-aligned shaded background with semantic theme tokens across the consumer page; the desktop map surface is transparent.
- Feather actual geography rendering near the viewport boundaries, with a soft transition toward the results. Because the shared WebGL canvas is portaled outside the placeholder, the fade must reach GPU geography as well as the static SVG fallback. Preserve consistent appearance during zoom and Iran/world morphing.
- Keep selected route, endpoint names, stop details and controls legible. Preserve common camera/overlay geometry, existing main-map visibility threshold, right-side input/click/scroll behavior, and hotel discovery.
- This is a presentation adjustment only: no added providers, data, selection logic, canvases or render loops. Preserve reduced-motion behavior and all transport/appearance palettes.
- Use focused existing checks, real browser screenshots at normal desktop sizes, and independent review. Record source/evidence in the tracker. M7 stays partial29/35, T30 active.

Evidence: `docs/evidence/adjustments/map-blending/`.
