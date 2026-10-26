import { parseDate } from '@internationalized/date';
import { useId } from 'react';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { priceBand, priceRange, type PriceRange } from './price-band';
export interface PriceChartPoint { date: string; x: number; y: number; amountRial: number }
export function priceChartX(cells: readonly DatePriceCell[], index: number): number {
  if (!cells.length) return 0; const first = parseDate(cells[0]!.date), last = parseDate(cells.at(-1)!.date); const days = last.compare(first);
  return days > 0 ? -.9 + parseDate(cells[index]!.date).compare(first) / days * 1.8 : 0;
}
/** Shared finite geometry. Only adjacent known cells produce an edge; gaps are never bridged. */
export function priceChartGeometry(cells: readonly DatePriceCell[], range?: PriceRange) {
  const known = cells.filter(cell => cell.status === 'priced');
  const amounts = known.map(cell => cell.minimum.amountRial);
  const bounds = range ?? priceRange(amounts);
  const min = bounds?.min ?? 0, max = bounds?.max ?? 0;
  const points: PriceChartPoint[] = [];
  const edges: number[] = [];
  let previous: PriceChartPoint | undefined;
  cells.forEach((cell, index) => {
    if (cell.status !== 'priced') { previous = undefined; return; }
    const point = { date: cell.date, amountRial: cell.minimum.amountRial, x: priceChartX(cells,index), y: max === min ? 0 : -.65 + (cell.minimum.amountRial - min) / (max - min) * 1.3 };
    if (previous && parseDate(previous.date).add({ days: 1 }).toString() === cell.date) edges.push(previous.x, previous.y, 0, point.x, point.y, 0);
    points.push(point); previous = point;
  });
  return { points, edges, min, max };
}
export function PriceChartFallback({ cells, selected, range }: { cells: readonly DatePriceCell[]; selected: string; range?: PriceRange }) {
  const { points, edges, min, max } = priceChartGeometry(cells,range);
  const gradient = useId();
  return <svg viewBox="-1 -1 2 2" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">
    <defs><linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1=".65" y2="-.65">
      <stop offset="0" stopColor="var(--price-low)"/><stop offset=".25" stopColor="var(--price-low)"/>
      <stop offset=".25" stopColor="var(--price-mid)"/><stop offset=".75" stopColor="var(--price-mid)"/>
      <stop offset=".75" stopColor="var(--price-high)"/><stop offset="1" stopColor="var(--price-high)"/>
    </linearGradient></defs>
    {[-.65, 0, .65].map(y => <line key={y} x1="-.9" x2=".9" y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth=".008" />)}
    {Array.from({ length: edges.length / 6 }, (_, i) => <line key={i} x1={edges[i * 6]} y1={-edges[i * 6 + 1]!} x2={edges[i * 6 + 3]} y2={-edges[i * 6 + 4]!} stroke={`url(#${gradient})`} strokeWidth=".018" />)}
    {points.map(point => <circle key={point.date} cx={point.x} cy={-point.y} r={point.date === selected ? .035 : .02} data-price-band={priceBand(point.amountRial,{min,max})} fill="currentColor" />)}
  </svg>;
}
