import { parseDate } from '@internationalized/date';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { priceRange, type PriceRange } from './price-band';

export interface PriceChartPoint { date: string; x: number; y: number; amountRial: number }
/** Samples are decoration only; no sample carries a date or price observation. */
export interface PriceChartCurvePoint { x: number; y: number }
export const priceChartPresentation = { lineWidth: 3.25, markerRadius: 4.5, selectedRadius: 7.5, hoverGrowth: 2.25, ringWidth: 1.7, selectionRingWidth: 1.5, motionMs: 160, drawMs: 560, reshapeMs: 440, exitMs: 280 } as const;
export function priceChartMarkerRadius(selected: boolean, emphasis: number): number {
  return (selected ? priceChartPresentation.selectedRadius : priceChartPresentation.markerRadius) + Math.max(0, Math.min(1, emphasis)) * priceChartPresentation.hoverGrowth;
}
export function priceChartX(cells: readonly DatePriceCell[], index: number): number {
  if (!cells.length) return 0; const first = parseDate(cells[0]!.date), last = parseDate(cells.at(-1)!.date); const days = last.compare(first);
  return days > 0 ? -.9 + parseDate(cells[index]!.date).compare(first) / days * 1.8 : 0;
}
/** Monotone Hermite tangents keep the curve between each pair of actual daily prices. */
function smoothRun(run: readonly PriceChartPoint[]): PriceChartCurvePoint[] {
  if (run.length < 2) return run.map(({ x, y }) => ({ x, y }));
  const slopes = run.slice(1).map((point, index) => (point.y - run[index]!.y) / (point.x - run[index]!.x));
  const tangents = run.map((_, index) => {
    if (!index) return slopes[0]!;
    if (index === run.length - 1) return slopes.at(-1)!;
    const before = slopes[index - 1]!, after = slopes[index]!;
    return before * after > 0 ? 2 * before * after / (before + after) : 0;
  });
  const samples: PriceChartCurvePoint[] = [{ x: run[0]!.x, y: run[0]!.y }];
  run.slice(1).forEach((next, index) => {
    const previous = run[index]!, width = next.x - previous.x;
    for (let step = 1; step <= 12; step++) {
      const t = step / 12, t2 = t * t, t3 = t2 * t;
      samples.push({ x: step === 12 ? next.x : previous.x + width * t, y: step === 12 ? next.y : (2 * t3 - 3 * t2 + 1) * previous.y + (t3 - 2 * t2 + t) * width * tangents[index]! + (-2 * t3 + 3 * t2) * next.y + (t3 - t2) * width * tangents[index + 1]! });
    }
  });
  return samples;
}
/** Only consecutive priced cells share a path. Every missing state and omitted date is a gap. */
export function priceChartGeometry(cells: readonly DatePriceCell[], range?: PriceRange) {
  const amounts = cells.flatMap(cell => cell.status === 'priced' ? [cell.minimum.amountRial] : []), bounds = range ?? priceRange(amounts);
  const min = bounds?.min ?? 0, max = bounds?.max ?? 0, points: PriceChartPoint[] = [], runs: PriceChartPoint[][] = [], edges: number[] = [];
  let previous: PriceChartPoint | undefined;
  cells.forEach((cell, index) => {
    if (cell.status !== 'priced') { previous = undefined; return; }
    const point = { date: cell.date, amountRial: cell.minimum.amountRial, x: priceChartX(cells, index), y: max === min ? 0 : -.65 + (cell.minimum.amountRial - min) / (max - min) * 1.3 };
    if (previous && parseDate(previous.date).add({ days: 1 }).toString() === cell.date) {
      edges.push(previous.x, previous.y, 0, point.x, point.y, 0); runs.at(-1)!.push(point);
    } else runs.push([point]);
    points.push(point); previous = point;
  });
  return { points, runs, edges, paths: runs.map(smoothRun), min, max };
}
export type PriceChartGeometry = ReturnType<typeof priceChartGeometry>;
