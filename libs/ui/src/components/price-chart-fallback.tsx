import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { priceBand, type PriceRange } from './price-band';
import { useMotionPolicy } from '../motion/motion-surface';
import { priceChartMarkerRadius, priceChartPresentation, priceChartX } from './price-chart-geometry';
import { priceChartPointOpacity, usePriceChartLifecycle, type PriceChartLifecycle } from './price-chart-lifecycle';
import styles from './price-chart-fallback.module.css';
export * from './price-chart-geometry';
export * from './price-chart-lifecycle';
export function PriceChartFallback({ cells, selected, hovered, range, motionEnabled, lifecycle }: { cells: readonly DatePriceCell[]; selected: string; hovered?: string; range?: PriceRange; motionEnabled?: boolean; lifecycle?: PriceChartLifecycle }) {
  const svg = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState({ width: 320, height: 184 });
  const policy = useMotionPolicy();
  const moving = motionEnabled ?? policy.enabled;
  const controller = usePriceChartLifecycle(cells, range, moving, selected, lifecycle);
  const frame = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { points, paths, min, max } = frame, exiting = frame.phase === 'exiting';
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
  const selectedIndex = cells.findIndex(cell => cell.date === selected), selectedPoint = !exiting && cells[selectedIndex]?.status === 'priced' ? points.find(point => point.date === selected) : undefined;
  const selectedX = selectedPoint ? x(selectedPoint.x) : selectedIndex < 0 ? undefined : x(priceChartX(cells, selectedIndex));
  const gradient = useId(), clip = useId();
  return <svg ref={svg} viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" data-price-chart="fallback" data-motion-policy={moving ? 'finite' : 'static'} data-chart-phase={frame.phase} data-chart-reveal={frame.reveal} data-chart-opacity={frame.opacity} data-chart-morph-progress={frame.morphProgress} className={styles.chart}>
    <defs><linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={y(-.65)} y2={y(.65)}>
      <stop offset="0" stopColor="var(--price-low)"/><stop offset=".25" stopColor="var(--price-low)"/>
      <stop offset=".25" stopColor="var(--price-mid)"/><stop offset=".75" stopColor="var(--price-mid)"/>
      <stop offset=".75" stopColor="var(--price-high)"/><stop offset="1" stopColor="var(--price-high)"/>
    </linearGradient><clipPath id={clip}><rect x="0" y="0" width={frame.reveal >= 1 ? viewport.width : x(frame.startX + (frame.endX - frame.startX) * frame.reveal)} height={viewport.height}/></clipPath>
    {paths.map((path, index) => path.length > 1 && <mask key={index} id={`${clip}-opacity-${index}`} maskUnits="userSpaceOnUse" x="0" y="0" width={viewport.width} height={viewport.height} style={{ maskType: 'alpha' }}>
      {path.slice(0, -1).map((point, edge) => { const left = edge ? x(point.x) : 0, right = edge === path.length - 2 ? viewport.width : x(path[edge + 1]!.x); return <rect key={edge} x={left} y="0" width={Math.max(0, right - left)} height={viewport.height} fill="var(--text)" opacity={frame.edgeOpacity[index]?.[edge] ?? 1}/>; })}
    </mask>)}</defs>
    {[-.65, 0, .65].map(value => <line key={value} x1={x(-.9)} x2={x(.9)} y1={y(value)} y2={y(value)} stroke="var(--chart-grid)" strokeWidth="1" />)}
    {selectedX !== undefined && <line data-chart-selection={selected} x1={selectedX} x2={selectedX} y1={y(.82)} y2={y(-.82)} stroke="var(--chart-marker)" strokeWidth="1" strokeOpacity=".3" />}
    <g clipPath={`url(#${clip})`} opacity={frame.opacity}>{paths.map((path, index) => path.length > 1 && <polyline key={index} data-price-path={!exiting || undefined} data-price-ghost-path={exiting || undefined} points={path.map(point => `${x(point.x)},${y(point.y)}`).join(' ')} fill="none" stroke={`url(#${gradient})`} mask={`url(#${clip}-opacity-${index})`} strokeWidth={priceChartPresentation.lineWidth} strokeLinecap="round" strokeLinejoin="round" />)}</g>
    {points.map(point => {
      const active = !exiting && point.date === selected, radius = priceChartMarkerRadius(active, !exiting && point.date === hovered ? 1 : 0);
      return <g key={point.date} data-price-marker={!exiting ? point.date : undefined} data-price-ghost={exiting ? point.date : undefined} data-selected={active || undefined} data-hovered={!exiting && point.date === hovered || undefined} data-price-band={priceBand(point.amountRial,{min,max})} transform={`translate(${x(point.x)},${y(point.y)})`} opacity={priceChartPointOpacity(frame, point)}>
        {active && <circle className={styles.marker} style={{ r: radius - priceChartPresentation.selectionRingWidth / 2 }} fill="var(--scene-background)" stroke="var(--chart-marker)" strokeWidth={priceChartPresentation.selectionRingWidth} />}
        <circle className={styles.marker} style={{ r: radius - (active ? 3.25 : 0) - priceChartPresentation.ringWidth / 2 }} fill="var(--scene-background)" stroke="currentColor" strokeWidth={priceChartPresentation.ringWidth} />
      </g>;
    })}
  </svg>;
}
