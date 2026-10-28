/** Smooth wandering remains local to each geographic anchor, without a looping path. */
export const LIVING_DOT_AMPLITUDE_PX = 9;
export const LIVING_DOT_MAX_OFFSET_PX = LIVING_DOT_AMPLITUDE_PX;
const AXIS_SCALE = Math.SQRT1_2;
const hash = (value: number) => {
  let n = Math.imul(value ^ value >>> 16, 0x7feb352d);
  n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
};
const seedFor = (x: number, y: number) => hash((Math.floor(x * 128 + .5) >>> 0) ^ hash((Math.floor(y * 128 + .5) + 0x9e3779b9) >>> 0));
const smooth = (a: number, b: number, value: number) => { const t=Math.max(0,Math.min(1,(value-a)/(b-a))); return t*t*(3-2*t); };

/** Staggered six-to-ten-second lives keep the silhouette visible while individual dots come and go. */
export function sampleLivingDotOpacity(x: number, y: number, time: number, amplitude = LIVING_DOT_AMPLITUDE_PX) {
  if (amplitude <= 0) return 1;
  const seed=seedFor(x,y);
  const age=time/(6.5+3.5*(seed&65535)/65535)+(hash(seed^0x68bc21eb)&65535)/65535;
  const phase=age-Math.floor(age);
  return smooth(0,.18,phase)*(1-smooth(.68,.94,phase));
}

/** Keeps a complete moving core inside the bounded five-cell neighborhood at extreme zoom-out. */
export const livingDotAmplitudeForSpacing = (spacingPx: number, requested = LIVING_DOT_AMPLITUDE_PX) => Math.max(0, Math.min(requested, LIVING_DOT_AMPLITUDE_PX, (spacingPx * 2.5 - 2) / AXIS_SCALE));

/** Matches the lattice shader; scope changes snapshot these displayed positions, not a rigid grid. */
export function sampleLivingDotOffset(x: number, y: number, time: number, amplitude = LIVING_DOT_AMPLITUDE_PX): readonly [number, number] {
  const seed = seedFor(x,y);
  const strength = Math.max(0, Math.min(LIVING_DOT_AMPLITUDE_PX, amplitude));
  if (strength === 0 || time <= 0) return [0, 0];
  const t = Math.min(1, Math.max(0, time / .9));
  const onset = t * t * (3 - 2 * t);
  const clock = time * (.72 + .32 * (seed & 65535) / 65535) + (seed >>> 16) / 65535 * 32;
  const step = Math.floor(clock), f = clock - step, f2 = f * f, f3 = f2 * f;
  const weights = [(1 - f) ** 3 / 6, (3 * f3 - 6 * f2 + 4) / 6, (-3 * f3 + 3 * f2 + 3 * f + 1) / 6, f3 / 6];
  let dx = 0, dy = 0;
  for (let i = 0; i < 4; i++) {
    const point = hash(seed ^ Math.imul(step + i - 1, 0x9e3779b9));
    dx += ((point & 65535) / 65535 * 2 - 1) * weights[i]!;
    dy += ((point >>> 16) / 65535 * 2 - 1) * weights[i]!;
  }
  return [dx * AXIS_SCALE * strength * onset, dy * AXIS_SCALE * strength * onset];
}
