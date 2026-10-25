export interface RenderPolicy { active: boolean; motion: boolean; reducedMotion: boolean }
export interface FrameClock { request: (callback: FrameRequestCallback) => number; cancel: (id: number) => void; now: () => number }
/** The only application RAF owner. Idle changes coalesce; no measurement-only frames. */
export function createRenderScheduler(render: (time: number) => void, clock: FrameClock = { request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id), now: () => performance.now() }) {
  let policy: RenderPolicy = { active: true, motion: false, reducedMotion: false };
  let pending: number | undefined;
  let disposed = false;
  const cancel = () => { if (pending !== undefined) clock.cancel(pending); pending = undefined; };
  const draw = (time: number) => {
    pending = undefined;
    if (disposed || !policy.active) return;
    render(time);
    if (policy.motion && !policy.reducedMotion) invalidate();
  };
  const invalidate = () => {
    if (!disposed && policy.active && pending === undefined) pending = clock.request(draw);
  };
  return {
    invalidate,
    flush() { cancel(); draw(clock.now()); },
    setPolicy(next: RenderPolicy) { policy = next; if (policy.active) invalidate(); else cancel(); },
    dispose() { disposed = true; cancel(); },
  };
}
export type RenderScheduler = ReturnType<typeof createRenderScheduler>;
