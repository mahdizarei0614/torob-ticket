import { ItinerarySchema, type ComparisonGroup, type NormalizedOffer, type TransportSearchQuery } from '@torob-ticket/contracts';
import { quoteOffer, type ComparisonContext } from './quote-offer';
import { itineraryKey } from './itinerary-key';
import { journeyConnectionCount, journeyDurationMinutes } from './round-trip';

/** Stable journey collection only; T08 owns ranking across groups. */
export function groupOffers(offers: NormalizedOffer[], query: TransportSearchQuery, context: ComparisonContext): ComparisonGroup[] {
  const groups = new Map<string, ComparisonGroup>();
  // The chosen source display itinerary must not depend on provider completion order.
  const orderedOffers = [...offers].sort((a, b) => a.offerId < b.offerId ? -1 : a.offerId > b.offerId ? 1 : 0);
  const observedAt = context.realClock.now().getTime();
  const snapshotContext = { ...context, realClock: { now: () => new Date(observedAt) } };
  for (const offer of orderedOffers) {
    const evaluation = quoteOffer(offer, query, snapshotContext);
    if (evaluation.status === 'rejected') continue;
    const groupId = itineraryKey(offer.itinerary);
    let group = groups.get(groupId);
    if (!group) {
      group = {
        groupId, itinerary: { ...ItinerarySchema.parse(offer.itinerary), itineraryId: groupId },
        eligibleQuotes: [], incompletePriceOffers: [],
        durationMinutes: journeyDurationMinutes(offer.itinerary), connectionCount: journeyConnectionCount(offer.itinerary),
      };
      groups.set(groupId, group);
    }
    if (evaluation.status === 'eligible') {
      if (!group.eligibleQuotes.some(quote => quote.quoteId === evaluation.quote.quoteId)) group.eligibleQuotes.push(evaluation.quote);
    } else if (!group.incompletePriceOffers.some(candidate => candidate.offerId === offer.offerId)) {
      group.incompletePriceOffers.push(evaluation.offer);
    }
  }
  for (const group of groups.values()) {
    group.eligibleQuotes.sort((a, b) => a.total.amountRial - b.total.amountRial || (a.quoteId < b.quoteId ? -1 : a.quoteId > b.quoteId ? 1 : 0));
    if (group.eligibleQuotes[0]) group.representativeQuoteId = group.eligibleQuotes[0].quoteId;
  }
  return [...groups.values()].sort((a, b) => a.groupId < b.groupId ? -1 : a.groupId > b.groupId ? 1 : 0);
}
