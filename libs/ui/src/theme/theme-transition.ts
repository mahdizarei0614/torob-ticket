export interface ThemeTransitionOptions {
  onApplied?: () => Promise<void>;
  origin?: HTMLElement;
  isCurrent?: () => boolean;
  animate?: boolean;
}
export interface ThemeTransitionRun { skip: () => void; finished: Promise<void> }
/** The callback owns the atomic update; applications can supply an independent graphics flush. */
export function runThemeTransition(nextTheme: () => void, options: ThemeTransitionOptions = {}): ThemeTransitionRun {
  let cancelled = false, settled = false, failed = false, revealSkipped = false;
  let transition: Pick<ViewTransition, 'ready' | 'finished' | 'skipTransition'> | undefined, animation: Animation | undefined;
  let application: Promise<void> | undefined;
  let finish!: () => void, applied!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const appliedFrame = new Promise<void>(resolve => { applied = resolve; });
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  const current = () => !cancelled && options.isCurrent?.() !== false;
  const settle = () => {
    if (settled) return;
    settled = true;
    media?.removeEventListener?.('change', motionChanged);
    finish();
  };
  const skip = () => {
    if (cancelled) return;
    cancelled = true;
    transition?.skipTransition();
    animation?.cancel();
    applied();
    settle();
  };
  const apply = (): Promise<void> => {
    if (application) return application;
    if (!current()) { applied(); return Promise.resolve(); }
    application = (async () => {
      try { nextTheme(); if (current()) await options.onApplied?.(); }
      catch { failed = true; transition?.skipTransition(); }
      finally { applied(); }
    })();
    return application;
  };
  function motionChanged() {
    if (!media?.matches) return;
    // Reducing motion settles the requested theme; superseding ownership instead cancels it.
    revealSkipped = true;
    transition?.skipTransition();
    animation?.cancel();
    void apply().then(settle, settle);
  }
  if (!current()) { settle(); return { skip, finished }; }
  if (typeof document === 'undefined' || !document.startViewTransition || media?.matches || options.animate === false) {
    void apply().then(settle, settle);
    return { skip, finished };
  }
  media?.addEventListener?.('change', motionChanged);
  try { transition = document.startViewTransition(apply); }
  catch { void apply().then(settle, settle); return { skip, finished }; }
  const nativeFinished = Promise.resolve(transition.finished).catch(() => undefined);
  void transition.ready.then(async () => {
    await appliedFrame;
    if (!current() || failed || revealSkipped) return;
    const rect = options.origin?.getBoundingClientRect();
    const width = typeof innerWidth === 'number' ? innerWidth : 0, height = typeof innerHeight === 'number' ? innerHeight : 0;
    const x = rect ? rect.left + rect.width / 2 : width / 2, y = rect ? rect.top + rect.height / 2 : height / 2;
    const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    animation = document.documentElement.animate?.(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 260, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' },
    );
    await animation?.finished.catch(() => undefined);
    await nativeFinished;
  }, async () => { if (current()) await apply(); }).then(settle, settle);
  return { skip, finished };
}
