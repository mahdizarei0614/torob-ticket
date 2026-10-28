import { parseDate } from '@internationalized/date';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { priceBand, priceRange, type PriceRange } from './price-band';
import { useMotionPolicy } from '../motion/motion-surface';
import styles from './price-chart-fallback.module.css';
export interface PriceChartPoint { date: string; x: number; y: number; amountRial: number }
/** Curve samples are decoration only. Only PriceChartPoint carries a date and a price. */
export interface PriceChartCurvePoint { x: number; y: number }
export const priceChartPresentation = { lineWidth: 3.25, markerRadius: 4.5, selectedRadius: 7.5, hoverGrowth: 2.25, ringWidth: 1.7, selectionRingWidth: 1.5, motionMs: 160 } as const;
export function priceChartMarkerRadius(selected: boolean, emphasis: number): number {
  return (selected ? priceChartPresentation.selectedRadius : priceChartPresentation.markerRadius) + Math.max(0, Math.min(1, emphasis)) * priceChartPresentation.hoverGrowth;
}
export function priceChartX(cells: readonly DatePriceCell[], index: number): number {
  if (!cells.length) return 0; const first = parseDate(cells[0]!.date), last = parseDate(cells.at(-1)!.date); const days = last.compare(first);
  return days > 0 ? -.9 + parseDate(cells[index]!.date).compare(first) / days * 1.8 : 0;
}
/** Monotone Hermite tangents keep the visual curve between each pair of actual prices. */
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
/** Only consecutive known cells share a path. Missing states and omitted dates remain gaps. */
export function priceChartGeometry(cells: readonly DatePriceCell[], range?: PriceRange) {
  const known = cells.filter(cell => cell.status === 'priced');
  const amounts = known.map(cell => cell.minimum.amountRial);
  const bounds = range ?? priceRange(amounts);
  const min = bounds?.min ?? 0, max = bounds?.max ?? 0;
  const points: PriceChartPoint[] = [];
  const edges: number[] = [];
  const runs: PriceChartPoint[][] = [];
  let previous: PriceChartPoint | undefined;
  cells.forEach((cell, index) => {
    if (cell.status !== 'priced') { previous = undefined; return; }
    const point = { date: cell.date, amountRial: cell.minimum.amountRial, x: priceChartX(cells,index), y: max === min ? 0 : -.65 + (cell.minimum.amountRial - min) / (max - min) * 1.3 };
    if (previous && parseDate(previous.date).add({ days: 1 }).toString() === cell.date) {
      edges.push(previous.x, previous.y, 0, point.x, point.y, 0);
      runs.at(-1)!.push(point);
    } else runs.push([point]);
    points.push(point); previous = point;
  });
  return { points, edges, paths: runs.map(smoothRun), min, max };
}
export function PriceChartFallback({ cells, selected, hovered, range, motionEnabled }: { cells: readonly DatePriceCell[]; selected: string; hovered?: string; range?: PriceRange; motionEnabled?: boolean }) {
  const { points, paths, min, max } = priceChartGeometry(cells,range);
  const svg = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState({ width: 320, height: 184 });
  const policy = useMotionPolicy();
  const moving = motionEnabled ?? policy.enabled;
  useLayoutEffect(() => {
    const element = svg.current;
    if (!element) return;
    const measure = () => { const { width, height } = element.getBoundingClientRect(); if (width > 0 && height > 0) setViewport(current => current.width === width && current.height === height ? current : { width, height }); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const x = (value: number) => (value + 1) / 2 * viewport.width;
  const y = (value: number) => (1 - value) / 2 * viewport.height;
  const selectedIndex = cells.findIndex(cell => cell.date === selected), selectedX = selectedIndex < 0 ? undefined : x(priceChartX(cells, selectedIndex));
  const gradient = useId();
  return <svg ref={svg} viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" data-price-chart="fallback" data-motion-policy={moving ? 'finite' : 'static'} className={styles.chart}>
    <defs><linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={y(-.65)} y2={y(.65)}>
      <stop offset="0" stopColor="var(--price-low)"/><stop offset=".25" stopColor="var(--price-low)"/>
      <stop offset=".25" stopColor="var(--price-mid)"/><stop offset=".75" stopColor="var(--price-mid)"/>
      <stop offset=".75" stopColor="var(--price-high)"/><stop offset="1" stopColor="var(--price-high)"/>
    </linearGradient></defs>
    {[-.65, 0, .65].map(value => <line key={value} x1={x(-.9)} x2={x(.9)} y1={y(value)} y2={y(value)} stroke="var(--chart-grid)" strokeWidth="1" />)}
    {selectedX !== undefined && <line data-chart-selection={selected} x1={selectedX} x2={selectedX} y1={y(.82)} y2={y(-.82)} stroke="var(--chart-marker)" strokeWidth="1" strokeOpacity=".3" />}
    {paths.filter(path => path.length > 1).map((path, index) => <polyline key={index} data-price-path points={path.map(point => `${x(point.x)},${y(point.y)}`).join(' ')} fill="none" stroke={`url(#${gradient})`} strokeWidth={priceChartPresentation.lineWidth} strokeLinecap="round" strokeLinejoin="round" />)}
    {points.map(point => {
      const active = point.date === selected, radius = priceChartMarkerRadius(active, point.date === hovered ? 1 : 0);
      return <g key={point.date} data-price-marker={point.date} data-selected={active || undefined} data-hovered={point.date === hovered || undefined} data-price-band={priceBand(point.amountRial,{min,max})} transform={`translate(${x(point.x)},${y(point.y)})`}>
        {active && <circle className={styles.marker} style={{ r: radius - priceChartPresentation.selectionRingWidth / 2 }} fill="var(--scene-background)" stroke="var(--chart-marker)" strokeWidth={priceChartPresentation.selectionRingWidth} />}
        <circle className={styles.marker} style={{ r: radius - (active ? 3.25 : 0) - priceChartPresentation.ringWidth / 2 }} fill="var(--scene-background)" stroke="currentColor" strokeWidth={priceChartPresentation.ringWidth} />
      </g>;
    })}
  </svg>;
}
