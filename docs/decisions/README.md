# Architecture and product decisions

The [specification](../superpowers/specs/2026-10-24-torobticket-design.md) is the
authority; the [master tracker](../superpowers/plans/2026-10-24-torobticket-master-plan.md)
records implementation and actual evidence. These records explain why a boundary
or interaction changed. Later owner rulings can supersede earlier designs.
Historical mock terminology is technical history, not current product UI copy.

## Useful entry points

| Question | Read |
| --- | --- |
| Why these apps and libraries? | [0001 foundation](0001-foundation.md) and [architecture](../architecture.md) |
| What makes offers comparable? | [T06 normalization](T06-provider-normalization.md), [T07 fare evidence](T07-comparison-and-fare-evidence.md), [T08 ranking](T08-ranking-facts-and-suggestions.md) |
| How do streamed searches recover? | [T09 durable orchestration](T09-durable-search-orchestration.md), [0077 rehearsal](0077-t33-reproducible-startup-and-owned-lifecycle.md) |
| What authorizes a referral? | [T11 recheck/handoff](T11-referral-recheck-and-handoff.md), [0022 consent/return](0022-referral-consent-and-return.md) |
| Why do hotels follow arrival? | [0061 arrival discovery](0061-arrival-based-hotel-discovery.md), [0064 real geography](0064-real-hotel-geography-and-hover-pins.md) |
| Why are fastest and fewest stops separate? | [0063 trade-offs](0063-independent-duration-and-connection-tradeoffs.md) |
| What is measured versus assumed? | [0075 accessibility](0075-t31-accessibility-and-browser-audit.md), [0076 graphics](0076-t32-graphics-visual-and-resource-acceptance.md), [release evidence](../evidence/release/README.md) |
| What are the reviewer-material boundaries? | [0078 reviewer materials](0078-reviewer-materials-and-evidence-scope.md), [T34 opening brief](https://github.com/mahdizarei0614/torob-ticket/blob/226bd9d929a023d4060ba102602faad9fde97914/docs/evidence/T34/task-brief.md), [limitations](../limitations.md) |

## Numbered records

| File | Recorded subject |
| --- | --- |
| [0001-foundation.md](0001-foundation.md) | 0001 — Runnable Nx foundation |
| [0002-runtime-contracts.md](0002-runtime-contracts.md) | 0002 — Runtime wire contracts |
| [0003-pure-money-time-and-eligibility.md](0003-pure-money-time-and-eligibility.md) | 0003 — Pure money, local time, and eligibility rules |
| [0005-deterministic-showcase-catalog.md](0005-deterministic-showcase-catalog.md) | T05 — Immutable showcase catalog and authored source evidence |
| [0012-ui-foundation.md](0012-ui-foundation.md) | T12 — Shared UI and theme foundation |
| [0013-shared-graphics-host.md](0013-shared-graphics-host.md) | T13 — shared graphics host and browser lifecycle |
| [0014-dotted-route-scenes.md](0014-dotted-route-scenes.md) | T14 — bounded dotted geography and explicit route geometry |
| [0015-consumer-search-intent.md](0015-consumer-search-intent.md) | T15 — Consumer shell and committed search intent |
| [0016-date-exploration.md](0016-date-exploration.md) | T16 — Date exploration |
| [0017-comparison-results.md](0017-comparison-results.md) | T17 — Comparison results, frozen adoption and explicit refinement |
| [0018-consumer-trip-map.md](0018-consumer-trip-map.md) | 0018 — Consumer canonical trip map |
| [0019-optional-demo-account.md](0019-optional-demo-account.md) | 0019 — Optional sandbox identity and saved search intent |
| [0020-hotel-stay-authority.md](0020-hotel-stay-authority.md) | 0020 — Whole-party hotel stay authority and shared referral lineage |
| [0021-hotel-discovery-and-foreground-map.md](0021-hotel-discovery-and-foreground-map.md) | 0021 — Independent hotel discovery and a key-free city map |
| [0022-production-style-presentation.md](0022-production-style-presentation.md) | 0022 — Production-style presentation |
| [0022-referral-consent-and-return.md](0022-referral-consent-and-return.md) | 0022 — Exact referral consent, immutable handoff and scoped return |
| [0023-scoped-operations-controls.md](0023-scoped-operations-controls.md) | 0023 — Session-scoped operations controls |
| [0024-inspectable-processing-evidence.md](0024-inspectable-processing-evidence.md) | 0024 — Inspect recorded processing, replay explicitly |
| [0025-bounded-alias-corrections.md](0025-bounded-alias-corrections.md) | 0025 — Effective, bounded alias corrections |
| [0026-factual-referral-analytics.md](0026-factual-referral-analytics.md) | 0026 — Factual referral accounting and lineage |
| [0027-flat-visual-and-motion-system.md](0027-flat-visual-and-motion-system.md) | 0027 — Flat visual identity and coordinated motion |
| [0028-intent-preserving-recovery.md](0028-intent-preserving-recovery.md) | 0028 — Preserve intent, revoke obsolete authority |
| [0029-foundation-docker.md](0029-foundation-docker.md) | 0029 — Early foundation Docker packaging |
| [0030-external-compose-acceptance-harness.md](0030-external-compose-acceptance-harness.md) | 0030 — Explicit external Compose acceptance |
| [0031-display-only-travel-map.md](0031-display-only-travel-map.md) | 0031 — Compact display-only travel map |
| [0032-atmospheric-selected-journey-map.md](0032-atmospheric-selected-journey-map.md) | 0032 — Atmospheric selected-journey map |
| [0033-world-map-context-and-scene-continuity.md](0033-world-map-context-and-scene-continuity.md) | 0033 — World map context and scene continuity |
| [0034-compact-search-and-journey-motion.md](0034-compact-search-and-journey-motion.md) | 0034 — Compact search and journey motion |
| [0035-compact-ticket-results-and-default-selection.md](0035-compact-ticket-results-and-default-selection.md) | 0035 — Compact ticket results and default selection |
| [0036-continuous-map-background.md](0036-continuous-map-background.md) | 0036 — Continuous map background |
| [0037-price-bands-and-same-price-sellers.md](0037-price-bands-and-same-price-sellers.md) | 0037 — Price bands and same-price sellers |
| [0038-soft-transitions-and-aligned-controls.md](0038-soft-transitions-and-aligned-controls.md) | 0038 — Soft transitions and aligned controls |
| [0039-compact-profile-and-roundtrip-discovery.md](0039-compact-profile-and-roundtrip-discovery.md) | 0039 — Compact profile, round-trip discovery and living map dots |
| [0040-visible-living-dot-motion.md](0040-visible-living-dot-motion.md) | 0040 — Visible positional motion for map dots |
| [0041-living-map-particle-lifecycles.md](0041-living-map-particle-lifecycles.md) | 0041 — Living map particle lifecycles |
| [0042-overlay-hotel-banner.md](0042-overlay-hotel-banner.md) | 0042 — Overlay hotel banner without moving the map |
| [0043-chart-controls-and-result-refinements.md](0043-chart-controls-and-result-refinements.md) | 0043 — Chart, controls, airline assets and result refinements |
| [0044-roundtrip-chart-profile-and-corners.md](0044-roundtrip-chart-profile-and-corners.md) | 0044 — Round-trip motion, chart lifecycle, profile and shared corners |
| [0045-staggered-particles-and-adaptive-bloom.md](0045-staggered-particles-and-adaptive-bloom.md) | 0045 — Staggered particle arrival and adaptive map bloom |
| [0046-continuous-morph-and-pointer-repulsion.md](0046-continuous-morph-and-pointer-repulsion.md) | 0046 — Continuous moving-target morph and stronger pointer repulsion |
| [0047-faster-morph-provinces-and-bounded-glow.md](0047-faster-morph-provinces-and-bounded-glow.md) | 0047 — Faster simultaneous departure, provinces, and bounded particle glow |
| [0048-particle-scatter-and-momentum.md](0048-particle-scatter-and-momentum.md) | 0048 — Particle scattering with momentum and a slow return |
| [0049-travel-research-catalog-and-compact-controls.md](0049-travel-research-catalog-and-compact-controls.md) | 0049 — Researched travel inventory, operator assets, and control/map refinements |
| [0050-compact-loop-production-identity.md](0050-compact-loop-production-identity.md) | 0050 — Compact Loop production identity |
| [0051-form-profile-and-route-polish.md](0051-form-profile-and-route-polish.md) | 0051 — Quiet search feedback, compact account controls and route-light exit |
| [0052-rich-inventory-coverage.md](0052-rich-inventory-coverage.md) | 0052 — Broad, near-realistic normal ticket coverage |
| [0053-docker-development-hot-reload.md](0053-docker-development-hot-reload.md) | 0053 — Docker development with automatic source updates |
| [0054-ticket-list-rendering-performance.md](0054-ticket-list-rendering-performance.md) | 0054 — Keep large ticket lists responsive |
| [0055-map-heading-arrow-only-trip-changes.md](0055-map-heading-arrow-only-trip-changes.md) | 0055 — Trip-type changes animate only the map arrows |
| [0056-search-controls-and-validation-tooltips.md](0056-search-controls-and-validation-tooltips.md) | 0056 — Compact search controls and above-field validation |
| [0057-four-controls-row-and-travel-direction.md](0057-four-controls-row-and-travel-direction.md) | 0057 — Four labeled travel controls on one row |
| [0058-vehicle-filter-and-text-motion.md](0058-vehicle-filter-and-text-motion.md) | 0058 — Vehicle-dependent controls and bounded text motion |
| [0060-remove-word-scramble.md](0060-remove-word-scramble.md) | 0060 — Remove the rejected word scramble |
| [0061-arrival-based-hotel-discovery.md](0061-arrival-based-hotel-discovery.md) | 0061 — Arrival-based hotel discovery |
| [0062-viewport-filters-and-directional-roundtrip-fares.md](0062-viewport-filters-and-directional-roundtrip-fares.md) | 0062 — Viewport filters and directional round-trip fares |
| [0063-independent-duration-and-connection-tradeoffs.md](0063-independent-duration-and-connection-tradeoffs.md) | 0063 — Independent duration and connection trade-offs |
| [0064-real-hotel-geography-and-hover-pins.md](0064-real-hotel-geography-and-hover-pins.md) | 0064 — Real hotel geography and hover-only names |
| [0065-directional-route-halos-and-overlap-lanes.md](0065-directional-route-halos-and-overlap-lanes.md) | 0065 — Directional route halos and shared-section lanes |
| [0066-bloom-performance-recovery.md](0066-bloom-performance-recovery.md) | 0066 — Bloom performance recovery and invisible work |
| [0067-modal-hotel-split-and-provider-handoff.md](0067-modal-hotel-split-and-provider-handoff.md) | 0067 — Hotel split view, provider backdrop and dark surfaces |
| [0068-gold-suggestions-and-hotel-map-polish.md](0068-gold-suggestions-and-hotel-map-polish.md) | 0068 — Gold suggestions, hotel controls and map text |
| [0069-metallic-recommendation-finish.md](0069-metallic-recommendation-finish.md) | 0069 — Metallic recommendation finish |
| [0070-hotel-reference-reactivation-and-plain-heading.md](0070-hotel-reference-reactivation-and-plain-heading.md) | 0070 — Reference reactivation and plain route heading |
| [0071-dock-presence-and-dual-gold-glow.md](0071-dock-presence-and-dual-gold-glow.md) | 0071 — Restore finite presence and strengthen metallic border motion |
| [0072-brighter-sparse-map-bloom.md](0072-brighter-sparse-map-bloom.md) | 0072 — Brighter light around sparse map particles |
| [0073-t30-current-behavioral-acceptance.md](0073-t30-current-behavioral-acceptance.md) | 0073 — Resume T30 against current product behavior |
| [0074-font-independent-map-heading-arrows.md](0074-font-independent-map-heading-arrows.md) | Font-independent map heading arrows |
| [0075-t31-accessibility-and-browser-audit.md](0075-t31-accessibility-and-browser-audit.md) | T31 accessibility and browser audit |
| [0076-t32-graphics-visual-and-resource-acceptance.md](0076-t32-graphics-visual-and-resource-acceptance.md) | T32 graphics, visual and resource acceptance |
| [0077-t33-reproducible-startup-and-owned-lifecycle.md](0077-t33-reproducible-startup-and-owned-lifecycle.md) | T33 reproducible startup and owned lifecycle |
| [0078-reviewer-materials-and-evidence-scope.md](0078-reviewer-materials-and-evidence-scope.md) | 0078 — Reviewer materials and evidence scope |
| [0079-search-request-control.md](0079-search-request-control.md) | 0079 — Bound repeated ticket searches and cancel obsolete starts |
| [0080-final-review-and-canonical-release-scope.md](0080-final-review-and-canonical-release-scope.md) | 0080 — Final review and canonical local release scope |
| [0081-negotiated-date-evidence-batches.md](0081-negotiated-date-evidence-batches.md) | 0081 — Negotiated date evidence batches and immutable preparation outside the session lock |
| [0082-hotel-map-provider-and-tile-resilience.md](0082-hotel-map-provider-and-tile-resilience.md) | 0082 — Free hotel basemap provider, real-content readiness and recoverable tile errors |
| [0083-route-aware-city-and-stop-labels.md](0083-route-aware-city-and-stop-labels.md) | 0083 — General route-aware city and stop/wait label clearance |
| [0084-date-price-loading-motion.md](0084-date-price-loading-motion.md) | 0084 — Date-price loading presence and opacity breathing |
| [0085-moving-gray-chart-placeholder.md](0085-moving-gray-chart-placeholder.md) | 0085 — Moving gray chart placeholder and reciprocal presence |
| [0086-provider-traffic-and-graduated-referral-fees.md](0086-provider-traffic-and-graduated-referral-fees.md) | 0086 — Provider traffic and graduated referral fees |

## Task-named foundational records

| File | Recorded subject |
| --- | --- |
| [T04-session-persistence.md](T04-session-persistence.md) | T04 — PostgreSQL and reviewer session foundation |
| [T06-provider-normalization.md](T06-provider-normalization.md) | T06 provider normalization and evidence boundary |
| [T07-comparison-and-fare-evidence.md](T07-comparison-and-fare-evidence.md) | T07 — Comparison identity and explicit fare evidence |
| [T08-ranking-facts-and-suggestions.md](T08-ranking-facts-and-suggestions.md) | T08 — Deterministic ranking and evidence-bound comparisons |
| [T09-durable-search-orchestration.md](T09-durable-search-orchestration.md) | T09 — Durable bounded search orchestration and recovery |
| [T10-date-price-projection-and-cache.md](T10-date-price-projection-and-cache.md) | T10 — date-price projection, evidence, and scoped caching |
| [T11-referral-recheck-and-handoff.md](T11-referral-recheck-and-handoff.md) | T11: Fresh referral evidence and atomic handoff |

The 81 records present in T35 source `d1e052ba` are retained. Decisions0082 through0086
add the hotel-map, general route-label and date-loading corrections, plus the
provider-traffic and graduated referral-fee ruling, as records82 through86; their
proof is tracked separately.
Number gaps and historical duplicate prefixes remain; use the full filename.
The original local search-control working ID 0057 is canonically
[0079](0079-search-request-control.md), distinct from the committed four-control
row decision 0057. Its original untracked working file remains local.
[0080](0080-final-review-and-canonical-release-scope.md) records final review,
source reconciliation and the faster-only automatic advice limitation.

[Decision0093](0093-referral-activity-history.md) completes the explicit reviewer activity-history import, including atomic/idempotent source records, preserved scopes and billing evidence, historical hotel reads and the authorized reviewer handoff.
