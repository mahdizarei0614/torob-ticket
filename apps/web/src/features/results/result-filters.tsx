import { useRef, useState } from 'react';
import type { CatalogSnapshot, EligibilityFilters, SearchSnapshot, TransportSearchQuery } from '@torob-ticket/contracts';
import { Button } from '@torob-ticket/ui';
import { number, operatorLabel } from './format';
import styles from './results.module.css';
const clock = (minute: number) => `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
const minute = (time: string) => Number(time.slice(0,2))*60+Number(time.slice(3));
export function ResultFilters({ query, snapshot, catalog, disabled, onApply, isCurrent = () => true }: { query: TransportSearchQuery; snapshot: SearchSnapshot; catalog: CatalogSnapshot; disabled: boolean; onApply: (query: TransportSearchQuery) => void; isCurrent?: () => boolean }) {
 const trigger = useRef<HTMLDivElement>(null);
 const [open,setOpen] = useState(false); const [error,setError] = useState('');
 const [budget,setBudget] = useState(query.filters.budgetMaxRial === undefined ? '' : String(query.filters.budgetMaxRial/10));
 const [maximum,setMaximum] = useState(query.filters.maxStopsOrTransfers === undefined ? '' : String(query.filters.maxStopsOrTransfers));
 const [baggage,setBaggage] = useState(query.filters.checkedBaggageMinKg === undefined ? '' : String(query.filters.checkedBaggageMinKg));
 const [refundable,setRefundable] = useState(query.filters.refundableOnly ?? false);
 const [providers,setProviders] = useState(query.filters.providerIds ?? []);
 const [operators,setOperators] = useState(query.filters.operatorIds ?? []);
 const [classCode,setClassCode] = useState(query.classCode);
 const [windowEnabled,setWindowEnabled] = useState(Boolean(query.filters.departureWindow));
 const [start,setStart] = useState(clock(query.filters.departureWindow?.startMinute ?? 0));
 const [end,setEnd] = useState(clock(query.filters.departureWindow?.endMinute ?? 1439));
 const operatorIds = [...new Set([...snapshot.groups.flatMap(group => [...group.itinerary.outbound.segments,...group.itinerary.return?.segments ?? []].map(segment => segment.operatorId)),...operators])].sort();
 const toggle = (current: string[], id: string) => current.includes(id) ? current.filter(value => value !== id) : [...current,id];
 const count = Object.values(query.filters).filter(value => value !== undefined && value !== false).length;
 function resetDraft() {
  setBudget(query.filters.budgetMaxRial === undefined ? '' : String(query.filters.budgetMaxRial/10));
  setMaximum(query.filters.maxStopsOrTransfers === undefined ? '' : String(query.filters.maxStopsOrTransfers));
  setBaggage(query.filters.checkedBaggageMinKg === undefined ? '' : String(query.filters.checkedBaggageMinKg));
  setRefundable(query.filters.refundableOnly ?? false);setProviders(query.filters.providerIds ?? []);setOperators(query.filters.operatorIds ?? []);setClassCode(query.classCode);
  setWindowEnabled(Boolean(query.filters.departureWindow));setStart(clock(query.filters.departureWindow?.startMinute ?? 0));setEnd(clock(query.filters.departureWindow?.endMinute ?? 1439));setError('');
 }
 function close() { resetDraft();setOpen(false);if(isCurrent()) trigger.current?.querySelector<HTMLButtonElement>('button')?.focus(); }
 function toggleOpen() { if(!isCurrent()) return;resetDraft();setOpen(!open); }
 function apply(clear = false) {
  if (disabled || !isCurrent()) return;
  if(clear) {onApply({...query,filters:{}});close();return;}
  const parse = (value: string, integral: boolean) => { const parsed = value === '' ? undefined : Number(value); if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0 || (integral && !Number.isSafeInteger(parsed)))) throw new Error('invalid'); return parsed; };
  try {
   const amount = parse(budget,false); const max = parse(maximum,true); const kg = parse(baggage,false);
   if (amount !== undefined && !Number.isSafeInteger(amount*10)) throw new Error('invalid');
   if (windowEnabled && (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end))) throw new Error('invalid');
   const filters: EligibilityFilters = { ...(amount === undefined ? {} : { budgetMaxRial: amount*10 }), ...(max === undefined ? {} : { maxStopsOrTransfers:max }), ...(query.mode === 'flight' && kg !== undefined ? { checkedBaggageMinKg:kg } : {}), ...(refundable ? { refundableOnly:true } : {}), ...(providers.length ? { providerIds:providers } : {}), ...(operators.length ? { operatorIds:operators } : {}), ...(windowEnabled ? { departureWindow: { startMinute:minute(start), endMinute:minute(end) } } : {}) };
   onApply({ ...query, classCode, filters }); setError(''); setOpen(false);
  } catch { setError('مقادیر فیلتر باید عدد معتبر و نامنفی باشند؛ زمان‌ها را کامل وارد کنید.'); }
 }
 return <div ref={trigger} className={styles.filterWrap}><Button variant="secondary" aria-expanded={open} onPress={toggleOpen}>فیلتر نتایج{count ? ` · ${number(count)}` : ''}</Button>{open && <form className={styles.filters} aria-label="فیلتر پیشنهادهای سفر" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}} onSubmit={event => { event.preventDefault(); apply(); }}>
  <div className={styles.filterGrid}><label>سقف مبلغ کل (تومان)<input type="number" min="0" step="0.1" value={budget} onChange={event => setBudget(event.target.value)} /></label><label>{query.tripType === 'round-trip' ? 'حداکثر مجموع ' : 'حداکثر '}{query.mode === 'flight' ? 'توقف' : 'تعویض وسیله'}<input type="number" min="0" step="1" value={maximum} onChange={event => setMaximum(event.target.value)} /></label><label>کلاس نتایج<select value={classCode} onChange={event => setClassCode(event.target.value)}>{catalog.classChoices.filter(choice => choice.mode === query.mode).map(choice => <option key={choice.code} value={choice.code}>{choice.name}</option>)}</select></label>{query.mode === 'flight' && <label>حداقل بار تحویلی (کیلوگرم)<input type="number" min="0" step="any" value={baggage} onChange={event => setBaggage(event.target.value)}/></label>}</div>
  <label className={styles.check}><input type="checkbox" checked={refundable} onChange={event => setRefundable(event.target.checked)}/>فقط قابل استرداد؛ شرایط نامشخص پذیرفته نمی‌شود</label>
  <fieldset><legend>ساعت حرکت{query.tripType === 'round-trip' ? ' رفت' : ''} به وقت محلی مبدا</legend><label className={styles.check}><input type="checkbox" checked={windowEnabled} onChange={event => setWindowEnabled(event.target.checked)}/>محدود کردن بازه حرکت</label>{windowEnabled && <div className={styles.filterGrid}><label>از ساعت<input type="time" value={start} onChange={event => setStart(event.target.value)}/></label><label>تا ساعت<input type="time" value={end} onChange={event => setEnd(event.target.value)}/></label><small className={styles.muted}>بازه‌ای که از نیمه‌شب عبور کند مجاز است.</small></div>}</fieldset>
  <fieldset><legend>فروشنده · انتخاب نکردن یعنی همه</legend><div className={styles.checks}>{catalog.providerCapabilities.filter(p => p.modes.includes(query.mode) && p.scopes.includes(query.scope)).map(provider => <label className={styles.check} key={provider.providerId}><input type="checkbox" checked={providers.includes(provider.providerId)} onChange={() => setProviders(toggle(providers,provider.providerId))}/>{provider.name}</label>)}</div></fieldset>
  <fieldset><legend>شرکت حمل‌ونقل · از مسیرهای دریافت‌شده</legend>{operatorIds.length ? <div className={styles.checks}>{operatorIds.map(id => <label key={id} className={styles.check}><input type="checkbox" checked={operators.includes(id)} onChange={() => setOperators(toggle(operators,id))}/>{operatorLabel(id,query.mode)}</label>)}</div> : <p className={styles.muted}>هنوز شرکت مشخصی از پیشنهادها دریافت نشده است.</p>}</fieldset>
  {error && <p role="alert" className={styles.invalid}>{error}</p>}<div className={styles.filterActions}><Button type="submit" isDisabled={disabled}>اعمال فیلترها</Button><Button variant="quiet" isDisabled={disabled} onPress={() => apply(true)}>پاک کردن فیلترها</Button><Button variant="quiet" onPress={close}>انصراف از فیلتر</Button></div>
 </form>}</div>;
}
