import { lazy, Suspense, useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { GraphicsView } from '@torob-ticket/graphics/host';
import { MotionSurface, PriceChartFallback, priceChartGeometry, priceChartX, priceBand, useMotionPolicy, type PriceRange } from '@torob-ticket/ui';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { cellLabel, dateLabel, disabledCell, type DateLeg } from './date-state';
import styles from './dates.module.css';
const Scene = lazy(() => import('@torob-ticket/graphics').then(module => ({ default: module.PriceChartScene })));
interface Inspection { date: string; source: 'pointer' | 'touch' }
interface PointerStart { id: number; x: number; y: number; moved: boolean }
export function DateChart({ cells, selected, onSelect, leg, range }: { cells: readonly DatePriceCell[]; selected: string; onSelect: (date: string) => void; leg: DateLeg; range?: PriceRange }) {
  const geometry = priceChartGeometry(cells);
  const presentation = priceChartGeometry(cells, range);
  const policy = useMotionPolicy();
  const chart = useRef<HTMLDivElement>(null), pointerStart = useRef<PointerStart | null>(null), activePointers = useRef(new Set<number>());
  const [inspection, setInspection] = useState<Inspection | null>(null), [focused, setFocused] = useState(false), [dismissed, setDismissed] = useState(false);
  const tooltipId = useId();
  const selectedIndex = Math.max(0, cells.findIndex(cell => cell.date === selected));
  const activeCell = dismissed ? undefined : cells.find(cell => cell.date === inspection?.date) ?? (focused ? cells.find(cell => cell.date === selected) ?? cells[0] : undefined);
  const activePoint = presentation.points.find(point => point.date === activeCell?.date);
  const hovered = activePoint?.date;
  const activeIndex = activeCell ? cells.indexOf(activeCell) : -1;
  const tooltipX = activeIndex < 0 ? 0 : (priceChartX(cells, activeIndex) + 1) * 50;
  const tooltipY = activePoint ? (1 - activePoint.y) * 50 : 50;
  const below = tooltipY < 42;
  useEffect(() => {
    if (inspection?.source !== 'touch') return;
    const dismissOutside = (event: globalThis.PointerEvent) => { if (!chart.current?.contains(event.target as Node)) { pointerStart.current = null; setInspection(null); setDismissed(true); } };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [inspection?.source]);
  const nearestCell = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!cells.length || box.width <= 0) return undefined;
    const x = (event.clientX - box.left) / box.width * 2 - 1;
    const index = cells.reduce((nearest, _, index) => Math.abs(priceChartX(cells, index) - x) < Math.abs(priceChartX(cells, nearest) - x) ? index : nearest, 0);
    return cells[index];
  };
  const inspect = (event: PointerEvent<HTMLDivElement>) => {
    const cell = nearestCell(event);
    if (!cell) return;
    setDismissed(false);
    setInspection(current => current?.date === cell.date && current.source === (event.pointerType === 'touch' ? 'touch' : 'pointer') ? current : { date: cell.date, source: event.pointerType === 'touch' ? 'touch' : 'pointer' });
  };
  return <div className={styles.chartSection}>
    <div className={styles.chartHeading}><span>کمترین قیمت روزهای سفر</span><span>تومان</span></div>
    <div ref={chart} className={styles.chart} data-chart-selected={selected} data-motion-policy={policy.enabled ? 'finite' : 'static'}>
      <GraphicsView label="نمودار کمترین قیمت واجد شرایط به تاریخ حرکت" fallback={<PriceChartFallback cells={cells} selected={selected} hovered={hovered} range={range} motionEnabled={policy.enabled} />}><Suspense fallback={null}><Scene cells={cells} selected={selected} hovered={hovered} range={range} motionEnabled={policy.enabled} /></Suspense></GraphicsView>
      <div className={styles.chartPoints} role="slider" tabIndex={cells.length ? 0 : -1} aria-label="انتخاب روز از نمودار" aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={Math.max(0, cells.length - 1)} aria-valuenow={selectedIndex} aria-valuetext={`${dateLabel(selected)}، ${cellLabel(cells.find(cell => cell.date === selected), leg)}`} aria-describedby={activeCell ? tooltipId : undefined}
        onFocus={() => { setFocused(true); setDismissed(false); }} onBlur={() => { setFocused(false); setInspection(null); }}
        onPointerDown={event => {
          if (event.button !== 0 || activePointers.current.has(event.pointerId)) return;
          activePointers.current.add(event.pointerId);
          if (activePointers.current.size > 1) { pointerStart.current = null; setInspection(null); setDismissed(true); return; }
          pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }; inspect(event);
        }}
        onPointerMove={event => {
          const start = pointerStart.current;
          if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) start.moved = true;
          if (activePointers.current.size > 1 || event.pointerType === 'touch' && (!start || start.id !== event.pointerId || start.moved)) { setInspection(null); setDismissed(true); return; }
          inspect(event);
        }}
        onPointerUp={event => {
          const start = pointerStart.current; pointerStart.current = null;
          activePointers.current.delete(event.pointerId);
          if (event.button !== 0 || !start || start.id !== event.pointerId || activePointers.current.size > 0 || event.pointerType === 'touch' && start.moved) { setInspection(null); setDismissed(true); return; }
          inspect(event);
          const cell = nearestCell(event); if (cell && !disabledCell(cell, leg)) onSelect(cell.date);
        }}
        onPointerLeave={event => { if (event.pointerType !== 'touch') { activePointers.current.delete(event.pointerId); if (pointerStart.current?.id === event.pointerId) pointerStart.current = null; setInspection(null); } }}
        onPointerCancel={event => { activePointers.current.delete(event.pointerId); pointerStart.current = null; setInspection(null); setDismissed(true); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); setDismissed(true); setInspection(null); return; }
          const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'Home' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'End' ? -1 : 0;
          if (!step) return;
          event.preventDefault();
          let index = event.key === 'Home' ? 0 : event.key === 'End' ? cells.length - 1 : selectedIndex + step;
          while (index >= 0 && index < cells.length && disabledCell(cells[index], leg)) index += step;
          const cell = cells[index]; if (!cell) return;
          setInspection(null); setDismissed(false); onSelect(cell.date);
        }} />
      {activeCell && <div className={styles.chartTooltipAnchor} data-placement={below ? 'below' : 'above'} style={{ left: `clamp(0px, calc(${tooltipX}% - 68px), max(0px, calc(100% - 136px)))`, top: `${tooltipY}%` }}>
        <MotionSurface id={tooltipId} role="tooltip" className={styles.chartTooltip} purpose="emphasis" motionKey={activeCell.date}>
          <bdi className={styles.chartTooltipDate} dir="ltr">{dateLabel(activeCell.date)}</bdi>
          <span className={styles.chartTooltipPrice} data-price-band={priceBand(activeCell.status === 'priced' ? activeCell.minimum.amountRial : undefined, range ?? { min: presentation.min, max: presentation.max })}>{activeCell.status === 'priced' ? <><bdi>{new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(activeCell.minimum.amountRial / 10)}</bdi><span>تومان</span></> : cellLabel(activeCell, leg)}</span>
        </MotionSurface>
      </div>}
    </div>
    <div className={styles.axis} aria-hidden="true"><span>{cells[0] ? dateLabel(cells[0].date) : ''}</span><span>{cells.at(-1) ? dateLabel(cells.at(-1)!.date) : ''}</span></div>
    <div className={styles.range} aria-label="بازه قیمت روزهای قابل مقایسه"><span><span>کمینه:</span><bdi data-price-band={priceBand(geometry.points.length ? geometry.min : undefined, range)}>{geometry.points.length?new Intl.NumberFormat('fa-IR').format(geometry.min/10):'نامشخص'}</bdi></span><span><span>بیشینه:</span><bdi data-price-band={priceBand(geometry.points.length ? geometry.max : undefined, range)}>{geometry.points.length?new Intl.NumberFormat('fa-IR').format(geometry.max/10):'نامشخص'}</bdi></span></div>
  </div>;
}
