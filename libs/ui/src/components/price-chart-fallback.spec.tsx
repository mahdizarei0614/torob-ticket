import { describe, expect, it } from 'vitest';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { priceChartGeometry } from './price-chart-fallback';
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
});
