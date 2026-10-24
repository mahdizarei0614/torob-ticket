import { describe, expect, it } from 'vitest';
import { addReturn, caseContext, comparisonCase, rankingGroup, rankingTradeoffs } from '../testing/comparison-cases';
import { groupOffers } from './group-offers';
import { rankGroups } from './rank-groups';

describe('auditable group rankings', () => {
  it.each(['cheapest', 'fastest', 'fewest-connections'] as const)('orders every %s criterion independently of input order', sort => {
    const data = rankingTradeoffs();
    const before = structuredClone(data.groups);
    for (let offset = 0; offset < data.groups.length; offset++) {
      const shuffled = [...data.groups.slice(offset), ...data.groups.slice(0, offset)].reverse();
      expect(rankGroups(shuffled, sort).map(group => group.groupId)).toEqual(data.expected[sort]);
    }
    expect(data.groups).toEqual(before);
  });

  it.each(['cheapest', 'fastest', 'fewest-connections'] as const)('puts incomplete or invalid representatives last for %s', sort => {
    const incomplete = rankingGroup('incomplete', 0, 0);
    incomplete.eligibleQuotes = [];
    delete incomplete.representativeQuoteId;
    const invalid = rankingGroup('invalid', 0, 0);
    invalid.representativeQuoteId = 'absent';
    const eligible = rankingGroup('eligible', 10000000, 600);
    expect(rankGroups([invalid, incomplete, eligible], sort).map(group => group.groupId)).toEqual(['eligible', 'incomplete', 'invalid']);
    expect(rankGroups([invalid, incomplete], sort).map(group => group.groupId)).toEqual(['incomplete', 'invalid']);
    expect(rankGroups([], sort)).toEqual([]);
  });

  it('uses lower price as the fastest secondary and fewest tertiary criterion', () => {
    const costly = rankingGroup('a', 20000001, 120);
    const cheap = rankingGroup('z', 20000000, 120);
    expect(rankGroups([costly, cheap], 'fastest')[0]!.groupId).toBe('z');
    expect(rankGroups([costly, cheap], 'fewest-connections')[0]!.groupId).toBe('z');
  });

  it('ranks asymmetric complete round trips by both legs, excluding destination stay', () => {
    const data = comparisonCase();
    addReturn(data.offer, data.query, '2026-10-25T06:00:00Z', '2026-10-25T11:00:00Z');
    const roundTrip = groupOffers([data.offer], data.query, caseContext(data))[0]!;
    const other = rankingGroup('other', 20000000, 400);
    expect(roundTrip.durationMinutes).toBe(420);
    expect(rankGroups([roundTrip, other], 'fastest')[0]!.groupId).toBe('other');
  });

  it.each(['train', 'bus'] as const)('counts %s dwell in travel time without inventing a transfer', mode => {
    const data = comparisonCase(mode);
    const leg = data.offer.itinerary.outbound;
    leg.stops.push({ placeId: 'mid', kind: 'dwell', waitMinutes: 30, vehicleChange: false });
    const dwell = groupOffers([data.offer], data.query, caseContext(data))[0]!;
    const transfer = rankingGroup('transfer', 20000000, 90, 1);
    expect(dwell.durationMinutes).toBe(120);
    expect(dwell.connectionCount).toBe(0);
    expect(rankGroups([transfer, dwell], 'fewest-connections')[0]!.groupId).toBe(dwell.groupId);
  });
});

it('never promotes an incomplete, ineligible, or mismatched representative quote', () => {
  const good = rankingGroup('good', 20000000, 240);
  const wrongItinerary = rankingGroup('wrong-itinerary', 0, 1);
  wrongItinerary.eligibleQuotes[0]!.itineraryId = 'unrelated';
  const ineligible = rankingGroup('ineligible', 0, 1);
  ineligible.eligibleQuotes[0]!.eligibility = { status: 'ineligible', reasons: ['party'] };
  const incomplete = rankingGroup('incomplete', 0, 1);
  incomplete.eligibleQuotes[0]!.completeness = { status: 'incomplete', missing: ['tax'] };
  expect(rankGroups([wrongItinerary, ineligible, incomplete, good]).map(group => group.groupId)).toEqual(['good', 'incomplete', 'ineligible', 'wrong-itinerary']);
});

it('prioritizes duration over fewer connections in cheapest ties, and price over connections in fastest ties', () => {
  const slowDirect = rankingGroup('slow-direct', 20000000, 180, 0);
  const fastConnection = rankingGroup('fast-connection', 20000000, 120, 1);
  expect(rankGroups([slowDirect, fastConnection], 'cheapest')[0]!.groupId).toBe('fast-connection');
  const costlyDirect = rankingGroup('costly-direct', 20000001, 120, 0);
  expect(rankGroups([costlyDirect, fastConnection], 'fastest')[0]!.groupId).toBe('fast-connection');
});
