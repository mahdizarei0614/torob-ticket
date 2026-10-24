import { parseDate } from '@internationalized/date';
import { TransportSearchQuerySchema, type ComparisonGroup, type Coverage, type QuoteSnapshot, type Suggestion } from '@torob-ticket/contracts';
import { boundQuote, comparisonCoverage, normalizedParty, validSnapshot, type ComparisonSnapshot } from './explain-group';
import { compareStableIds, rankGroups } from './rank-groups';
import { canonicalValue } from './itinerary-key';

export interface SuggestionContext {
  searchId: string;
  dismissedSearchId?: string;
  current: ComparisonSnapshot;
  nearbyDates: ComparisonSnapshot[];
}

interface Candidate {
  group: ComparisonGroup;
  quote: QuoteSnapshot;
  coverage: Coverage;
  distance: number;
}

function completedCoverage(snapshot: ComparisonSnapshot): Coverage | null {
  if (!validSnapshot(snapshot)) return null;
  const coverage = comparisonCoverage(snapshot.coverageEvidence);
  if (!coverage?.complete || coverage.expectedProviderIds.length === 0) return null;
  if (coverage.failedProviderIds.length || coverage.pendingProviderIds.length) return null;
  return coverage;
}

function cheapest(snapshot: ComparisonSnapshot): { group: ComparisonGroup; quote: QuoteSnapshot } | null {
  for (const group of rankGroups(snapshot.groups)) {
    const quote = boundQuote(snapshot, group);
    if (quote) return { group, quote };
  }
  return null;
}

function queryConditions(snapshot: ComparisonSnapshot): string {
  const query = TransportSearchQuerySchema.parse(snapshot.query);
  return canonicalValue({
    ...query,
    party: normalizedParty(query.party),
    sort: undefined,
    departureDate: undefined,
    returnDate: undefined,
  });
}

/** Exactly one date-only leg changes; calendar comparison never truncates a travel instant. */
function dateDistance(current: ComparisonSnapshot, candidate: ComparisonSnapshot): number | null {
  if (queryConditions(current) !== queryConditions(candidate)) return null;
  const outboundChanged = current.query.departureDate !== candidate.query.departureDate;
  const returnChanged = current.query.returnDate !== candidate.query.returnDate;
  if (outboundChanged === returnChanged) return null;
  const original = outboundChanged ? current.query.departureDate : current.query.returnDate;
  const alternative = outboundChanged ? candidate.query.departureDate : candidate.query.returnDate;
  if (!original || !alternative) return null;
  const distance = Math.abs(parseDate(alternative).compare(parseDate(original)));
  return distance >= 1 && distance <= 3 ? distance : null;
}

/** At most one suggestion, always relative to the current cheapest complete representative. */
export function chooseSuggestion(context: SuggestionContext): Suggestion | null {
  if (!context.searchId.trim() || context.dismissedSearchId === context.searchId) return null;
  const coverage = completedCoverage(context.current);
  if (!coverage) return null;
  const baseline = cheapest(context.current);
  if (!baseline || baseline.quote.total.amountRial === 0) return null;
  const baselineAmount = BigInt(baseline.quote.total.amountRial);
  const alternatives: Candidate[] = [];
  for (const snapshot of context.nearbyDates) {
    const candidateCoverage = completedCoverage(snapshot);
    if (!candidateCoverage || canonicalValue(candidateCoverage) !== canonicalValue(coverage)) continue;
    if (canonicalValue(snapshot.identity) !== canonicalValue(context.current.identity)) continue;
    const distance = dateDistance(context.current, snapshot);
    if (distance === null) continue;
    const candidate = cheapest(snapshot);
    if (!candidate) continue;
    const saving = baselineAmount - BigInt(candidate.quote.total.amountRial);
    // BigInt avoids floating rounding/overflow at the exact 10% threshold.
    if (saving < 2000000n || saving * 10n < baselineAmount) continue;
    alternatives.push({ ...candidate, coverage: candidateCoverage, distance });
  }
  alternatives.sort((a, b) => a.quote.total.amountRial - b.quote.total.amountRial
    || a.distance - b.distance
    || compareStableIds(a.quote.quoteId, b.quote.quoteId));
  const dateCandidate = alternatives[0];
  let selected = dateCandidate;
  if (!selected) {
    const faster: Candidate[] = [];
    for (const group of context.current.groups) {
      const quote = boundQuote(context.current, group);
      if (!quote || baseline.group.durationMinutes - group.durationMinutes < 90) continue;
      if (BigInt(quote.total.amountRial) * 10n > baselineAmount * 11n) continue;
      faster.push({ group, quote, coverage, distance: 0 });
    }
    faster.sort((a, b) => a.group.durationMinutes - b.group.durationMinutes
      || a.quote.total.amountRial - b.quote.total.amountRial
      || compareStableIds(a.quote.quoteId, b.quote.quoteId));
    selected = faster[0];
  }
  if (!selected) return null;
  return {
    kind: dateCandidate ? 'nearby-date' : 'faster-journey',
    alternativeId: selected.quote.quoteId,
    baselineId: baseline.quote.quoteId,
    delta: {
      amountRial: selected.quote.total.amountRial - baseline.quote.total.amountRial,
      minutes: baseline.group.durationMinutes - selected.group.durationMinutes,
      priceRatio: selected.quote.total.amountRial / baseline.quote.total.amountRial,
    },
    coverage: selected.coverage,
    dismissalScope: { searchId: context.searchId },
  };
}
