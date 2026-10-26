import { fitRouteBounds, wrapLongitude, type ProjectedPoint, type RouteBounds } from '../geo/projection';

export function fitPresentationBounds(paths: readonly (readonly ProjectedPoint[])[]): RouteBounds {
  const tight = fitRouteBounds(paths);
  return { ...tight, width: Math.min(360, Math.max(8, tight.width / 1.3 * 1.65)), height: Math.min(180, Math.max(6, tight.height / 1.3 * 1.65)) };
}
const sameFrame = (a: RouteBounds, b: RouteBounds) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
/** Consumes the shared renderer's elapsed time; never schedules work of its own. */
export function createCameraTransition(initial: RouteBounds, durationMs = 1150) {
  let current = { ...initial }, from = current, target = current, elapsed = durationMs;
  return {
    rebaseLongitude(delta:number) {
      // A fitted region keeps its screen position when geometry adopts a new central meridian.
      // A global overview remains centered so projection seams cannot expose an empty half-world.
      current={...current,x:current.width>=300?0:wrapLongitude(current.x+delta)};
      from=current;target=current;elapsed=durationMs;
      return current;
    },
    setTarget(next: RouteBounds, reducedMotion = false) {
      if (!sameFrame(target, next)) { from = current; target = { ...next }; elapsed = 0; }
      if (reducedMotion) { current = target; elapsed = durationMs; }
      return current;
    },
    sample(deltaMs: number, active: boolean, reducedMotion = false) {
      if (reducedMotion) { current = target; elapsed = durationMs; }
      else if (active && elapsed < durationMs) {
        elapsed = Math.min(durationMs, elapsed + Math.min(50, Math.max(0, deltaMs)));
        const t = elapsed / durationMs;
        const amount = t * t * t * (t * (t * 6 - 15) + 10);
        current = elapsed === durationMs ? target : { x: from.x + (target.x - from.x) * amount, y: from.y + (target.y - from.y) * amount, width: from.width + (target.width - from.width) * amount, height: from.height + (target.height - from.height) * amount };
      }
      return current;
    },
    current: () => current,
  };
}

export function createSceneFrameStore() {
  let value: RouteBounds | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update: (next: RouteBounds) => {
      if (value && sameFrame(value, next)) return;
      value = next; listeners.forEach(listener => listener());
    },
  };
}
export type SceneFrameStore = ReturnType<typeof createSceneFrameStore>;
