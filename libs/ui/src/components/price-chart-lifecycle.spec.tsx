import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { PriceChartFallback } from './price-chart-fallback';
import { priceChartGeometry, priceChartPresentation } from './price-chart-geometry';
import { createPriceChartLifecycle, priceChartPointOpacity } from './price-chart-lifecycle';

const coverage = { expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [], complete: true };
const priced = (date: string, amountRial: number): DatePriceCell => ({ date, status: 'priced', minimum: { amountRial, currency: 'IRR' }, coverage, observedAt: '2026-10-25T00:00:00Z', quoteIds: ['q'], offerIds: ['o'] });
const cells = [priced('2026-10-25', 0), priced('2026-10-26', 100), priced('2026-10-27', 200)];
function driver() {
  const animations: { duration: number; update: (progress: number) => void; complete: () => void; stop: ReturnType<typeof vi.fn> }[] = [];
  const lifecycle = createPriceChartLifecycle((duration, update, complete) => { const animation = { duration, update, complete, stop: vi.fn() }; animations.push(animation); return animation; });
  return { lifecycle, animations, last: () => animations.at(-1)! };
}
describe('shared finite date-chart lifecycle', () => {
  it('reveals real geometry from start to end, keeps zero prices and completes without later replay', () => {
    const d = driver(), target = priceChartGeometry(cells);
    d.lifecycle.setTarget(target, true);
    let frame = d.lifecycle.getSnapshot(); expect(frame).toMatchObject({ phase: 'entering', reveal: 0, opacity: 0, morphProgress: 0 });
    expect(d.last().duration).toBe(priceChartPresentation.drawMs); expect(frame.points.map(point => point.amountRial)).toEqual([0, 100, 200]);
    expect(frame.paths.map(path => path.map(({ x, y }) => ({ x, y })))).toEqual(target.paths);
    d.last().update(.4); frame = d.lifecycle.getSnapshot();
    expect(frame.reveal).toBe(.4); expect(priceChartPointOpacity(frame, frame.points[0]!)).toBeGreaterThan(0); expect(priceChartPointOpacity(frame, frame.points.at(-1)!)).toBe(0);
    const stale = d.last(); stale.complete(); expect(d.lifecycle.getSnapshot()).toMatchObject({ phase: 'settled', reveal: 1, opacity: 1 });
    const settled = d.lifecycle.getSnapshot(); stale.update(.7); expect(d.lifecycle.getSnapshot()).toBe(settled);
    d.lifecycle.setTarget(target, true); expect(d.animations).toHaveLength(1); d.lifecycle.dispose();
  });
  it('reshapes from the displayed point and sampled curve during rapid interruptions without changing target prices', () => {
    const d = driver(), a = priceChartGeometry(cells), b = priceChartGeometry([priced('2026-10-25', 200), priced('2026-10-26', 100), priced('2026-10-27', 0)]);
    d.lifecycle.setTarget(a, false); d.lifecycle.setTarget(b, true); d.last().update(.5);
    const shown = d.lifecycle.getSnapshot(), old = d.last(); expect(shown.points[0]!.y).toBeCloseTo(0); expect(shown.points[0]!.amountRial).toBe(200);
    const c = priceChartGeometry([priced('2026-10-25', 0), priced('2026-10-26', 400), priced('2026-10-27', 200)]);
    d.lifecycle.setTarget(c, true); const start = d.lifecycle.getSnapshot();
    expect(old.stop).toHaveBeenCalledOnce(); expect(start.points[0]!.y).toBe(shown.points[0]!.y); expect(start.paths).toEqual(shown.paths);
    expect(start.points.map(point => point.amountRial)).toEqual([0, 400, 200]);
    old.update(1); expect(d.lifecycle.getSnapshot()).toBe(start);
    d.last().update(.7); d.last().complete(); expect(d.lifecycle.getSnapshot().paths).toEqual(c.paths); d.lifecycle.dispose();
  });
  it('opens unknown and omitted-date gaps immediately while keeping only current target observations', () => {
    const d = driver(); d.lifecycle.setTarget(priceChartGeometry(cells), false);
    const target = priceChartGeometry([cells[0]!, { date: '2026-10-26', status: 'checking' }, cells[2]!, priced('2026-10-29', 300)]);
    d.lifecycle.setTarget(target, true);
    const frame = d.lifecycle.getSnapshot(); expect(frame.paths.map(path => path.length)).toEqual([1, 1, 1]);
    expect(frame.points.map(point => point.date)).toEqual(['2026-10-25', '2026-10-27', '2026-10-29']);
    expect(frame.points.map(point => point.amountRial)).toEqual([0, 200, 300]); d.lifecycle.dispose();
  });
  it('fades newly priced edges in from zero instead of instantly joining a former unknown gap', () => {
    const d = driver(), prior = priceChartGeometry([cells[0]!, { date: '2026-10-26', status: 'checking' }, cells[2]!]);
    d.lifecycle.setTarget(prior, false); d.lifecycle.setTarget(priceChartGeometry(cells), true);
    expect(d.lifecycle.getSnapshot().edgeOpacity.flat().every(opacity => opacity === 0)).toBe(true);
    d.last().update(.4); expect(d.lifecycle.getSnapshot().edgeOpacity.flat().every(opacity => opacity === .4)).toBe(true);
    const shown = d.lifecycle.getSnapshot(); d.lifecycle.setTarget(priceChartGeometry(cells.map(cell => cell.status === 'priced' ? { ...cell, minimum: { ...cell.minimum, amountRial: cell.minimum.amountRial + 50 } } : cell)), true);
    expect(d.lifecycle.getSnapshot().edgeOpacity).toEqual(shown.edgeOpacity); d.last().complete();
    expect(d.lifecycle.getSnapshot().edgeOpacity.flat().every(opacity => opacity === 1)).toBe(true); d.lifecycle.dispose();
  });
  it('retains the displayed reveal boundary when a partial entry changes its first and last priced dates', () => {
    const d = driver(), prior = priceChartGeometry([{ date: '2026-10-24', status: 'checking' }, ...cells, { date: '2026-10-28', status: 'checking' }]);
    d.lifecycle.setTarget(prior, true); d.last().update(.4); const before = d.lifecycle.getSnapshot();
    const cut = before.startX + (before.endX - before.startX) * before.reveal;
    d.lifecycle.setTarget(priceChartGeometry([priced('2026-10-24', 50), ...cells, priced('2026-10-28', 100)]), true);
    const after = d.lifecycle.getSnapshot(); expect(after.startX).toBe(before.startX); expect(after.endX).toBe(before.endX);
    expect(after.startX + (after.endX - after.startX) * after.reveal).toBe(cut); d.lifecycle.dispose();
  });
  it('finishes a finite decorative exit, draws again on reentry and continues an interrupted exit from what is visible', () => {
    const d = driver(), target = priceChartGeometry(cells), empty = priceChartGeometry([{ date: cells[0]!.date, status: 'checking' }]);
    d.lifecycle.setTarget(target, false); d.lifecycle.setTarget(empty, true); expect(d.last().duration).toBe(priceChartPresentation.exitMs);
    d.last().update(.5); expect(d.lifecycle.getSnapshot()).toMatchObject({ phase: 'exiting', reveal: .5, opacity: .5 });
    d.lifecycle.setTarget(target, true); expect(d.lifecycle.getSnapshot()).toMatchObject({ phase: 'entering', reveal: .5, opacity: .5 });
    d.last().complete(); d.lifecycle.setTarget(empty, true); d.last().complete();
    expect(d.lifecycle.getSnapshot()).toMatchObject({ phase: 'empty', points: [], paths: [], reveal: 0, opacity: 0 });
    d.lifecycle.setTarget(target, true); expect(d.lifecycle.getSnapshot()).toMatchObject({ phase: 'entering', reveal: 0, opacity: 0 }); d.lifecycle.dispose();
  });
  it('settles reduced, covered or hidden owners directly and resumes without replaying an existing target', () => {
    const d = driver(), target = priceChartGeometry(cells);
    d.lifecycle.setTarget(target, true); const old = d.last(); old.update(.3);
    d.lifecycle.setTarget(target, false); expect(old.stop).toHaveBeenCalledOnce(); expect(d.lifecycle.getSnapshot()).toMatchObject({ phase: 'settled', reveal: 1, opacity: 1 });
    const settled = d.lifecycle.getSnapshot(); old.update(.7); expect(d.lifecycle.getSnapshot()).toBe(settled);
    d.lifecycle.setTarget(target, true); expect(d.animations).toHaveLength(1);
    d.lifecycle.setTarget(priceChartGeometry([]), false); expect(d.lifecycle.getSnapshot().phase).toBe('empty');
    d.lifecycle.setTarget(target, false); d.lifecycle.setTarget(target, true); expect(d.animations).toHaveLength(1); d.lifecycle.dispose();
  });
  it('stops retired callbacks and lets effect replay resume the current entry without a geometry reset', () => {
    const d = driver(), target = priceChartGeometry(cells), listener = vi.fn(); d.lifecycle.subscribe(listener);
    d.lifecycle.setTarget(target, true); d.last().update(.35); const shown = d.lifecycle.getSnapshot(), old = d.last();
    d.lifecycle.stop(); old.update(.8); expect(d.lifecycle.getSnapshot()).toBe(shown);
    d.lifecycle.setTarget(target, true); expect(d.lifecycle.getSnapshot()).toMatchObject({ phase: 'entering', reveal: .35, opacity: .35 });
    const resumed = d.last(); d.lifecycle.dispose(); listener.mockClear(); resumed.update(.9); resumed.complete(); d.lifecycle.setTarget(target, true);
    expect(listener).not.toHaveBeenCalled(); expect(d.animations).toHaveLength(2);
  });
  it('gives SVG the actual shared phase/reveal/opacity and makes exit remnants decorative', () => {
    const d = driver(); d.lifecycle.setTarget(priceChartGeometry(cells), true);
    const view = render(<PriceChartFallback cells={cells} selected={cells[0]!.date} lifecycle={d.lifecycle} motionEnabled />);
    const svg = view.container.querySelector('svg')!; expect(svg).toHaveAttribute('data-chart-phase', 'entering');
    act(() => d.last().update(.5)); expect(svg).toHaveAttribute('data-chart-reveal', '0.5'); expect(svg).toHaveAttribute('data-chart-opacity', '0.5');
    expect(view.container.querySelector('mask rect')).toHaveAttribute('opacity', '0.5');
    const pending: DatePriceCell[] = cells.map(cell => ({ date: cell.date, status: 'checking' }));
    act(() => { d.last().complete(); d.lifecycle.setTarget(priceChartGeometry(pending), true); });
    view.rerender(<PriceChartFallback cells={pending} selected={cells[0]!.date} lifecycle={d.lifecycle} motionEnabled />);
    expect(svg).toHaveAttribute('data-chart-phase', 'exiting'); expect(view.container.querySelector('[data-price-marker]')).toBeNull(); expect(view.container.querySelectorAll('[data-price-ghost]')).toHaveLength(3);
    act(() => d.last().complete()); expect(svg).toHaveAttribute('data-chart-phase', 'empty'); expect(view.container.querySelector('[data-price-ghost]')).toBeNull(); d.lifecycle.dispose();
  });
});
