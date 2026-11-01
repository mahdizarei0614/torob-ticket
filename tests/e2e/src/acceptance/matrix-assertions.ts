import type { Locator, Page } from '@playwright/test';
import type { CatalogSnapshot, ComparisonGroup, DatePriceSnapshot, Party, QuoteSnapshot, SearchRecovery, SortOrder, TransportSearchQuery } from '@torob-ticket/contracts';
import { currentDatePrices, dateExplorer, expect, priceCards, type OwnedReviewer } from '../../fixtures';

export const faNumber = (value: number) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value);
export const money = (amountRial: number) => faNumber(amountRial / 10) + ' تومان';
export const dayLabel = (date: string) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
export function localDate(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const part = (kind: string) => parts.find(part => part.type === kind)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function localMinute(instant: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  return Number(parts.find(part => part.type === 'hour')!.value) * 60 + Number(parts.find(part => part.type === 'minute')!.value);
}
export const allQuotes = (recovery: SearchRecovery) => recovery.snapshot.groups.flatMap(group => group.eligibleQuotes);
export const minimumTotal = (recovery: SearchRecovery) => Math.min(...allQuotes(recovery).map(quote => quote.total.amountRial));
export const legsOf = (group: ComparisonGroup) => [group.itinerary.outbound, ...(group.itinerary.return ? [group.itinerary.return] : [])];
/** An empty optional age array carries the same evidence as omission only when its category is empty. */
function comparableParty(party: Party): Party {
  return { ...party,
    ...(party.children === 0 && !party.childAges?.length ? { childAges: [] } : {}),
    ...(party.infants === 0 && !party.infantAgesMonths?.length ? { infantAgesMonths: [] } : {}),
  };
}

export interface CardFact { id: string; groupId: string; quoteId: string; amountRial: number; durationMinutes: number; connectionCount: number }
/** Independent factual tuples: each supplied itinerary/complete-price bucket is one native card. */
export function expectedCards(recovery: SearchRecovery, sort: SortOrder): CardFact[] {
  const cards = recovery.snapshot.groups.flatMap(group => {
    const prices = [...new Set(group.eligibleQuotes.map(quote => quote.total.amountRial))];
    return prices.map(amountRial => {
      const quotes = group.eligibleQuotes.filter(quote => quote.total.amountRial === amountRial).sort((a, b) => a.quoteId.localeCompare(b.quoteId));
      const quote = quotes.find(quote => quote.quoteId === group.representativeQuoteId) ?? quotes[0]!;
      return { id: JSON.stringify([group.groupId, 'IRR', amountRial]), groupId: group.groupId, quoteId: quote.quoteId, amountRial, durationMinutes: group.durationMinutes, connectionCount: group.connectionCount };
    });
  });
  const difference = (a: CardFact, b: CardFact, key: 'amountRial' | 'durationMinutes' | 'connectionCount') => a[key] - b[key];
  const keys: ('amountRial' | 'durationMinutes' | 'connectionCount')[] = sort === 'fastest' ? ['durationMinutes', 'amountRial', 'connectionCount'] : sort === 'fewest-connections' ? ['connectionCount', 'durationMinutes', 'amountRial'] : ['amountRial', 'durationMinutes', 'connectionCount'];
  return cards.sort((a, b) => keys.map(key => difference(a, b, key)).find(Boolean) || a.groupId.localeCompare(b.groupId) || a.id.localeCompare(b.id));
}

export async function assertCardEvidence(page: Page, recovery: SearchRecovery, sort: SortOrder): Promise<CardFact[]> {
  const expected = expectedCards(recovery, sort);
  await expect(priceCards(page)).toHaveCount(expected.length);
  await expect.poll(() => priceCards(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-price-card-id')))).toEqual(expected.map(card => card.id));
  const visible = await priceCards(page).evaluateAll(nodes => nodes.map(node => ({
    id: node.getAttribute('data-price-card-id')!, groupId: node.getAttribute('data-group-id')!,
    quoteId: node.getAttribute('data-quote-id')!, amountRial: Number(node.getAttribute('data-amount-rial')),
    version: Number(node.getAttribute('data-quote-version')),
    priceLabels: Array.from(node.querySelectorAll('[role="group"][aria-label]')).map(price => price.getAttribute('aria-label')),
  })));
  for (const card of visible) {
    const group = recovery.snapshot.groups.find(group => group.groupId === card.groupId)!;
    const quote = group.eligibleQuotes.find(quote => quote.quoteId === card.quoteId)!;
    expect(quote, 'Every displayed total must identify an actual complete eligible quote').toBeDefined();
    expect(card.amountRial).toBe(quote.total.amountRial);
    expect(card.version).toBe(quote.version);
    expect(quote.total.currency).toBe('IRR');
    expect(quote.party).toEqual(recovery.snapshot.query.party);
    expect(quote.completeness.status).toBe('complete');
    expect(quote.eligibility.status).toBe('eligible');
    expect(card.priceLabels.filter(label => label === `مجموع ${faNumber(quote.party.adults + quote.party.children + quote.party.infants)} مسافر: ${money(quote.total.amountRial)}`)).toHaveLength(1);
  }
  return expected;
}

export function assertCompleteFacts(recovery: SearchRecovery, catalog: CatalogSnapshot): void {
  const query = recovery.snapshot.query;
  expect(recovery.snapshot.status).toBe('complete');
  expect(recovery.snapshot.coverage.complete).toBe(true);
  expect(recovery.snapshot.coverage.failedProviderIds).toEqual([]);
  expect(recovery.snapshot.coverage.pendingProviderIds).toEqual([]);
  expect(recovery.snapshot.coverage.successfulProviderIds.length).toBeGreaterThanOrEqual(1);
  const places = new Map(catalog.places.map(place => [place.id, place]));
  for (const group of recovery.snapshot.groups) {
    expect(group.itinerary.mode).toBe(query.mode);
    expect(Boolean(group.itinerary.return)).toBe(query.tripType === 'round-trip');
    const legs = legsOf(group);
    const duration = Math.ceil(legs.reduce((sum, leg) => sum + (Date.parse(leg.segments.at(-1)!.arrivalAt) - Date.parse(leg.segments[0]!.departureAt)) / 60_000, 0));
    const connections = legs.reduce((sum, leg) => sum + leg.stops.filter(stop => query.mode === 'flight' || stop.vehicleChange).length, 0);
    expect(group.durationMinutes).toBe(duration);
    expect(group.connectionCount).toBe(connections);
    for (const [direction, leg] of legs.entries()) {
      const first = leg.segments[0]!, last = leg.segments.at(-1)!;
      expect(places.get(first.originPlaceId)?.cityId).toBe(direction === 0 ? query.originCityId : query.destinationCityId);
      expect(places.get(last.destinationPlaceId)?.cityId).toBe(direction === 0 ? query.destinationCityId : query.originCityId);
      expect(localDate(first.departureAt, first.departureTimeZone)).toBe(direction === 0 ? query.departureDate : query.returnDate);
      for (const [index, segment] of leg.segments.entries()) {
        expect(places.get(segment.originPlaceId)?.timeZone).toBe(segment.departureTimeZone);
        expect(places.get(segment.destinationPlaceId)?.timeZone).toBe(segment.arrivalTimeZone);
        expect(Date.parse(segment.arrivalAt)).toBeGreaterThan(Date.parse(segment.departureAt));
        const previous = leg.segments[index - 1];
        if (previous) {
          expect(previous.destinationPlaceId).toBe(segment.originPlaceId);
          expect(Date.parse(segment.departureAt)).toBeGreaterThanOrEqual(Date.parse(previous.arrivalAt));
          expect(leg.stops.some(stop => stop.placeId === segment.originPlaceId && stop.waitMinutes === (Date.parse(segment.departureAt) - Date.parse(previous.arrivalAt)) / 60_000)).toBe(true);
        }
        if (segment.mode !== query.mode) {
          expect(segment.mode).toBe('bus');
          expect(leg.stops.some(stop => stop.kind === 'ground-transfer' && stop.vehicleChange && stop.placeId === segment.originPlaceId)).toBe(true);
        }
      }
      for (const stop of leg.stops) {
        expect(places.has(stop.placeId)).toBe(true);
        if (stop.arrivalAt && stop.departureAt) expect((Date.parse(stop.departureAt) - Date.parse(stop.arrivalAt)) / 60_000).toBe(stop.waitMinutes);
      }
    }
    if (group.itinerary.return) expect(Date.parse(group.itinerary.return.segments[0]!.departureAt)).toBeGreaterThanOrEqual(Date.parse(group.itinerary.outbound.segments.at(-1)!.arrivalAt));
    for (const quote of group.eligibleQuotes) {
      expect(quote.party).toEqual(query.party);
      expect(quote.total.currency).toBe('IRR');
      expect(quote.breakdown.reduce((sum, row) => sum + row.amount.amountRial, 0)).toBe(quote.total.amountRial);
      expect(quote.breakdown.every(row => row.amount.currency === 'IRR')).toBe(true);
      expect(Boolean(quote.conditions.return)).toBe(query.tripType === 'round-trip');
      expect([quote.conditions.outbound, ...quote.conditions.return ? [quote.conditions.return] : []].every(terms => terms.classCode === query.classCode)).toBe(true);
    }
  }
}

function waitText(minutes: number): string {
  return `${minutes >= 60 ? `${faNumber(Math.floor(minutes / 60))} ساعت` : ''}${minutes >= 60 && minutes % 60 ? ' و ' : ''}${minutes % 60 || minutes === 0 ? `${faNumber(minutes % 60)} دقیقه` : ''}`;
}
export async function assertTimeline(card: Locator, group: ComparisonGroup): Promise<void> {
  await card.getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
  for (const [direction, leg] of legsOf(group).entries()) {
    const timeline = card.getByRole('region', { name: `جزئیات مسیر ${direction === 0 ? 'رفت' : 'برگشت'}`, exact: true });
    await expect(timeline).toBeVisible();
    expect(await timeline.locator('[data-segment-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-segment-id')))).toEqual(leg.segments.map(segment => segment.segmentId));
    expect(await timeline.locator('[data-stop-place]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-stop-place')))).toEqual(leg.stops.map(stop => stop.placeId));
    for (const [index, stop] of leg.stops.entries()) {
      const row = timeline.locator(`[data-stop-occurrence="${index}"]`);
      await expect(row).toContainText(waitText(stop.waitMinutes) + ' انتظار');
      await expect(row).toContainText(stop.vehicleChange ? 'تعویض وسیله' : 'بدون تعویض وسیله');
    }
    for (const segment of leg.segments) {
      const row = timeline.locator(`[data-segment-id="${segment.segmentId}"]`);
      expect(await row.locator('time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')))).toEqual([segment.departureAt, segment.arrivalAt]);
      await expect(row).toContainText(segment.departureTimeZone);
      await expect(row).toContainText(segment.arrivalTimeZone);
      await expect(row).toHaveAttribute('data-transfer', String(segment.mode !== group.itinerary.mode));
    }
  }
  if (!group.itinerary.return) await expect(card.getByRole('region', { name: 'جزئیات مسیر برگشت', exact: true })).toHaveCount(0);
}

