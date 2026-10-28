import { createDateInteractions, type DateInteractions } from './date-interaction';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { priceRange } from '@torob-ticket/ui';
import { LocalDateSchema } from '@torob-ticket/contracts';
import type { CatalogSnapshot, DatePriceCell, DatePriceQuery, SessionInfo } from '@torob-ticket/contracts';
import { dateBounds, validateDraft, type SearchDraft } from '../search/search-url';
import { calendarWindow, commitDate, dateLabel, dateWindow, datePriceIdentityForSession, type DateLeg } from './date-state';
import { DateWheel } from './date-wheel';
import { DateCalendar } from './date-calendar';
import { DateChart } from './date-chart';
import { useDatePrices } from './use-date-prices';
import styles from './dates.module.css';
export function DateExplorer({ draft, catalog, session, onCommit, onPreview, onCovered, onInteractionChange, interaction: controlledInteraction, disabled = false, waiting = false }: { draft: SearchDraft; catalog: CatalogSnapshot; session: SessionInfo; onCommit: (draft: SearchDraft) => void; onPreview: (date?: string) => void; onCovered: (covered: boolean) => void; onInteractionChange: (active: boolean) => void; disabled?: boolean; waiting?: boolean; interaction?: DateInteractions }) {
  const [leg, setLeg] = useState<DateLeg>('outbound'); const activeLeg = draft.tripType === 'one-way' ? 'outbound' : leg;
  const [ownedInteraction] = useState(createDateInteractions); const interaction = controlledInteraction ?? ownedInteraction;
  const externalBasis = JSON.stringify([draft,session]); const basisRef = useRef(externalBasis); basisRef.current = externalBasis;
  const [provisional, setProvisional] = useState<{ draft: SearchDraft; basis: string; token: number } | undefined>(undefined);
  const provisionalRef = useRef(provisional); provisionalRef.current = provisional;
  const activeProvisional = provisional && provisional.basis === externalBasis && interaction.isCurrent(provisional.token) && !disabled ? provisional : undefined;
  const [month, setMonth] = useState(draft.departureDate); const [preview, setPreview] = useState<string | undefined>(undefined);
  const trigger = useRef<HTMLButtonElement>(null);
  const model = activeProvisional?.draft ?? draft;
  const rawSelected = (activeLeg === 'outbound' ? model.departureDate : model.returnDate) ?? model.departureDate;
  const city = catalog.cities.find(city => city.id === (activeLeg === 'outbound' ? model.originCityId : model.destinationCityId));
  const bounds = dateBounds(session, city?.timeZone ?? 'Asia/Tehran');
  const selected = LocalDateSchema.safeParse(rawSelected).success ? rawSelected : bounds.min;
  const dates = useMemo(() => dateWindow(selected || bounds.min, bounds.min, bounds.max, 89), [selected, bounds.min, bounds.max]);
  // Only the inspected return is a placeholder. An actual fixed return is required for outbound totals.
  const candidate = activeLeg === 'return' && model.tripType === 'round-trip' ? { ...model, returnDate: model.returnDate ?? model.departureDate } : model;
  const validity = validateDraft(candidate, catalog, session);
  const basis = validity.query ? datePriceIdentityForSession({ query: validity.query, leg: activeLeg, dates: [bounds.min], clientGeneration: 'basis' }, session) : JSON.stringify([activeLeg,model]);
  const nearby = useRef<{ basis: string; dates: string[] }>({ basis: '', dates: [] });
  if (nearby.current.basis !== basis || (!activeProvisional && !nearby.current.dates.includes(selected))) nearby.current = { basis, dates: dateWindow(selected, bounds.min, bounds.max) };
  const batch = [...new Set([...nearby.current.dates, ...(activeProvisional ? calendarWindow(month) : [])])].sort().slice(0, 90);
  const request: DatePriceQuery | undefined = validity.valid && batch.length ? { query: validity.query!, leg: activeLeg, dates: batch, clientGeneration: 'date-intent' } : undefined;
  const prices = useDatePrices(request, session, !disabled);
  const cells = useMemo<readonly DatePriceCell[]>(() => {
    if (prices.error && !prices.snapshot) return [];
    return prices.snapshot?.cells.map(cell => prices.error && cell.status === 'checking' ? { date: cell.date, status: 'unavailable' as const, reason: 'retrieval-failed' as const, retryable: !!prices.retryable, coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: false } } : cell) ?? (request ? batch.map(date => ({ date, status: 'checking' as const })) : []);
  }, [prices.snapshot, prices.error, prices.retryable, batch.join('|'), !!request]);
  const selectedDate = preview ?? selected;
  const range = useMemo(() => priceRange(cells.flatMap(cell => cell.status === 'priced' ? [cell.minimum.amountRial] : [])), [cells]);
  function previewDate(date: string) { if (!mounted.current || disabled) return; setPreview(date); onPreview(date); }
  function commit(date: string) { if (!mounted.current || disabled) return; setPreview(undefined); onPreview(undefined); onCommit(commitDate(draft, activeLeg, date)); }
  const callbacks = useRef({ onPreview,onCovered,onInteractionChange }); callbacks.current = { onPreview,onCovered,onInteractionChange };
  const mounted = useRef(true); const focusFrame = useRef<number | undefined>(undefined);
  function clearLocal() {
    const wasOpen = !!provisionalRef.current; provisionalRef.current = undefined;
    if (mounted.current) { setProvisional(undefined); setPreview(undefined); }
    callbacks.current.onPreview(undefined); callbacks.current.onInteractionChange(false);
    if (wasOpen) { callbacks.current.onCovered(false); if (typeof requestAnimationFrame === 'function') focusFrame.current = requestAnimationFrame(() => { if (mounted.current) trigger.current?.focus(); }); }
  }
  const clearRef = useRef(clearLocal); clearRef.current = clearLocal;
  useLayoutEffect(() => { mounted.current = true; const unsubscribe = interaction.subscribe(() => clearRef.current()); return () => { mounted.current = false; unsubscribe(); interaction.invalidate(); if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current); if (provisionalRef.current) callbacks.current.onCovered(false); provisionalRef.current = undefined; callbacks.current.onInteractionChange(false); }; }, [interaction]);
  const previousBasis = useRef(externalBasis);
  useLayoutEffect(() => { if (previousBasis.current !== externalBasis || disabled) { previousBasis.current = externalBasis; interaction.invalidate(); } }, [externalBasis,disabled,interaction]);
  function close() { if (mounted.current) interaction.invalidate(); }
  function open() { if (!mounted.current || disabled) return; interaction.invalidate(); const next = { draft: structuredClone(draft), basis: externalBasis, token: interaction.capture() }; provisionalRef.current = next; setProvisional(next); setMonth(selected); setPreview(undefined); onCovered(true); }
  function changeLeg(next: DateLeg) {
    if (!mounted.current || disabled) return;
    const calendar = activeProvisional && interaction.isCurrent(activeProvisional.token) && activeProvisional.basis === basisRef.current ? activeProvisional : undefined; interaction.invalidate(); setLeg(next); setPreview(undefined);
    // Changing direction inside the same calendar is an intentional continuation.
    if (calendar && calendar.basis === basisRef.current) { if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current); const renewed = { ...calendar, token: interaction.capture() }; provisionalRef.current = renewed; setProvisional(renewed); onCovered(true); setMonth((next === 'outbound' ? calendar.draft.departureDate : calendar.draft.returnDate) ?? calendar.draft.departureDate); }
  }
  function applyCalendar() { if (!activeProvisional || !interaction.isCurrent(activeProvisional.token) || activeProvisional.basis !== basisRef.current || disabled || !mounted.current) return; onCommit(activeProvisional.draft); close(); }
  return <section aria-label="کاوش تاریخ سفر" className={styles.explorer} data-selected-outbound={draft.departureDate} data-selected-return={draft.returnDate ?? ''} data-date-price-id={prices.snapshot?.datePriceId} data-date-price-status={prices.error ? 'unavailable' : prices.snapshot?.status ?? (request ? 'checking' : 'unselected')}>
    {draft.tripType === 'round-trip' && <div className={styles.toolbar}><select aria-label="بخش سفر برای قیمت روزها" value={activeLeg} onChange={event => changeLeg(event.target.value as DateLeg)}><option value="outbound">تاریخ رفت</option><option value="return">تاریخ برگشت</option></select></div>}
    {model.tripType === 'round-trip' && <p className={styles.caption}>{activeLeg === 'outbound' ? 'برگشت ثابت' : 'رفت ثابت'}: {model.returnDate || activeLeg === 'return' ? dateLabel(activeLeg === 'outbound' ? model.returnDate! : model.departureDate) : 'هنوز انتخاب نشده'}</p>}
    <div className={styles.exploration}><div className={styles.wheelColumn}><DateWheel dates={dates} value={selected} cells={cells} range={range} onPreview={previewDate} onCommit={commit} onInteractionChange={onInteractionChange} leg={activeLeg} interaction={interaction} interactionKey={externalBasis + activeLeg} missingLabel={prices.error ? 'قیمت در دسترس نیست' : undefined} /><button ref={trigger} type="button" className={styles.calendarTrigger} aria-label="تقویم جلالی و انتخاب تاریخ" title="تقویم جلالی و انتخاب تاریخ" onClick={open} disabled={disabled}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17M8 14h2M14 14h2M8 17.5h2"/></svg></button></div><DateChart leg={activeLeg} cells={cells} range={range} selected={selectedDate} onSelect={date => { if (!disabled) commit(date); }} />
    </div>
    {!request && <p className={styles.status}>{model.tripType === 'round-trip' && !model.returnDate && activeLeg === 'outbound' ? 'برای قیمت کامل رفت، ابتدا تاریخ برگشت را انتخاب کنید. رفت را می‌توانید بدون قیمت جابه‌جا کنید.' : 'مسیر و تاریخ را انتخاب کنید تا قیمت روزها بررسی شود.'}</p>}
    {!!prices.error && <p role="alert" className={styles.error}>قیمت روزها دریافت نشد؛ این به معنی نبودن پیشنهاد نیست.</p>}
    {waiting && <p role="status" className={styles.status}>تاریخ انتخاب‌شده ثبت شد؛ آخرین انتخاب شما با آزاد شدن ظرفیت جست‌وجو می‌شود.</p>}
    {activeProvisional && <DateCalendar draft={activeProvisional.draft} leg={activeLeg} onLeg={changeLeg} onDraft={next => setProvisional(previous => previous && interaction.isCurrent(previous.token) && previous.basis === basisRef.current ? { ...previous, draft: next } : undefined)} month={month} onMonth={setMonth} min={activeLeg === 'return' && model.departureDate > bounds.min ? model.departureDate : bounds.min} max={bounds.max} localBounds={{ outbound: dateBounds(session, catalog.cities.find(city => city.id === model.originCityId)?.timeZone ?? 'Asia/Tehran'), return: dateBounds(session, catalog.cities.find(city => city.id === model.destinationCityId)?.timeZone ?? 'Asia/Tehran') }} cells={cells} range={range} canApply={validateDraft(activeProvisional.draft, catalog, session).valid && !disabled} priceNotice={prices.error ? 'قیمت روزها در دسترس نیست؛ نبودن پیشنهاد ثابت نشده است.' : undefined} missingLabel={prices.error ? 'قیمت در دسترس نیست' : undefined} onApply={applyCalendar} onCancel={close} />}

  </section>;
}
