import { createDateInteractions, type DateInteractions } from './date-interaction';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { DatePriceCell } from '@torob-ticket/contracts';
import { priceBand, type PriceRange } from '@torob-ticket/ui';
import { cellLabel, dateLabel, disabledCell, settleMs, type DateLeg } from './date-state';
import { DateAmount } from './date-amount';
import styles from './dates.module.css';
const rowHeight = 44;
/** Nearby wheel/trackpad intent settles once; outward motion at an edge chains to the page. */
export function DateWheel({ dates, value, cells, range, onPreview, onCommit, onInteractionChange, leg = 'outbound', interaction: controlledInteraction, interactionKey = leg, missingLabel, loading = false, motionEnabled = true }: { dates: readonly string[]; value: string; cells: readonly DatePriceCell[]; range?: PriceRange; onPreview: (date: string) => void; onCommit: (date: string) => void; onInteractionChange?: (active: boolean) => void; leg?: DateLeg; interaction?: DateInteractions; interactionKey?: string; missingLabel?: string; loading?: boolean; motionEnabled?: boolean }) {
  const [ownedInteraction] = useState(createDateInteractions); const interaction = controlledInteraction ?? ownedInteraction;
  const authorization = useRef<{ token: number; key: string } | undefined>(undefined);
  const basis = useRef(interactionKey); basis.current = interactionKey;
  const mounted = useRef(true);
  const element = useRef<HTMLDivElement>(null);
  const wheelGesture = useRef<{ index: number; delta: number } | undefined>(undefined);
  const [preview, setPreview] = useState(value);
  const selected = useRef(value); selected.current = value;
  const current = useRef(value); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gesture = useRef<{ id: number; start: number; index: number; moved: boolean } | undefined>(undefined);
  const suppressClick = useRef(false); const id = useId();
  const callbacks = useRef({ onPreview, onCommit, onInteractionChange }); callbacks.current = { onPreview, onCommit, onInteractionChange };
  function show(date: string) { current.current = date; setPreview(date); callbacks.current.onPreview(date); }
  function cancel() { const hadGesture = !!gesture.current || !!authorization.current; clearTimeout(timer.current); timer.current = undefined; authorization.current = undefined; gesture.current = undefined; wheelGesture.current = undefined; suppressClick.current = hadGesture; current.current = selected.current; setPreview(selected.current); callbacks.current.onInteractionChange?.(false); callbacks.current.onPreview(selected.current); }
  function settle(date: string) {
    const permit = authorization.current ?? { token: interaction.capture(), key: basis.current }; authorization.current = permit;
    callbacks.current.onInteractionChange?.(true); clearTimeout(timer.current); show(date);
    timer.current = setTimeout(() => {
      timer.current = undefined; wheelGesture.current = undefined; authorization.current = undefined; callbacks.current.onInteractionChange?.(false);
      if (mounted.current && interaction.isCurrent(permit.token) && basis.current === permit.key && date !== selected.current) callbacks.current.onCommit(date);
    }, settleMs);
  }
  useLayoutEffect(() => { cancel(); }, [value, interactionKey]);
  useLayoutEffect(() => interaction.subscribe(cancel), [interaction]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); authorization.current = undefined; callbacks.current.onInteractionChange?.(false); }; }, []);
  useEffect(() => {
    const node = element.current; if (!node) return;
    function wheel(event: WheelEvent) {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
      const at = Math.max(0, dates.indexOf(current.current));
      if ((at === 0 && event.deltaY < 0) || (at === dates.length - 1 && event.deltaY > 0)) return;
      event.preventDefault(); suppressClick.current = false;
      const motion = wheelGesture.current ?? { index: at, delta: 0 }; wheelGesture.current = motion;
      motion.delta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rowHeight * 3 : 1);
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
      onKeyDown={event => { suppressClick.current = false; if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(event.key)) { event.preventDefault(); if (event.key === 'Home' || event.key === 'End') { const date = event.key === 'Home' ? dates[0] : dates.at(-1); if (enabled(date)) settle(date!); } else step(event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'PageDown' ? 5 : -5); } }}
      onPointerDown={event => { if (event.button !== 0 && event.pointerType !== 'touch') return; suppressClick.current = false; authorization.current = { token: interaction.capture(), key: basis.current }; callbacks.current.onInteractionChange?.(true); clearTimeout(timer.current); gesture.current = { id: event.pointerId, start: event.clientY, index: Math.max(0, dates.indexOf(current.current)), moved: false }; }}
      onPointerMove={event => { const drag = gesture.current; if (!drag || drag.id !== event.pointerId) return; const delta = drag.start - event.clientY; if (Math.abs(delta) > 5) { drag.moved = true; event.currentTarget.setPointerCapture?.(event.pointerId); } const date = dates[Math.max(0, Math.min(dates.length - 1, drag.index + Math.round(delta / rowHeight)))]; if (enabled(date)) show(date!); }}
      onPointerUp={() => { const drag = gesture.current; if (!drag) return; gesture.current = undefined; suppressClick.current = drag.moved; if (drag.moved) settle(current.current); else { authorization.current = undefined; callbacks.current.onInteractionChange?.(false); } }}
      onPointerCancel={cancel}>
      <div className={styles.wheelCenter} aria-hidden="true" />
      <div className={styles.wheelRows} style={{ transform: `translateY(${(1 - index) * rowHeight}px)` }}>{dates.map((date, i) => {
        const cell = cells.find(cell => cell.date === date);
        const label = dateLabel(date), availability = cell ? cellLabel(cell, leg) : missingLabel ?? cellLabel(undefined);
        return <div id={`${id}-${i}`} role="option" aria-label={`${label}، ${availability}`} aria-selected={date === preview} aria-disabled={disabledCell(cell, leg) || undefined} title={`${label} — ${availability}`} key={date} className={styles.wheelRow} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (enabled(date)) settle(date); }}><bdi className={styles.wheelDate} dir="ltr">{label}</bdi><span className={styles.wheelSeparator} aria-hidden="true">—</span><DateAmount pending={loading && cell?.status === 'checking'} motionEnabled={motionEnabled} band={priceBand(cell?.status === 'priced' ? cell.minimum.amountRial : undefined, range)}>{availability}</DateAmount></div>;
      })}</div>
    </div>
    <button type="button" className={styles.arrow} aria-label="روز بعد" disabled={!enabled(dates[index + 1])} onClick={() => step(1)}>⌄</button>
  </div>;
}
