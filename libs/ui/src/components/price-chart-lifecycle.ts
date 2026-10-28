import { useLayoutEffect, useMemo, useState } from 'react';
import { animate } from 'motion';
import type { DatePriceCell } from '@torob-ticket/contracts';
import type { PriceRange } from './price-band';
import { priceChartGeometry, priceChartPresentation, type PriceChartCurvePoint, type PriceChartGeometry, type PriceChartPoint } from './price-chart-geometry';

export type PriceChartPhase = 'empty' | 'entering' | 'reshaping' | 'exiting' | 'settled';
export interface PriceChartVisualPoint extends PriceChartPoint { opacity: number }
export interface PriceChartFrame {
  points: readonly PriceChartVisualPoint[]; paths: readonly (readonly PriceChartCurvePoint[])[]; runs: readonly (readonly PriceChartPoint[])[];
  edgeOpacity: readonly (readonly number[])[];
  min: number; max: number; phase: PriceChartPhase; reveal: number; opacity: number; morphProgress: number; startX: number; endX: number;
}
export type ChartLifecycleTween = (durationMs: number, update: (progress: number) => void, complete: () => void) => { stop: () => void };
const tween: ChartLifecycleTween = (durationMs, onUpdate, onComplete) => animate(0, 1, { duration: durationMs / 1000, ease: [.22, .68, .24, 1], onUpdate, onComplete });
const empty = (): PriceChartFrame => ({ points: [], paths: [], runs: [], edgeOpacity: [], min: 0, max: 0, phase: 'empty', reveal: 0, opacity: 0, morphProgress: 1, startX: -.9, endX: .9 });
const day = (date: string) => Date.parse(date + 'T00:00:00Z') / 86400000;
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function settled(geometry: PriceChartGeometry): PriceChartFrame {
  if (!geometry.points.length) return empty();
  return { ...geometry, edgeOpacity: geometry.paths.map(path => Array(Math.max(0, path.length - 1)).fill(1)), points: geometry.points.map(point => ({ ...point, opacity: 1 })), phase: 'settled', reveal: 1, opacity: 1, morphProgress: 1, startX: geometry.points[0]!.x, endX: geometry.points.at(-1)!.x };
}
/** A displayed coordinate/opacity only; the target cell remains the sole owner of date/price facts. */
function displayedAt(frame: PriceChartFrame, datePosition: number, fallback: PriceChartCurvePoint): PriceChartCurvePoint & { opacity: number } {
  for (let index = 0; index < frame.runs.length; index++) {
    const run = frame.runs[index]!, start = day(run[0]!.date), end = day(run.at(-1)!.date), samples = frame.paths[index]!;
    if (datePosition < start || datePosition > end || !samples.length) continue;
    const raw = Math.min(samples.length - 1, Math.max(0, (datePosition - start) * 12)), nearest = Math.round(raw);
    // Fractional calendar days have a large epoch offset; recover exact existing sample indices.
    const at = Math.abs(raw - nearest) < 1e-7 ? nearest : raw, first = Math.floor(at), last = Math.min(samples.length - 1, first + 1), progress = at - first;
    const a = samples[first]!, b = samples[last]!;
    return { x: mix(a.x, b.x, progress), y: mix(a.y, b.y, progress), opacity: 1 };
  }
  const nearest = [...frame.points].sort((a, b) => Math.abs(day(a.date) - datePosition) - Math.abs(day(b.date) - datePosition))[0];
  return nearest ? { x: nearest.x, y: nearest.y, opacity: 0 } : { ...fallback, opacity: 0 };
}
/** A new daily edge has no visible predecessor; an interrupted existing edge keeps its displayed opacity. */
function displayedEdgeOpacity(frame: PriceChartFrame, leftDay: number, sample: number): number {
  for (let index = 0; index < frame.runs.length; index++) {
    const run = frame.runs[index]!, first = day(run[0]!.date), last = day(run.at(-1)!.date);
    if (leftDay >= first && leftDay + 1 <= last) return frame.edgeOpacity[index]?.[(leftDay - first) * 12 + sample] ?? 1;
  }
  return 0;
}
/** The same reveal envelope drives SVG marker opacity and the GPU marker attribute. */
export function priceChartPointOpacity(frame: PriceChartFrame, point: PriceChartVisualPoint): number {
  const position = frame.endX === frame.startX ? 0 : (point.x - frame.startX) / (frame.endX - frame.startX);
  return frame.opacity * point.opacity * clamp((frame.reveal * 1.12 - position) / .12);
}
export function createPriceChartLifecycle(animateProgress: ChartLifecycleTween = tween) {
  let frame = empty(), target = priceChartGeometry([]), key = '', control: { stop: () => void } | undefined, revision = 0, retired = false;
  const listeners = new Set<() => void>();
  const publish = (next: PriceChartFrame) => { frame = next; for (const listener of [...listeners]) listener(); };
  const stop = () => { revision++; control?.stop(); control = undefined; };
  return {
    getSnapshot: () => frame,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    stop,
    setTarget(geometry: PriceChartGeometry, moving: boolean, intentKey = '') {
      if (retired) return;
      const nextKey = JSON.stringify([intentKey, geometry.min, geometry.max, geometry.points, geometry.runs.map(run => run.map(point => point.date))]);
      const same = nextKey === key;
      if (same && (control || frame.phase === 'settled' || frame.phase === 'empty') && moving) return;
      const prior = frame, wasEmpty = !target.points.length;
      stop(); key = nextKey; target = geometry;
      if (!moving) { publish(settled(target)); return; }
      if (!target.points.length && !prior.points.length) { publish(empty()); return; }
      const own = revision;
      const complete = () => { if (!retired && own === revision) { revision++; control = undefined; publish(settled(target)); } };
      if (!target.points.length) {
        const update = (progress: number) => { if (!retired && own === revision) publish({ ...prior, phase: 'exiting', reveal: mix(prior.reveal, 0, progress), opacity: mix(prior.opacity, 0, progress), morphProgress: progress }); };
        update(0); control = animateProgress(priceChartPresentation.exitMs, update, complete); return;
      }
      const final = settled(target), phase: PriceChartPhase = same && (prior.phase === 'entering' || prior.phase === 'reshaping') ? prior.phase : wasEmpty || !prior.points.length ? 'entering' : 'reshaping';
      const sources = final.points.map(point => prior.points.find(previous => previous.date === point.date) ?? displayedAt(prior, day(point.date), point));
      const pathSources = final.paths.map((path, index) => path.map((point, sample) => displayedAt(prior, day(final.runs[index]![0]!.date) + sample / 12, point)));
      const edgeSources = final.paths.map((path, index) => Array.from({ length: Math.max(0, path.length - 1) }, (_, sample) => displayedEdgeOpacity(prior, day(final.runs[index]![0]!.date) + Math.floor(sample / 12), sample % 12)));
      const revealFrom = prior.points.length ? prior.reveal : 0, opacityFrom = prior.points.length ? prior.opacity : 0;
      const update = (progress: number) => {
        if (retired || own !== revision) return;
        const points = final.points.map((point, index) => ({ ...point, x: mix(sources[index]!.x, point.x, progress), y: mix(sources[index]!.y, point.y, progress), opacity: mix(sources[index]!.opacity ?? 1, 1, progress) }));
        const paths = final.paths.map((path, index) => path.map((point, sample) => ({ x: mix(pathSources[index]![sample]!.x, point.x, progress), y: mix(pathSources[index]![sample]!.y, point.y, progress) })));
        const edgeOpacity = edgeSources.map(edges => edges.map(opacity => mix(opacity, 1, progress)));
        publish({ ...final, points, paths, edgeOpacity, phase, reveal: mix(revealFrom, 1, progress), opacity: mix(opacityFrom, 1, progress), morphProgress: progress, startX: mix(prior.points.length ? prior.startX : final.startX, final.startX, progress), endX: mix(prior.points.length ? prior.endX : final.endX, final.endX, progress) });
      };
      update(0); control = animateProgress(phase === 'entering' ? priceChartPresentation.drawMs : priceChartPresentation.reshapeMs, update, complete);
    },
    dispose() { stop(); retired = true; listeners.clear(); },
  };
}
export type PriceChartLifecycle = ReturnType<typeof createPriceChartLifecycle>;

/** One owner can pass this store to both renderers. Cleanup cancels finite work; StrictMode resumes from its visible frame. */
export function usePriceChartLifecycle(cells: readonly DatePriceCell[], range: PriceRange | undefined, moving: boolean, intentKey = '', external?: PriceChartLifecycle): PriceChartLifecycle {
  const [owned] = useState(() => createPriceChartLifecycle());
  const geometry = useMemo(() => priceChartGeometry(cells, range), [cells, range]);
  useLayoutEffect(() => {
    if (external) return;
    owned.setTarget(geometry, moving, intentKey);
    return () => owned.stop();
  }, [owned, geometry, moving, intentKey, external]);
  return external ?? owned;
}
