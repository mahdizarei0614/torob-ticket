import type { ProjectionContext, RouteBounds } from '../geo/projection';
import { DOMESTIC_DOT_BASE_SPACING, INTERNATIONAL_DOT_BASE_SPACING, worldDotWeights } from '../geo/world-context';
import { sampleParticleFlowOffset, type ParticleFlowSnapshot } from './particle-flow-sampling';
import { sampleLivingDotOffset, sampleLivingDotOpacity, livingDotAmplitudeForSpacing } from './living-dot-drift';

export const SCOPE_MORPH_PARTICLE_LIMIT = 1800;
export const SCOPE_MORPH_DURATION_MS = 2000;
export interface LiveMorphDot { anchorX: number; anchorY: number; amplitudePx: number; spacingPx: number; spacingWorld: number; baseX: number; baseY: number; opacity: number; residualSeconds?: number }
export interface MorphDot { x: number; y: number; opacity: number; arrivalSeed?: number; live?: LiveMorphDot }
export interface MorphMotion { seconds: number; width: number; height: number; unit: number; centralLongitude: number; frame?: RouteBounds; flow?: ParticleFlowSnapshot }
export interface MorphParticle { from: MorphDot; to: MorphDot; seed: number }
export interface MorphLand { positions: ArrayLike<number>; context: ProjectionContext; domestic: boolean; frame: RouteBounds; width: number; morphProgress?: number; motion?: { seconds: number; amplitudePx: number; flow?: ParticleFlowSnapshot } }
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const random = (index: number) => { const value = Math.sin(index * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };

const timingHash = (value: number) => {
  let n = Math.imul(value ^ value >>> 16, 0x7feb352d);
  n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
};
/** Integer anchor hash matches GLSL, so a dot and its arriving particle share one handoff. */
export function scopeMorphSeed(x: number, y: number) {
  return (timingHash((Math.floor(x * 128 + .5) >>> 0) ^ timingHash((Math.floor(y * 128 + .5) + 0x9e3779b9) >>> 0)) & 65535) / 65535;
}
export function scopeMorphTiming(seed: number) {
  // A second integer hash avoids discontinuous fract boundaries under float32 GLSL.
  const variation = (timingHash(Math.round(seed * 65535) ^ 0x51ed270b) & 65535) / 65535;
  return { delay: 0, duration: .54 + .32 * variation };
}
export function scopeMorphParticleProgress(progress: number, seed: number) {
  const { delay, duration } = scopeMorphTiming(seed);
  return smooth((progress - delay) / duration);
}
/** A per-dot landing envelope replaces the old synchronized whole-map fade. */
export function scopeMorphLandOpacity(progress: number, seed: number) {
  const { delay, duration } = scopeMorphTiming(seed);
  return smooth((progress - delay - duration) / .12);
}

/** Snapshot visible lattice centers only when scope changes. Triangle row buckets bound the land lookup. */
export function snapshotLandDots({ positions, context, domestic, frame, width, motion, morphProgress = 1 }: MorphLand): MorphDot[] {
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
        const unit = frame.width / Math.max(1, width);
        const amplitude = motion ? livingDotAmplitudeForSpacing(spacing / unit, motion.amplitudePx) : 0;
        const arrivalSeed = scopeMorphSeed(x + context.centralLongitude, y);
        const opacity = weight * scopeMorphLandOpacity(morphProgress, arrivalSeed) * (motion ? sampleLivingDotOpacity(x + context.centralLongitude,y,motion.seconds,amplitude) : 1);
        const old = points.get(key);
        if (old) { old.opacity = Math.min(1, old.opacity + opacity); if(old.live)old.live.opacity = Math.min(1,old.live.opacity+weight*scopeMorphLandOpacity(morphProgress,arrivalSeed)); }
        else {
          const drift = motion ? sampleLivingDotOffset(x + context.centralLongitude, y, motion.seconds,amplitude) : [0, 0];
          const repel = sampleParticleFlowOffset(x+context.centralLongitude,y,unit,amplitude,spacing/unit,drift,motion?.flow);
          const baseX=(x-frame.x)/frame.width*2, baseY=(y-frame.y)/frame.height*2;
          points.set(key, { x: baseX+(drift[0]!+repel[0]!)*unit/frame.width*2, y: baseY+(drift[1]!+repel[1]!)*unit/frame.height*2, opacity, arrivalSeed,
            ...(motion&&motion.amplitudePx>0?{live:{anchorX:x+context.centralLongitude,anchorY:y,amplitudePx:amplitude,spacingPx:spacing/unit,spacingWorld:spacing,baseX,baseY,opacity:weight*scopeMorphLandOpacity(morphProgress,arrivalSeed)}}:{}) });
        }
      }
    }
  });
  const values = [...points.values()];
  // Evenly spread the capped sample through the existing grid; no geographic recomputation per frame.
  return values.length <= SCOPE_MORPH_PARTICLE_LIMIT ? values : Array.from({ length: SCOPE_MORPH_PARTICLE_LIMIT }, (_, i) => values[Math.floor(i * values.length / SCOPE_MORPH_PARTICLE_LIMIT)]!);
}

/** The endpoint remains in the live field. A zero-slope blend weight joins its
 * velocity as well as position; neither the field nor the endpoint pauses. */
