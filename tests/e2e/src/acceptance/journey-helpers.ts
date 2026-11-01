import { randomUUID } from 'node:crypto';
import type { APIResponse, Page } from '@playwright/test';
import {
  AdminReferralDetailSchema, AdminReferralListSchema, RecheckResultSchema,
  ReferralReceiptSchema, type ConfirmReferralInput, type HotelSearchSnapshot, type ReferralIntent,
  type ReferralReceipt, type ReferralSelection, type SearchSnapshot,
} from '@torob-ticket/contracts';
import { expect, type OwnedReviewer } from '../../fixtures';

export async function contractResponse<T>(response: APIResponse, schema: { parse(value: unknown): T }, status = 200): Promise<T> {
  // Do not dump response headers: they may contain the owned namespace cookie.
  expect(response.status()).toBe(status);
  return schema.parse(await response.json());
}

export async function prepare(reviewer: OwnedReviewer, selection: ReferralSelection) {
  return contractResponse(await reviewer.context.request.post('/api/v1/referrals/prepare', { data: selection }), RecheckResultSchema, 201);
}

export const confirmation = (intent: ReferralIntent, idempotencyKey = 't30-' + randomUUID()): ConfirmReferralInput => ({
  intentId: intent.intentId, acceptedQuoteVersion: intent.selection.quoteVersion, idempotencyKey,
});

export async function confirm(reviewer: OwnedReviewer, input: ConfirmReferralInput): Promise<ReferralReceipt> {
  return contractResponse(await reviewer.context.request.post('/api/v1/referrals/confirm', { data: input }), ReferralReceiptSchema, 201);
}

export function exactReceipt(receipt: ReferralReceipt, intent: ReferralIntent): void {
  expect(receipt.intentId).toBe(intent.intentId);
  expect(receipt.selection).toEqual(intent.selection);
  expect(receipt.payload).toEqual(intent.quote);
  expect(receipt.handoffPath).toBe('/provider-demo/' + receipt.referralId);
}

export const referralList = async (reviewer: OwnedReviewer) => contractResponse(await reviewer.context.request.get('/api/v1/admin/referrals'), AdminReferralListSchema);
export const referralDetail = async (reviewer: OwnedReviewer, id: string) => contractResponse(await reviewer.context.request.get('/api/v1/admin/referrals/' + id), AdminReferralDetailSchema);

/** The authored recheck-change record is service zero, rather than whichever row ranks first. */
export function scenarioQuote(snapshot: SearchSnapshot) {
  const quote = snapshot.groups.flatMap(group => group.eligibleQuotes).find(candidate =>
    candidate.providerId === 'demo-provider-04' && candidate.provenance.some(item => {
      const source = item.sourceValue as { payload?: { reference?: unknown } } | null;
      return typeof source?.payload?.reference === 'string' && source.payload.reference.endsWith(':0');
    }),
  );
  expect(quote, 'The current scenario must provide its authored service-zero quote').toBeDefined();
  return quote!;
}

export function nextDay(date: string): string {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function localDate(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const read = (kind: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === kind)!.value;
  return `${read('year')}-${read('month')}-${read('day')}`;
}

/** Assert the observable sort objective and tie prices without calling the product ranker. */
export function hotelOrder(snapshot: HotelSearchSnapshot): void {
  const rows = snapshot.results!;
  expect(rows).toBeDefined();
  const priced = rows.filter(row => row.status === 'priced');
  expect(rows.slice(0, priced.length).every(row => row.status === 'priced')).toBe(true);
  const total = (id: string) => snapshot.quotes.find(quote => quote.quoteId === id)!.total.amountRial;
  const metric = (row: typeof rows[number]) => snapshot.query.sort === 'stars'
    ? snapshot.hotels.find(hotel => hotel.hotelId === row.hotelId)!.stars
    : snapshot.query.sort === 'arrival-distance' ? row.arrivalDistanceKm
    : snapshot.query.sort === 'location-distance' ? row.locationDistanceKm
    : total(row.representativeQuoteId!);
  for (let index = 1; index < priced.length; index++) {
    const before = priced[index - 1]!, after = priced[index]!;
    const a = metric(before), b = metric(after);
    if (a === null) expect(b).toBeNull();
    else if (b !== null) {
      if (snapshot.query.sort === 'stars') expect(a).toBeGreaterThanOrEqual(b);
      else expect(a).toBeLessThanOrEqual(b);
      if (a === b) expect(total(before.representativeQuoteId!)).toBeLessThanOrEqual(total(after.representativeQuoteId!));
    }
  }
}

export async function hotelProjection(page: Page, snapshot: HotelSearchSnapshot): Promise<void> {
  const region = page.getByRole('region', { name: 'نتایج مقایسه اقامتگاه‌ها', exact: true });
  await expect(region).toHaveAttribute('data-hotel-search-id', snapshot.hotelSearchId);
  const cards = region.locator('article[data-hotel-id]');
  await expect.poll(() => cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-hotel-id')))).toEqual(snapshot.results!.map(row => row.hotelId));
  for (const row of snapshot.results!) {
    const card = cards.locator(`xpath=self::*[@data-hotel-id="${row.hotelId}"]`);
    await expect(card).toHaveAttribute('data-hotel-status', row.status);
    if (row.representativeQuoteId) {
      const quote = snapshot.quotes.find(quote => quote.quoteId === row.representativeQuoteId)!;
      await expect(card).toHaveAttribute('data-hotel-quote-id', quote.quoteId);
      await expect(card).toHaveAttribute('data-hotel-price-rial', String(quote.total.amountRial));
    }
  }
}

/** Only the requested destination navigation is intercepted; recheck/confirm remain real. */
export async function interceptPlaceholder(reviewer: OwnedReviewer): Promise<string[]> {
  const attempts: string[] = [];
  await reviewer.context.route(/^https:\/\/zarei\.xyz(?:\/|$)/, async route => {
    attempts.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>T30 navigation boundary</title><p>Approved placeholder navigation intercepted.</p>' });
  });
  return attempts;
}

export async function expectPlaceholder(page: Page, trigger: () => Promise<unknown>): Promise<Page> {
  const pending = page.waitForEvent('popup');
  await trigger();
  const popup = await pending;
  await expect(popup).toHaveURL('https://zarei.xyz/');
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await expect(page.locator('[data-provider-handoff-overlay]')).toHaveCount(0);
  return popup;
}
