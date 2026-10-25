import { useEffect, useId, useRef, useState } from 'react';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { cellLabel, dateLabel, disabledCell, settleMs, type DateLeg } from './date-state';
import styles from './dates.module.css';
const rowHeight = 54;
/** Nearby wheel/trackpad intent settles once; outward motion at an edge chains to the page. */
export function DateWheel({ dates, value, cells, onPreview, onCommit, onInteractionChange, leg = 'outbound' }: { dates: readonly string[]; value: string; cells: readonly DatePriceCell[]; onPreview: (date: string) => void; onCommit: (date: string) => void; onInteractionChange?: (active: boolean) => void; leg?: DateLeg }) {
  const element = useRef<HTMLDivElement>(null);
  const wheelGesture = useRef<{ index: number; delta: number } | undefined>(undefined);
  const [preview, setPreview] = useState(value);
  const selected = useRef(value); selected.current = value;
  const current = useRef(value); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gesture = useRef<{ id: number; start: number; index: number; moved: boolean } | undefined>(undefined);
  const suppressClick = useRef(false); const id = useId();
  const callbacks = useRef({ onPreview, onCommit, onInteractionChange }); callbacks.current = { onPreview, onCommit, onInteractionChange };
  function show(date: string) { current.current = date; setPreview(date); callbacks.current.onPreview(date); }
  function settle(date: string) { callbacks.current.onInteractionChange?.(true); clearTimeout(timer.current); show(date); timer.current = setTimeout(() => { timer.current = undefined; wheelGesture.current = undefined; callbacks.current.onInteractionChange?.(false); if (date !== selected.current) callbacks.current.onCommit(date); }, settleMs); }
  useEffect(() => { clearTimeout(timer.current); current.current = value; setPreview(value); callbacks.current.onInteractionChange?.(false); }, [value]);
  useEffect(() => () => { clearTimeout(timer.current); callbacks.current.onInteractionChange?.(false); }, []);
  useEffect(() => {
    const node = element.current; if (!node) return;
    function wheel(event: WheelEvent) {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
      const at = Math.max(0, dates.indexOf(current.current));
      if ((at === 0 && event.deltaY < 0) || (at === dates.length - 1 && event.deltaY > 0)) return;
      event.preventDefault();
      const motion = wheelGesture.current ?? { index: at, delta: 0 }; wheelGesture.current = motion;
      motion.delta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rowHeight * 5 : 1);
      const next = dates[Math.max(0, Math.min(dates.length - 1, motion.index + Math.round(motion.delta / rowHeight)))];
      if (next && !disabledCell(cells.find(cell => cell.date === next), leg)) settle(next);
    }
    node.addEventListener('wheel', wheel, { passive: false }); return () => node.removeEventListener('wheel', wheel);
  }, [dates, cells, leg]);
  const index = Math.max(0, dates.indexOf(preview));
  const enabled = (date: string | undefined) => date && !disabledCell(cells.find(cell => cell.date === date), leg);
  function step(delta: number) { const date = dates[Math.max(0, Math.min(dates.length - 1, dates.indexOf(current.current) + delta))]; if (enabled(date)) settle(date!); }
  return <div className={styles.wheelSection}>
    <button type="button" className={styles.arrow} aria-label="روز قبل" disabled={!enabled(dates[index - 1])} onClick={() => step(-1)}>⌃</button>
    <div ref={element} className={styles.wheel} role="listbox" aria-label="روزهای نزدیک" tabIndex={0} aria-activedescendant={`${id}-${index}`} data-preview-date={preview}
      onKeyDown={event => { if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(event.key)) { event.preventDefault(); if (event.key === 'Home' || event.key === 'End') { const date = event.key === 'Home' ? dates[0] : dates.at(-1); if (enabled(date)) settle(date!); } else step(event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'PageDown' ? 5 : -5); } }}
      onPointerDown={event => { if (event.button !== 0 && event.pointerType !== 'touch') return; callbacks.current.onInteractionChange?.(true); clearTimeout(timer.current); gesture.current = { id: event.pointerId, start: event.clientY, index: Math.max(0, dates.indexOf(current.current)), moved: false }; }}
      onPointerMove={event => { const drag = gesture.current; if (!drag || drag.id !== event.pointerId) return; const delta = drag.start - event.clientY; if (Math.abs(delta) > 5) { drag.moved = true; event.currentTarget.setPointerCapture?.(event.pointerId); } const date = dates[Math.max(0, Math.min(dates.length - 1, drag.index + Math.round(delta / rowHeight)))]; if (enabled(date)) show(date!); }}
      onPointerUp={() => { const drag = gesture.current; if (!drag) return; gesture.current = undefined; suppressClick.current = drag.moved; if (drag.moved) setTimeout(() => { suppressClick.current = false; }, 0); if (drag.moved) settle(current.current); else callbacks.current.onInteractionChange?.(false); }}
      onPointerCancel={() => { gesture.current = undefined; suppressClick.current = true; setTimeout(() => { suppressClick.current = false; }, 0); clearTimeout(timer.current); callbacks.current.onInteractionChange?.(false); show(selected.current); }}>
      <div className={styles.wheelCenter} aria-hidden="true" />
      <div className={styles.wheelRows} style={{ transform: `translateY(${(2 - index) * rowHeight}px)` }}>{dates.map((date, i) => <div id={`${id}-${i}`} role="option" aria-selected={date === preview} aria-disabled={disabledCell(cells.find(cell => cell.date === date), leg) || undefined} key={date} className={styles.wheelRow} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (enabled(date)) settle(date); }}><span>{dateLabel(date)}</span><small>{cellLabel(cells.find(cell => cell.date === date), leg)}</small></div>)}</div>
    </div>
    <button type="button" className={styles.arrow} aria-label="روز بعد" disabled={!enabled(dates[index + 1])} onClick={() => step(1)}>⌄</button>
    <span className={styles.caption}>بکشید یا از کلیدهای بالا و پایین استفاده کنید</span>
  </div>;
}
