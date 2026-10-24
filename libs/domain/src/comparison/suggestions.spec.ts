import { describe, expect, it } from 'vitest';
import { SuggestionSchema } from '@torob-ticket/contracts';
import { rankingGroup, rankingSnapshot, setSnapshotDates, suggestionCase } from '../testing/comparison-cases';
import { chooseSuggestion } from './choose-suggestion';

describe('bounded contextual suggestions', () => {
  it('selects the exact ten-percent and 200000-toman nearby-day saving', () => {
    const context = suggestionCase();
    const before = structuredClone(context);
    const result = chooseSuggestion(context);
    expect(result).toMatchObject({ kind: 'nearby-date', alternativeId: 'alternative-quote', baselineId: 'baseline-quote', delta: { amountRial: -2000000, minutes: 0, priceRatio: 0.9 }, dismissalScope: { searchId: 'search-1' } });
    expect(SuggestionSchema.safeParse(result).success).toBe(true);
    expect(context).toEqual(before);
  });

  it.each([
    [30000000, 27030000], // 9.9% but more than 200000 toman.
    [10000000, 8000001], // More than 10%, one rial short of absolute minimum.
    [0, 0],
  ])('suppresses insufficient/undefined saving for baseline %s and candidate %s', (baseline, alternative) => {
    expect(chooseSuggestion(suggestionCase(baseline, alternative))).toBeNull();
  });

  it.each(['2026-10-22', '2026-10-28'])('accepts inclusive three-day boundary %s', date => {
    expect(chooseSuggestion(suggestionCase(20000000, 18000000, date))?.kind).toBe('nearby-date');
  });
  it.each(['2026-10-21', '2026-10-29', '2026-10-25'])('rejects outside or unchanged date %s', date => {
    expect(chooseSuggestion(suggestionCase(20000000, 18000000, date))).toBeNull();
  });

  it('uses calendar days across a leap-day boundary', () => {
    const context = suggestionCase(20000000, 18000000, '2028-03-02');
    setSnapshotDates(context.current, '2028-02-28');
    expect(chooseSuggestion(context)?.kind).toBe('nearby-date');
    setSnapshotDates(context.nearbyDates[0]!, '2028-03-03');
    expect(chooseSuggestion(context)).toBeNull();
  });

  it('prefers greater saving then nearest day then stable quote ID regardless of input order', () => {
    const context = suggestionCase(20000000, 17000000, '2026-10-28');
    const nearer = rankingSnapshot([rankingGroup('nearer', 17000000, 240)]);
    setSnapshotDates(nearer, '2026-10-26');
    const stable = structuredClone(nearer);
    stable.groups = [rankingGroup('a', 17000000, 240)];
    setSnapshotDates(stable, '2026-10-26');
    const lessSaving = rankingSnapshot([rankingGroup('cheap-looking', 18000000, 240)]);
    setSnapshotDates(lessSaving, '2026-10-24');
    context.nearbyDates.push(nearer, stable, lessSaving);
    expect(chooseSuggestion(context)?.alternativeId).toBe('a-quote');
    context.nearbyDates.reverse();
    expect(chooseSuggestion(context)?.alternativeId).toBe('a-quote');
  });

  it('holds the opposite leg fixed for outbound and return-date changes', () => {
    const context = suggestionCase();
    setSnapshotDates(context.current, '2026-10-25', '2026-10-30');
    setSnapshotDates(context.nearbyDates[0]!, '2026-10-26', '2026-10-30');
    expect(chooseSuggestion(context)?.kind).toBe('nearby-date');
    setSnapshotDates(context.nearbyDates[0]!, '2026-10-26', '2026-10-31');
    expect(chooseSuggestion(context)).toBeNull();
    setSnapshotDates(context.nearbyDates[0]!, '2026-10-25', '2026-10-31');
    expect(chooseSuggestion(context)?.kind).toBe('nearby-date');
  });

  it('uses the current cheapest representative even when input order or user sort differs', () => {
    const context = suggestionCase();
    context.current.groups.unshift(rankingGroup('costly', 40000000, 180));
    context.current.query.sort = 'fastest';
    expect(chooseSuggestion(context)?.baselineId).toBe('baseline-quote');
  });

  it('normalizes restriction lists and age order but does not price sort', () => {
    const context = suggestionCase();
    context.current.query.filters = { providerIds: [], operatorIds: [] };
    context.nearbyDates[0]!.query.sort = 'fastest';
    expect(chooseSuggestion(context)?.kind).toBe('nearby-date');
    for (const snapshot of [context.current, ...context.nearbyDates]) {
      snapshot.query.party = { adults: 1, children: 2, infants: 0, childAges: [4, 8] };
      snapshot.groups[0]!.eligibleQuotes[0]!.party = structuredClone(snapshot.query.party);
    }
    context.nearbyDates[0]!.query.party.childAges = [8, 4];
    expect(chooseSuggestion(context)?.kind).toBe('nearby-date');
  });

  it.each(['party', 'filters', 'class', 'mode', 'route', 'session', 'seed', 'fixture', 'mapping', 'scenario', 'policy', 'source', 'quote-revision', 'quote-party', 'pending', 'failed', 'providers', 'duplicate-status', 'missing-identity'] as const)('suppresses incomparable %s evidence', fault => {
    const context = suggestionCase();
    const candidate = context.nearbyDates[0]!;
    if (fault === 'party') candidate.query.party.adults = 1;
    if (fault === 'filters') candidate.query.filters.refundableOnly = true;
    if (fault === 'class') candidate.query.classCode = 'business';
    if (fault === 'mode') candidate.query.mode = 'bus';
    if (fault === 'route') candidate.query.destinationCityId = 'other';
    if (fault === 'session') candidate.identity.sessionId = 'other';
    if (fault === 'seed') candidate.identity.fixtureSeed = 'other';
    if (fault === 'fixture') candidate.identity.fixtureVersion = 'other';
    if (fault === 'mapping') candidate.identity.mappingRevision = 'other';
    if (fault === 'scenario') candidate.identity.scenarioRevision = 'other';
    if (fault === 'policy') candidate.identity.policyRevision = 'other';
    if (fault === 'source') candidate.identity.sourceRevisionsByProviderId['provider-a'] = 'other';
    if (fault === 'quote-revision') candidate.groups[0]!.eligibleQuotes[0]!.mappingRevision = 'other';
    if (fault === 'quote-party') candidate.groups[0]!.eligibleQuotes[0]!.party.adults = 1;
    if (fault === 'pending') candidate.coverageEvidence.collectionComplete = false;
    if (fault === 'failed') candidate.coverageEvidence.providerStatuses[1]!.status = 'failed';
    if (fault === 'providers') candidate.coverageEvidence.expectedProviderIds.push('provider-c');
    if (fault === 'duplicate-status') candidate.coverageEvidence.providerStatuses.push(candidate.coverageEvidence.providerStatuses[0]!);
    if (fault === 'missing-identity') candidate.identity.sessionId = '';
    expect(chooseSuggestion(context)).toBeNull();
  });

  it('dismisses only the same search and suppresses zero eligible candidates', () => {
    const context = suggestionCase();
    context.dismissedSearchId = 'search-1';
    expect(chooseSuggestion(context)).toBeNull();
    context.dismissedSearchId = 'older-search';
    expect(chooseSuggestion(context)?.kind).toBe('nearby-date');
    context.current.groups = [];
    expect(chooseSuggestion(context)).toBeNull();
  });

  it('falls back to the greatest time saving, then lower price, then stable ID', () => {
    const context = suggestionCase(20000000, 19000000);
    context.current.groups.push(
      rankingGroup('ninety', 21000000, 150),
      rankingGroup('costlier', 22000000, 120),
      rankingGroup('z', 21500000, 120),
      rankingGroup('a', 21500000, 120),
    );
    expect(chooseSuggestion(context)).toMatchObject({ kind: 'faster-journey', alternativeId: 'a-quote', delta: { amountRial: 1500000, minutes: 120, priceRatio: 1.075 } });
    context.nearbyDates = [suggestionCase().nearbyDates[0]!];
    expect(chooseSuggestion(context)?.kind).toBe('nearby-date');
  });

  it.each([
    [22000000, 150, true],
    [22000001, 150, false],
    [22000000, 151, false],
  ])('checks exact faster bounds at %s rials and %s minutes', (price, duration, qualifies) => {
    const context = suggestionCase();
    context.nearbyDates = [];
    context.current.groups.push(rankingGroup('fast', price, duration));
    expect(chooseSuggestion(context)?.kind ?? null).toBe(qualifies ? 'faster-journey' : null);
  });

  it('compares safe-integer price thresholds without overflowing multiplication', () => {
    const context = suggestionCase(9007199254740990, 8106479329266891);
    expect(chooseSuggestion(context)?.kind).toBe('nearby-date');
    context.nearbyDates[0]!.groups[0]!.eligibleQuotes[0]!.total.amountRial++;
    expect(chooseSuggestion(context)).toBeNull();
  });
});

