import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ComboBox, SegmentedControl } from '@torob-ticket/ui';
import type { CatalogSnapshot, Mode, Party, Scope, SessionInfo, TripType } from '@torob-ticket/contracts';
import { parseDate, PersianCalendar, toCalendar } from '@internationalized/date';
import { dateBounds, requiredAges, type SearchDraft } from './search-url';
import styles from './search.module.css';
export function jalaliLabel(value: string): string {
  try { const date = toCalendar(parseDate(value), new PersianCalendar()); return new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(date.year) + '/' + new Intl.NumberFormat('fa-IR', { useGrouping: false, minimumIntegerDigits: 2 }).format(date.month) + '/' + new Intl.NumberFormat('fa-IR', { useGrouping: false, minimumIntegerDigits: 2 }).format(date.day); } catch { return 'تاریخ را انتخاب کنید'; }
}
export function SearchComposer({ draft, catalog, session, edit, onSubmit, errors, pending, disabled, dateExplorer }: { draft: SearchDraft; catalog: CatalogSnapshot; session: SessionInfo; edit: (patch: Partial<SearchDraft>) => void; onSubmit: () => void; errors: string[]; pending: boolean; disabled: boolean; dateExplorer?: ReactNode }) {
  const selectedOrigin = useRef(draft.originCityId);
  const selectedDestination = useRef(draft.destinationCityId);
  selectedOrigin.current = draft.originCityId;
  selectedDestination.current = draft.destinationCityId;
  const typingOrigin = useRef(false);
  const typingDestination = useRef(false);
  const [originText, setOriginText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const cityName = (id: string) => catalog.cities.find(c => c.id === id)?.name ?? '';
  useEffect(() => { if (typingOrigin.current && !draft.originCityId) { typingOrigin.current = false; return; } setOriginText(cityName(draft.originCityId)); }, [draft.originCityId, catalog]);
  useEffect(() => { if (typingDestination.current && !draft.destinationCityId) { typingDestination.current = false; return; } setDestinationText(cityName(draft.destinationCityId)); }, [draft.destinationCityId, catalog]);
  const routes = catalog.supportedConnections.filter(c => c.mode === draft.mode && c.scope === draft.scope);
  const origins = new Set(routes.map(c => c.originCityId));
  const destinations = new Set(routes.filter(c => c.originCityId === draft.originCityId).map(c => c.destinationCityId));
  const items = (ids: Set<string>) => catalog.cities.filter(c => ids.has(c.id)).map(c => ({ id: c.id, label: c.name }));
  const ages = requiredAges(draft, catalog);
  const party = draft.party;
  function changeCount(key: 'adults' | 'children' | 'infants', value: number) {
    const next: Party = { ...party, [key]: value };
    if (key === 'children') delete next.childAges;
    if (key === 'infants') delete next.infantAgesMonths;
    edit({ party: next });
  }
  const origin = catalog.cities.find(c => c.id === draft.originCityId);
  const destination = catalog.cities.find(c => c.id === draft.destinationCityId);
  const bounds = dateBounds(session, origin?.timeZone ?? 'Asia/Tehran');
  const returnBounds = dateBounds(session, destination?.timeZone ?? 'Asia/Tehran');
  const countError = ![party.adults, party.children, party.infants].every(value => Number.isSafeInteger(value) && value >= 0) || party.adults < 1 || party.adults + party.children + party.infants > 9 || party.infants > party.adults;
  return <form className={styles.composer} aria-label="جست‌وجوی سفر" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
    <div className={styles.segments}><SegmentedControl label="وسیله سفر" value={draft.mode} onChange={value => edit({ mode: value as Mode })} options={[{ id: 'flight', label: 'پرواز', icon: '✈' }, { id: 'train', label: 'قطار', icon: '▤' }, { id: 'bus', label: 'اتوبوس', icon: '▣' }]} /><SegmentedControl label="محدوده سفر" value={draft.scope} onChange={value => edit({ scope: value as Scope })} options={[{ id: 'domestic', label: 'داخلی' }, { id: 'international', label: 'بین‌المللی' }]} />
    <SegmentedControl label="نوع سفر" value={draft.tripType} onChange={value => edit({ tripType: value as TripType })} options={[{ id: 'one-way', label: 'یک‌طرفه' }, { id: 'round-trip', label: 'رفت‌وبرگشت' }]} /></div>
    <div className={styles.fieldGrid}>
      <div><ComboBox label="مبدا" items={items(origins)} selectedKey={draft.originCityId || null} onSelectionChange={id => { selectedOrigin.current = id ?? ''; edit({ originCityId: id ?? '' }); }} inputValue={originText} onInputChange={value => { setOriginText(value); if (value !== cityName(selectedOrigin.current)) { typingOrigin.current = true; edit({ originCityId: '' }); } }} /></div>
      <div><ComboBox label="مقصد" items={items(destinations)} selectedKey={draft.destinationCityId || null} onSelectionChange={id => { selectedDestination.current = id ?? ''; edit({ destinationCityId: id ?? '' }); }} inputValue={destinationText} onInputChange={value => { setDestinationText(value); if (value !== cityName(selectedDestination.current)) { typingDestination.current = true; edit({ destinationCityId: '' }); } }} isDisabled={!draft.originCityId} description="مقصدهای شبکه نمایشی" /></div>
      {!dateExplorer && <label className={`${styles.field} ${styles.dateField}`}>تاریخ رفت <strong>{jalaliLabel(draft.departureDate)}</strong><span className={styles.muted}>ورود میلادی · به وقت محلی {origin?.name ?? 'مبدا'}</span><input aria-label="تاریخ رفت میلادی" type="date" dir="ltr" min={bounds.min} max={bounds.max} value={draft.departureDate} onChange={event => edit({ departureDate: event.target.value })} /></label>}
      {!dateExplorer && draft.tripType === 'round-trip' && <label className={`${styles.field} ${styles.dateField}`}>تاریخ برگشت <strong>{draft.returnDate ? jalaliLabel(draft.returnDate) : 'دوباره انتخاب کنید'}</strong><span className={styles.muted}>ورود میلادی · به وقت محلی {destination?.name ?? 'مقصد'}</span><input aria-label="تاریخ برگشت میلادی" type="date" dir="ltr" min={draft.departureDate > returnBounds.min ? draft.departureDate : returnBounds.min} max={returnBounds.max} value={draft.returnDate ?? ''} onChange={event => edit({ returnDate: event.target.value || undefined })} /></label>}
      <label className={styles.field}>کلاس سفر<select aria-label="کلاس سفر" value={draft.classCode} onChange={event => edit({ classCode: event.target.value })}><option value="">انتخاب کلاس</option>{catalog.classChoices.filter(c => c.mode === draft.mode).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
    </div>
    {dateExplorer}
    <fieldset className={styles.party}><legend>مسافران <span className={styles.muted}>· حداکثر ۹ نفر</span></legend><div className={styles.counts}>{([['adults','بزرگسال'],['children','کودک'],['infants','نوزاد']] as const).map(([key,label]) => <label className={styles.field} key={key}>{label}<input aria-label={`تعداد ${label}`} type="number" min={key === 'adults' ? 1 : 0} max={9} step={1} value={party[key]} aria-invalid={countError || undefined} onChange={event => changeCount(key, event.target.value === '' ? 0 : event.target.valueAsNumber)} /></label>)}</div>
      {countError && <p role="alert" className={styles.error}>حداقل یک بزرگسال، حداکثر ۹ مسافر؛ تعداد نوزاد نباید از بزرگسال بیشتر باشد.</p>}
      <div className={styles.ages}>{ages.children && Array.from({ length: Math.min(8, party.children) }, (_, index) => <label className={styles.field} key={`c${index}`}>سن کودک {index + 1} (سال)<input aria-label={`سن کودک ${index + 1} سال`} type="number" min={0} step={1} disabled={countError} value={(party.childAges?.[index] ?? -1) < 0 ? '' : party.childAges?.[index] ?? ''} onChange={event => { const values = Array.from({ length: Math.min(8, Math.max(0, party.children)) }, (_, i) => party.childAges?.[i] ?? -1); values[index] = event.target.value === '' ? -1 : event.target.valueAsNumber; edit({ party: { ...party, childAges: values } }); }} /></label>)}{ages.infants && Array.from({ length: Math.min(9, party.infants) }, (_, index) => <label className={styles.field} key={`i${index}`}>سن نوزاد {index + 1} (ماه)<input aria-label={`سن نوزاد ${index + 1} ماه`} type="number" min={0} step={1} disabled={countError} value={(party.infantAgesMonths?.[index] ?? -1) < 0 ? '' : party.infantAgesMonths?.[index] ?? ''} onChange={event => { const values = Array.from({ length: Math.min(9, Math.max(0, party.infants)) }, (_, i) => party.infantAgesMonths?.[i] ?? -1); values[index] = event.target.value === '' ? -1 : event.target.valueAsNumber; edit({ party: { ...party, infantAgesMonths: values } }); }} /></label>)}</div>
    </fieldset>
    {Object.keys(draft.filters).length > 0 && <div className={styles.filterNote}>فیلترهای پیوند برای این جست‌وجو حفظ شده‌اند. <Button variant="quiet" onPress={() => edit({ filters: {} })}>پاک کردن فیلترها</Button></div>}
    <div className={styles.submitRow}><Button type="submit" isDisabled={disabled || errors.length > 0} isLoading={pending}>جست‌وجوی سفر</Button><span className={styles.muted}>بدون ورود · بدون خرید یا رزرو</span></div>
    {errors.length > 0 && <p className={styles.help} role="status">{errors.join(' ')}</p>}
  </form>;
}
