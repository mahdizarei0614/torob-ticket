import { TransportSearchQuerySchema, type ComparisonGroup, type Coverage, type Explanation, type Party, type ProviderStatus, type QuoteSnapshot, type TransportSearchQuery } from '@torob-ticket/contracts';
import { compareStableIds, currentQuote, representativeQuote } from './rank-groups';
import { canonicalValue } from './itinerary-key';
import { localDateAt } from '../time';

export interface CoverageEvidence {
  expectedProviderIds: string[];
  providerStatuses: ProviderStatus[];
  collectionComplete: boolean;
}

export interface ComparisonIdentity {
  sessionId: string;
  fixtureVersion: string;
  fixtureSeed: string;
  mappingRevision: string;
  scenarioRevision: string;
  policyRevision: string;
  sourceRevisionsByProviderId: Record<string, string>;
}

export interface ComparisonSnapshot {
  query: TransportSearchQuery;
  groups: ComparisonGroup[];
  coverageEvidence: CoverageEvidence;
  identity: ComparisonIdentity;
}

export interface QuoteReference {
  quoteId: string;
  quoteVersion: number;
}

export interface ExplanationContext extends ComparisonSnapshot {
  baseline: QuoteReference & { groupId: string };
  selectedQuote?: QuoteReference;
}

export function normalizedParty(party: Party): Party {
  return {
    adults: party.adults,
    children: party.children,
    infants: party.infants,
    ...(party.childAges?.length ? { childAges: [...party.childAges].sort((a, b) => a - b) } : {}),
    ...(party.infantAgesMonths?.length ? { infantAgesMonths: [...party.infantAgesMonths].sort((a, b) => a - b) } : {}),
  };
}

/** Missing rows remain pending. Duplicate or unexpected rows are contradictory evidence. */
export function comparisonCoverage(evidence: CoverageEvidence): Coverage | null {
  const expected = new Set(evidence.expectedProviderIds);
  if (expected.size !== evidence.expectedProviderIds.length || [...expected].some(id => !id.trim())) return null;
  const statuses = new Map<string, ProviderStatus>();
  for (const row of evidence.providerStatuses) {
    if (!expected.has(row.providerId) || statuses.has(row.providerId)) return null;
    statuses.set(row.providerId, row);
  }
  const coverage: Coverage = {
    expectedProviderIds: [...expected].sort(compareStableIds),
    successfulProviderIds: [],
    failedProviderIds: [],
    pendingProviderIds: [],
    complete: false,
  };
  for (const id of coverage.expectedProviderIds) {
    const status = statuses.get(id)?.status;
    if (status === 'complete') coverage.successfulProviderIds.push(id);
    else if (status === 'failed' || status === 'timeout' || status === 'paused' || status === 'cancelled') coverage.failedProviderIds.push(id);
    else coverage.pendingProviderIds.push(id);
  }
  coverage.complete = evidence.collectionComplete && coverage.pendingProviderIds.length === 0;
  return coverage;
}

export function validSnapshot(snapshot: ComparisonSnapshot): boolean {
  const identity = snapshot.identity;
  const values = [identity.sessionId, identity.fixtureVersion, identity.fixtureSeed, identity.mappingRevision, identity.scenarioRevision, identity.policyRevision];
  if (values.some(value => typeof value !== 'string' || !value.trim())) return false;
  if (!TransportSearchQuerySchema.safeParse(snapshot.query).success) return false;
  if (!comparisonCoverage(snapshot.coverageEvidence)) return false;
  return snapshot.coverageEvidence.expectedProviderIds.every(id => {
    const revision = identity.sourceRevisionsByProviderId[id];
    return typeof revision === 'string' && revision.trim().length > 0;
  });
}

