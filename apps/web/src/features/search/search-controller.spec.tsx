import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@torob-ticket/client';
import type { SearchRecovery, SearchRequest } from '@torob-ticket/contracts';
import { useSearchController } from './use-search-controller';
import { SearchComposer } from './search-composer';
import { catalog, query, session } from './search-test-data';
function recovery(input: SearchRequest): SearchRecovery { return { snapshot: { searchId: 'operation', clientGeneration: input.clientGeneration, query: input.query, status: 'collecting', groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: false }, observedAt: session.anchorInstant }, sequence: 0 }; }
function setup(client: ApiClient) {
  const cache = new QueryClient();
  let navigate: ReturnType<typeof useNavigate>;
  function Navigation() { navigate = useNavigate(); return null; }
  function Wrapper({ children }: { children: ReactNode }) { return <StrictMode><QueryClientProvider client={cache}><MemoryRouter><Navigation />{children}</MemoryRouter></QueryClientProvider></StrictMode>; }
  const hook = renderHook(() => useSearchController(catalog, session, client), { wrapper: Wrapper });
  return { ...hook, cache, navigate: (path: string) => navigate(path) };
}
describe('controller request and navigation ownership', () => {
  it('cancels a same-generation response with a different query, never adopting it', async () => {
    const cancel = vi.fn(async () => undefined);
    const client = { startSearch: vi.fn(async (request: SearchRequest) => recovery({ ...request, query: { ...request.query, departureDate: '2026-10-26' } })), cancelSearch: cancel } as unknown as ApiClient;
    const { result, cache } = setup(client);
    await act(() => result.current.submit());
    expect(cancel).toHaveBeenCalledWith('operation');
    expect(result.current.accepted).toBe(false);
    expect(result.current.state.searchId).toBeUndefined();
    expect(cache.getQueryCache().getAll()).toHaveLength(0);
    expect(result.current.feedback).not.toBe('');
  });
  it('keeps preview local, restores on navigation and cleans up a late operation without adoption', async () => {
    let release!: (value: SearchRecovery) => void;
    let submitted!: SearchRequest;
    const cancel = vi.fn(async () => undefined);
    const client = { startSearch: vi.fn((request: SearchRequest) => { submitted = request; return new Promise<SearchRecovery>(resolve => { release = resolve; }); }), cancelSearch: cancel } as unknown as ApiClient;
    const { result, navigate } = setup(client);
    let done!: Promise<void>;
    act(() => { done = result.current.submit(); });
    const committed = result.current.state.committed;
    act(() => result.current.dispatch({ type: 'preview-date', date: '2026-10-28' }));
    expect(result.current.state.committed).toEqual(committed);
    act(() => navigate('/?q=broken'));
    await act(async () => { release(recovery(submitted)); await done; });
    expect(cancel).toHaveBeenCalledWith('operation');
    expect(result.current.accepted).toBe(false);
    expect(result.current.state.searchId).toBeUndefined();
    expect(result.current.state.notice).toContain('پیوند');
  });
  it('caps unresolved starts across history and controller remounts with synchronous admission', async () => {
    const held: { request: SearchRequest; release: (value: SearchRecovery) => void }[] = [];
    const client = { startSearch: vi.fn((request: SearchRequest) => new Promise<SearchRecovery>(release => held.push({ request, release }))), cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient;
    let hook = setup(client);
    const operations: Promise<void>[] = [];
    try {
      act(() => { operations.push(hook.result.current.submit()); operations.push(hook.result.current.submit()); });
      expect(client.startSearch).toHaveBeenCalledTimes(1);
      act(() => hook.navigate('/'));
      act(() => { operations.push(hook.result.current.submit()); });
      act(() => hook.navigate('/'));
      act(() => { operations.push(hook.result.current.submit()); });
      expect(client.startSearch).toHaveBeenCalledTimes(2);
      hook.unmount();
      hook = setup(client);
      act(() => { operations.push(hook.result.current.submit()); operations.push(hook.result.current.submit()); });
      expect(client.startSearch).toHaveBeenCalledTimes(2);
      await act(async () => { held[0]!.release(recovery(held[0]!.request)); await operations[0]; });
      act(() => { operations.push(hook.result.current.submit()); operations.push(hook.result.current.submit()); });
      expect(client.startSearch).toHaveBeenCalledTimes(3);
    } finally {
      await act(async () => { for (const item of held) item.release(recovery(item.request)); await Promise.allSettled(operations); });
      hook.unmount();
    }
  });
  it('bounds traveler age edits under oversized counts rather than allocating that count', async () => {
    const user = userEvent.setup();
    const edit = vi.fn();
    render(<SearchComposer draft={{ ...query, party: { adults: 1, children: 1000000000, infants: 0 } }} catalog={catalog} session={session} edit={edit} onSubmit={() => undefined} errors={['invalid']} pending={false} disabled={false} />);
    const ages = screen.getAllByRole('spinbutton', { name: /سن کودک/ });
    expect(ages).toHaveLength(8);
    expect(ages.every(input => (input as HTMLInputElement).disabled)).toBe(true);
    await user.click(ages[0]!);
    expect(edit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'جست‌وجوی سفر' })).toBeDisabled());
  });
});
