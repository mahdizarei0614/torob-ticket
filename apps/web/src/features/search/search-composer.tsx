import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, ComboBox, SegmentedControl,TransportIcon, useMotionPolicy } from '@torob-ticket/ui';
import type { CatalogSnapshot, Mode, Scope, SessionInfo, TripType } from '@torob-ticket/contracts';
import { parseDate, PersianCalendar, toCalendar } from '@internationalized/date';
import { dateBounds, draftFieldErrors, validateDraft, type SearchDraft, type SearchFieldErrors } from './search-url';
import { SearchFieldFeedback, SearchFieldFeedbackContext } from './search-field-feedback';
import styles from './search.module.css';
export function jalaliLabel(value: string): string {
  try { const date = toCalendar(parseDate(value), new PersianCalendar()); return new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(date.year) + '/' + new Intl.NumberFormat('fa-IR', { useGrouping: false, minimumIntegerDigits: 2 }).format(date.month) + '/' + new Intl.NumberFormat('fa-IR', { useGrouping: false, minimumIntegerDigits: 2 }).format(date.day); } catch { return 'تاریخ را انتخاب کنید'; }
}
export function SearchComposer({ draft, catalog, session, edit, onSubmit, errors, pending, disabled, dateExplorer }: { draft: SearchDraft; catalog: CatalogSnapshot; session: SessionInfo; edit: (patch: Partial<SearchDraft>) => void; onSubmit: () => void; errors: string[]; pending: boolean; disabled: boolean; dateExplorer?: ReactNode }) {
  const form = useRef<HTMLFormElement>(null), focusPending = useRef(false), prefix = useId(), policy = useMotionPolicy();
  const [reported, setReported] = useState<SearchFieldErrors>({}), [attempt, setAttempt] = useState(0);
  const issues = useMemo(() => {
    const fields = draftFieldErrors(draft, catalog, session);
    if (!Object.keys(fields).length && errors.length) fields.form = errors.join(' ');
    return fields;
  }, [draft, catalog, session, errors]);
  const shown = Object.fromEntries(Object.entries(issues).filter(([field]) => field in reported)) as SearchFieldErrors;
  useEffect(() => { setReported(previous => {
    const next = Object.fromEntries(Object.entries(previous).filter(([field]) => field in issues));
    return Object.keys(next).length === Object.keys(previous).length ? previous : next;
  }); }, [issues]);
  const blocked = disabled || pending || policy.covered || policy.disabled || !policy.documentVisible;
  const invalid = Object.keys(issues).length > 0;
  useLayoutEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    if (blocked) return;
    const selector = 'input:not(:disabled),select:not(:disabled),button:not(:disabled):not([aria-disabled="true"]),[tabindex="0"]';
    const target = ['originCityId','destinationCityId','departureDate','returnDate','classCode','filters','form'].flatMap(field => issues[field as keyof SearchFieldErrors] ? Array.from(form.current?.querySelectorAll<HTMLElement>(`[data-search-field~="${field}"]`) ?? []) : []).map(field => field.querySelector<HTMLElement>(selector)).find(Boolean) ?? form.current?.querySelector<HTMLElement>(selector);
    target?.focus();
  }, [attempt, blocked]);
  function submit() {
    if (blocked) return;
    if (!validateDraft(draft, catalog, session).valid || invalid) {
      focusPending.current = true; setReported(issues); setAttempt(value => value + 1);
      return;
    }
    onSubmit();
  }
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
  const origin = catalog.cities.find(c => c.id === draft.originCityId);
  const destination = catalog.cities.find(c => c.id === draft.destinationCityId);
  const bounds = dateBounds(session, origin?.timeZone ?? 'Asia/Tehran');
  const returnBounds = dateBounds(session, destination?.timeZone ?? 'Asia/Tehran');
  return <form ref={form} noValidate className={styles.composer} aria-label="جست‌وجوی سفر" onSubmit={event => { event.preventDefault(); submit(); }}><SearchFieldFeedbackContext.Provider value={{ errors: shown, attempt, prefix, blocked }}>
    <div className={styles.segments}><SegmentedControl hideLabel label="وسیله سفر" value={draft.mode} onChange={value => edit({ mode: value as Mode })} options={[{ id: 'flight', label: 'پرواز', icon: <TransportIcon mode="flight" size={20}/> }, { id: 'train', label: 'قطار', icon: <TransportIcon mode="train" size={20}/> }, { id: 'bus', label: 'اتوبوس', icon: <TransportIcon mode="bus" size={20}/> }]} /><SegmentedControl hideLabel label="محدوده سفر" value={draft.scope} onChange={value => edit({ scope: value as Scope })} options={[{ id: 'domestic', label: 'داخلی' }, { id: 'international', label: 'بین‌المللی' }]} />
    <SegmentedControl hideLabel label="نوع سفر" value={draft.tripType} onChange={value => edit({ tripType: value as TripType })} options={[{ id: 'one-way', label: 'یک‌طرفه' }, { id: 'round-trip', label: 'رفت‌وبرگشت' }]} /></div>
    <div className={`${styles.fieldGrid} ${styles.tripFields}`}>
      <SearchFieldFeedback fields={['originCityId']} showError={false}><ComboBox clearable placeholder="جست‌وجوی شهر مبدا" label="مبدا" error={shown.originCityId} items={items(origins)} selectedKey={draft.originCityId || null} onSelectionChange={id => { selectedOrigin.current = id ?? ''; edit({ originCityId: id ?? '' }); }} inputValue={originText} onInputChange={value => { setOriginText(value); if (value !== cityName(selectedOrigin.current)) { typingOrigin.current = true; edit({ originCityId: '' }); } }} /></SearchFieldFeedback>
      <SearchFieldFeedback fields={['destinationCityId']} showError={false}><ComboBox clearable placeholder={draft.originCityId ? "جست‌وجوی شهر مقصد" : "ابتدا مبدا را انتخاب کنید"} label="مقصد" error={shown.destinationCityId} items={items(destinations)} selectedKey={draft.destinationCityId || null} onSelectionChange={id => { selectedDestination.current = id ?? ''; edit({ destinationCityId: id ?? '' }); }} inputValue={destinationText} onInputChange={value => { setDestinationText(value); if (value !== cityName(selectedDestination.current)) { typingDestination.current = true; edit({ destinationCityId: '' }); } }} isDisabled={!draft.originCityId} /></SearchFieldFeedback>
      {!dateExplorer && <SearchFieldFeedback fields={['departureDate']}><label className={`${styles.field} ${styles.dateField}`}>تاریخ رفت <strong>{jalaliLabel(draft.departureDate)}</strong><input aria-label="تاریخ رفت میلادی" aria-invalid={!!shown.departureDate || undefined} aria-describedby={shown.departureDate ? `${prefix}-departureDate-error` : undefined} type="date" dir="ltr" min={bounds.min} max={bounds.max} value={draft.departureDate} onChange={event => edit({ departureDate: event.target.value })} /></label></SearchFieldFeedback>}
      {!dateExplorer && draft.tripType === 'round-trip' && <SearchFieldFeedback fields={['returnDate']}><label className={`${styles.field} ${styles.dateField}`}>تاریخ برگشت <strong>{draft.returnDate ? jalaliLabel(draft.returnDate) : 'تاریخ را انتخاب کنید'}</strong><input aria-label="تاریخ برگشت میلادی" aria-invalid={!!shown.returnDate || undefined} aria-describedby={shown.returnDate ? `${prefix}-returnDate-error` : undefined} type="date" dir="ltr" min={draft.departureDate > returnBounds.min ? draft.departureDate : returnBounds.min} max={returnBounds.max} value={draft.returnDate ?? ''} onChange={event => edit({ returnDate: event.target.value || undefined })} /></label></SearchFieldFeedback>}
      <div className={styles.classField}><SearchFieldFeedback fields={['classCode']} label="اعتبار کلاس سفر"><SegmentedControl label="کلاس سفر" value={draft.classCode} onChange={value => edit({ classCode: value })} options={catalog.classChoices.filter(choice => choice.mode === draft.mode).map(choice => ({ id: choice.code, label: choice.name }))}/></SearchFieldFeedback></div>
    </div>
    {dateExplorer}
    <SearchFieldFeedback fields={['filters']} label={shown.filters ? 'اعتبار فیلترهای سفر' : undefined}>{Object.keys(draft.filters).length > 0 && <div className={styles.filterNote}>فیلترهای پیوند برای این جست‌وجو حفظ شده‌اند. <Button variant="quiet" onPress={() => edit({ filters: {} })}>پاک کردن فیلترها</Button></div>}</SearchFieldFeedback>
    <div className={styles.submitRow}><Button type="submit" data-invalid={invalid || undefined} aria-describedby={shown.form ? `${prefix}-form-error` : undefined} isDisabled={blocked} isLoading={pending}>جست‌وجوی سفر</Button></div>
    <SearchFieldFeedback fields={['form']}/>
  </SearchFieldFeedbackContext.Provider></form>;
}
