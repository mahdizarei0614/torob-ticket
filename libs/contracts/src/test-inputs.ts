/** A fresh valid wire input for contract and downstream tests. */
export function validSearchInput() {
  return {
    mode: 'flight' as const, scope: 'domestic' as const, tripType: 'one-way' as const,
    originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-24',
    party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy',
    filters: {}, sort: 'cheapest' as const,
  };
}
