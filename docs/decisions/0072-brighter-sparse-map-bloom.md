# 0072 — Brighter light around sparse map particles

2026-11-01. Owner requests brighter bloom, especially on Iran and zoomed maps
where fewer visible dots make the existing effect hard to perceive.

The regular dots already retain their CSS size across zoom. Their dim semantic
RGB is attenuated by opacity/lifetime and density crossfades before luminance
extraction. The old .025 threshold plus .04 smoothing suppresses much of that
light; subsequent blur and .22 dark composition leave weak isolated halos.
Actual enabled effect draws alone do not demonstrate a perceptible result.

Use stronger, bounded extraction/composition with the existing pmndrs effect:

- Dark: intensity .45, luminance threshold .008 and smoothing .018.
- Light: intensity .16, threshold .025 and smoothing .04.
- Retain the .5 intensity cap. Clamp smoothing to .001–.25 so the extraction
  interval stays finite and non-degenerate, including invalid/missing CSS input.
- Use three mip levels with radius .4. This narrows the faint far halo and
  removes one down/up pair; the brightness improvement principally comes from
  extraction and composition. Live appearance updates change the existing
  material and strength without reallocating its source/effect.

Keep ordinary dot colors/cores/opacity caps, floating/lifetime/fluid behavior,
point counts, density changes and zoom geometry unchanged. Page backgrounds,
primary colors and transport palettes stay intact. Country/province lines retain
their existing geometry/style; their stronger soft light remains thin and
restrained in the reviewed captures. No extra per-border/source machinery,
renderer, scheduler, dependency or capability bypass is introduced.

Decision0066 remains authoritative for real device qualification, CPU/GPU and
cadence budgets, active-time recovery, bounded targets and graceful fallback.
Preserve viewport/scissor/output restoration, map edge transparency, chart/DOM
isolation and vehicle foreground. Coverage, reduced motion and mobile omission
pause actual composites; restoring them resumes through the existing policy.

Four baseline/candidate Iran/world overview/zoom cases use genuinely qualified
same-frame pre/post-composite readbacks. Compare sampled 2–6 CSS-pixel halo rings
around isolated blue local peaks, with images and unchanged ordinary shaders.
The two versions have separate live-particle phases and the heuristic may include
border joints; these are sampled emitted-light contributions, not a universal
perceptual multiplier or a full semantic geography maximum. Separate route/zoom
performance windows use no synchronous pixel readback or CPU profiler. Include
Retina, live theme uniforms, foreground and policy evidence.

Evidence lives in docs/evidence/adjustments/sparse-map-bloom. Preserve foreign
token/branding/search/infra/master work using a scoped token/master projection.
No reset, rebuild, push, deploy or market release. M7 remains partial29/35,
T30active; specification1.42 records this refinement.
