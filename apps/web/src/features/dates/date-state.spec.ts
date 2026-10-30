import { describe, expect, it } from 'vitest';
import {datePriceKey} from '@torob-ticket/client';
import { dateWindow, commitDate, matchesDateSnapshot, snapshotReusable, datePriceIdentityForSession, cellLabel, disabledCell, dateLabel } from './date-state';
import { query, session } from '../search/search-test-data';
import type { DatePriceCell, DatePriceQuery, DatePriceSnapshot } from '@torob-ticket/contracts';
const request: DatePriceQuery = { query, leg: 'outbound', dates: ['2026-10-25','2026-10-26'], clientGeneration: 'g' };
const snapshot: DatePriceSnapshot = { datePriceId: 'id', clientGeneration: 'g', query: request, status: 'complete', cells: request.dates.map(date => ({ date, status: 'outside-coverage' })), observedAt: '2026-10-25T00:00:00Z' };
describe('date intent and semantic response ownership', () => {
  it('retires earlier fare and schedule estimates while keeping inspected dates and ordering reusable', () => {
    const {fixtureVersion,catalogRevision,seed,anchorInstant,scenario,mappingRevision,scenarioRevision}=session;
    const oldKey=datePriceKey(request,{fixtureVersion,catalogRevision,seed,anchorInstant,scenario,mappingRevision,scenarioRevision});
    const current=datePriceIdentityForSession(request,session);
    expect(current).not.toBe(oldKey);
    const previousDirectionalKey=datePriceKey(request,{fixtureVersion,catalogRevision,seed,anchorInstant,scenario,mappingRevision,scenarioRevision,pricingPolicy:'directional-fares-2026-10-30'});
    expect(current).not.toBe(previousDirectionalKey);
    const round={...request,leg:'return' as const,query:{...query,tripType:'round-trip' as const,returnDate:'2026-10-28'}};
    expect(datePriceIdentityForSession(round,session)).toBe(datePriceIdentityForSession({...round,query:{...round.query,returnDate:'2026-10-29',sort:'fastest'}},session));
    expect(datePriceIdentityForSession(round,session)).not.toBe(datePriceIdentityForSession({...round,query:{...round.query,departureDate:'2026-10-26'}},session));
  });
  it('keeps repeated Persian leap-boundary date labels and exact one-rial price digits', () => {
    for (let repetition = 0; repetition < 10; repetition++) {
      expect(dateLabel('2025-03-20')).toBe('۱۴۰۳/۱۲/۳۰');
      expect(dateLabel('2025-03-21')).toBe('۱۴۰۴/۱/۱');
      expect(dateLabel('invalid')).toBe('تاریخ انتخاب نشده');
      expect(cellLabel({ date: '2026-11-02', status: 'priced', minimum: { amountRial: 25000001, currency: 'IRR' }, quoteIds: ['q'], offerIds: ['o'], observedAt: '2026-10-29T06:00:00Z', coverage: { complete: true, expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [] } })).toBe('۲٬۵۰۰٬۰۰۰٫۱ تومان');
    }
  });
  it('keeps same-day returns structurally valid and clears an invalidated return without committing invalid URL intent', () => {
    const round = { ...query, tripType: 'round-trip' as const, returnDate: query.departureDate };
    expect(commitDate(round, 'return', query.departureDate)).toEqual(round);
    expect(commitDate(round, 'outbound', '2026-10-26').returnDate).toBeUndefined();
    expect(commitDate(round, 'outbound', '2026-10-26').departureDate).toBe('2026-10-26');
  });
  it('bounds local date-only batches and crosses Jalali leap/month boundaries without an instant', () => {
    expect(dateWindow('2025-03-20', '2025-03-18', '2025-03-24', 2)).toEqual(['2025-03-18','2025-03-19','2025-03-20','2025-03-21','2025-03-22']);
    expect(dateWindow('2026-10-25', '2026-10-25', '2027-01-22', 100)).toHaveLength(90);
  });
  it('accepts canonical inspected placeholders and sort changes but rejects both generations, fixed-leg, dates, ID and session drift', () => {
    const canonical = { ...snapshot, query: { ...request, query: { ...query, sort: 'fastest' as const, departureDate: '2026-10-26' } } };
    expect(matchesDateSnapshot(canonical, request, session, 'id')).toBe(true);
    expect(matchesDateSnapshot({ ...canonical, clientGeneration: 'old' }, request, session, 'id')).toBe(false);
    expect(matchesDateSnapshot({ ...canonical, query: { ...canonical.query, clientGeneration: 'old' } }, request, session, 'id')).toBe(false);
    expect(matchesDateSnapshot(canonical, request, session, 'other')).toBe(false);
    expect(matchesDateSnapshot({ ...canonical, query: { ...canonical.query, dates: ['2026-10-25'] } }, request, session)).toBe(false);
    const round = { ...request, query: { ...query, tripType: 'round-trip' as const, returnDate: '2026-10-28' } };
    expect(matchesDateSnapshot({ ...snapshot, query: { ...round, query: { ...round.query, returnDate: '2026-10-29' } } }, round, session)).toBe(false);
    expect(datePriceIdentityForSession(request, session)).not.toBe(datePriceIdentityForSession(request, { ...session, scenarioRevision: 'new' }));
  });
  it('keeps every missing-price state truthful, with leg-aware structural date editing', () => {
    const coverage = { complete: true, expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [] };
    const cells = [{ date: query.departureDate, status: 'checking' },{ date: query.departureDate, status: 'no-match', coverage },{ date: query.departureDate, status: 'outside-coverage' },{ date: query.departureDate, status: 'invalid-date-pair', reason: 'return-before-departure' },{ date: query.departureDate, status: 'unavailable', reason: 'incomplete-price', retryable: false, coverage },{ date: query.departureDate, status: 'unavailable', reason: 'retrieval-failed', retryable: true, coverage }] satisfies readonly DatePriceCell[];
    const labels = cells.map(cell => cellLabel(cell)); expect(new Set(labels).size).toBe(6); expect(labels.every(label => !label.includes('۰ تومان'))).toBe(true);
    expect(disabledCell(cells[2])).toBe(true); expect(disabledCell(cells[3], 'return')).toBe(true); expect(disabledCell(cells[3], 'outbound')).toBe(false); expect(cellLabel(cells[3], 'outbound')).toContain('برگشت'); expect(disabledCell(cells[1])).toBe(false);
  });
  it('retains dated estimates without a clock-only cutoff but rejects future observations and retryable gaps', () => {
    expect(snapshotReusable(snapshot, Date.parse(snapshot.observedAt) + 59999)).toBe(true);
    expect(snapshotReusable(snapshot, Date.parse(snapshot.observedAt) + 3600000)).toBe(true);
    expect(snapshotReusable(snapshot, Date.parse(snapshot.observedAt) - 1)).toBe(false);
    expect(snapshotReusable({ ...snapshot, cells: [{ date: query.departureDate, status: 'unavailable', reason: 'retrieval-failed', retryable: true, coverage: { complete: true, expectedProviderIds: ['p'], successfulProviderIds: [], failedProviderIds: ['p'], pendingProviderIds: [] } }] }, Date.parse(snapshot.observedAt) + 1)).toBe(false);
  });
});
