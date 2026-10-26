import { lazy, Suspense } from 'react';
import { GraphicsView } from '@torob-ticket/graphics/host';
import { PriceChartFallback, priceChartGeometry, priceChartX } from '@torob-ticket/ui';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { cellLabel, dateLabel, disabledCell, type DateLeg } from './date-state';
import styles from './dates.module.css';
const Scene = lazy(() => import('@torob-ticket/graphics').then(module => ({ default: module.PriceChartScene })));
export function DateChart({ cells, selected, onSelect, leg }: { cells: readonly DatePriceCell[]; selected: string; onSelect: (date: string) => void; leg: DateLeg }) {
  const geometry = priceChartGeometry(cells);
  return <div className={styles.chartSection}>
    <div className={styles.chartHeading}><span>کمترین قیمت روزهای سفر</span><span>تومان · مجموع مسافران</span></div>
    <div className={styles.chart}>
      <GraphicsView label="نمودار کمترین قیمت واجد شرایط به تاریخ حرکت" fallback={<PriceChartFallback cells={cells} selected={selected} />}><Suspense fallback={null}><Scene cells={cells} selected={selected} /></Suspense></GraphicsView>
      <div className={styles.chartPoints} role="slider" tabIndex={cells.length ? 0 : -1} aria-label="انتخاب روز از نمودار" aria-valuemin={0} aria-valuemax={Math.max(0, cells.length - 1)} aria-valuenow={Math.max(0, cells.findIndex(cell => cell.date === selected))} aria-valuetext={`${dateLabel(selected)}، ${cellLabel(cells.find(cell => cell.date === selected), leg)}`} onPointerUp={event => { const box = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - box.left) / box.width * 2 - 1; const index = cells.reduce((nearest, _, index) => Math.abs(priceChartX(cells, index) - x) < Math.abs(priceChartX(cells, nearest) - x) ? index : nearest, 0); const cell = cells[index]; if (cell && !disabledCell(cell,leg)) onSelect(cell.date); }} onKeyDown={event => { const current = Math.max(0, cells.findIndex(cell => cell.date === selected)); const index = event.key === 'Home' ? 0 : event.key === 'End' ? cells.length - 1 : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? current + 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? current - 1 : -1; if (index < 0 || index >= cells.length) return; event.preventDefault(); const cell = cells[index]!; if (!disabledCell(cell,leg)) onSelect(cell.date); }} />
    </div>
    <div className={styles.axis} aria-hidden="true"><span>{cells[0] ? dateLabel(cells[0].date) : ''}</span><span>{cells.at(-1) ? dateLabel(cells.at(-1)!.date) : ''}</span></div>
    <div className={styles.range} aria-label="بازه قیمت روزهای قابل مقایسه"><span>کمینه: <bdi>{geometry.points.length?new Intl.NumberFormat('fa-IR').format(geometry.min/10):'نامشخص'}</bdi></span><span>بیشینه: <bdi>{geometry.points.length?new Intl.NumberFormat('fa-IR').format(geometry.max/10):'نامشخص'}</bdi></span></div>
    <p className={styles.caption}>روزهای بدون قیمت فاصله دارند؛ قیمت حرکت است، نه تاریخچه قیمت.</p>
  </div>;
}