export async function assertDateSurfaces(reviewer: OwnedReviewer, recovery: SearchRecovery): Promise<DatePriceSnapshot> {
  const page = reviewer.page, prices = await currentDatePrices(reviewer);
  const date = prices.query.leg === 'return' ? recovery.snapshot.query.returnDate! : recovery.snapshot.query.departureDate;
  const cell = prices.cells.find(cell => cell.date === date);
  expect(cell?.status).toBe('priced');
  if (!cell || cell.status !== 'priced') throw new Error('The selected date must have a complete current minimum');
  expect(cell.minimum.amountRial).toBe(minimumTotal(recovery));
  expect(cell.minimum.currency).toBe('IRR');
  // An inspected-leg batch is reusable while moving among its cells. Its captured
  // selected date can be older; the opposite leg and the chosen cell are authority.
  if (prices.query.leg === 'return') expect(prices.query.query.departureDate).toBe(recovery.snapshot.query.departureDate);
  else expect(prices.query.query.returnDate).toBe(recovery.snapshot.query.returnDate);
  expect(comparableParty(prices.query.query.party)).toEqual(comparableParty(recovery.snapshot.query.party));
  expect(prices.query.query.filters).toEqual(recovery.snapshot.query.filters);
  const exact = dayLabel(date) + '، ' + money(cell.minimum.amountRial);
  await expect(page.getByRole('listbox', { name: 'روزهای نزدیک', exact: true }).getByRole('option', { name: exact, exact: true })).toHaveAttribute('aria-selected', 'true');
  const chart = page.getByRole('slider', { name: 'انتخاب روز از نمودار', exact: true });
  await expect(chart).toHaveAttribute('aria-valuetext', exact);
  await chart.focus();
  await expect(page.getByRole('tooltip')).toContainText(faNumber(cell.minimum.amountRial / 10));
  return prices;
}

