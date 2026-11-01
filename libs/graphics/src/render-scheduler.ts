export interface RenderPolicy { active: boolean; motion: boolean; reducedMotion: boolean }
export interface FrameClock { request: (callback: FrameRequestCallback) => number; cancel: (id: number) => void; now: () => number }
/** The only application RAF owner. Idle changes coalesce; no measurement-only frames. */
export function createRenderScheduler(render: (time: number) => void, clock: FrameClock = { request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id), now: () => performance.now() }, readReducedMotion?: () => boolean) {
  let policy: RenderPolicy = { active: true, motion: false, reducedMotion: false };
  let pending: number | undefined;
  let disposed = false;
  let drawing = false;
  const cancel = () => { if (pending !== undefined) clock.cancel(pending); pending = undefined; };
  const draw = (time: number) => {
    pending = undefined;
    // Native media-change delivery may lag or be missed. An already scheduled
    // frame must honor the live preference before it decides whether to repeat.
    if (readReducedMotion) policy = { ...policy, reducedMotion: readReducedMotion() };
    if (disposed || !policy.active) return;
    drawing = true;
    try { render(time); } finally { drawing = false; }
    if (policy.motion && !policy.reducedMotion) invalidate();
  };
  const invalidate = () => {
    if (!disposed && policy.active && pending === undefined) pending = clock.request(draw);
  };
  return {
    invalidate,
    // Ordinary reconciler commits and imperative scene changes get one frame. A
    // useFrame callback cannot turn that bridge into motion the host did not permit.
    invalidateScene() {
      if (drawing && (!policy.motion || policy.reducedMotion)) return;
      invalidate();
    },
    flush() { cancel(); draw(clock.now()); },
    setPolicy(next: RenderPolicy) { policy = next; if (policy.active) invalidate(); else cancel(); },
    dispose() { disposed = true; cancel(); },
  };
}
export type RenderScheduler = ReturnType<typeof createRenderScheduler>;
