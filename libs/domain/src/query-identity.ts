import { DatePriceQuerySchema, HotelSearchQuerySchema, TransportSearchQuerySchema, type DatePriceQuery, type HotelSearchQuery, type Party, type TransportSearchQuery } from '@torob-ticket/contracts';
import { canonicalValue } from './comparison/itinerary-key';
/** Caller supplies revision evidence. This identity is never an access credential. */
export type QueryIdentity = Record<string, unknown>;
function partyIdentity(party: Party) {
  return { ...party, childAges: party.children ? party.childAges?.slice().sort((a, b) => a - b) : [], infantAgesMonths: party.infants ? party.infantAgesMonths?.slice().sort((a, b) => a - b) : [] };
}
export function canonicalTransportQuery(query: TransportSearchQuery) {
  const parsed = TransportSearchQuerySchema.parse(query);
  return { ...parsed, party: partyIdentity(parsed.party), filters: { ...parsed.filters, refundableOnly: parsed.filters.refundableOnly || undefined } };
}
export function datePriceIdentity(request: DatePriceQuery, identity: QueryIdentity): string {
  const input = DatePriceQuerySchema.parse(request);
  const query = canonicalTransportQuery(input.query);
  const { sort: _sort, departureDate, returnDate, ...shared } = query;
  void _sort;
  return canonicalValue(['date-prices', identity, { query: { ...shared, ...(input.leg === 'outbound' ? { returnDate } : { departureDate }) }, leg: input.leg, dates: [...new Set(input.dates)].sort() }]);
}
export function searchIdentity(query: TransportSearchQuery, identity: QueryIdentity): string {
  return canonicalValue(['search', identity, canonicalTransportQuery(query)]);
}
export function hotelIdentity(query: HotelSearchQuery, identity: QueryIdentity): string {
  const parsed = HotelSearchQuerySchema.parse(query);
  return canonicalValue(['hotels', identity, { ...parsed, party: partyIdentity(parsed.party), childAgesAtCheckIn: parsed.childAgesAtCheckIn?.slice().sort((a, b) => a - b) }]);
}