/** The caller supplies the current filtered T07 candidate set and its frozen run identity. */
export function boundQuote(snapshot: ComparisonSnapshot, group: ComparisonGroup, reference?: QuoteReference): QuoteSnapshot | undefined {
  if (group.itinerary.mode !== snapshot.query.mode) return undefined;
  if (Boolean(group.itinerary.return) !== (snapshot.query.tripType === 'round-trip')) return undefined;
  const outbound = group.itinerary.outbound.segments[0];
  const inbound = group.itinerary.return?.segments[0];
  if (!outbound || (group.itinerary.return && !inbound)) return undefined;
  try {
    if (localDateAt(outbound.departureAt, outbound.departureTimeZone) !== snapshot.query.departureDate) return undefined;
    if (inbound && localDateAt(inbound.departureAt, inbound.departureTimeZone) !== snapshot.query.returnDate) return undefined;
  } catch {
    return undefined;
  }
  const quote = reference ? currentQuote(group, reference.quoteId) : representativeQuote(group);
  if (!quote || (reference && quote.version !== reference.quoteVersion)) return undefined;
  const identity = snapshot.identity;
  const sourceRevision = identity.sourceRevisionsByProviderId[quote.providerId];
  if (!snapshot.coverageEvidence.expectedProviderIds.includes(quote.providerId)) return undefined;
  if (canonicalValue(normalizedParty(quote.party)) !== canonicalValue(normalizedParty(snapshot.query.party))) return undefined;
  if (quote.fixtureVersion !== identity.fixtureVersion || quote.mappingRevision !== identity.mappingRevision || quote.sourceRevision !== sourceRevision) return undefined;
  if (quote.provenance.some(item => item.fixtureVersion !== identity.fixtureVersion || item.mappingRevision !== identity.mappingRevision || item.sourceRevision !== sourceRevision)) return undefined;
  return quote;
}

export function explainGroup(group: ComparisonGroup, context: ExplanationContext): Explanation[] {
  if (!validSnapshot(context)) return [];
  const targets = context.groups.filter(candidate => candidate.groupId === group.groupId);
  const baselines = context.groups.filter(candidate => candidate.groupId === context.baseline.groupId);
  const targetGroup = targets.length === 1 ? targets[0] : undefined;
  const baselineGroup = baselines.length === 1 ? baselines[0] : undefined;
  if (!targetGroup || !baselineGroup) return [];
  const target = boundQuote(context, targetGroup, context.selectedQuote);
  const baseline = boundQuote(context, baselineGroup, context.baseline);
  const coverage = comparisonCoverage(context.coverageEvidence);
  if (!target || !baseline || !coverage) return [];
  const shared = {
    baselineQuoteVersion: baseline.version,
    targetQuoteVersion: target.version,
    provisional: coverage.complete ? 0 : 1,
  };
  const reason = (reasonCode: Explanation['reasonCode'], facts: Record<string, number>): Explanation => ({
    reasonCode,
    facts: { ...shared, ...facts },
    baselineIds: [baseline.quoteId, target.quoteId],
    coverage,
  });
  const reasons = [
    reason('price-difference', {
      baselineAmountRial: baseline.total.amountRial,
      targetAmountRial: target.total.amountRial,
      amountRial: target.total.amountRial - baseline.total.amountRial,
    }),
    reason('time-saved', {
      baselineMinutes: baselineGroup.durationMinutes,
      targetMinutes: targetGroup.durationMinutes,
      minutes: baselineGroup.durationMinutes - targetGroup.durationMinutes,
    }),
    reason('connection-count', {
      baselineConnections: baselineGroup.connectionCount,
      targetConnections: targetGroup.connectionCount,
    }),
  ];
  for (const [legIndex, leg] of (['outbound', 'return'] as const).entries()) {
    const baselineLeg = baseline.conditions[leg];
    const targetLeg = target.conditions[leg];
    if (!baselineLeg && !targetLeg) continue;
    for (const [baggageKind, field] of (['checkedBaggageKg', 'cabinBaggageKg'] as const).entries()) {
      const baselineQuantity = baselineLeg?.[field];
      const targetQuantity = targetLeg?.[field];
      const facts: Record<string, number> = {
        legIndex,
        baggageKind,
        baselineKnown: baselineQuantity?.status === 'known' ? 1 : 0,
        targetKnown: targetQuantity?.status === 'known' ? 1 : 0,
      };
      if (baselineQuantity?.status === 'known') facts.baselineKg = baselineQuantity.value;
      if (targetQuantity?.status === 'known') facts.targetKg = targetQuantity.value;
      if (baselineQuantity?.status === 'known' && targetQuantity?.status === 'known') {
        facts.kilograms = targetQuantity.value - baselineQuantity.value;
      }
      reasons.push(reason('baggage-difference', facts));
    }
  }
  reasons.push(reason('provider-coverage', {
    expectedProviders: coverage.expectedProviderIds.length,
    successfulProviders: coverage.successfulProviderIds.length,
    failedProviders: coverage.failedProviderIds.length,
    pendingProviders: coverage.pendingProviderIds.length,
  }));
  return reasons;
}
