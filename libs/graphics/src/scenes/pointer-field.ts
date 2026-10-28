import { livingDotSeed } from './living-dot-drift';
import type { TrailPointer } from './pointer-trail';

export const POINTER_REPULSION_PX = 12;
export const POINTER_REPULSION_RADIUS_PX = 110;
/** A broad, quiet response independent of the smaller illumination trail. */
export const pointerRepulsionRadiusPx = (width: number, height: number) => Math.max(0,Math.min(POINTER_REPULSION_RADIUS_PX,width*.2,height*.22));
export type PointerField = readonly [number, number, number, number];
/** One soft live cursor; trailing illumination remains a separate bounded history. */
export function createPointerField() {
  const uniforms = new Float32Array(4);
  let initialized = false;
  return {
    uniforms,
    clear() { uniforms.fill(0); initialized = false; },
    advance(deltaMs: number, pointer: TrailPointer | undefined, radius: number, options: { active: boolean; reducedMotion: boolean }) {
      if (options.reducedMotion) { this.clear(); return uniforms; }
      if (!options.active) return uniforms;
      const dt = Math.max(0, Math.min(50, deltaMs));
      const present = !!pointer?.active && Number.isFinite(pointer.x) && Number.isFinite(pointer.y) && radius > 0;
      if (present) {
        if (!initialized || uniforms[3]! < .001) { uniforms[0] = pointer!.x; uniforms[1] = pointer!.y; initialized = true; }
        const follow = 1 - Math.exp(-dt / 85);
        uniforms[0] = uniforms[0]! + (pointer!.x - uniforms[0]!) * follow;
        uniforms[1] = uniforms[1]! + (pointer!.y - uniforms[1]!) * follow;
        uniforms[2] = radius;
      }
      uniforms[3] = uniforms[3]! + ((present ? 1 : 0) - uniforms[3]!) * (1 - Math.exp(-dt / (present ? 180 : 480)));
      return uniforms;
    },
  };
}
/** CSS-pixel displacement, shared exactly with dot-pointer-field.glsl. */
export function samplePointerRepulsion(x: number, y: number, unit: number, centralLongitude: number, amplitude: number, spacingPx: number, field: ArrayLike<number>, drift: readonly number[] = [0,0], seedAnchor: readonly number[] = [x,y]): readonly [number, number] {
  const strength = field[3] ?? 0, radius = (field[2] ?? 0) / unit;
  const budget = Math.max(0, Math.min(POINTER_REPULSION_PX, spacingPx * 2.5 - 2 - amplitude * Math.SQRT1_2));
  if (strength <= .0001 || radius <= 0 || budget <= 0) return [0, 0];
  const dx = (x - centralLongitude - field[0]!) / unit + drift[0]!, dy = (y - field[1]!) / unit + drift[1]!;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return [0, 0];
  const t = Math.min(1, distance / radius), falloff = 1 - t * t * (3 - 2 * t);
  // Geographic fallback is stable even directly beneath the pointer. Its weight
  // vanishes smoothly outside the subpixel center instead of flipping direction.
  const angle = (livingDotSeed(seedAnchor[0]!, seedAnchor[1]!) & 65535) / 65535 * Math.PI * 2;
  const fallback = Math.exp(-distance * distance * 4) * .35;
  const vx = dx + Math.cos(angle) * fallback, vy = dy + Math.sin(angle) * fallback;
  const length = Math.sqrt(vx*vx+vy*vy+.35*.35);
  return [vx / length * budget * strength * falloff, vy / length * budget * strength * falloff];
}
