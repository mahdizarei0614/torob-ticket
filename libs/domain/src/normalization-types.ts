import type { CatalogSnapshot, JourneyLeg, MappingPatch, NormalizationTrace, NormalizedOffer, Party, RawProviderRecord, TransportSearchQuery } from '@torob-ticket/contracts';
import type { RealClock } from './clocks';
export interface DecodedProviderRecord {
  raw: RawProviderRecord;
  sourceRawRecordId: string;
  serviceKey: string;
  outbound: JourneyLeg;
  inbound?: JourneyLeg;
  originAlias: string;
  destinationAlias: string;
  amount: string | number;
  unit: string;
  mandatoryCharge: string | number | null;
  classCode: string;
  baggageKg: number | null;
  refundable: boolean | null;
  /** Only explicitly supplied material terms; missing source evidence stays absent. */
  materialTerms?: string[];
  available: boolean;
  seats: number;
  party: Party;
  sourceRevision: string;
  mappingRevision: string;
  fixtureVersion: string;
}
export type AliasMapping = Pick<MappingPatch, 'entityType' | 'sourceNamespace' | 'sourceValue' | 'targetId'>;
export interface NormalizationContext {
  query: TransportSearchQuery;
  catalog: CatalogSnapshot;
  mappingRevision: string;
  aliases: readonly AliasMapping[];
  realClock: RealClock;
}
export interface SourceFareEvidence {
  sourceRawRecordId: string;
  sourceRevision: string;
  party: Party;
  seats: number;
  pricingBasis: 'whole-party-gross';
}
export interface NormalizationResult {
  trace: NormalizationTrace;
  offer?: NormalizedOffer;
  source?: SourceFareEvidence;
}
