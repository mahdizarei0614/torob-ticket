/** Decorative geography movement stays below 1.2 CSS pixels at every map scale. */
export const LIVING_DOT_AMPLITUDE_PX = 1;
export const LIVING_DOT_MAX_OFFSET_PX = Math.hypot(.9, .78);

/** Matches the lattice shader; scope changes snapshot these displayed positions, not a rigid grid. */
export function sampleLivingDotOffset(x: number, y: number, time: number, amplitude = LIVING_DOT_AMPLITUDE_PX): readonly [number, number] {
  const phase = Math.sin(x * 12.9898 + y * 78.233) * Math.PI * 2;
  const strength = Math.max(0, Math.min(LIVING_DOT_AMPLITUDE_PX, amplitude));
  if (strength === 0) return [0, 0];
  return [
    (.7 * Math.sin(time * .27 + phase) + .2 * Math.sin(time * .11 + phase * 1.9)) * strength,
    (.6 * Math.cos(time * .23 + phase * 1.3) + .18 * Math.sin(time * .13 - phase)) * strength,
  ];
}
