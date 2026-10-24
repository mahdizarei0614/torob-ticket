import type { DatePriceQuery, DatePriceCell, NormalizedOffer, Coverage, QuoteSnapshot } from '@torob-ticket/contracts';
import { parseDate } from '@internationalized/date';
import { TransportSearchQuerySchema } from '@torob-ticket/contracts';
import { localDateAt } from '../time';
import { quoteOffer, type ComparisonContext } from './quote-offer';
import { groupOffers } from './group-offers';
export interface DateProjectionInput {
  request: DatePriceQuery;
  anchorInstant: string;
  originTimeZone: string;
  destinationTimeZone: string;
  offers: NormalizedOffer[];
  comparison: ComparisonContext;
  coverageByDate: Record<string, Coverage>;
  observationsByOfferId: Record<string, string>;
  persistedQuotes: QuoteSnapshot[];
  interrupted?: boolean;
}
/** A local calendar range, separately anchored in each departure city's zone. */
export function dateQueryState(input: Pick<DateProjectionInput, 'request' | 'anchorInstant' | 'originTimeZone' | 'destinationTimeZone'>, date: string): 'valid' | 'outside-coverage' | 'invalid-date-pair' {
  const query = { ...input.request.query, ...(input.request.leg === 'outbound' ? { departureDate: date } : { returnDate: date }) };
  if (query.returnDate && query.returnDate < query.departureDate) return 'invalid-date-pair';
  const inside = (value: string, zone: string) => {
    const first = localDateAt(input.anchorInstant, zone);
    return value >= first && value <= parseDate(first).add({ days: 89 }).toString();
  };
  return inside(query.departureDate, input.originTimeZone) && (!query.returnDate || inside(query.returnDate, input.destinationTimeZone)) ? 'valid' : 'outside-coverage';
}

/** The same grouping/eligibility authority as selected-date results, with original observations. */
export function projectDatePrices(input: DateProjectionInput): { cells: DatePriceCell[]; quotes: { offerId: string; quote: QuoteSnapshot }[] } {
  const quotes: { offerId: string; quote: QuoteSnapshot }[] = [];
  const persisted = new Map(input.persistedQuotes.map(quote => [quote.quoteId, quote]));
  // Index only by the inspected departure date; grouping still validates the full
  // journey, opposite leg, fare and party. Avoid O(dates * all inventory) quoting.
  const offersByDate = new Map<string, NormalizedOffer[]>();
  for (const offer of input.offers) {
    const leg = input.request.leg === 'outbound' ? offer.itinerary.outbound : offer.itinerary.return;
    const departure = leg?.segments[0];
    if (!departure) continue;
    const date = localDateAt(departure.departureAt, input.request.leg === 'outbound' ? input.originTimeZone : input.destinationTimeZone);
    const collection = offersByDate.get(date) ?? [];
    collection.push(offer); offersByDate.set(date, collection);
  }
  const cells = [...new Set(input.request.dates)].sort().map((date): DatePriceCell => {
    const state = dateQueryState(input, date);
    if (state === 'invalid-date-pair') return { date, status: state, reason: 'return-before-departure' };
    if (state === 'outside-coverage') return { date, status: state };
    const coverage = input.coverageByDate[date] ?? { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: true };
    const query = TransportSearchQuerySchema.parse({ ...input.request.query, ...(input.request.leg === 'outbound' ? { departureDate: date } : { returnDate: date }) });
    const dateOffers = offersByDate.get(date) ?? [];
    const groups = groupOffers(dateOffers, query, input.comparison);
    const eligibleIds = new Set(groups.flatMap(group => group.eligibleQuotes.map(quote => quote.quoteId)));
    const candidates: { offerId: string; quote: QuoteSnapshot }[] = [];
    for (const offer of dateOffers) {
      const observedAt = input.observationsByOfferId[offer.offerId];
      if (!observedAt) continue; // Never mint a lifetime without the original committed observation.
      const evaluation = quoteOffer(offer, query, { ...input.comparison, realClock: { now: () => new Date(observedAt) } });
      if (evaluation.status !== 'eligible' || !eligibleIds.has(evaluation.quote.quoteId)) continue;
      const quote = persisted.get(evaluation.quote.quoteId) ?? evaluation.quote;
      candidates.push({ offerId: offer.offerId, quote });
    }
    quotes.push(...candidates);
    candidates.sort((a, b) => a.quote.total.amountRial - b.quote.total.amountRial || a.quote.quoteId.localeCompare(b.quote.quoteId));
    if (candidates[0]) {
      const winners = candidates.filter(item => item.quote.total.amountRial === candidates[0]!.quote.total.amountRial);
      return { date, status: 'priced', minimum: candidates[0].quote.total, quoteIds: winners.map(item => item.quote.quoteId), offerIds: winners.map(item => item.offerId), coverage, observedAt: winners.map(item => item.quote.observedAt).sort()[0]! };
    }
    if (input.interrupted) return { date, status: 'unavailable', reason: 'interrupted', retryable: true, coverage };
    if (!coverage.complete) return { date, status: 'checking' };
    const adequate = coverage.expectedProviderIds.length > 0 && coverage.failedProviderIds.length === 0 && coverage.pendingProviderIds.length === 0 && coverage.expectedProviderIds.every(id => coverage.successfulProviderIds.includes(id));
    if (!adequate) return { date, status: 'unavailable', reason: 'retrieval-failed', retryable: true, coverage };
    if (groups.some(group => group.incompletePriceOffers.length)) return { date, status: 'unavailable', reason: 'incomplete-price', retryable: false, coverage };
    return { date, status: 'no-match', coverage };
  });
  return { cells, quotes };
}
