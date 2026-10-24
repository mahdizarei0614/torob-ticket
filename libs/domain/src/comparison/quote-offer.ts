import {
  IdSchema, NormalizedOfferSchema, PartySchema, QuoteSnapshotSchema, TransportSearchQuerySchema,
  type NormalizedOffer, type Party, type Place, type ProviderCapabilities, type QuoteSnapshot, type TransportSearchQuery,
} from '@torob-ticket/contracts';
import type { RealClock } from '../clocks';
import type { SourceFareEvidence } from '../normalization-types';
import { validateParty, type PartyPolicy } from '../party';
import { matchesEligibility } from '../filters';
import { canonicalValue, comparisonId, itineraryKey } from './itinerary-key';
import { validateCompleteJourney } from './round-trip';

export interface ProviderFarePolicy extends PartyPolicy, Pick<ProviderCapabilities, 'modes' | 'scopes' | 'classCodes'> {
  revision: string;
  sourceAgeBasis: 'category-counts' | 'exact-ages';
  seatUnits: { adult: 1; child: 1; infant: 0 | 1 };
}
export interface BoundSourceFareEvidence { rawRecordId: string; source: SourceFareEvidence }
export interface ComparisonContext {
  realClock: RealClock;
  places: readonly Pick<Place, 'id' | 'cityId' | 'timeZone'>[];
  sourceByOfferId: Record<string, BoundSourceFareEvidence | undefined>;
  policiesByProviderId: Record<string, ProviderFarePolicy | undefined>;
}
export type QuoteEvaluation =
  | { status: 'eligible'; quote: QuoteSnapshot; policyRevision: string }
  | { status: 'incomplete'; offer: NormalizedOffer; reasons: string[]; policyRevision: string }
  | { status: 'rejected'; reasons: string[]; policyRevision?: string };
function validPolicy(policy: ProviderFarePolicy): boolean {
  const validRange = (range: PartyPolicy['childAgeRangeYears']) => !range ||
    Number.isSafeInteger(range.min) && Number.isSafeInteger(range.max) && range.min >= 0 && range.max >= range.min;
  return IdSchema.safeParse(policy.revision).success &&
    typeof policy.requiresChildAges === 'boolean' && typeof policy.requiresInfantAges === 'boolean' &&
    validRange(policy.childAgeRangeYears) && validRange(policy.infantAgeRangeMonths) &&
    ['category-counts', 'exact-ages'].includes(policy.sourceAgeBasis) &&
    policy.seatUnits?.adult === 1 && policy.seatUnits?.child === 1 && [0, 1].includes(policy.seatUnits?.infant) &&
    Array.isArray(policy.modes) && Array.isArray(policy.scopes) && Array.isArray(policy.classCodes);
}

function partyIdentity(party: Party) {
  return {
    adults: party.adults, children: party.children, infants: party.infants,
    childAges: party.children === 0 ? [] : party.childAges ? [...party.childAges].sort((a, b) => a - b) : undefined,
    infantAgesMonths: party.infants === 0 ? [] : party.infantAgesMonths ? [...party.infantAgesMonths].sort((a, b) => a - b) : undefined,
  };
}

