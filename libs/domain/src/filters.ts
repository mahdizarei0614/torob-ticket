import { MoneySchema, type NormalizedOffer, type TransportSearchQuery } from '@torob-ticket/contracts';
import { hasSupportedSegmentModes, journeyConnectionCount } from './comparison/round-trip';
import { localDateAt, matchesDepartureWindow } from './time';

/** Consumes normalized eligibility; provider policy/age validation precedes this. */
export function matchesEligibility(offer: NormalizedOffer, query: TransportSearchQuery): boolean {
  if (offer.eligibility.status !== 'eligible' || offer.completeness.status !== 'complete' || !MoneySchema.safeParse(offer.total).success) return false;
  if (offer.availability.status !== 'known' || !offer.availability.value) return false;
  if (offer.itinerary.mode !== query.mode) return false;
  const hasReturn = query.tripType === 'round-trip';
  if (Boolean(offer.itinerary.return) !== hasReturn || Boolean(offer.conditions.return) !== hasReturn) return false;
  const legs = [offer.itinerary.outbound, ...(offer.itinerary.return ? [offer.itinerary.return] : [])];
  const conditions = [offer.conditions.outbound, ...(offer.conditions.return ? [offer.conditions.return] : [])];
  const outboundDeparture = legs[0]?.segments[0];
  const returnDeparture = legs[1]?.segments[0];
  if (!outboundDeparture || localDateAt(outboundDeparture.departureAt, outboundDeparture.departureTimeZone) !== query.departureDate) return false;
  if (hasReturn && (!returnDeparture || localDateAt(returnDeparture.departureAt, returnDeparture.departureTimeZone) !== query.returnDate)) return false;
  const outboundArrival = offer.itinerary.outbound.segments.at(-1);
  if (returnDeparture && outboundArrival && Date.parse(returnDeparture.departureAt) < Date.parse(outboundArrival.arrivalAt)) return false;
  if (conditions.some(terms => terms.classCode !== query.classCode)) return false;

  const filters = query.filters;
  if (filters.budgetMaxRial !== undefined && offer.total!.amountRial > filters.budgetMaxRial) return false;
  if (filters.providerIds?.length && !filters.providerIds.includes(offer.providerId)) return false;
  const segments = legs.flatMap(leg => leg.segments);
  if (legs.some(leg => !hasSupportedSegmentModes(leg, query.mode))) return false;
  if (filters.operatorIds?.length && segments.filter(segment => segment.mode === query.mode).some(segment => !filters.operatorIds!.includes(segment.operatorId))) return false;
  if (filters.departureWindow && !matchesDepartureWindow(outboundDeparture.departureAt, outboundDeparture.departureTimeZone, filters.departureWindow)) return false;
  const stopsOrTransfers = journeyConnectionCount(offer.itinerary);
  if (filters.maxStopsOrTransfers !== undefined && stopsOrTransfers > filters.maxStopsOrTransfers) return false;
  if (filters.refundableOnly && conditions.some(terms => terms.refundable.status !== 'known' || !terms.refundable.value)) return false;
  if (filters.checkedBaggageMinKg !== undefined && conditions.some(terms => terms.checkedBaggageKg.status !== 'known' || terms.checkedBaggageKg.value < filters.checkedBaggageMinKg!)) return false;
  return true;
}