it('requires all-success coverage even when both searches have the same terminal failures', () => {
  const context = suggestionCase();
  for (const snapshot of [context.current, ...context.nearbyDates]) {
    snapshot.coverageEvidence.providerStatuses[1]!.status = 'failed';
  }
  expect(chooseSuggestion(context)).toBeNull();
});

it('rejects empty provider coverage and missing representatives instead of inventing a baseline', () => {
  const context = suggestionCase();
  context.current.groups[0]!.representativeQuoteId = 'missing';
  expect(chooseSuggestion(context)).toBeNull();
  context.current.groups[0]!.representativeQuoteId = 'baseline-quote';
  context.current.coverageEvidence = { expectedProviderIds: [], providerStatuses: [], collectionComplete: true };
  expect(chooseSuggestion(context)).toBeNull();
});

it.each(['outbound-date', 'return-date', 'trip-shape', 'mode'] as const)('rejects a snapshot relabeled with a mismatched %s', fault => {
  const context = suggestionCase();
  const candidate = context.nearbyDates[0]!;
  if (fault === 'outbound-date') candidate.query.departureDate = '2026-10-27';
  if (fault === 'return-date') {
    setSnapshotDates(context.current, '2026-10-25', '2026-10-30');
    setSnapshotDates(candidate, '2026-10-26', '2026-10-30');
    candidate.groups[0]!.itinerary.return!.segments[0]!.departureAt = '2026-10-29T08:00:00Z';
  }
  if (fault === 'trip-shape') {
    candidate.query.tripType = 'round-trip';
    candidate.query.returnDate = '2026-10-30';
    setSnapshotDates(context.current, '2026-10-25', '2026-10-30');
  }
  if (fault === 'mode') candidate.groups[0]!.itinerary.mode = 'bus';
  expect(chooseSuggestion(context)).toBeNull();
});
