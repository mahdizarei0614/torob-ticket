import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@torob-ticket/client';
import type { DatePriceQuery, DatePriceSnapshot } from '@torob-ticket/contracts';
import { DatePriceJobs, type DateJobState } from './date-price-jobs';
import { searchStartPool } from '../search/search-start-pool';
import { query, session } from '../search/search-test-data';
const input: DatePriceQuery = { query, leg: 'outbound', dates: [query.departureDate], clientGeneration: 'input' };
function response(request: DatePriceQuery, status: 'checking' | 'complete' = 'complete'): DatePriceSnapshot { return { datePriceId: 'job', query: { ...request, query: { ...request.query, sort: 'cheapest' } }, clientGeneration: request.clientGeneration, status, cells: request.dates.map(date => status === 'checking' ? { date, status: 'checking' as const } : { date, status: 'no-match' as const, coverage: { complete: true, expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [] } }), observedAt: new Date().toISOString() }; }
afterEach(() => vi.useRealTimers());
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
describe('bounded date read ownership', () => {
  it('coalesces StrictMode reacquisition and semantic sort changes, polls one GET then stops terminal', async () => {
    vi.useFakeTimers(); let sent!: DatePriceQuery;
    const client = { startDatePrices: vi.fn(async (request: DatePriceQuery) => { sent = request; return response(request,'checking'); }), getDatePrices: vi.fn(async () => response(sent)), cancelDatePrices: vi.fn(async () => undefined) } as unknown as ApiClient;
    const jobs = new DatePriceJobs(client), states: DateJobState[] = [];
    const release = jobs.acquire(input, session, state => states.push(state)); release();
    const release2 = jobs.acquire({ ...input, query: { ...query, sort: 'fastest' } }, session, state => states.push(state));
    await flush(); expect(client.startDatePrices).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200); expect(client.getDatePrices).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000); expect(client.getDatePrices).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.snapshot?.status).toBe('complete'); release2();
    expect(client.cancelDatePrices).not.toHaveBeenCalled(); expect(searchStartPool(client).getSnapshot().count).toBe(0);
  });
  it.each(['missing','extra','duplicate'])('rejects %s cells as protocol unavailable and cleans exact returned ID', async variant => {
    const client = { startDatePrices: vi.fn(async (request: DatePriceQuery) => ({ ...response(request), cells: variant === 'missing' ? [] : variant === 'duplicate' ? [...response(request).cells,...response(request).cells] : [...response(request).cells,{ ...response(request).cells[0]!, date: '2026-10-26' }] })), cancelDatePrices: vi.fn(async () => undefined) } as unknown as ApiClient;
    const states: DateJobState[] = []; new DatePriceJobs(client).acquire(input, session, state => states.push(state)); await flush(); await flush();
    expect(states.at(-1)?.error).toMatchObject({ kind: 'schema' }); expect(client.cancelDatePrices).toHaveBeenCalledWith('job', expect.any(String));
  });
  it('fences late IDs after reset, retaining the slot until exact stale cleanup completes', async () => {
    let release!: (value: DatePriceSnapshot) => void; let sent!: DatePriceQuery;
    const client = { startDatePrices: vi.fn((request: DatePriceQuery) => { sent = request; return new Promise<DatePriceSnapshot>(resolve => { release = resolve; }); }), cancelDatePrices: vi.fn(async () => undefined) } as unknown as ApiClient;
    const states: DateJobState[] = []; new DatePriceJobs(client).acquire(input, session, state => states.push(state)); await flush();
    const pool = searchStartPool(client); expect(pool.getSnapshot().count).toBe(1); pool.beginReset(); release(response(sent)); await flush(); await flush();
    expect(states.every(state => !state.snapshot)).toBe(true); expect(client.cancelDatePrices).toHaveBeenCalledWith('job', sent.clientGeneration); expect(pool.getSnapshot().count).toBe(0);
  });
  it('prioritizes an authorized selected-date intent over passive read admission', async () => {
    const client = {} as ApiClient, pool = searchStartPool(client); const priority = Symbol('intent'); pool.prioritize(priority,true);
    expect(pool.reserve('date-read')).toBeUndefined(); const selected = pool.reserve(); expect(selected).toBeDefined(); selected!.finish(); pool.prioritize(priority,false); expect(pool.reserve('date-read')).toBeDefined();
  });
});
