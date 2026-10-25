import { useMemo, useRef, useState } from 'react';
import { Button } from '@torob-ticket/ui';
import { LocalDateSchema } from '@torob-ticket/contracts';
import type { CatalogSnapshot, DatePriceCell, DatePriceQuery, SessionInfo } from '@torob-ticket/contracts';
import { dateBounds, validateDraft, type SearchDraft } from '../search/search-url';
import { calendarWindow, cellLabel, commitDate, dateLabel, dateWindow, datePriceIdentityForSession, type DateLeg } from './date-state';
import { DateWheel } from './date-wheel';
import { DateCalendar } from './date-calendar';
import { DateChart } from './date-chart';
import { useDatePrices } from './use-date-prices';
import styles from './dates.module.css';
export function DateExplorer({ draft, catalog, session, onCommit, onPreview, onCovered, onInteractionChange, disabled = false, waiting = false }: { draft: SearchDraft; catalog: CatalogSnapshot; session: SessionInfo; onCommit: (draft: SearchDraft) => void; onPreview: (date?: string) => void; onCovered: (covered: boolean) => void; onInteractionChange: (active: boolean) => void; disabled?: boolean; waiting?: boolean }) {
  const [leg, setLeg] = useState<DateLeg>('outbound'); const activeLeg = draft.tripType === 'one-way' ? 'outbound' : leg;
  const [provisional, setProvisional] = useState<SearchDraft | undefined>(undefined);
  const [month, setMonth] = useState(draft.departureDate); const [preview, setPreview] = useState<string | undefined>(undefined);
  const trigger = useRef<HTMLButtonElement>(null);
  const model = provisional ?? draft;
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
  if (nearby.current.basis !== basis || (!provisional && !nearby.current.dates.includes(selected))) nearby.current = { basis, dates: dateWindow(selected, bounds.min, bounds.max) };
  const batch = [...new Set([...nearby.current.dates, ...(provisional ? calendarWindow(month) : [])])].sort().slice(0, 90);
  const request: DatePriceQuery | undefined = validity.valid && batch.length ? { query: validity.query!, leg: activeLeg, dates: batch, clientGeneration: 'date-intent' } : undefined;
  const prices = useDatePrices(request, session, !disabled);
  const cells = useMemo<readonly DatePriceCell[]>(() => prices.snapshot?.cells.map(cell => prices.error && cell.status === 'checking' ? { date: cell.date, status: 'unavailable' as const, reason: 'retrieval-failed' as const, retryable: !!prices.retryable, coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: false } } : cell) ?? (request ? batch.map(date => ({ date, status: 'checking' as const })) : []), [prices.snapshot, prices.error, prices.retryable, batch.join('|'), !!request]);
  const selectedDate = preview ?? selected;
  const selectedCell = cells.find(cell => cell.date === selectedDate);
  const travelers = model.party.adults + model.party.children + model.party.infants;
  function previewDate(date: string) { setPreview(date); onPreview(date); }
  function commit(date: string) { setPreview(undefined); onPreview(undefined); onCommit(commitDate(draft, activeLeg, date)); }
  function close() { setProvisional(undefined); setPreview(undefined); onPreview(undefined); onCovered(false); requestAnimationFrame(() => trigger.current?.focus()); }
  function open() { setProvisional(structuredClone(draft)); setMonth(selected); setPreview(undefined); onCovered(true); }
  function changeLeg(next: DateLeg) { setLeg(next); setPreview(undefined); if (provisional) setMonth((next === 'outbound' ? provisional.departureDate : provisional.returnDate) ?? provisional.departureDate); }
  const coverage = selectedCell && 'coverage' in selectedCell ? selectedCell.coverage : undefined;
  return <section aria-label="کاوش تاریخ سفر" className={styles.explorer} data-selected-outbound={draft.departureDate} data-selected-return={draft.returnDate ?? ''} data-date-price-id={prices.snapshot?.datePriceId} data-date-price-status={prices.error ? 'unavailable' : prices.snapshot?.status ?? (request ? 'checking' : 'unselected')}>
    <div className={styles.toolbar}><h2>روزهای سفر را مقایسه کنید</h2>{draft.tripType === 'round-trip' && <select aria-label="بخش سفر برای قیمت روزها" value={activeLeg} onChange={event => changeLeg(event.target.value as DateLeg)}><option value="outbound">تاریخ رفت</option><option value="return">تاریخ برگشت</option></select>}<button ref={trigger} type="button" className={styles.monthSelect} onClick={open} disabled={disabled}>تقویم جلالی و انتخاب تاریخ</button></div>
    <p className={styles.caption}>مجموع {new Intl.NumberFormat('fa-IR').format(travelers)} مسافر{model.tripType === 'round-trip' ? ` · رفت‌وبرگشت کامل · ${activeLeg === 'outbound' ? 'برگشت ثابت' : 'رفت ثابت'}: ${model.returnDate || activeLeg === 'return' ? dateLabel(activeLeg === 'outbound' ? model.returnDate! : model.departureDate) : 'هنوز انتخاب نشده'}` : ' · یک‌طرفه'} · به وقت محلی {city?.name ?? 'شهر حرکت'}</p>
    <div className={styles.exploration}><DateWheel dates={dates} value={selected} cells={cells} onPreview={previewDate} onCommit={commit} onInteractionChange={onInteractionChange} leg={activeLeg} /><DateChart leg={activeLeg} cells={cells} selected={selectedDate} onSelect={date => { if (!disabled) commit(date); }} /></div>
    <div className={styles.selection} aria-live="polite"><p>{dateLabel(selectedDate)} · {cellLabel(selectedCell,activeLeg)}</p>{coverage && <p className={styles.status}>{new Intl.NumberFormat('fa-IR').format(coverage.successfulProviderIds.length)} از {new Intl.NumberFormat('fa-IR').format(coverage.expectedProviderIds.length)} فروشنده پاسخ موفق{coverage.complete ? '' : ' · تا این لحظه'}{coverage.failedProviderIds.length ? ' · بخشی از دریافت‌ها ناموفق بود' : ''}</p>}{selectedCell?.status === 'priced' && <p className={styles.status}>مشاهده: <time dateTime={selectedCell.observedAt}>{new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(selectedCell.observedAt))}</time> · کمترین قیمت واجد شرایط همین فرم</p>}</div>
    {!request && <p className={styles.status}>{model.tripType === 'round-trip' && !model.returnDate && activeLeg === 'outbound' ? 'برای قیمت کامل رفت، ابتدا تاریخ برگشت را انتخاب کنید. رفت را می‌توانید بدون قیمت جابه‌جا کنید.' : 'مسیر، تاریخ و شرایط مسافران را کامل کنید تا قیمت روزها بررسی شود.'}</p>}
    {prices.waiting && <p role="status" className={styles.status}>در انتظار ظرفیت بررسی قیمت روزها…</p>}{!!prices.error && <p role="alert" className={styles.error}>قیمت روزها دریافت نشد؛ این به معنی نبودن پیشنهاد نیست.</p>}{prices.retryable && <Button type="button" variant="quiet" onPress={prices.retry}>تلاش دوباره برای قیمت روزها</Button>}
    {waiting && <p role="status" className={styles.status}>تاریخ انتخاب‌شده ثبت شد؛ آخرین انتخاب شما با آزاد شدن ظرفیت جست‌وجو می‌شود.</p>}
    {provisional && <DateCalendar draft={provisional} leg={activeLeg} onLeg={changeLeg} onDraft={setProvisional} month={month} onMonth={setMonth} min={activeLeg === 'return' && provisional.departureDate > bounds.min ? provisional.departureDate : bounds.min} max={bounds.max} localBounds={{ outbound: dateBounds(session, catalog.cities.find(city => city.id === model.originCityId)?.timeZone ?? 'Asia/Tehran'), return: dateBounds(session, catalog.cities.find(city => city.id === model.destinationCityId)?.timeZone ?? 'Asia/Tehran') }} cells={cells} canApply={validateDraft(provisional, catalog, session).valid && !disabled} onApply={() => { onCommit(provisional); close(); }} onCancel={close} />}
  </section>;
}
