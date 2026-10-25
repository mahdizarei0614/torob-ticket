import { useId } from 'react';
import { parseDate, toCalendar, PersianCalendar, GregorianCalendar, toCalendarDate, type DateValue, type CalendarDate } from '@internationalized/date';
import { Button as AriaButton, Calendar, CalendarCell, CalendarGrid, CalendarGridHeader, CalendarHeaderCell, CalendarGridBody, Heading, I18nProvider } from 'react-aria-components';
import { Button, Dialog } from '@torob-ticket/ui';
import type { DatePriceCell } from '@torob-ticket/contracts';
import type { SearchDraft } from '../search/search-url';
import { cellLabel, commitDate, dateLabel, type DateLeg } from './date-state';
import styles from './dates.module.css';
const gregorian = (date: DateValue) => toCalendar(toCalendarDate(date), new GregorianCalendar()).toString();
const persian = (date: string) => toCalendar(parseDate(date), new PersianCalendar());
export function DateCalendar({ draft, leg, onLeg, onDraft, month, onMonth, min, max, localBounds, cells, onApply, onCancel, canApply }: { draft: SearchDraft; leg: DateLeg; onLeg: (leg: DateLeg) => void; onDraft: (draft: SearchDraft) => void; month: string; onMonth: (date: string) => void; min: string; max: string; localBounds: { outbound: { min: string; max: string }; return: { min: string; max: string } }; cells: readonly DatePriceCell[]; onApply: () => void; onCancel: () => void; canApply: boolean }) {
  const descriptionId = useId();
  const value = leg === 'outbound' ? draft.departureDate : draft.returnDate;
  const months: CalendarDate[] = []; let cursor = persian(min).set({ day: 1 });
  while (gregorian(cursor) <= max && months.length < 5) { months.push(cursor); cursor = cursor.add({ months: 1 }); }
  const monthKey = `${persian(month).year}-${persian(month).month}`;
  return <Dialog title="انتخاب تاریخ سفر" isOpen onOpenChange={open => { if (!open) onCancel(); }}>
    <p className={styles.status}>تاریخ‌ها تا «اعمال تاریخ‌ها» موقت‌اند. قیمت‌ها مجموع مسافران و برای شرایط همین فرم هستند.</p>
    {draft.tripType === 'round-trip' && <label className={styles.toolbar}>انتخاب بخش سفر<select aria-label="بخش سفر در تقویم" value={leg} onChange={event => onLeg(event.target.value as DateLeg)}><option value="outbound">رفت</option><option value="return">برگشت</option></select></label>}
    <p className={styles.caption}>قیمت خانه‌ها به هزار تومان · مجموع همه مسافران{draft.tripType === 'round-trip' ? ` · ${leg === 'return' ? 'رفت ثابت' : 'برگشت ثابت'}: ${dateLabel((leg === 'return' ? draft.departureDate : draft.returnDate) ?? '')}` : ''}</p>
    <I18nProvider locale="fa-IR-u-ca-persian"><Calendar aria-label={leg === 'outbound' ? 'تقویم تاریخ رفت' : 'تقویم تاریخ برگشت'} className={styles.calendar} createCalendar={() => new PersianCalendar()} value={value ? persian(value) : null} focusedValue={persian(month)} onFocusChange={date => onMonth(gregorian(date))} onChange={date => { if (date) onDraft(commitDate(draft, leg, gregorian(date))); }} minValue={persian(min)} maxValue={persian(max)} isDateUnavailable={date => leg === 'return' && gregorian(date) < draft.departureDate}>
      <header><AriaButton type="button" slot="previous" aria-label="ماه قبل" className={styles.arrow}>‹</AriaButton><Heading /><AriaButton type="button" slot="next" aria-label="ماه بعد" className={styles.arrow}>›</AriaButton></header>
      <label className={styles.toolbar}>رفتن به ماه<select className={styles.monthSelect} aria-label="رفتن به ماه جلالی" value={monthKey} onChange={event => { const date = months.find(date => `${date.year}-${date.month}` === event.target.value); if (date) onMonth(gregorian(date)); }}>{months.map(date => <option key={`${date.year}-${date.month}`} value={`${date.year}-${date.month}`}>{new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${gregorian(date)}T12:00:00Z`))}</option>)}</select></label>
      <CalendarGrid><CalendarGridHeader>{day => <CalendarHeaderCell>{day}</CalendarHeaderCell>}</CalendarGridHeader><CalendarGridBody>{date => { const wire = gregorian(date); const cell = cells.find(cell => cell.date === wire); return <CalendarCell date={date} data-date={wire} className={styles.calendarCell} aria-describedby={`${descriptionId}-${wire}`}>{({ formattedDate }) => <><span>{formattedDate}</span><span id={`${descriptionId}-${wire}`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>{cellLabel(cell,leg)} · مجموع همه مسافران</span><small>{cell?.status === 'priced' ? new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(cell.minimum.amountRial / 10000) : cellLabel(cell,leg)}</small></>}</CalendarCell>; }}</CalendarGridBody></CalendarGrid>
    </Calendar></I18nProvider>
    {draft.tripType === 'round-trip' && !draft.returnDate && <p className={styles.status}>تاریخ برگشت را دوباره انتخاب کنید؛ تاریخ رفت انتخاب‌شده حفظ می‌شود.</p>}
    <div className={styles.manual}><label>تاریخ رفت میلادی<input aria-label="تاریخ رفت میلادی در تقویم" type="date" dir="ltr" min={localBounds.outbound.min} max={localBounds.outbound.max} value={draft.departureDate} onChange={event => { if (event.target.value) onDraft(commitDate(draft, 'outbound', event.target.value)); }} /></label>{draft.tripType === 'round-trip' && <label>تاریخ برگشت میلادی<input aria-label="تاریخ برگشت میلادی در تقویم" type="date" dir="ltr" value={draft.returnDate ?? ''} min={draft.departureDate > localBounds.return.min ? draft.departureDate : localBounds.return.min} max={localBounds.return.max} onChange={event => onDraft({ ...draft, returnDate: event.target.value || undefined })} /></label>}</div>
    <p className={styles.status} aria-live="polite">{value ? `${dateLabel(month)} · ${cellLabel(cells.find(cell => cell.date === month),leg)}` : 'تاریخ برگشت را انتخاب کنید.'}</p>
    <div className={styles.calendarFooter}><Button type="button" onPress={onApply} isDisabled={!canApply}>اعمال تاریخ‌ها</Button><Button type="button" variant="quiet" onPress={onCancel}>انصراف</Button></div>
  </Dialog>;
}
