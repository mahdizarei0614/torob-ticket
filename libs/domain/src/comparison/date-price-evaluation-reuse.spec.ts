import {expect,it} from 'vitest';
import {TransportSearchQuerySchema, type DatePriceCell,type QuoteSnapshot,type NormalizedOffer} from '@torob-ticket/contracts';
import {localDateAt} from '../time';
import {groupOffers} from './group-offers';
import {quoteOffer} from './quote-offer';
import {dateQueryState,projectDatePrices,type DateProjectionInput} from './project-date-prices';
import {comparisonCase,caseContext} from '../testing/comparison-cases';
// Frozen pre-optimization reference for wire-output compatibility only.
/** The same grouping/eligibility authority as selected-date results, with original observations. */
function previousDatePrices(input: DateProjectionInput): { cells: DatePriceCell[]; quotes: { offerId: string; quote: QuoteSnapshot }[] } {
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

function input():DateProjectionInput {
 const c=comparisonCase(),context=caseContext(c),clock='2026-10-24T18:00:00.000Z';
 return{request:{query:c.query,leg:'outbound',dates:[c.query.departureDate],clientGeneration:'reuse-check'},anchorInstant:'2026-10-24T00:00:00.000Z',originTimeZone:'Asia/Tehran',destinationTimeZone:'Asia/Dubai',offers:[c.offer],comparison:context,coverageByDate:{[c.query.departureDate]:{expectedProviderIds:['provider-a'],successfulProviderIds:['provider-a'],failedProviderIds:[],pendingProviderIds:[],complete:true}},observationsByOfferId:{[c.offer.offerId]:clock},persistedQuotes:[]};
}
function parity(make:()=>DateProjectionInput){const old=previousDatePrices(make()),current=projectDatePrices(make());expect(current).toEqual(old);return current;}
it.each(['ordinary','missing-observation','invalid-observation','overflow-observation','incomplete-missing','incomplete-invalid','initial-invalid','initial-overflow','initial-invalid-incomplete','unknown-baggage-filter','source-unbound'] as const)('preserves original eligibility/lifetime/unknown output: %s',cause=>{
 const make=()=>{const f=input(),offer=f.offers[0]!;
  if(cause==='missing-observation'||cause==='incomplete-missing')f.observationsByOfferId={};
  if(cause==='invalid-observation'||cause==='incomplete-invalid')f.observationsByOfferId[offer.offerId]='not-a-date';
  if(cause==='overflow-observation')f.observationsByOfferId[offer.offerId]=new Date(8640000000000000).toISOString();
  if(cause.startsWith('incomplete-')||cause==='initial-invalid-incomplete')offer.completeness={status:'incomplete',missing:['mandatory-charge']};
  if(cause==='initial-invalid'||cause==='initial-invalid-incomplete')f.comparison.realClock={now:()=>new Date(NaN)};
  if(cause==='initial-overflow')f.comparison.realClock={now:()=>new Date(8640000000000000)};
  if(cause==='unknown-baggage-filter'){offer.conditions.outbound.checkedBaggageKg={status:'unknown',reason:'not-supplied'};f.request.query.filters.checkedBaggageMinKg=1;}
  if(cause==='source-unbound')f.comparison.sourceByOfferId={};return f;};
 const result=parity(make);
 if(cause==='incomplete-missing'||cause==='incomplete-invalid'||cause==='initial-invalid-incomplete')expect(result.cells[0]).toMatchObject({status:'unavailable',reason:'incomplete-price'});
 if(cause==='ordinary'){expect(result.quotes[0]!.quote.observedAt).toBe('2026-10-24T18:00:00.000Z');expect(result.quotes[0]!.quote.expiresAt).toBe('2026-10-24T18:10:00.000Z');}
});
it('preserves persisted payload/lifetime authority even when incoming original observations differ',()=>{
 const make=()=>{const f=input(),first=previousDatePrices(f).quotes[0]!.quote;
  f.persistedQuotes=[{...first,observedAt:'2026-10-24T17:00:00Z',expiresAt:'2026-10-24T17:10:00Z'}];return f;};
 const result=parity(make);expect(result.quotes[0]!.quote.expiresAt).toBe('2026-10-24T17:10:00Z');
 const noObservation=()=>{const f=make();f.observationsByOfferId={};return f;};expect(parity(noObservation).quotes).toEqual([]);
});
it('preserves independently evaluated material entries sharing an offer ID and does not cache mutable objects',()=>{
 const f=input(),different=structuredClone(f.offers[0]!);different.total!.amountRial=25000000;different.breakdown=[{code:'gross',amount:different.total!,mandatory:true}];f.offers.push(different);
 expect(projectDatePrices(f)).toEqual(previousDatePrices(f));expect(projectDatePrices(f).quotes).toHaveLength(2);
 const before=projectDatePrices(f);f.offers[0]!.total!.amountRial=26000000;f.offers[0]!.breakdown=[{code:'gross',amount:f.offers[0]!.total!,mandatory:true}];const after=projectDatePrices(f);expect(after).toEqual(previousDatePrices(f));expect(after.quotes[0]!.quote.quoteId).not.toBe(before.quotes[0]!.quote.quoteId);
});
it('preserves input ledger order before ties are sorted into stable cell references',()=>{
 const f=input(),a=f.offers[0]!,b=structuredClone(a);a.offerId='offer-z';b.offerId='offer-a';f.offers=[a,b];const binding=Object.values(f.comparison.sourceByOfferId)[0];f.comparison.sourceByOfferId={[a.offerId]:binding,[b.offerId]:binding};f.observationsByOfferId={[a.offerId]:'2026-10-24T18:00:00Z',[b.offerId]:'2026-10-24T18:00:00Z'};
 const untouched=JSON.stringify(f.offers),result=projectDatePrices(f);expect(result).toEqual(previousDatePrices(f));expect(result.quotes.map(row=>row.offerId)).toEqual(['offer-z','offer-a']);expect(JSON.stringify(f.offers)).toBe(untouched);
});
it.each(['initial','original'] as const)('preserves schema errors for an out-of-wire-range %s observation',clock=>{
 const make=()=>{const f=input();if(clock==='initial')f.comparison.realClock={now:()=>new Date('+010000-01-01T00:00:00.000Z')};else f.observationsByOfferId[f.offers[0]!.offerId]='+010000-01-01T00:00:00.000Z';return f;};
 let oldError:unknown;try{previousDatePrices(make());}catch(error){oldError=error;}expect(oldError).toBeDefined();expect(()=>projectDatePrices(make())).toThrow();
});
it.each(['empty','incomplete'] as const)('captures exactly one initial clock per valid date even for %s input',cause=>{
 for(const implementation of [previousDatePrices,projectDatePrices]){
  const f=input();f.request.dates.push('2026-10-26');let calls=0;f.comparison.realClock={now:()=>{calls++;return new Date('2026-11-01T12:00:00Z');}};
  if(cause==='empty')f.offers=[];else f.offers[0]!.completeness={status:'incomplete',missing:['fees']};
  implementation(f);expect(calls).toBe(2);
 }
});