/** Evaluates one source-supplied gross fare, never recalculates or joins seller prices. */
export function quoteOffer(offer: NormalizedOffer, query: TransportSearchQuery, context: ComparisonContext): QuoteEvaluation {
  const policy = context.policiesByProviderId[offer.providerId];
  const reject = (...reasons: string[]): QuoteEvaluation => ({
    status: 'rejected', reasons, ...(policy?.revision ? { policyRevision: policy.revision } : {}),
  });
  if (!TransportSearchQuerySchema.safeParse(query).success) return reject('INVALID_QUERY');
  if (!NormalizedOfferSchema.safeParse(offer).success) return reject('INVALID_OFFER');
  if (!policy || !validPolicy(policy)) return reject('MISSING_OR_INVALID_POLICY');
  const supportedFare = policy.modes.includes(query.mode) && policy.scopes.includes(query.scope) && policy.classCodes.includes(query.classCode);
  if (!supportedFare) return reject('UNSUPPORTED_FARE');
  const missingAgePolicy = (query.party.children > 0 && !policy.childAgeRangeYears) || (query.party.infants > 0 && !policy.infantAgeRangeMonths);
  if (missingAgePolicy) return reject('MISSING_AGE_POLICY');
  const partyValidation = validateParty(query.party, policy);
  if (!partyValidation.valid) return reject(partyValidation.code);

  const binding = context.sourceByOfferId[offer.offerId];
  if (!binding) return reject('MISSING_SOURCE_EVIDENCE');
  const source = binding.source;
  if (!source) return reject('INVALID_SOURCE_EVIDENCE');
  const validSource = IdSchema.safeParse(source.sourceRawRecordId).success && PartySchema.safeParse(source.party).success &&
    source.pricingBasis === 'whole-party-gross' && Number.isSafeInteger(source.seats) && source.seats >= 0;
  if (!validSource) return reject('INVALID_SOURCE_EVIDENCE');
  const provenance = offer.provenance[0]!;
  const sourceMismatch = offer.provenance.some(item => item.rawRecordId !== binding.rawRecordId ||
    item.sourceRevision !== source.sourceRevision || item.mappingRevision !== provenance.mappingRevision ||
    item.fixtureVersion !== provenance.fixtureVersion);
  if (sourceMismatch) return reject('SOURCE_BINDING_MISMATCH');
  const sameCounts = source.party.adults === query.party.adults && source.party.children === query.party.children && source.party.infants === query.party.infants;
  if (!sameCounts) return reject('SOURCE_PARTY_MISMATCH');
  const sameAges = canonicalValue(partyIdentity(source.party)) === canonicalValue(partyIdentity(query.party));
  if (policy.sourceAgeBasis === 'exact-ages' && !sameAges) return reject('SOURCE_AGE_MISMATCH');
  const seatsRequired = query.party.adults * policy.seatUnits.adult + query.party.children * policy.seatUnits.child + query.party.infants * policy.seatUnits.infant;
  if (source.seats < seatsRequired) return reject('INSUFFICIENT_SEATS');
  if (offer.availability.status !== 'known' || !offer.availability.value) return reject('AVAILABILITY_UNCONFIRMED');
  if (offer.eligibility.status === 'ineligible') return reject(...offer.eligibility.reasons);
  if (offer.eligibility.status === 'unknown' && offer.eligibility.reasons.some(reason => reason !== 'fare-evaluation-required')) return reject(...offer.eligibility.reasons);

  const journeyReasons = validateCompleteJourney(offer, query, context.places);
  if (journeyReasons.length) return reject(...journeyReasons);
  const incomplete = offer.completeness.status === 'incomplete';
  if (incomplete && query.filters.budgetMaxRial !== undefined) return reject('INCOMPLETE_BUDGET');
  if (!incomplete) {
    const breakdownTotal = offer.breakdown.reduce((sum, part) => sum + BigInt(part.amount.amountRial), 0n);
    if (!offer.breakdown.length || breakdownTotal !== BigInt(offer.total!.amountRial)) return reject('PRICE_BREAKDOWN_MISMATCH');
  }
  // The predicate also serves incomplete display candidates. Its temporary total is never returned as a quote.
  const candidate: NormalizedOffer = {
    ...offer, eligibility: { status: 'eligible' }, completeness: { status: 'complete' },
    total: offer.total ?? { amountRial: 0, currency: 'IRR' },
  };
  if (!matchesEligibility(candidate, query)) return reject('FILTER_MISMATCH');
  if (incomplete) return {
    status: 'incomplete', offer: NormalizedOfferSchema.parse(offer), reasons: ['INCOMPLETE_PRICE'], policyRevision: policy.revision,
  };

  const observed = context.realClock.now();
  if (!Number.isFinite(observed.getTime())) return reject('INVALID_AUDIT_CLOCK');
  const expires = new Date(observed.getTime() + 10 * 60 * 1000);
  if (!Number.isFinite(expires.getTime())) return reject('INVALID_AUDIT_CLOCK');
  const { sort: _sort, ...queryIdentity } = TransportSearchQuerySchema.parse(query);
  void _sort;
  const quoteId = comparisonId('quote', {
    offerId: offer.offerId, fareId: offer.fareId, providerId: offer.providerId,
    rawRecordId: binding.rawRecordId, source, policy,
    query: { ...queryIdentity, party: partyIdentity(query.party) },
    itinerary: itineraryKey(offer.itinerary),
    revisions: offer.provenance.map(item => [item.sourceRevision, item.mappingRevision, item.fixtureVersion]),
    total: offer.total, breakdown: offer.breakdown, conditions: offer.conditions,
  });
  const quote = QuoteSnapshotSchema.parse({
    quoteId,
    version: 1,
    itineraryId: itineraryKey(offer.itinerary),
    fareId: offer.fareId,
    providerId: offer.providerId,
    party: query.party,
    total: offer.total,
    breakdown: offer.breakdown,
    completeness: { status: 'complete' },
    eligibility: { status: 'eligible' },
    conditions: offer.conditions,
    observedAt: observed.toISOString(),
    expiresAt: expires.toISOString(),
    sourceRevision: source.sourceRevision,
    mappingRevision: provenance.mappingRevision,
    fixtureVersion: provenance.fixtureVersion,
    provenance: offer.provenance,
  });
  return { status: 'eligible', quote, policyRevision: policy.revision };
}
