import type { ProjectionContext, RouteBounds } from '../geo/projection';
import { DOMESTIC_DOT_BASE_SPACING, INTERNATIONAL_DOT_BASE_SPACING, worldDotWeights } from '../geo/world-context';
import { sampleLivingDotOffset } from './living-dot-drift';

export const SCOPE_MORPH_PARTICLE_LIMIT = 1800;
export const SCOPE_MORPH_DURATION_MS = 1700;
export interface MorphDot { x: number; y: number; opacity: number }
export interface MorphParticle { from: MorphDot; to: MorphDot; seed: number }
export interface MorphLand { positions: ArrayLike<number>; context: ProjectionContext; domestic: boolean; frame: RouteBounds; width: number; motion?: { seconds: number; amplitudePx: number } }
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const random = (index: number) => { const value = Math.sin(index * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };

/** Snapshot visible lattice centers only when scope changes. Triangle row buckets bound the land lookup. */
export function snapshotLandDots({ positions, context, domestic, frame, width, motion }: MorphLand): MorphDot[] {
  const base = domestic ? DOMESTIC_DOT_BASE_SPACING : INTERNATIONAL_DOT_BASE_SPACING;
  const ratio = domestic ? 2 : 4, weights = worldDotWeights(frame.width / Math.max(1, width), base, ratio);
  const left = Math.max(-180, frame.x - frame.width / 2), right = Math.min(180, frame.x + frame.width / 2);
  const bottom = Math.max(-90, frame.y - frame.height / 2), top = Math.min(90, frame.y + frame.height / 2);
  if (right <= left || top <= bottom) return [];
  const rows: number[][] = Array.from({ length: 32 }, () => []);
  const bucket = (y: number) => Math.max(0, Math.min(31, Math.floor((y - bottom) / (top - bottom) * 32)));
  for (let i = 0; i < positions.length; i += 9) {
    const minX = Math.min(positions[i]!, positions[i + 3]!, positions[i + 6]!);
    const maxX = Math.max(positions[i]!, positions[i + 3]!, positions[i + 6]!);
    const minY = Math.min(positions[i + 1]!, positions[i + 4]!, positions[i + 7]!);
    const maxY = Math.max(positions[i + 1]!, positions[i + 4]!, positions[i + 7]!);
    if (maxX < left || minX > right || maxY < bottom || minY > top) continue;
    if (Math.abs((positions[i + 3]! - positions[i]!) * (positions[i + 7]! - positions[i + 1]!) - (positions[i + 4]! - positions[i + 1]!) * (positions[i + 6]! - positions[i]!)) < .00000001) continue;
    for (let row = bucket(minY); row <= bucket(maxY); row++) rows[row]!.push(i);
  }
  const land = (x: number, y: number) => rows[bucket(y)]!.some(i => {
    const ax = positions[i]!, ay = positions[i + 1]!, bx = positions[i + 3]!, by = positions[i + 4]!, cx = positions[i + 6]!, cy = positions[i + 7]!;
    const a = (x - bx) * (ay - by) - (ax - bx) * (y - by), b = (x - cx) * (by - cy) - (bx - cx) * (y - cy), c = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
    return !((a < 0 || b < 0 || c < 0) && (a > 0 || b > 0 || c > 0));
  });
  const points = new Map<string, MorphDot>();
  let candidates = 0;
  weights.forEach((weight, level) => {
    if (weight < .01) return;
    const spacing = base / ratio ** level;
    const ox = (domestic ? 44 : -179) - context.centralLongitude, oy = domestic ? 25 : -59;
    const cols = Math.ceil((right - left) / spacing), rowCount = Math.ceil((top - bottom) / spacing);
    // Very large viewports retain a deterministic representative sample, never unbounded work.
    const stride = Math.max(1, Math.ceil(Math.sqrt(cols * rowCount / 24000)));
    const firstX = Math.ceil((left - ox) / spacing), firstY = Math.ceil((bottom - oy) / spacing);
    for (let row = firstY; oy + row * spacing <= top; row += stride) {
      const y = oy + row * spacing;
      for (let col = firstX; ox + col * spacing <= right; col += stride) {
        if (++candidates > 48000) return;
        const x = ox + col * spacing;
        if (!land(x, y)) continue;
        const key = `${x.toFixed(5)}:${y.toFixed(5)}`;
        const old = points.get(key);
        if (old) old.opacity = Math.min(1, old.opacity + weight);
        else {
          const drift = motion ? sampleLivingDotOffset(x + context.centralLongitude, y, motion.seconds, motion.amplitudePx) : [0, 0];
          const unit = frame.width / Math.max(1, width);
          points.set(key, { x: (x + drift[0]! * unit - frame.x) / frame.width * 2, y: (y + drift[1]! * unit - frame.y) / frame.height * 2, opacity: weight });
        }
      }
    }
  });
  const values = [...points.values()];
  // Evenly spread the capped sample through the existing grid; no geographic recomputation per frame.
  return values.length <= SCOPE_MORPH_PARTICLE_LIMIT ? values : Array.from({ length: SCOPE_MORPH_PARTICLE_LIMIT }, (_, i) => values[Math.floor(i * values.length / SCOPE_MORPH_PARTICLE_LIMIT)]!);
}

export function sampleMorphParticle(particle: MorphParticle, progress: number): MorphDot {
  const t = smooth(progress), drift = Math.sin(Math.PI * t) * (.12 + particle.seed * .24);
  const angle = particle.seed * Math.PI * 8;
  return { x: particle.from.x + (particle.to.x - particle.from.x) * t + Math.cos(angle) * drift, y: particle.from.y + (particle.to.y - particle.from.y) * t + Math.sin(angle) * drift, opacity: particle.from.opacity + (particle.to.opacity - particle.from.opacity) * t };
}
export const scopeMorphLandOpacity = (progress: number) => smooth((progress - .76) / .24);

/** Interruption snapshots the actual current particle positions, then gathers toward the latest scope. */
export function createScopeMorph() {
  let particles: MorphParticle[] = [], elapsed = SCOPE_MORPH_DURATION_MS;
  return {
    start(source: readonly MorphDot[], target: readonly MorphDot[]) {
      const ordered = target.map((dot, index) => ({ dot, rank: random(index) })).sort((a, b) => a.rank - b.rank).map(item => item.dot);
      const count = Math.min(SCOPE_MORPH_PARTICLE_LIMIT, Math.max(source.length, target.length));
      particles = Array.from({ length: count }, (_, index) => {
        const from = source[index] ?? { ...(source[index % Math.max(1, source.length)] ?? ordered[index % Math.max(1, ordered.length)] ?? { x: 0, y: 0 }), opacity: 0 };
        const to = ordered[index] ?? { ...(ordered[index % Math.max(1, ordered.length)] ?? from), opacity: 0 };
        return { from, to, seed: random(index + 13) };
      });
      elapsed = particles.length ? 0 : SCOPE_MORPH_DURATION_MS;
      return particles;
    },
    advance(deltaMs: number, active: boolean, reducedMotion: boolean) {
      if (reducedMotion) elapsed = SCOPE_MORPH_DURATION_MS;
      else if (active) elapsed = Math.min(SCOPE_MORPH_DURATION_MS, elapsed + Math.max(0, Math.min(50, deltaMs)));
      return elapsed / SCOPE_MORPH_DURATION_MS;
    },
    snapshot: () => particles.map(particle => sampleMorphParticle(particle, elapsed / SCOPE_MORPH_DURATION_MS)),
    active: () => elapsed < SCOPE_MORPH_DURATION_MS,
    progress: () => elapsed / SCOPE_MORPH_DURATION_MS,
  };
}
