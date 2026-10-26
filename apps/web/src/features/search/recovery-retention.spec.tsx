import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {ClientError, type ApiClient } from '@torob-ticket/client';
import type {SearchRecovery,SearchRequest} from '@torob-ticket/contracts';
import { useSearchController } from './use-search-controller';
import { catalog, query, session } from './search-test-data';
import { parseSearchUrl, serializeSearchUrl } from './search-url';

describe('recovery preserves explicit trip intent', () => {
  it('does not restore the URL over an edited form when metadata is refreshed', () => {
    const cache = new QueryClient();
    const client = { startSearch: vi.fn() } as unknown as ApiClient;
    function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={cache}><MemoryRouter initialEntries={['/' + serializeSearchUrl(query)]}>{children}</MemoryRouter></QueryClientProvider>; }
    const hook = renderHook(({ current }) => useSearchController(catalog, current, client), { wrapper, initialProps: { current: session } });
    act(() => hook.result.current.edit({ departureDate: '2026-10-29', party: { adults: 2, children: 1, infants: 0, childAges: [6] }, filters: { refundableOnly: true, budgetMaxRial: 5000000 } }));
    const edited = structuredClone(hook.result.current.state.draft);
    hook.rerender({ current: { ...session, scenarioRevision: 'next' } });
    expect(hook.result.current.state.draft).toEqual(edited);
    expect(client.startSearch).not.toHaveBeenCalled();
  });
  it('clears an old expired-mutation error when authority is reconciled, retaining the exact form', async () => {
    const client = { startSearch: vi.fn().mockRejectedValue(new ClientError('api','SESSION_EXPIRED',{code:'SESSION_EXPIRED',requestId:'actual-request',fieldPaths:[],retryable:false})) } as unknown as ApiClient;
    const cache=new QueryClient();function wrapper({children}:{children:ReactNode}){return <QueryClientProvider client={cache}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;}
    const hook=renderHook(()=>useSearchController(catalog,session,client),{wrapper});
    await act(()=>hook.result.current.submit());expect(hook.result.current.lastError).toBeInstanceOf(ClientError);
    const draft=structuredClone(hook.result.current.state.draft);act(()=>hook.result.current.reconcileAuthority());
    expect(hook.result.current.lastError).toBeUndefined();expect(hook.result.current.state.draft).toEqual(draft);expect(client.startSearch).toHaveBeenCalledTimes(1);
  });
  it('aborts obsolete start signals without releasing unknown capacity until settlement', async () => {
    let release!:(value:SearchRecovery)=>void,request!:SearchRequest,signal!:AbortSignal;
    const client={startSearch:vi.fn((value:SearchRequest,abort:AbortSignal)=>{request=value;signal=abort;return new Promise<SearchRecovery>(resolve=>{release=resolve;});}),cancelSearch:vi.fn().mockResolvedValue(undefined)} as unknown as ApiClient;
    const cache=new QueryClient();function wrapper({children}:{children:ReactNode}){return <QueryClientProvider client={cache}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;}
    const hook=renderHook(()=>useSearchController(catalog,session,client),{wrapper});let done!:Promise<void>;
    act(()=>{done=hook.result.current.submit();});act(()=>hook.result.current.reconcileAuthority());const aborted=signal.aborted;
    expect(hook.result.current.unresolvedStarts).toBe(1);
    await act(async()=>{release({sequence:0,snapshot:{searchId:'obsolete',clientGeneration:request.clientGeneration,query:request.query,status:'collecting',groups:[],providerStatuses:[],coverage:{expectedProviderIds:[],successfulProviderIds:[],failedProviderIds:[],pendingProviderIds:[],complete:false},observedAt:session.anchorInstant}});await done;});
    expect(aborted).toBe(true);expect(hook.result.current.unresolvedStarts).toBe(0);expect(hook.result.current.state.searchId).toBeUndefined();
  });
  it('retains a schema-valid unsupported route and old date as editable URL intent', () => {
    const requested = { ...query, destinationCityId: 'c', departureDate: '2026-10-01', party: { adults: 3, children: 0, infants: 0 } };
    const parsed = parseSearchUrl(serializeSearchUrl(requested), catalog, session);
    expect(parsed.kind).toBe('invalid');
    expect(parsed).toHaveProperty('draft', requested);
    expect(parsed.query).toBeUndefined();
  });
});
