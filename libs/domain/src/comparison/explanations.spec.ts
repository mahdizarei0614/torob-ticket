import { describe, expect, it } from 'vitest';
import { ExplanationSchema } from '@torob-ticket/contracts';
import { addAirportTransfer, caseContext, comparisonCase, explanationCase, rankingSnapshot, setSnapshotDates } from '../testing/comparison-cases';
import { explainGroup } from './explain-group';
import { groupOffers } from './group-offers';

describe('recomputable factual explanations', () => {
  it('binds quote IDs and versions to absolute price, duration and connection facts', () => {
    const { group, context } = explanationCase();
    const before = structuredClone({ group, context });
    const result = explainGroup(group, context);
    expect(result.find(reason => reason.reasonCode === 'price-difference')).toMatchObject({
      baselineIds: ['baseline-quote', 'target-quote'],
      facts: { baselineQuoteVersion: 1, targetQuoteVersion: 1, baselineAmountRial: 20000000, targetAmountRial: 22000000, amountRial: 2000000 },
    });
    expect(result.find(reason => reason.reasonCode === 'time-saved')?.facts).toMatchObject({ baselineMinutes: 240, targetMinutes: 120, minutes: 120 });
    expect(result.find(reason => reason.reasonCode === 'connection-count')?.facts).toMatchObject({ baselineConnections: 2, targetConnections: 0 });
    expect(result.every(reason => ExplanationSchema.safeParse(reason).success)).toBe(true);
    expect({ group, context }).toEqual(before);
  });

  it('updates the price and per-leg baggage facts when an eligible fare is selected', () => {
    const { group, context } = explanationCase();
    setSnapshotDates(context, '2026-10-25', '2026-10-30');
    const selected = structuredClone(group.eligibleQuotes[0]!);
    selected.quoteId = 'selected-quote';
    selected.version = 3;
    selected.providerId = 'provider-b';
    selected.total.amountRial = 24000000;
    selected.conditions.outbound.checkedBaggageKg = { status: 'unknown', reason: 'not-supplied' };
    selected.conditions.return = { ...selected.conditions.outbound, checkedBaggageKg: { status: 'known', value: 15 } };
    context.groups[0]!.eligibleQuotes[0]!.conditions.return = { ...selected.conditions.outbound, checkedBaggageKg: { status: 'known', value: 20 } };
    group.eligibleQuotes.push(selected);
    context.selectedQuote = { quoteId: selected.quoteId, quoteVersion: selected.version };
    const result = explainGroup(group, context);
    expect(result.find(reason => reason.reasonCode === 'price-difference')).toMatchObject({
      baselineIds: ['baseline-quote', 'selected-quote'], facts: { targetQuoteVersion: 3, targetAmountRial: 24000000, amountRial: 4000000 },
    });
    const baggage = result.filter(reason => reason.reasonCode === 'baggage-difference');
    expect(baggage.find(reason => reason.facts.legIndex === 0 && reason.facts.baggageKind === 0)?.facts).toMatchObject({ baselineKnown: 1, targetKnown: 0 });
    expect(baggage.find(reason => reason.facts.legIndex === 0 && reason.facts.baggageKind === 0)?.facts).not.toHaveProperty('targetKg');
    expect(baggage.find(reason => reason.facts.legIndex === 1 && reason.facts.baggageKind === 0)?.facts).toMatchObject({ baselineKg: 20, targetKg: 15, kilograms: -5 });
  });

  it('counts responding providers, including zero-offer responses, instead of counting offers', () => {
    const { group, context } = explanationCase();
    context.coverageEvidence.providerStatuses[1]!.status = 'running';
    context.coverageEvidence.collectionComplete = false;
    const result = explainGroup(group, context);
    expect(result.find(reason => reason.reasonCode === 'provider-coverage')).toMatchObject({
      facts: { expectedProviders: 2, successfulProviders: 1, failedProviders: 0, pendingProviders: 1, provisional: 1 },
      coverage: { expectedProviderIds: ['provider-a', 'provider-b'], successfulProviderIds: ['provider-a'], failedProviderIds: [], pendingProviderIds: ['provider-b'], complete: false },
    });
    expect(result.every(reason => reason.facts.provisional === 1)).toBe(true);
    context.coverageEvidence.providerStatuses[1]!.status = 'complete';
    context.coverageEvidence.collectionComplete = true;
    expect(explainGroup(group, context).find(reason => reason.reasonCode === 'provider-coverage')?.facts).toMatchObject({ successfulProviders: 2, provisional: 0 });
  });

  it('keeps missing responses pending and terminal failures visible', () => {
    const { group, context } = explanationCase();
    context.coverageEvidence.providerStatuses.pop();
    expect(explainGroup(group, context)[0]?.coverage).toMatchObject({ complete: false, pendingProviderIds: ['provider-b'] });
    context.coverageEvidence.providerStatuses.push({ providerId: 'provider-b', status: 'timeout', offerCount: 0 });
    expect(explainGroup(group, context)[0]?.coverage).toMatchObject({ complete: true, failedProviderIds: ['provider-b'], pendingProviderIds: [] });
  });

  it.each(['stale-version', 'missing-baseline', 'stale-selected', 'incomplete', 'wrong-party', 'wrong-revision', 'duplicate-status', 'unknown-provider', 'detached-target'] as const)('suppresses claims when %s evidence cannot be bound', fault => {
    const { group, context } = explanationCase();
    if (fault === 'stale-version') context.baseline.quoteVersion = 2;
    if (fault === 'missing-baseline') context.groups.shift();
    if (fault === 'stale-selected') context.selectedQuote = { quoteId: 'target-quote', quoteVersion: 2 };
    if (fault === 'incomplete') group.eligibleQuotes[0]!.completeness = { status: 'incomplete', missing: ['tax'] };
    if (fault === 'wrong-party') group.eligibleQuotes[0]!.party.adults = 1;
    if (fault === 'wrong-revision') group.eligibleQuotes[0]!.mappingRevision = 'stale';
    if (fault === 'duplicate-status') context.coverageEvidence.providerStatuses.push(context.coverageEvidence.providerStatuses[0]!);
    if (fault === 'unknown-provider') context.coverageEvidence.providerStatuses[0]!.providerId = 'unexpected';
    if (fault === 'detached-target') context.groups.pop();
    expect(explainGroup(group, context)).toEqual([]);
  });

  it('can report absolute prices against zero without inventing a percentage', () => {
    const { group, context } = explanationCase();
    context.groups[0]!.eligibleQuotes[0]!.total.amountRial = 0;
    const facts = explainGroup(group, context).find(reason => reason.reasonCode === 'price-difference')?.facts;
    expect(facts).toMatchObject({ baselineAmountRial: 0, targetAmountRial: 22000000, amountRial: 22000000 });
    expect(facts).not.toHaveProperty('priceRatio');
  });
});

