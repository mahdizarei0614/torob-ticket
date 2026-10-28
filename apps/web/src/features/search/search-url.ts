import { TransportSearchQuerySchema, type CatalogSnapshot, type SessionInfo, type TransportSearchQuery } from '@torob-ticket/contracts';
import { localDateAt } from '@torob-ticket/domain';
import { parseDate } from '@internationalized/date';
export type SearchDraft = Omit<TransportSearchQuery, 'returnDate'> & { returnDate?: string };
export function defaultClassCode(mode: SearchDraft['mode'], catalog: CatalogSnapshot, preferred?: string): string {
  const choices = catalog.classChoices.filter(choice => choice.mode === mode);
  if (choices.some(choice => choice.code === preferred)) return preferred!;
  const defaults = { flight: 'economy', train: 'seat', bus: 'standard' } as const;
  return choices.find(choice => choice.code === defaults[mode])?.code ?? choices[0]?.code ?? '';
}
/** New consumer intent compares one adult; persisted evidence keeps its original party. */
export function consumerDraft(draft: SearchDraft, catalog: CatalogSnapshot): SearchDraft {
  return { ...draft, party: { adults: 1, children: 0, infants: 0 }, classCode: defaultClassCode(draft.mode,catalog,draft.classCode) };
}
export function dateBounds(session: SessionInfo, timeZone: string) {
  const min = localDateAt(session.anchorInstant, timeZone);
  return { min, max: parseDate(min).add({ days: 89 }).toString() };
}
/** A first explicit round-trip toggle gets an editable return; subsequent date edits never repair it silently. */
export function initialReturnDate(draft: SearchDraft, catalog: CatalogSnapshot, session: SessionInfo): string | undefined {
  const destination = catalog.cities.find(city => city.id === draft.destinationCityId);
  if (!destination) return undefined;
  try {
    const bounds = dateBounds(session, destination.timeZone);
    const suggested = parseDate(draft.departureDate).add({ days: 3 }).toString();
    const limited = suggested > bounds.max ? bounds.max : suggested < bounds.min ? bounds.min : suggested;
    return limited >= draft.departureDate ? limited : undefined;
  } catch { return undefined; }
}
export function requiredAges(draft: SearchDraft, catalog: CatalogSnapshot) {
  const providers = catalog.providerCapabilities.filter(p => p.modes.includes(draft.mode) && p.scopes.includes(draft.scope) && p.classCodes.includes(draft.classCode) && (!draft.filters.providerIds || draft.filters.providerIds.includes(p.providerId)));
  return { children: providers.some(p => p.requiresChildAges), infants: providers.some(p => p.requiresInfantAges) };
}
export function validateDraft(draft: unknown, catalog: CatalogSnapshot, session: SessionInfo): { valid: boolean; errors: string[]; query?: TransportSearchQuery } {
  const parsed = TransportSearchQuerySchema.safeParse(draft);
  if (!parsed.success) return { valid: false, errors: ['مبدا، مقصد و تاریخ سفر را کامل و معتبر انتخاب کنید.'] };
  const q = parsed.data;
  const errors: string[] = [];
  if (!catalog.supportedConnections.some(c => c.mode === q.mode && c.scope === q.scope && c.originCityId === q.originCityId && c.destinationCityId === q.destinationCityId)) errors.push('این مسیر برای وسیله و محدوده انتخاب‌شده در دسترس نیست.');
  if (!catalog.classChoices.some(c => c.mode === q.mode && c.code === q.classCode)) errors.push('کلاس سفر را از گزینه‌های همین وسیله انتخاب کنید.');
  const providers = catalog.providerCapabilities.filter(p => p.modes.includes(q.mode) && p.scopes.includes(q.scope));
  if (q.filters.providerIds?.some(id => !providers.some(p => p.providerId === id))) errors.push('فروشنده انتخاب‌شده برای این سفر پشتیبانی نمی‌شود.');
  // Operator IDs have only public contract syntax here. The API owns matching. 
  if (q.mode !== 'flight' && q.filters.checkedBaggageMinKg !== undefined) errors.push('فیلتر بار تحویلی فقط برای پرواز است.');
  const ages = requiredAges(q, catalog);
  if ((ages.children && q.party.children && !q.party.childAges) || (ages.infants && q.party.infants && !q.party.infantAgesMonths)) errors.push('سن هر کودک و سن هر نوزاد به ماه برای بررسی شرایط فروشندگان لازم است.');
  for (const [date, cityId] of [[q.departureDate, q.originCityId], [q.returnDate, q.destinationCityId]]) {
    if (!date) continue;
    const city = catalog.cities.find(c => c.id === cityId);
    if (!city) { errors.push('شهر ناشناخته است.'); continue; }
    const bounds = dateBounds(session, city.timeZone);
    if (date < bounds.min || date > bounds.max) errors.push('تاریخ باید در بازه ۹۰ روز آینده و به وقت محلی شهر باشد.');
  }
  return { valid: errors.length === 0, errors, ...(errors.length ? {} : { query: q }) };
}
function ordered(query: TransportSearchQuery): TransportSearchQuery {
  const q = TransportSearchQuerySchema.parse(query);
  return { mode: q.mode, scope: q.scope, tripType: q.tripType, originCityId: q.originCityId, destinationCityId: q.destinationCityId, departureDate: q.departureDate, ...(q.returnDate ? { returnDate: q.returnDate } : {}), party: { adults: q.party.adults, children: q.party.children, infants: q.party.infants, ...(q.party.childAges ? { childAges: q.party.childAges } : {}), ...(q.party.infantAgesMonths ? { infantAgesMonths: q.party.infantAgesMonths } : {}) }, classCode: q.classCode, filters: Object.fromEntries(Object.entries(q.filters).sort(([a], [b]) => a.localeCompare(b))), sort: q.sort };
}
export function serializeSearchUrl(query: TransportSearchQuery): string { return '?' + new URLSearchParams({ q: JSON.stringify(ordered(query)) }).toString(); }
export function parseSearchUrl(search: string, catalog: CatalogSnapshot, session: SessionInfo): { kind: 'empty' | 'valid' | 'invalid'; query?: TransportSearchQuery; draft?: TransportSearchQuery; message?: string } {
  if (!search || search === '?') return { kind: 'empty' };
  const invalid = { kind: 'invalid' as const, message: 'پیوند جست‌وجو معتبر نیست. می‌توانید فرم را اصلاح کنید و دوباره جست‌وجو کنید.' };
  if (search.length > 12000 || /%(?![\da-f]{2})/i.test(search)) return invalid;
  const params = new URLSearchParams(search);
  if ([...params.keys()].some(key => key !== 'q') || params.getAll('q').length !== 1 || !params.get('q')) return invalid;
  try {
    const raw = JSON.parse(params.get('q')!);
    const draft = TransportSearchQuerySchema.safeParse(raw);
    const result = validateDraft(raw, catalog, session);
    return result.valid ? { kind: 'valid', query: result.query! } : { ...invalid, ...(draft.success ? { draft: draft.data } : {}), message: `${invalid.message} ${result.errors.join(' ')}` };
  } catch { return invalid; }
}
export function parseConsumerSearchUrl(search: string, catalog: CatalogSnapshot, session: SessionInfo): ReturnType<typeof parseSearchUrl> {
  const parsed = parseSearchUrl(search,catalog,session);
  const source = parsed.draft ?? parsed.query;
  if (!source) return parsed;
  const draft = consumerDraft(source,catalog);
  const checked = validateDraft(draft,catalog,session);
  return checked.query ? {kind:'valid',query:checked.query} : {...parsed,query:undefined,draft};
}
export function initialDraft(catalog: CatalogSnapshot, session: SessionInfo): SearchDraft {
  const route = catalog.supportedConnections.find(c => c.mode === 'flight' && c.scope === 'domestic') ?? catalog.supportedConnections[0];
  const mode = route?.mode ?? 'flight';
  const origin = catalog.cities.find(c => c.id === route?.originCityId);
  return { mode, scope: route?.scope ?? 'domestic', tripType: 'one-way', originCityId: route?.originCityId ?? '', destinationCityId: route?.destinationCityId ?? '', departureDate: dateBounds(session, origin?.timeZone ?? 'Asia/Tehran').min, party: { adults: 1, children: 0, infants: 0 }, classCode: defaultClassCode(mode,catalog), filters: {}, sort: 'cheapest' };
}
