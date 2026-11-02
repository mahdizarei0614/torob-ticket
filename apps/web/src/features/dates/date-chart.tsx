import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import { DateLoadingVisual } from './date-loading-visual';
import { GraphicsView } from '@torob-ticket/graphics/host';
import { MotionSurface, PriceChartFallback, priceChartGeometry, priceChartX, priceBand, useMotionPolicy, usePriceChartLifecycle, type PriceChartLifecycle, type PriceRange } from '@torob-ticket/ui';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { cellLabel, dateLabel, disabledCell, type DateLeg } from './date-state';
import styles from './dates.module.css';
const Scene = lazy(() => import('@torob-ticket/graphics').then(module => ({ default: module.PriceChartScene })));
// Two identical decorative tiles meet at the same height and horizontal tangent.
// Translating exactly one tile loops continuously, without implying price facts.
const loadingCurve = 'M0 100C25 100 35 62 70 62S110 128 140 128S180 84 210 84S245 114 270 114S300 100 320 100C345 100 355 62 390 62S430 128 460 128S500 84 530 84S565 114 590 114S620 100 640 100';
interface Inspection { date: string; source: 'pointer' | 'touch' }
interface PointerStart { id: number; x: number; y: number; moved: boolean }
function ChartTooltip({ cell, cells, leg, range, lifecycle, id }: { cell: DatePriceCell; cells: readonly DatePriceCell[]; leg: DateLeg; range: PriceRange; lifecycle: PriceChartLifecycle; id: string }) {
  const frame = useSyncExternalStore(lifecycle.subscribe, lifecycle.getSnapshot, lifecycle.getSnapshot);
  const point = frame.phase === 'exiting' ? undefined : frame.points.find(point => point.date === cell.date);
  const index = cells.indexOf(cell), x = point ? (point.x + 1) * 50 : (priceChartX(cells, Math.max(0, index)) + 1) * 50, y = point ? (1 - point.y) * 50 : 50;
  return <div className={styles.chartTooltipAnchor} data-placement={y < 42 ? 'below' : 'above'} style={{ left: `clamp(0px, calc(${x}% - 68px), max(0px, calc(100% - 136px)))`, top: `${y}%` }}>
    <MotionSurface id={id} role="tooltip" className={styles.chartTooltip} purpose="emphasis" motionKey={cell.date}>
      <bdi className={styles.chartTooltipDate} dir="ltr">{dateLabel(cell.date)}</bdi>
      <span className={styles.chartTooltipPrice} data-price-band={priceBand(cell.status === 'priced' ? cell.minimum.amountRial : undefined, range)}>{cell.status === 'priced' ? <><bdi>{new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(cell.minimum.amountRial / 10)}</bdi><span>تومان</span></> : cellLabel(cell, leg)}</span>
    </MotionSurface>
  </div>;
}
export function DateChart({ cells, selected, onSelect, leg, range, loading = false, disabled = false }: { cells: readonly DatePriceCell[]; selected: string; onSelect: (date: string) => void; leg: DateLeg; range?: PriceRange; loading?: boolean; disabled?: boolean }) {
  const geometry = useMemo(() => priceChartGeometry(cells), [cells]);
  const presentation = useMemo(() => priceChartGeometry(cells, range), [cells, range]);
  const policy = useMotionPolicy({ disabled });
  const chart = useRef<HTMLDivElement>(null), pointerStart = useRef<PointerStart | null>(null), activePointers = useRef(new Set<number>());
  const [inspection, setInspection] = useState<Inspection | null>(null), [focused, setFocused] = useState(false), [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(true), moving = policy.enabled && visible;
  const [gpuReady, setGpuReady] = useState(false);
  const contentFade = useAnimationControls();
  useLayoutEffect(() => {
    contentFade.stop();
    const frame = { opacity: loading ? 0 : 1 };
    if (!moving) contentFade.set(frame);
    else void contentFade.start({ ...frame, transition: { duration: .28, ease: 'easeInOut' } });
    return () => contentFade.stop();
  }, [contentFade, loading, moving]);
  useLayoutEffect(() => {
    if (!loading) return;
    pointerStart.current = null; activePointers.current.clear();
    setInspection(null); setDismissed(true);
  }, [loading]);
  const lifecycle = usePriceChartLifecycle(cells, range, moving, selected);
  useLayoutEffect(() => {
    const update = () => {
      const frame = lifecycle.getSnapshot(), element = chart.current;
      if (!element) return;
      element.dataset['chartPhase'] = frame.phase; element.dataset['chartReveal'] = String(frame.reveal);
      element.dataset['chartOpacity'] = String(frame.opacity); element.dataset['chartMorphProgress'] = String(frame.morphProgress);
    };
    update(); return lifecycle.subscribe(update);
  }, [lifecycle]);
  const tooltipId = useId();
  const selectedIndex = Math.max(0, cells.findIndex(cell => cell.date === selected));
  const activeCell = loading || dismissed ? undefined : cells.find(cell => cell.date === inspection?.date) ?? (focused ? cells.find(cell => cell.date === selected) ?? cells[0] : undefined);
  const activePoint = presentation.points.find(point => point.date === activeCell?.date);
  const hovered = activePoint?.date;
  useEffect(() => {
    if (!chart.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => { const entry = entries[0]; if (entry) setVisible(entry.isIntersecting); });
    observer.observe(chart.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (inspection?.source !== 'touch') return;
    const dismissOutside = (event: globalThis.PointerEvent) => { if (!chart.current?.contains(event.target as Node)) { pointerStart.current = null; setInspection(null); setDismissed(true); } };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [inspection?.source]);
  const nearestCell = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (loading || !cells.length || box.width <= 0) return undefined;
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
    <div ref={chart} className={styles.chart} data-chart-selected={selected} data-chart-gpu-ready={gpuReady} data-chart-loading={loading} aria-busy={loading} data-motion-policy={moving ? 'finite' : 'static'}>
      <div className={styles.chartContent} data-chart-content inert={loading} aria-hidden={loading || undefined}>
      <GraphicsView label="نمودار کمترین قیمت واجد شرایط به تاریخ حرکت" fallback={<PriceChartFallback cells={cells} selected={selected} hovered={hovered} range={range} motionEnabled={moving} lifecycle={lifecycle} />}><Suspense fallback={null}><Scene cells={cells} selected={selected} hovered={hovered} range={range} motionEnabled={moving} lifecycle={lifecycle} onReadyChange={setGpuReady} /></Suspense></GraphicsView>
      <div className={styles.chartPoints} role="slider" tabIndex={!loading && cells.length ? 0 : -1} aria-label="انتخاب روز از نمودار" aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={Math.max(0, cells.length - 1)} aria-valuenow={selectedIndex} aria-valuetext={`${dateLabel(selected)}، ${cellLabel(cells.find(cell => cell.date === selected), leg)}`} aria-describedby={activeCell ? tooltipId : undefined}
        onFocus={() => { setFocused(true); setDismissed(false); }} onBlur={() => { setFocused(false); setInspection(null); }}
        onPointerDown={event => {
          if (loading || event.button !== 0 || activePointers.current.has(event.pointerId)) return;
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
          if (loading) return;
          if (event.key === 'Escape') { event.preventDefault(); setDismissed(true); setInspection(null); return; }
          const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'Home' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'End' ? -1 : 0;
          if (!step) return;
          event.preventDefault();
          let index = event.key === 'Home' ? 0 : event.key === 'End' ? cells.length - 1 : selectedIndex + step;
          while (index >= 0 && index < cells.length && disabledCell(cells[index], leg)) index += step;
          const cell = cells[index]; if (!cell) return;
          setInspection(null); setDismissed(false); onSelect(cell.date);
        }} />
      {activeCell && <ChartTooltip id={tooltipId} cell={activeCell} cells={cells} leg={leg} range={range ?? { min: presentation.min, max: presentation.max }} lifecycle={lifecycle}/>}
      </div>
      <AnimatePresence>{loading && <DateLoadingVisual key="loading" block loading motionEnabled={moving} className={styles.chartLoading}>
        <span data-chart-loading-visual className={styles.chartLoadingContent} role="status">
          <svg className={styles.chartLoadingGrid} viewBox="0 0 320 184" preserveAspectRatio="none" aria-hidden="true"><path d="M12 28H308M12 70H308M12 112H308M12 154H308" /></svg>
          <svg data-loading-wave className={styles.chartLoadingWave} viewBox="0 0 640 184" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.chartLoadingArea} d={`${loadingCurve}L640 184H0Z`} />
            <path data-loading-wave-path className={styles.chartLoadingLine} d={loadingCurve} vectorEffect="non-scaling-stroke" />
          </svg>
          <span className={styles.chartLoadingStatus}>در حال دریافت قیمت روزها…</span>
        </span>
      </DateLoadingVisual>}</AnimatePresence>
    </div>
    <motion.div initial={false} animate={contentFade} aria-hidden={loading || undefined}>
    <div className={styles.axis} aria-hidden="true"><span>{cells[0] ? dateLabel(cells[0].date) : ''}</span><span>{cells.at(-1) ? dateLabel(cells.at(-1)!.date) : ''}</span></div>
    <div className={styles.range} role="group" aria-label="بازه قیمت روزهای قابل مقایسه"><span><span>کمترین قیمت:</span><bdi data-price-band={priceBand(geometry.points.length ? geometry.min : undefined, range)}>{geometry.points.length?new Intl.NumberFormat('fa-IR').format(geometry.min/10):'نامشخص'}</bdi></span><span><span>بیشترین قیمت:</span><bdi data-price-band={priceBand(geometry.points.length ? geometry.max : undefined, range)}>{geometry.points.length?new Intl.NumberFormat('fa-IR').format(geometry.max/10):'نامشخص'}</bdi></span></div>
    </motion.div>
  </div>;
}
