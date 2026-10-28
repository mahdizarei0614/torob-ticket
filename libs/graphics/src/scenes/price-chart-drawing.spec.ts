import { describe, expect, it, vi } from 'vitest';
import { createPriceChartEmphasis, priceChartRibbon } from './price-chart-drawing';
import { createPriceChartLifecycle, priceChartGeometry } from '@torob-ticket/ui';
import { createRenderScheduler } from '../render-scheduler';

describe('chart ribbon and finite hover emphasis', () => {
  it('keeps each supplied run separate and creates width-ready quads only for real consecutive samples', () => {
    const drawing = priceChartRibbon([[{ x: -.9, y: -.65 }, { x: -.6, y: 0 }], [{ x: 0, y: .4 }], [{ x: .3, y: .2 }, { x: .9, y: .65 }]]);
    expect(drawing.positions).toHaveLength(36); expect(drawing.directions).toHaveLength(24); expect(drawing.sides).toHaveLength(12);
    expect([...drawing.positions, ...drawing.directions, ...drawing.sides].every(Number.isFinite)).toBe(true);
    expect(drawing.positions.filter((_, index) => index % 3 === 0)).not.toContain(0);
    expect(new Set(drawing.sides)).toEqual(new Set([-1, 1]));
  });
  it('carries per-edge lifecycle opacity to every vertex of the real ribbon without bridging runs', () => {
    const drawing = priceChartRibbon([[{ x: -.9, y: 0 }, { x: -.3, y: .2 }, { x: 0, y: .3 }], [{ x: .5, y: .2 }, { x: .9, y: .4 }]], [[1, .4], [0]]);
    expect(drawing.opacities).toEqual([...Array(6).fill(1), ...Array(6).fill(.4), ...Array(6).fill(0)]);
    expect(drawing.positions).toHaveLength(54); expect(priceChartRibbon([[{ x: 0, y: 0 }, { x: 1, y: 1 }]]).opacities).toEqual(Array(6).fill(1));
  });
  it('continues interruptions from the displayed size and terminates without further animation work', () => {
    const update = vi.fn(), animations: { from: number; to: number; frame: (value: number) => void; stop: ReturnType<typeof vi.fn> }[] = [];
    const emphasis = createPriceChartEmphasis(2, update, (from, to, frame) => { const animation = { from, to, frame, stop: vi.fn() }; animations.push(animation); return animation; });
    emphasis.target(0, 1, true); animations[0]!.frame(.4);
    expect(update).toHaveBeenLastCalledWith(0, .4);
    emphasis.target(0, 0, true);
    expect(animations[0]!.stop).toHaveBeenCalledTimes(1); expect(animations[1]!.from).toBe(.4); expect(animations[1]!.to).toBe(0);
    update.mockClear(); animations[0]!.frame(.9); expect(update).not.toHaveBeenCalled();
    animations[1]!.frame(0); emphasis.target(0, 0, true);
    expect(animations).toHaveLength(2);
    emphasis.target(1, 1, true); expect(animations).toHaveLength(3);
    emphasis.dispose(); expect(animations[2]!.stop).toHaveBeenCalledTimes(1);
    update.mockClear(); animations[2]!.frame(.8); emphasis.target(0, 1, true);
    expect(update).not.toHaveBeenCalled(); expect(animations).toHaveLength(3);
  });
  it('settles reduced/covered/hidden motion directly and does not replay on resume', () => {
    const update = vi.fn(), stop = vi.fn(); let frame: (value: number) => void = () => {};
    const animate = vi.fn((_from: number, _to: number, next: (value: number) => void) => { frame = next; return { stop }; });
    const emphasis = createPriceChartEmphasis(1, update, animate);
    emphasis.target(0, 1, true); frame(.4); emphasis.target(0, 1, false);
    expect(stop).toHaveBeenCalledTimes(1); expect(update).toHaveBeenLastCalledWith(0, 1);
    emphasis.target(0, 1, true); expect(animate).toHaveBeenCalledTimes(1);
    emphasis.dispose();
  });
  it('paints lifecycle entry and shape frames through the existing on-demand scheduler without a continuous map loop', () => {
    const frames = new Map<number, FrameRequestCallback>(); let id = 0;
    const paint = vi.fn(), scheduler = createRenderScheduler(paint, { request: callback => { frames.set(++id, callback); return id; }, cancel: key => { frames.delete(key); }, now: () => 0 });
    const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(1)); };
    scheduler.setPolicy({ active: true, motion: false, reducedMotion: false }); flush();
    let update = (progress: number) => { void progress; }, complete = () => {}; const stop = vi.fn();
    const lifecycle = createPriceChartLifecycle((_duration, next, done) => { update = next; complete = done; return { stop }; });
    const unsubscribe = lifecycle.subscribe(() => scheduler.invalidateScene());
    const coverage = { expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [], complete: true };
    const target = priceChartGeometry([{ date: '2026-10-25', status: 'priced', minimum: { amountRial: 1000, currency: 'IRR' }, coverage, observedAt: '2026-10-25T00:00:00Z', quoteIds: ['q'], offerIds: ['o'] }]);
    lifecycle.setTarget(target, true); flush();
    for (const progress of [.2, .6, 1]) { update(progress); expect(frames.size).toBe(1); flush(); expect(frames.size).toBe(0); }
    complete(); flush(); expect(lifecycle.getSnapshot().phase).toBe('settled'); expect(frames.size).toBe(0);
    const paints = paint.mock.calls.length; lifecycle.setTarget(target, true); flush(); expect(paint).toHaveBeenCalledTimes(paints);
    lifecycle.setTarget(priceChartGeometry([]), true); lifecycle.setTarget(priceChartGeometry([]), false); flush(); expect(stop).toHaveBeenCalled();
    lifecycle.dispose(); update(.7); complete(); expect(frames.size).toBe(0); unsubscribe(); scheduler.dispose();
  });
});
