# 0082 — Hotel street-map provider and tile resilience

Date:2026-11-02. Owner requests fixing the unavailable hotel map and real browser
verification with task subagents and independent review. This updates an
engineering default, not hotel geography, prices, ranking, arrival/stay authority
or the locked free interactive street-map experience.

## Observed cause

On canonical9f82a2d2, actual Chrome rejects the configured OSM Shadow style with
`MissingAllowOriginHeader`/`net::ERR_FAILED`. A direct diagnostic GET with the
exact same Origin and Referer returns200JSON but no Allow-Origin header; the
style response varies by Origin. OSM TileJSON separately returns Allow-Origin `*`.
This is a browser CORS failure at style loading, not proof that all OSM tiles are
down or that curl200means the browser can use them. T35's earlier unavailable
results remain true to their source/time; their precise cause was not captured.

The adapter also maps every MapLibre `error` to immediate teardown. Pinned
MapLibre6.16 intentionally continues after individual tile/sprite errors, so that
catch-all prevents normal recovery independently of the style host problem.

## Single free provider

Use OpenFreeMap's documented Bright/Dark styles through the existing pinned,
lazy MapLibre SDK. Both public style responses were checked with this app's
Origin/Referer and return200with Allow-Origin `*`. The primary vector source is
`openmaptiles`; auxiliary low-zoom raster shading cannot establish readiness.
Use normal browser caching and on-demand current-view requests. No runtime proxy,
silent alternative-provider fanout, offline archive, bulk prefetch, API key,
account, billing or new package is introduced. Historical OSM/VersaTiles evidence
remains unchanged; a successful HTTP probe alone is not live-map proof.

Keep visible OpenFreeMap, OpenMapTiles and OpenStreetMap contributor credits in
the provider control and supporting footer. Provider styles/fonts/tiles/sprites
remain third-party assets, separate from semantic authored markers and controls.
Real hotel coordinates/provenance and authored rates remain unchanged.

## Readiness and recovery

- A current style must emit style.load and report isStyleLoaded, then expose at
  least one actual rendered feature from `openmaptiles` at load/idle. DOM hotel
  pins or other raster/vector sources cannot substitute. This checks the initial
  supported urban viewport, not every later pan or all upstream availability.
- Theme replacement uses `setStyle(...,{diff:false})` on the same map, preserving
  camera and keyed markers. MapLibre's default asynchronous diff can leave old
  features visible while the new request fails. Reset proof for each generation;
  detach readiness listeners after success, replacement or disposal. Retired
  callbacks cannot settle a later theme or reopen.
- Preserve healthy maps on individual tile/glyph/sprite errors. Module/constructor
  failure, context loss or synchronous style failure remains fatal. Initial/new
  styles with no genuine visible basemap still time out after the existing15s,
  remove the renderer and show the truthful unavailable state with explicit retry.
- No periodic readiness polling or permanent feature queries: stop checks once
  the current style is ready. Cards, reference alternatives, selection, lifecycle
  and finite/reduced motion keep their existing authority.

## Verification boundary

Focused behavior tests cover transient asset recovery, empty/all-failed tile
settlement, post-ready errors, actual current-style readiness, retired callbacks,
style timeout/throw, SDK failure and cleanup. Real browser verification must show
streets/labels, arrival and hotel pins, two-way selection, theme/close/reopen,
and controlled failure/retry. Injection of a request failure is documented as
controlled; live successful responses and visible real geography are separate.
Evidence and current status live in the follow-up checkpoint/tracker; this ruling
does not claim a future check passed or change old release receipts.

References checked2026-11-02:

- [OpenFreeMap quick start](https://openfreemap.org/quick_start/): documented
  MapLibre/Vite worker integration and styles.
- [OpenFreeMap](https://openfreemap.org/): free/keyless public service and
  attribution; no SLA is promised.
- [OSM vector policy](https://operations.osmfoundation.org/policies/vector/):
  ordinary browser cache/Referer, best-effort availability and no bulk download.
- [MapLibre Map API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/):
  public style/readiness/feature APIs; installed6.16source was inspected for the
  source/tile error and style-diff behavior.
