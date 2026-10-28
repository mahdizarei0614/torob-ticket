import type { ThemeTransitionRun } from './theme-transition';

export const modePaletteDuration = 760;
/** All authored semantic color tokens, including independently authored shader and haze colors. */
export const paletteColorTokens = [
  '--surface', '--canvas', '--surface-raised', '--surface-subtle', '--text', '--text-muted',
  '--border', '--border-strong', '--disabled-bg', '--disabled-text', '--focus', '--success',
  '--success-bg', '--warning', '--warning-bg', '--danger', '--danger-bg', '--info', '--info-bg',
  '--overlay', '--shadow-color', '--accent', '--accent-hover', '--accent-soft', '--on-accent',
  '--icon', '--icon-active', '--scene-background', '--scene-dot', '--scene-route',
  '--scene-route-muted', '--scene-highlight', '--canvas-haze', '--scene-haze',
  '--scene-haze-secondary', '--scene-edge', '--chart-line', '--chart-grid', '--chart-marker',
  '--price-low', '--price-mid', '--price-high',
] as const;
type PaletteToken = typeof paletteColorTokens[number];
export type Palette = Partial<Record<PaletteToken, string>>;
type Channels = readonly [number, number, number, number];

export function readThemePalette(root: HTMLElement = document.documentElement): Palette {
  const css = getComputedStyle(root);
  return Object.fromEntries(paletteColorTokens.map(token => [token, css.getPropertyValue(token).trim()]));
}
function channels(value: string): Channels | undefined {
  if (/^#[\da-f]{3,8}$/i.test(value)) {
    const source = value.slice(1);
    if (![3, 4, 6, 8].includes(source.length)) return;
    const hex = source.length <= 4 ? [...source].map(part => part + part).join('') : source;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1];
  }
  if (/^rgba?\(/i.test(value)) {
    const parts = value.slice(value.indexOf('(') + 1, -1).split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.every(Number.isFinite)) return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
  }
  return undefined;
}
function blend(from: Channels, to: Channels, progress: number): string {
  const values = from.map((value, index) => value + (to[index]! - value) * progress);
  return `rgba(${values.slice(0, 3).map(value => Number(value.toFixed(3))).join(',')},${Number(values[3]!.toFixed(4))})`;
}

/** A finite palette blend. Every frame publishes the same resolved colors to CSS and the GPU bridge. */
export function runPaletteMorph(nextTheme: () => void, options: {
  from: Palette;
  onFrame: () => void;
  onApplied?: () => Promise<void>;
  isCurrent: () => boolean;
  root?: HTMLElement;
}): ThemeTransitionRun {
  const root = options.root ?? document.documentElement;
  const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  const forced = typeof matchMedia === 'function' ? matchMedia('(forced-colors: active)') : undefined;
  const overrides: { token: PaletteToken; value: string; priority: string; from: Channels; to: Channels }[] = [];
  let frame: number | undefined, settled = false, cancelled = false;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const current = () => !cancelled && options.isCurrent();
  const restore = () => {
    for (const { token, value, priority } of overrides) {
      if (value) root.style.setProperty(token, value, priority); else root.style.removeProperty(token);
    }
    delete root.dataset.paletteTransition;
  };
  const settle = () => {
    if (settled) return;
    settled = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    reduced?.removeEventListener?.('change', environmentChanged);
    forced?.removeEventListener?.('change', environmentChanged);
    document.removeEventListener('visibilitychange', environmentChanged);
    finish();
  };
  const complete = () => {
    if (settled) return;
    restore();
    if (current()) {
      try { options.onFrame(); } catch { settle(); return; }
      void Promise.resolve().then(() => current() ? options.onApplied?.() : undefined).then(settle, settle);
    } else settle();
  };
  const skip = () => { if (settled) return; cancelled = true; restore(); settle(); };
  function environmentChanged() {
    if (reduced?.matches || forced?.matches || document.visibilityState === 'hidden') complete();
  }
  if (!current()) { settle(); return { skip, finished }; }
  try { nextTheme(); } catch { settle(); return { skip, finished }; }
  const target = readThemePalette(root);
  for (const token of paletteColorTokens) {
    const from = channels(options.from[token] ?? ''), to = channels(target[token] ?? '');
    if (from && to && from.some((value, index) => value !== to[index])) overrides.push({ token, from, to, value: root.style.getPropertyValue(token), priority: root.style.getPropertyPriority(token) });
  }
  if (!overrides.length || reduced?.matches || forced?.matches || document.visibilityState === 'hidden' || typeof requestAnimationFrame !== 'function') {
    complete(); return { skip, finished };
  }
  root.dataset.paletteTransition = 'morph';
  const write = (progress: number) => {
    for (const entry of overrides) root.style.setProperty(entry.token, blend(entry.from, entry.to, progress));
    options.onFrame();
  };
  try { write(0); } catch { skip(); return { skip, finished }; }
  reduced?.addEventListener?.('change', environmentChanged);
  forced?.addEventListener?.('change', environmentChanged);
  document.addEventListener('visibilitychange', environmentChanged);
  const start = performance.now();
  const advance = (time: number) => {
    if (!current()) { skip(); return; }
    const progress = Math.min(1, Math.max(0, (time - start) / modePaletteDuration));
    if (progress >= 1) { complete(); return; }
    try { write(progress * progress * (3 - 2 * progress)); } catch { skip(); return; }
    frame = requestAnimationFrame(advance);
  };
  frame = requestAnimationFrame(advance);
  return { skip, finished };
}