it('binds an explanation to the authoritative current candidate rather than a stale copied argument', () => {
  const { group, context } = explanationCase();
  const staleCopy = structuredClone(group);
  staleCopy.eligibleQuotes[0]!.total.amountRial = 1;
  expect(explainGroup(staleCopy, context).find(reason => reason.reasonCode === 'price-difference')?.facts.targetAmountRial).toBe(22000000);
});

it('treats a paused provider as terminal unavailable without claiming ongoing collection', () => {
  const { group, context } = explanationCase();
  context.coverageEvidence.providerStatuses[1]!.status = 'paused';
  expect(explainGroup(group, context).find(reason => reason.reasonCode === 'provider-coverage')).toMatchObject({
    facts: { successfulProviders: 1, failedProviders: 1, pendingProviders: 0, provisional: 0 },
    coverage: { complete: true, failedProviderIds: ['provider-b'] },
  });
});

it('rejects quote provenance that conflicts with the frozen source revision', () => {
  const { group, context } = explanationCase();
  group.eligibleQuotes[0]!.provenance[0]!.sourceRevision = 'wrong-source';
  expect(explainGroup(group, context)).toEqual([]);
});


it('retains supplied flight-to-bus airport transfers under flight snapshot identity', () => {
  const directCase = comparisonCase();
  const transferCase = comparisonCase();
  addAirportTransfer(transferCase.offer);
  const baseline = groupOffers([directCase.offer], directCase.query, caseContext(directCase))[0]!;
  const target = groupOffers([transferCase.offer], transferCase.query, caseContext(transferCase))[0]!;
  const quote = baseline.eligibleQuotes[0]!;
  const reasons = explainGroup(target, {
    ...rankingSnapshot([baseline, target]),
    baseline: { groupId: baseline.groupId, quoteId: quote.quoteId, quoteVersion: quote.version },
  });
  expect(reasons.find(reason => reason.reasonCode === 'time-saved')?.facts).toMatchObject({ baselineMinutes: 120, targetMinutes: 210, minutes: -90 });
  expect(reasons.find(reason => reason.reasonCode === 'connection-count')?.facts).toMatchObject({ baselineConnections: 0, targetConnections: 1 });
});
