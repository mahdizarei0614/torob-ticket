import { describe, expect, it, vi } from 'vitest';
import { createPriceChartEmphasis, priceChartRibbon } from './price-chart-drawing';

describe('chart ribbon and finite hover emphasis', () => {
  it('keeps each supplied run separate and creates width-ready quads only for real consecutive samples', () => {
    const drawing = priceChartRibbon([[{ x: -.9, y: -.65 }, { x: -.6, y: 0 }], [{ x: 0, y: .4 }], [{ x: .3, y: .2 }, { x: .9, y: .65 }]]);
    expect(drawing.positions).toHaveLength(36); expect(drawing.directions).toHaveLength(24); expect(drawing.sides).toHaveLength(12);
    expect([...drawing.positions, ...drawing.directions, ...drawing.sides].every(Number.isFinite)).toBe(true);
    expect(drawing.positions.filter((_, index) => index % 3 === 0)).not.toContain(0);
    expect(new Set(drawing.sides)).toEqual(new Set([-1, 1]));
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
});
