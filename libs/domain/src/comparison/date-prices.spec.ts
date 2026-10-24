import { describe, expect, it } from 'vitest';
import type { Coverage } from '@torob-ticket/contracts';
import { addReturn, caseContext, comparisonCase } from '../testing/comparison-cases';
import { groupOffers } from './group-offers';
import { projectDatePrices, type DateProjectionInput } from './project-date-prices';
const coverage: Coverage = { expectedProviderIds: ['provider-a'], successfulProviderIds: ['provider-a'], failedProviderIds: [], pendingProviderIds: [], complete: true };
function sample(mode: 'flight' | 'train' | 'bus' = 'flight') {
  const c = comparisonCase(mode);
  const input: DateProjectionInput = { request: { query: c.query, leg: 'outbound', dates: ['2026-10-25'], clientGeneration: 'g' }, anchorInstant: '2026-10-24T00:00:00Z', originTimeZone: 'Asia/Tehran', destinationTimeZone: 'Asia/Dubai', offers: [c.offer], comparison: caseContext(c), coverageByDate: { '2026-10-25': coverage }, observationsByOfferId: { [c.offer.offerId]: c.offer.observedAt }, persistedQuotes: [] };
  return { c, input };
}
describe('date minima share selected-date eligibility and complete quote meaning', () => {
  for (const mode of ['flight', 'train', 'bus'] as const) for (const scope of ['domestic', 'international'] as const) it(`${mode}/${scope} matches selected-date grouping, independent of sort`, () => {
    const { c, input } = sample(mode); c.query.scope = scope;
    const expected = Math.min(...groupOffers(input.offers, c.query, input.comparison).flatMap(group => group.eligibleQuotes.map(q => q.total.amountRial)));
    const first = projectDatePrices(input);
    expect(first.cells[0]).toMatchObject({ status: 'priced', minimum: { amountRial: expected }, coverage });
    c.query.sort = 'fastest'; expect(projectDatePrices(input)).toEqual(first);
    expect(Date.parse(first.quotes[0]!.quote.observedAt)).toBe(Date.parse(c.offer.observedAt));
  });
  it('holds the opposite leg fixed and admits a chronologically valid same-day round trip', () => {
    const { c, input } = sample(); addReturn(c.offer, c.query);
    expect(projectDatePrices(input).cells[0]?.status).toBe('priced');
    input.request.leg = 'return'; input.request.dates = ['2026-10-25', '2026-10-26'];
    input.coverageByDate['2026-10-26'] = coverage;
    expect(projectDatePrices(input).cells.map(cell => cell.status)).toEqual(['priced', 'no-match']);
    expect(input.request.query.departureDate).toBe('2026-10-25');
  });
  it('marks an invalid date pair explicitly without moving the fixed leg', () => {
    const { c, input } = sample(); addReturn(c.offer, c.query); input.request.dates = ['2026-10-26'];
    expect(projectDatePrices(input).cells[0]).toEqual({ date: '2026-10-26', status: 'invalid-date-pair', reason: 'return-before-departure' });
    expect(c.query.returnDate).toBe('2026-10-25');
  });
  it('reflects eligibility filters and party mismatch with no zero placeholders', () => {
    const { c, input } = sample(); c.query.filters.refundableOnly = true;
    c.offer.conditions.outbound.refundable = { status: 'unknown', reason: 'missing' };
    expect(projectDatePrices(input).cells[0]?.status).toBe('no-match');
    c.query.filters = {}; c.query.party = { adults: 3, children: 0, infants: 0 };
    expect(projectDatePrices(input).cells[0]?.status).toBe('no-match');
  });
  it('distinguishes pending, failed, interrupted, incomplete and adequate empty evidence', () => {
    const { input, c } = sample(); input.offers = [];
    input.coverageByDate['2026-10-25'] = { ...coverage, successfulProviderIds: [], pendingProviderIds: ['provider-a'], complete: false };
    expect(projectDatePrices(input).cells[0]?.status).toBe('checking');
    input.coverageByDate['2026-10-25'] = { ...coverage, successfulProviderIds: [], failedProviderIds: ['provider-a'] };
    expect(projectDatePrices(input).cells[0]).toMatchObject({ status: 'unavailable', reason: 'retrieval-failed' });
    input.interrupted = true;
    expect(projectDatePrices(input).cells[0]).toMatchObject({ status: 'unavailable', reason: 'interrupted' });
    input.interrupted = false; input.coverageByDate['2026-10-25'] = coverage;
    expect(projectDatePrices(input).cells[0]?.status).toBe('no-match');
    input.offers = [c.offer]; c.offer.completeness = { status: 'incomplete', missing: ['tax'] };
    // A positive visible subtotal must never be promoted to a complete cheap total.
    expect(projectDatePrices(input).cells[0]).toMatchObject({ status: 'unavailable', reason: 'incomplete-price', retryable: false });
  });
  it('zero is a price only when a genuine complete eligible source quote is zero', () => {
    const { c, input } = sample(); c.offer.total = { amountRial: 0, currency: 'IRR' }; c.offer.breakdown = [{ code: 'gross', amount: c.offer.total, mandatory: true }];
    expect(projectDatePrices(input).cells[0]).toMatchObject({ status: 'priced', minimum: { amountRial: 0 } });
    input.offers = []; expect(projectDatePrices(input).cells[0]).not.toHaveProperty('minimum');
  });
  it('retains complete quotes with truthful partial coverage and unchanged evidence lifetime', () => {
    const { input } = sample(); input.coverageByDate['2026-10-25'] = { ...coverage, expectedProviderIds: ['provider-a', 'provider-b'], failedProviderIds: ['provider-b'] };
    const first = projectDatePrices(input);
    expect(first.cells[0]).toMatchObject({ status: 'priced', coverage: { failedProviderIds: ['provider-b'] } });
    input.persistedQuotes = first.quotes.map(item => item.quote); input.comparison.realClock = { now: () => new Date('2027-01-01T00:00:00Z') };
    expect(projectDatePrices(input)).toEqual(first);
  });
  it('uses local day zero through day89, including a leap date and Jalali new-year boundary', () => {
    const { input } = sample(); input.offers = []; input.anchorInstant = '2028-02-28T21:00:00Z';
    input.request.dates = ['2028-02-28', '2028-02-29', '2028-03-20', '2028-05-28', '2028-05-29', '2028-02-29'];
    input.coverageByDate = Object.fromEntries(input.request.dates.map(date => [date, coverage]));
    expect(projectDatePrices(input).cells.map(cell => [cell.date, cell.status])).toEqual([['2028-02-28', 'outside-coverage'], ['2028-02-29', 'no-match'], ['2028-03-20', 'no-match'], ['2028-05-28', 'no-match'], ['2028-05-29', 'outside-coverage']]);
  });
});