export async function assertCalendarMinimum(reviewer: OwnedReviewer, recovery: SearchRecovery): Promise<DatePriceSnapshot> {
  const page = reviewer.page, before = await dateExplorer(page).getAttribute('data-date-price-id');
  const searchId = recovery.snapshot.searchId;
  await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click();
  const calendar = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
  await expect(calendar).toBeVisible();
  await expect(dateExplorer(page)).not.toHaveAttribute('data-date-price-id', before!);
  const prices = await currentDatePrices(reviewer);
  const date = prices.query.leg === 'return' ? recovery.snapshot.query.returnDate! : recovery.snapshot.query.departureDate;
  const cell = prices.cells.find(cell => cell.date === date);
  expect(cell?.status).toBe('priced');
  if (!cell || cell.status !== 'priced') throw new Error('The calendar selected date must be priced');
  expect(cell.minimum.amountRial).toBe(minimumTotal(recovery));
  await expect(calendar.getByText('قیمت‌ها به هزار تومان', { exact: true })).toBeVisible();
  const day = calendar.locator(`[data-date="${date}"]`);
  await expect(day).toContainText(money(cell.minimum.amountRial));
  await expect(day.locator('[data-price-band]')).toHaveText(faNumber(cell.minimum.amountRial / 10_000));
  await calendar.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(calendar).toBeHidden();
  await expect(page.locator(`[data-search-id="${searchId}"]`)).toHaveCount(1);
  await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', recovery.snapshot.query.departureDate);
  await expect(dateExplorer(page)).toHaveAttribute('data-selected-return', recovery.snapshot.query.returnDate ?? '');
  return prices;
}

export const quoteFact = (group: ComparisonGroup, quote: QuoteSnapshot) => JSON.stringify([
  group.itinerary.outbound.segments.map(segment => segment.serviceId),
  group.itinerary.return?.segments.map(segment => segment.serviceId) ?? [], quote.providerId, quote.total.amountRial,
]);
export function quoteFacts(recovery: SearchRecovery): string[] {
  return recovery.snapshot.groups.flatMap(group => group.eligibleQuotes.map(quote => quoteFact(group, quote))).sort();
}
export function withDate(query: TransportSearchQuery, leg: 'outbound' | 'return', date: string): TransportSearchQuery {
  return { ...query, ...(leg === 'outbound' ? { departureDate: date } : { returnDate: date }) };
}