export function sampleLiveMorphDot(point: MorphDot, motion?: MorphMotion, target = true): MorphDot {
  if (!motion || !point.live) return point;
  const live=point.live;
  if(live.residualSeconds!==undefined){
    const before=sampleLivingDotOffset(live.anchorX,live.anchorY,live.residualSeconds,live.amplitudePx),now=sampleLivingDotOffset(live.anchorX,live.anchorY,motion.seconds,live.amplitudePx);
    return {...point,x:live.baseX+(now[0]-before[0])*.65*2/motion.width,y:live.baseY+(now[1]-before[1])*.65*2/motion.height,opacity:live.opacity};
  }
  const spacingPx=target?live.spacingWorld/motion.unit:live.spacingPx;
  const amplitude=target?livingDotAmplitudeForSpacing(spacingPx):live.amplitudePx;
  const drift=sampleLivingDotOffset(live.anchorX,live.anchorY,motion.seconds,amplitude);
  const frame=motion.frame;
  const baseX=target&&frame?(live.anchorX-motion.centralLongitude-frame.x)/frame.width*2:live.baseX;
  const baseY=target&&frame?(live.anchorY-frame.y)/frame.height*2:live.baseY;
  const repel=sampleParticleFlowOffset(live.anchorX,live.anchorY,motion.unit,amplitude,spacingPx,drift,motion.flow);
  return {...point,x:baseX+(drift[0]!+repel[0]!)*2/motion.width,y:baseY+(drift[1]!+repel[1]!)*2/motion.height,opacity:live.opacity*sampleLivingDotOpacity(live.anchorX,live.anchorY,motion.seconds,amplitude)};
}
export function sampleMorphParticle(particle: MorphParticle, progress: number, motion?: MorphMotion): MorphDot {
  const t = scopeMorphParticleProgress(progress, particle.seed), drift = Math.sin(Math.PI * t) * (.12 + particle.seed * .24);
  const angle = particle.seed * Math.PI * 8;
  const from=sampleLiveMorphDot(particle.from,motion,false),to=sampleLiveMorphDot(particle.to,motion,true);
  // Samples of an in-flight blend are already visible positions. Do not retain
  // either endpoint's anchor when a later interruption takes this as its source.
  const metadata={...(progress>=1?particle.to:particle.from)};
  delete metadata.live;
  return { ...metadata, x: from.x + (to.x - from.x) * t + Math.cos(angle) * drift, y: from.y + (to.y - from.y) * t + Math.sin(angle) * drift, opacity: from.opacity + (to.opacity - from.opacity) * t };
}
export function sampleVisibleMorphParticle(particle: MorphParticle, progress: number, motion?: MorphMotion): MorphDot {
  const point = sampleMorphParticle(particle, progress,motion);
  return { ...point, opacity: point.opacity * (1 - scopeMorphLandOpacity(progress, particle.seed)) };
}

/** Freeze every visible source in screen space before a new projection/flow
 * scale can reinterpret its offset; only its small wander residual stays live. */
export function captureMorphSources(points:readonly MorphDot[],seconds:number):MorphDot[]{
  return points.map(point=>point.live?{...point,live:{...point.live,baseX:point.x,baseY:point.y,opacity:point.opacity,residualSeconds:seconds}}:point);
}

/** Interruption snapshots the actual current particle positions, then gathers toward the latest scope. */
export function createScopeMorph() {
  let particles: MorphParticle[] = [], elapsed = SCOPE_MORPH_DURATION_MS;
  return {
    start(source: readonly MorphDot[], target: readonly MorphDot[]) {
      const ordered = target.map((dot, index) => ({ dot, rank: random(index) })).sort((a, b) => a.rank - b.rank).map(item => item.dot);
      const count = Math.min(SCOPE_MORPH_PARTICLE_LIMIT, Math.max(source.length, target.length));
      particles = Array.from({ length: count }, (_, index) => {
        const from = source[index] ?? { ...(source[index % Math.max(1, source.length)] ?? ordered[index % Math.max(1, ordered.length)] ?? { x: 0, y: 0 }), opacity: 0, live: undefined };
        const to = ordered[index] ?? { ...(ordered[index % Math.max(1, ordered.length)] ?? from), opacity: 0, live: undefined };
        return { from, to, seed: to.arrivalSeed ?? random(index + 13) };
      });
      elapsed = particles.length ? 0 : SCOPE_MORPH_DURATION_MS;
      return particles;
    },
    advance(deltaMs: number, active: boolean, reducedMotion: boolean) {
      if (reducedMotion) elapsed = SCOPE_MORPH_DURATION_MS;
      else if (active) elapsed = Math.min(SCOPE_MORPH_DURATION_MS, elapsed + Math.max(0, Math.min(50, deltaMs)));
      return elapsed / SCOPE_MORPH_DURATION_MS;
    },
    snapshot: (motion?: MorphMotion) => particles.map(particle => {
      const point=sampleVisibleMorphParticle(particle,elapsed/SCOPE_MORPH_DURATION_MS,motion);
      const anchor=particle.to.live??particle.from.live;
      // An interrupted path has no single geographic trajectory to preserve.
      // Keep its actual visible point, then add only a small live wander delta.
      // This prevents the stagger delay from holding it perfectly still.
      if(motion&&anchor)point.live={...anchor,baseX:point.x,baseY:point.y,opacity:point.opacity,residualSeconds:motion.seconds};
      return point;
    }),
    active: () => elapsed < SCOPE_MORPH_DURATION_MS,
    progress: () => elapsed / SCOPE_MORPH_DURATION_MS,
  };
}
