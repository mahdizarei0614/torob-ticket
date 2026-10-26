import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientError, type ApiClient } from '@torob-ticket/client';
import { DatePriceSnapshotSchema, type DatePriceQuery, type DatePriceSnapshot } from '@torob-ticket/contracts';
import { useDatePrices } from './use-date-prices';
import { datePriceIdentityForSession } from './date-state';
import { query, session } from '../search/search-test-data';
const request: DatePriceQuery = { query, leg: 'outbound', dates: [query.departureDate], clientGeneration: 'estimate-test' };
function snapshot(sent: DatePriceQuery, observedAt = new Date().toISOString()): DatePriceSnapshot { return DatePriceSnapshotSchema.parse({ datePriceId: 'date-observation', clientGeneration: sent.clientGeneration, query: sent, status: 'complete', observedAt, cells: [{ date: query.departureDate, status: 'priced', minimum: { amountRial: 1000000, currency: 'IRR' }, quoteIds: ['original-quote'], offerIds: ['original-offer'], observedAt, coverage: { complete: true, expectedProviderIds: ['p'], successfulProviderIds: ['p'], failedProviderIds: [], pendingProviderIds: [] } }] }); }
function setup(start: (sent: DatePriceQuery) => Promise<DatePriceSnapshot>) {
  const client = { startDatePrices: vi.fn(start), cancelDatePrices: vi.fn(async () => undefined) } as unknown as ApiClient;
  const cache = new QueryClient();
  const hook = renderHook(({currentSession,enabled}) => useDatePrices(request, currentSession, enabled, client), { initialProps:{currentSession:session,enabled:true},wrapper: ({ children }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider> });
  return { ...hook, client, cache };
}
afterEach(() => vi.useRealTimers());
describe('date estimates and session/query ownership', () => {
  it('keeps an older observation unchanged across an hour and a matching remount without a retry loop', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T01:00:00Z')); const original = new Date(Date.now()-61000).toISOString();
    const hook = setup(async sent => snapshot(sent, original));
    await act(async () => { await vi.advanceTimersByTimeAsync(121); });
    const saved = hook.result.current.snapshot;
    expect(saved).toMatchObject({observedAt:original,cells:[{status:'priced',observedAt:original,quoteIds:['original-quote']}]});
    expect(hook.cache.getQueryData(['date-prices',datePriceIdentityForSession(request,session)])).toBe(saved);
    await act(async () => { await vi.advanceTimersByTimeAsync(3600000); });
    expect(hook.result.current.snapshot).toBe(saved); expect(hook.result.current.error).toBeUndefined(); expect(hook.result.current.retryable).toBe(false);
    hook.rerender({currentSession:session,enabled:false}); expect(hook.result.current.snapshot).toBeUndefined();
    hook.rerender({currentSession:session,enabled:true}); await act(async()=>{await vi.advanceTimersByTimeAsync(121);});
    expect(hook.result.current.snapshot).toBe(saved); expect(hook.client.startDatePrices).toHaveBeenCalledTimes(1); hook.unmount();
  });
  it.each(['scenarioRevision','mappingRevision'] as const)('hides previous prices immediately when %s changes and only publishes that new identity', async field => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T01:00:00Z')); const hook=setup(async sent=>snapshot(sent));
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);}); const original=hook.result.current.snapshot;
    let resolve!: (next:DatePriceSnapshot)=>void; let sent!:DatePriceQuery;
    vi.mocked(hook.client.startDatePrices).mockImplementationOnce(input=>{sent=input;return new Promise(done=>{resolve=done;});});
    hook.rerender({currentSession:{...session,[field]:'next'},enabled:true}); expect(hook.result.current.snapshot).toBeUndefined();
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);}); expect(hook.result.current.snapshot).toBeUndefined();
    await act(async()=>{resolve({...snapshot(sent),datePriceId:'new-estimate'});});
    expect(hook.result.current.snapshot?.datePriceId).toBe('new-estimate'); expect(hook.result.current.snapshot).not.toBe(original); expect(hook.client.startDatePrices).toHaveBeenCalledTimes(2); hook.unmount();
  });
  it('treats a future observation as invalid evidence without treating it as no inventory', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T01:00:00Z')); const future=new Date(Date.now()+1000).toISOString(); const hook=setup(async sent=>snapshot(sent,future));
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);}); expect(hook.result.current.snapshot).toBeUndefined(); expect(hook.result.current.error).toMatchObject({kind:'schema',message:'date-observation-invalid'}); expect(hook.result.current.retryable).toBe(false);
    await act(async()=>{await vi.advanceTimersByTimeAsync(120000);}); expect(hook.client.startDatePrices).toHaveBeenCalledTimes(1); hook.unmount();
  });
  it('quietly recovers a transient retrieval failure once without inventing prices', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T01:00:00Z')); const hook=setup(async()=>{throw new ClientError('network','network-unavailable');});
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);}); expect(hook.result.current.error).toMatchObject({message:'network-unavailable'}); expect(hook.result.current.snapshot).toBeUndefined(); expect(hook.result.current.retryable).toBe(true);
    vi.mocked(hook.client.startDatePrices).mockImplementation(async sent=>snapshot(sent));
    await act(async()=>{await vi.advanceTimersByTimeAsync(1500);});
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);}); expect(hook.result.current.snapshot?.cells[0]?.status).toBe('priced'); expect(hook.result.current.error).toBeUndefined(); expect(hook.client.startDatePrices).toHaveBeenCalledTimes(2);
    await act(async()=>{await vi.advanceTimersByTimeAsync(120000);}); expect(hook.client.startDatePrices).toHaveBeenCalledTimes(2); hook.unmount();
  });
  it('stops after one failed automatic recovery but still recovers when the network returns', async () => {
    vi.useFakeTimers(); const hook=setup(async()=>{throw new ClientError('network','network-unavailable');});
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);});
    await act(async()=>{await vi.advanceTimersByTimeAsync(1500);});
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);});
    await act(async()=>{await vi.advanceTimersByTimeAsync(120000);});
    expect(hook.client.startDatePrices).toHaveBeenCalledTimes(2);expect(hook.result.current.snapshot).toBeUndefined();
    vi.mocked(hook.client.startDatePrices).mockImplementation(async sent=>snapshot(sent));
    act(()=>window.dispatchEvent(new Event('online')));
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);});
    expect(hook.result.current.snapshot?.cells[0]?.status).toBe('priced');expect(hook.client.startDatePrices).toHaveBeenCalledTimes(3);hook.unmount();
  });
  it('cancels a pending recovery when disabled or when the scenario identity changes', async () => {
    vi.useFakeTimers(); const hook=setup(async()=>{throw new ClientError('network','network-unavailable');});
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);});
    hook.rerender({currentSession:session,enabled:false});
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(hook.client.startDatePrices).toHaveBeenCalledTimes(1);
    hook.rerender({currentSession:session,enabled:true});
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);});
    vi.mocked(hook.client.startDatePrices).mockImplementation(async sent=>snapshot(sent));
    hook.rerender({currentSession:{...session,scenarioRevision:'new'},enabled:true});
    await act(async()=>{await vi.advanceTimersByTimeAsync(121);});const current=hook.result.current.snapshot;
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
    expect(hook.result.current.snapshot).toBe(current);expect(hook.client.startDatePrices).toHaveBeenCalledTimes(3);hook.unmount();
  });
});
