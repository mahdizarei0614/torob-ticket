import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientError, type ApiClient } from '@torob-ticket/client';
import { DatePriceSnapshotSchema, type DatePriceQuery, type DatePriceSnapshot } from '@torob-ticket/contracts';
import { useDatePrices } from './use-date-prices';
import { datePriceIdentityForSession } from './date-state';
import { query, session } from '../search/search-test-data';
const request: DatePriceQuery = { query, leg: 'outbound', dates: [query.departureDate], clientGeneration: 'freshness-test' };
function snapshot(sent: DatePriceQuery, observedAt = new Date().toISOString()): DatePriceSnapshot { return DatePriceSnapshotSchema.parse({ datePriceId: 'date-observation', clientGeneration: sent.clientGeneration, query: sent, status: 'complete', observedAt, cells: [{ date: query.departureDate, status: 'priced', minimum: { amountRial: 1000000, currency: 'IRR' }, quoteIds: ['original-quote'], offerIds: ['original-offer'], observedAt, coverage: { complete: true, expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [] } }] }); }
function setup(start: (sent: DatePriceQuery) => Promise<DatePriceSnapshot>) {
  const client = { startDatePrices: vi.fn(start), cancelDatePrices: vi.fn(async () => undefined) } as unknown as ApiClient;
  const cache = new QueryClient();
  const hook = renderHook(() => useDatePrices(request, session, true, client), { wrapper: ({ children }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider> });
  return { ...hook, client, cache };
}
afterEach(() => vi.useRealTimers());
describe('actual pricing hook/registry freshness boundary', () => {
  it.each([-61000,1000])('rejects a receipt with observation offset %s without automatic retry or changed evidence', async offset => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T01:00:00Z')); const observedAt = new Date(Date.now() + offset).toISOString();
    const hook = setup(async sent => snapshot(sent, observedAt));
    await act(async () => { await vi.advanceTimersByTimeAsync(121); });
    expect(hook.result.current.snapshot).toBeUndefined(); expect(hook.result.current.error).toMatchObject({ message: 'date-prices-stale' }); expect(hook.result.current.waiting).toBe(false); expect(hook.result.current.retryable).toBe(true);
    expect(hook.result.current.staleSnapshot).toMatchObject({ observedAt, cells: [{ quoteIds: ['original-quote'], observedAt }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(hook.client.startDatePrices).toHaveBeenCalledTimes(1); expect(hook.result.current.snapshot).toBeUndefined(); hook.unmount();
  });
  it('is priced at 59999ms, immediately unavailable at 60000ms, and only explicitly refreshes once', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T01:00:00Z')); const original = new Date().toISOString();
    const hook = setup(async sent => snapshot(sent, original));
    await act(async () => { await vi.advanceTimersByTimeAsync(121); });
    await act(async () => { await vi.advanceTimersByTimeAsync(59878); }); expect(hook.result.current.snapshot?.cells[0]?.status).toBe('priced');
    await act(async () => { await vi.advanceTimersByTimeAsync(1); }); expect(hook.result.current.snapshot).toBeUndefined(); expect(hook.result.current.waiting).toBe(false); expect(hook.result.current.error).toMatchObject({ message: 'date-prices-stale' });
    expect(hook.cache.getQueryData(['date-prices',datePriceIdentityForSession(request,session)])).toBeUndefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(119); }); expect(hook.result.current.snapshot).toBeUndefined(); expect(hook.client.startDatePrices).toHaveBeenCalledTimes(1);
    vi.mocked(hook.client.startDatePrices).mockImplementation(async sent => snapshot(sent)); act(() => hook.result.current.retry()); expect(hook.result.current.snapshot).toBeUndefined(); expect(hook.result.current.waiting).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(121); }); expect(hook.client.startDatePrices).toHaveBeenCalledTimes(2); expect(hook.result.current.snapshot?.cells[0]?.status).toBe('priced'); hook.unmount();
  });
  it('keeps an explicit stale-refresh failure unavailable and bounded, with original historical evidence', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T01:00:00Z')); const original = new Date().toISOString(); const hook = setup(async sent => snapshot(sent, original));
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); }); expect(hook.result.current.snapshot).toBeUndefined();
    vi.mocked(hook.client.startDatePrices).mockRejectedValueOnce(new ClientError('network','network-unavailable')); act(() => hook.result.current.retry());
    await act(async () => { await vi.advanceTimersByTimeAsync(121); }); expect(hook.result.current.error).toMatchObject({ message: 'network-unavailable' }); expect(hook.result.current.snapshot).toBeUndefined(); expect(hook.result.current.waiting).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); }); expect(hook.client.startDatePrices).toHaveBeenCalledTimes(2);
    const historic = hook.cache.getQueryCache().getAll().flatMap(entry => (entry.state.data as DatePriceSnapshot | undefined)?.cells ?? []); expect(historic.some(cell => cell.status === 'priced' && cell.observedAt === original && cell.quoteIds[0] === 'original-quote')).toBe(true); hook.unmount();
  });
});
