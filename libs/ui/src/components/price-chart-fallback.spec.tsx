import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { PriceChartFallback, priceChartGeometry, priceChartMarkerRadius, priceChartPresentation } from './price-chart-fallback';
const coverage = { expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [], complete: true };
const priced = (date: string, amountRial: number): DatePriceCell => ({ date, status: 'priced', minimum: { amountRial, currency: 'IRR' }, coverage, observedAt: '2026-10-25T00:00:00Z', quoteIds: ['q'], offerIds: ['o'] });
describe('shared fallback and final GPU chart geometry', () => {
  it('keeps actual zero prices, separates known runs and never bridges missing states', () => {
    const geometry = priceChartGeometry([priced('2026-10-25',0),priced('2026-10-26',100),{ date: '2026-10-27', status: 'checking' },priced('2026-10-28',200),priced('2026-10-29',300)]);
    expect(geometry.points).toHaveLength(4); expect(geometry.min).toBe(0); expect(geometry.edges).toHaveLength(12);
    expect(geometry.edges.slice(0,6)).toEqual([...Object.values({ x:geometry.points[0]!.x,y:geometry.points[0]!.y,z:0 }),geometry.points[1]!.x,geometry.points[1]!.y,0]);
    expect(geometry.edges.every(Number.isFinite)).toBe(true);
  });
  it('does not bridge uninspected nonconsecutive dates even when both endpoints are priced', () => { expect(priceChartGeometry([priced('2026-10-25',100),priced('2026-11-25',200)]).edges).toHaveLength(0); });
  it('makes flat, single and empty data finite without inventing a minimum point', () => {
    expect(priceChartGeometry([]).points).toEqual([]); expect(priceChartGeometry([priced('2026-10-25',0)]).points[0]).toMatchObject({ x:0,y:0,amountRial:0 });
    const flat = priceChartGeometry([priced('2026-10-25',100),priced('2026-10-26',100)]); expect(flat.points.every(point => point.y === 0)).toBe(true);
  });
  it('passes through every real minimum and bounds smoothing to each pair without adding price observations', () => {
    const amounts = [0, 800, 820, 200, 600, 600];
    const geometry = priceChartGeometry(amounts.map((amount, index) => priced(`2026-10-${25 + index}`, amount)));
    const path = geometry.paths[0]!;
    expect(geometry.points.map(point => point.amountRial)).toEqual(amounts);
    geometry.points.forEach((point, index) => expect(path[index * 12]).toEqual({ x: point.x, y: point.y }));
    geometry.points.slice(1).forEach((point, index) => {
      const previous = geometry.points[index]!;
      for (const sample of path.slice(index * 12, (index + 1) * 12 + 1)) {
        expect(sample.x).toBeGreaterThanOrEqual(previous.x); expect(sample.x).toBeLessThanOrEqual(point.x);
        expect(sample.y).toBeGreaterThanOrEqual(Math.min(previous.y, point.y) - 1e-12);
        expect(sample.y).toBeLessThanOrEqual(Math.max(previous.y, point.y) + 1e-12);
        expect(Object.keys(sample).sort()).toEqual(['x', 'y']);
      }
    });
    const midpoint = path[6]!;
    expect(midpoint.y).not.toBeCloseTo((geometry.points[0]!.y + geometry.points[1]!.y) / 2);
  });
  it('breaks both GPU/SVG paths at every unavailable state and at absent calendar dates', () => {
    const gaps: DatePriceCell[] = [
      { date: '2026-10-26', status: 'checking' },
      { date: '2026-10-28', status: 'outside-coverage' },
      { date: '2026-10-30', status: 'no-match', coverage },
      { date: '2026-11-01', status: 'unavailable', reason: 'incomplete-price', retryable: false, coverage },
    ];
    const cells = [priced('2026-10-25', 100), gaps[0]!, priced('2026-10-27', 200), gaps[1]!, priced('2026-10-29', 300), gaps[2]!, priced('2026-10-31', 400), gaps[3]!, priced('2026-11-02', 500), priced('2026-11-04', 600)];
    const geometry = priceChartGeometry(cells);
    expect(geometry.paths).toHaveLength(6); expect(geometry.paths.every(path => path.length === 1)).toBe(true);
    const view = render(<PriceChartFallback cells={cells} selected="2026-10-25" />);
    expect(view.container.querySelector('[data-price-path]')).toBeNull();
    expect(view.container.querySelectorAll('[data-price-marker]')).toHaveLength(6);
  });
  it('keeps a distinct selected ring while another exact marker grows, with round pixel sizing after resize', () => {
    const measure = vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 420, height: 130 } as DOMRect);
    const cells = [priced('2026-10-25', 100), priced('2026-10-26', 200)];
    const view = render(<PriceChartFallback cells={cells} selected="2026-10-25" hovered="2026-10-26" motionEnabled />);
    expect(view.container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 420 130');
    const selected = view.container.querySelector('[data-price-marker="2026-10-25"]')!, hovered = view.container.querySelector('[data-price-marker="2026-10-26"]')!;
    expect(selected).toHaveAttribute('data-selected', 'true'); expect(selected.querySelectorAll('circle')).toHaveLength(2);
    expect(hovered).not.toHaveAttribute('data-selected'); expect(hovered).toHaveAttribute('data-hovered', 'true');
    expect(hovered.querySelector('circle')!.style.r).toBe(`${priceChartMarkerRadius(false, 1) - priceChartPresentation.ringWidth / 2}px`);
    view.rerender(<PriceChartFallback cells={cells} selected="2026-10-25" hovered="2026-10-26" motionEnabled={false} />);
    expect(view.container.querySelector('svg')).toHaveAttribute('data-motion-policy', 'static');
    expect(selected).toHaveAttribute('data-selected', 'true'); measure.mockRestore();
  });
});
