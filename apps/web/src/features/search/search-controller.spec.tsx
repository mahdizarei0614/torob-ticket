import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter, useNavigate } from 'react-router';
import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@torob-ticket/client';
import type { CatalogSnapshot, SearchRecovery, SearchRequest } from '@torob-ticket/contracts';
import { useSearchController } from './use-search-controller';
import { SearchComposer } from './search-composer';
import { catalog, query, session } from './search-test-data';
import { serializeSearchUrl } from './search-url';
function recovery(input: SearchRequest): SearchRecovery { return { snapshot: { searchId: 'operation', clientGeneration: input.clientGeneration, query: input.query, status: 'collecting', groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: false }, observedAt: session.anchorInstant }, sequence: 0 }; }
function setup(client: ApiClient, initialPath = '/', restore?: Parameters<typeof useSearchController>[3], choices:CatalogSnapshot=catalog) {
  const cache = new QueryClient();
  let navigate: ReturnType<typeof useNavigate>;
  function Navigation() { navigate = useNavigate(); return null; }
  function Wrapper({ children }: { children: ReactNode }) { return <StrictMode><QueryClientProvider client={cache}><MemoryRouter initialEntries={[initialPath]}><Navigation />{children}</MemoryRouter></QueryClientProvider></StrictMode>; }
  const hook = renderHook(() => useSearchController(choices, session, client, restore), { wrapper: Wrapper });
  return { ...hook, cache, navigate: (path: string) => navigate(path) };
}
describe('controller request and navigation ownership', () => {
  it('makes the first round-trip toggle searchable but requires reselecting an invalidated return',async()=>{
    const client={startSearch:vi.fn(async(input:SearchRequest)=>recovery(input)),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
    const hook=setup(client,serializeSearchUrl(query));
    act(()=>hook.result.current.edit({tripType:'round-trip'}));
    expect(hook.result.current.state.draft.returnDate).toBe('2026-10-28');expect(hook.result.current.validity.valid).toBe(true);
    expect(client.startSearch).not.toHaveBeenCalled();
    await act(()=>hook.result.current.submit());
    expect(vi.mocked(client.startSearch).mock.calls[0]![0].query).toMatchObject({tripType:'round-trip',returnDate:'2026-10-28'});
    act(()=>hook.result.current.edit({departureDate:'2026-10-29'}));
    expect(hook.result.current.state.draft.returnDate).toBeUndefined();expect(hook.result.current.validity.valid).toBe(false);
    act(()=>hook.result.current.edit({classCode:'economy'}));expect(hook.result.current.state.draft.returnDate).toBeUndefined();
    hook.unmount();
  });
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
  it('shows compact named choices and city search fields without transport passenger controls',()=>{
    render(<SearchComposer draft={query} catalog={catalog} session={session} edit={vi.fn()} onSubmit={vi.fn()} errors={[]} pending={false} disabled={false}/>);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    for(const name of ['وسیله سفر','محدوده سفر','نوع سفر'])expect(screen.getByRole('radiogroup',{name})).toBeInTheDocument();
    expect(screen.getByRole('combobox',{name:'مبدا'})).toHaveAttribute('placeholder','جست‌وجوی شهر مبدا');expect(screen.getByRole('combobox',{name:'مقصد'})).toHaveAttribute('placeholder','جست‌وجوی شهر مقصد');expect(within(screen.getByRole('radiogroup',{name:'کلاس سفر'})).getByRole('radio',{name:'اقتصادی'})).toBeChecked();
  });
  it('changes the class through named segmented choices without submitting or editing the route',()=>{
    const edit=vi.fn(),submit=vi.fn();const choices={...catalog,classChoices:[...catalog.classChoices,{mode:'flight' as const,code:'business',name:'تجاری'}]};
    const view=render(<SearchComposer draft={query} catalog={choices} session={session} edit={edit} onSubmit={submit} errors={[]} pending={false} disabled={false}/>);
    const classes=screen.getByRole('radiogroup',{name:'کلاس سفر'});
    expect(within(classes).getByRole('radio',{name:'اقتصادی'})).toBeChecked();
    fireEvent.click(within(classes).getByRole('radio',{name:'تجاری'}));
    expect(edit).toHaveBeenCalledExactlyOnceWith({classCode:'business'});expect(submit).not.toHaveBeenCalled();
    view.rerender(<SearchComposer draft={{...query,mode:'train',classCode:'seat'}} catalog={choices} session={session} edit={edit} onSubmit={submit} errors={[]} pending={false} disabled={false}/>);
    expect(within(screen.getByRole('radiogroup',{name:'کلاس سفر'})).getByRole('radio',{name:'صندلی'})).toBeChecked();
    expect(screen.queryByRole('radio',{name:'تجاری'})).not.toBeInTheDocument();
  });
});

describe('single-adult consumer intent', () => {
  const previous = { ...query, party: { adults: 2, children: 1, infants: 1, childAges: [8], infantAgesMonths: [6] } };
  it.each(['submit', 'preset', 'saved'] as const)('normalizes a new %s comparison without mutating its source', async entry => {
    const start = vi.fn(async (request: SearchRequest) => recovery(request));
    const client = { startSearch: start, cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient;
    const hook = setup(client);
    if (entry === 'submit') await act(() => hook.result.current.submit(previous));
    if (entry === 'preset') {
      act(() => hook.result.current.preset(previous));
      expect(start).not.toHaveBeenCalled();
      await act(() => hook.result.current.submit());
    }
    if (entry === 'saved') {
      act(() => hook.result.current.openSavedSearch(previous));
      await waitFor(() => expect(hook.result.current.accepted).toBe(true));
    }
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]![0].query.party).toEqual({ adults: 1, children: 0, infants: 0 });
    expect(hook.result.current.state.draft.party).toEqual({ adults: 1, children: 0, infants: 0 });
    expect(previous.party).toEqual({ adults: 2, children: 1, infants: 1, childAges: [8], infantAgesMonths: [6] });
    hook.unmount();
  });
  it('normalizes initial links and subsequent history before exposing draft or date-price intent', () => {
    const client = { startSearch: vi.fn() } as unknown as ApiClient;
    const hook = setup(client, '/' + serializeSearchUrl(previous));
    expect(hook.result.current.validity.query?.party).toEqual({ adults: 1, children: 0, infants: 0 });
    act(() => hook.navigate('/' + serializeSearchUrl({ ...previous, departureDate: '2026-10-26' })));
    expect(hook.result.current.state.draft).toMatchObject({ departureDate: '2026-10-26', party: { adults: 1, children: 0, infants: 0 } });
    expect(client.startSearch).not.toHaveBeenCalled();
    hook.unmount();
  });
  it('keeps restored historical party evidence readable while fencing its selections from the new one-adult draft', async () => {
    const historical = recovery({ query: previous, clientGeneration: 'historical-generation' });
    historical.snapshot.status = 'complete';
    const start = vi.fn(async (request: SearchRequest) => recovery(request));
    const client = { startSearch: start, cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient;
    const hook = setup(client, '/' + serializeSearchUrl(previous), { recovery: historical, draft: previous });
    expect(hook.result.current.state.committed).toEqual(previous);
    expect(hook.result.current.state.draft.party).toEqual({ adults: 1, children: 0, infants: 0 });
    expect(hook.result.current.resultIsCurrent('historical-generation', 'operation')).toBe(true);
    expect(hook.result.current.resultSelectionIsCurrent('historical-generation', 'operation')).toBe(false);
    expect(hook.result.current.canRefineResults).toBe(false);
    act(() => hook.result.current.pinResultItinerary('old-choice', 'historical-generation', 'operation'));
    expect(hook.result.current.state.pinnedItineraryId).toBeUndefined();
    expect(start).not.toHaveBeenCalled();
    await act(() => hook.result.current.submit());
    expect(start.mock.calls[0]![0].query.party).toEqual({ adults: 1, children: 0, infants: 0 });
    expect(historical.snapshot.query.party).toEqual(previous.party);
    hook.unmount();
  });
  it('preselects a valid train class on a mode change so choosing a destination is enough to search', async () => {
    const start = vi.fn(async (request: SearchRequest) => recovery(request));
    const client = { startSearch: start, cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient;
    const hook = setup(client);
    act(() => hook.result.current.edit({ mode: 'train' }));
    expect(hook.result.current.state.draft.classCode).toBe('seat');
    act(() => hook.result.current.edit({ destinationCityId: 'c' }));
    expect(hook.result.current.validity.valid).toBe(true);
    await act(() => hook.result.current.submit());
    expect(start.mock.calls[0]![0].query).toMatchObject({ mode: 'train', destinationCityId: 'c', classCode: 'seat' });
    hook.unmount();
  });
});

describe('authorized date intent admission', () => {
  it('commits single-adult dates immediately and drains only the latest authorized intent after capacity frees', async () => {
    const { searchStartPool } = await import('./search-start-pool');
    const client = { startSearch: vi.fn(async (request: SearchRequest) => recovery(request)), cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient;
    const pool = searchStartPool(client); const first = pool.reserve()!, second = pool.reserve()!;
    const hook = setup(client);
    act(() => { hook.result.current.commitDates({ ...query, departureDate: '2026-10-26', party: { adults: 2, children: 0, infants: 0 } }); });
    act(() => { hook.result.current.commitDates({ ...query, departureDate: '2026-10-27', party: { adults: 3, children: 0, infants: 0 } }); });
    expect(hook.result.current.state.committed?.departureDate).toBe('2026-10-27'); expect(hook.result.current.waitingDate).toBe(true); expect(client.startSearch).not.toHaveBeenCalled();
    await act(async () => { first.finish(); });
    await waitFor(() => expect(client.startSearch).toHaveBeenCalledTimes(1));
    expect((client.startSearch as ReturnType<typeof vi.fn>).mock.calls[0]![0].query).toMatchObject({ departureDate: '2026-10-27', party: { adults: 1, children: 0, infants: 0 } });
    expect(hook.result.current.waitingDate).toBe(false); second.finish(); hook.unmount();
  });
  it('drops queued authorization on history or nondate edit, and never serializes an incomplete round trip', async () => {
    const { searchStartPool } = await import('./search-start-pool');
    const client = { startSearch: vi.fn(async (request: SearchRequest) => recovery(request)), cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient;
    const pool = searchStartPool(client); const first = pool.reserve()!, second = pool.reserve()!; const hook = setup(client);
    act(() => hook.result.current.commitDates({ ...query, departureDate: '2026-10-26' }));
    act(() => hook.result.current.edit({ filters: { refundableOnly: true } }));
    await act(async () => first.finish()); expect(client.startSearch).not.toHaveBeenCalled();
    act(() => hook.result.current.commitDates({ ...query, tripType: 'round-trip', returnDate: undefined }));
    expect(hook.result.current.state.draft.returnDate).toBeUndefined(); expect(hook.result.current.accepted).toBe(false); expect(client.startSearch).not.toHaveBeenCalled();
    const replacement = pool.reserve()!;
    act(() => hook.result.current.commitDates({ ...query, departureDate: '2026-10-27' }));
    act(() => hook.navigate('/'));
    replacement.finish();
    await act(async () => second.finish()); expect(client.startSearch).not.toHaveBeenCalled(); hook.unmount();
  });
});

it('synchronously fences a fast native Pop and preserves a rapid new date intent against old replies/router renders', async () => {
  const held: { request: SearchRequest; release: (value: SearchRecovery) => void }[] = [];
  const client = { startSearch: vi.fn((request: SearchRequest) => new Promise<SearchRecovery>(release => held.push({ request, release }))), cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient;
  const hook = setup(client); let first!: Promise<void>;
  act(() => { first = hook.result.current.submit(); });
  const old = held[0]!;
  act(() => {
    window.history.replaceState(null,'','/'); window.dispatchEvent(new PopStateEvent('popstate'));
    hook.result.current.commitDates({ ...query, departureDate: '2026-10-27' });
    hook.navigate('/'); // Late router view of the Pop, before the new navigation render.
  });
  await waitFor(() => expect(held).toHaveLength(2));
  expect(hook.result.current.state.committed?.departureDate).toBe('2026-10-27');
  await act(async () => { old.release(recovery(old.request)); await first; });
  expect(client.cancelSearch).toHaveBeenCalledWith('operation'); expect(hook.result.current.accepted).toBe(false);
  await act(async () => { held[1]!.release(recovery(held[1]!.request)); });
  await waitFor(() => expect(hook.result.current.accepted).toBe(true));
  expect(hook.result.current.state.committed?.departureDate).toBe('2026-10-27'); hook.unmount();
});

it('cannot reauthorize a date intent or reserve priority after its controller unmounts', async () => {
  const { searchStartPool } = await import('./search-start-pool');
  const client = { startSearch: vi.fn(async (request: SearchRequest) => recovery(request)), cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient;
  const hook = setup(client); const lateCommit = hook.result.current.commitDates; const lease = hook.result.current.dateInteractions; const token = lease.capture(); hook.unmount();
  lateCommit({ ...query, departureDate: '2026-10-26' }); expect(lease.isCurrent(token)).toBe(false); expect(client.startSearch).not.toHaveBeenCalled();
  const slot = searchStartPool(client).reserve('date-read'); expect(slot).toBeDefined(); slot?.finish();
});

describe('result refinement authorization',()=>{
 it('rejects a refinement from an old interaction token or restored generation and preserves changed draft fields',async()=>{
  const client={startSearch:vi.fn(async(request:SearchRequest)=>recovery(request)),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const hook=setup(client);await act(()=>hook.result.current.submit());const basis=hook.result.current.state.generation!;const token=hook.result.current.refinementToken;const refine=hook.result.current.refineResults;
  act(()=>{hook.result.current.edit({filters:{refundableOnly:true}});refine({...query,sort:'fastest'},basis,token);});expect(client.startSearch).toHaveBeenCalledTimes(1);expect(hook.result.current.state.draft.filters.refundableOnly).toBe(true);expect(hook.result.current.canRefineResults).toBe(false);
  act(()=>hook.navigate('/'));act(()=>refine({...query,sort:'fastest'},basis,token));expect(client.startSearch).toHaveBeenCalledTimes(1);hook.unmount();
 });
 it('sorts the current evidence without another search, losing its pin or replacing its immutable query',async()=>{
  const client={startSearch:vi.fn(async(request:SearchRequest)=>recovery(request)),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const hook=setup(client);await act(()=>hook.result.current.submit(undefined,true));expect(hook.result.current.enterResults).toBe(true);
  const generation=hook.result.current.state.generation!,committed=hook.result.current.state.committed,token=hook.result.current.refinementToken;
  act(()=>hook.result.current.pinResultItinerary('chosen',generation,'operation'));
  const revision=hook.result.current.state.intentRevision;
  act(()=>hook.result.current.refineResults({...query,sort:'fastest'},generation,token));
  expect(client.startSearch).toHaveBeenCalledTimes(1);expect(hook.result.current.state.committed).toBe(committed);expect(committed?.sort).toBe('cheapest');
  expect(hook.result.current.state).toMatchObject({generation,searchId:'operation',resultSort:'fastest',pinnedItineraryId:'chosen',intentRevision:revision});
  expect(hook.result.current.resultSelectionIsCurrent(generation,'operation')).toBe(true);expect(hook.result.current.enterResults).toBe(false);hook.unmount();
 });
 it('restores presentation sort from the checkpoint while preserving exact evidence/query and selection authority',()=>{
  const value=recovery({query,clientGeneration:'restored'});value.snapshot.status='complete';
  const client={startSearch:vi.fn(),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const hook=setup(client,serializeSearchUrl(query),{recovery:value,draft:{...query,sort:'fastest'}});
  expect(hook.result.current.state.resultSort).toBe('fastest');expect(hook.result.current.state.committed).toBe(value.snapshot.query);
  expect(hook.result.current.state.draft.sort).toBe('cheapest');expect(hook.result.current.resultSelectionIsCurrent('restored','operation')).toBe(true);
  expect(client.startSearch).not.toHaveBeenCalled();expect(value.snapshot.query.sort).toBe('cheapest');hook.unmount();
 });
 it.each(['date','filter','refresh','form'] as const)('carries the displayed ranking into a fresh %s comparison without rewriting its old snapshot',async entry=>{
  const client={startSearch:vi.fn(async(request:SearchRequest)=>recovery(request)),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const hook=setup(client);await act(()=>hook.result.current.submit());
  const generation=hook.result.current.state.generation!,original=hook.result.current.state.committed!,evidence=hook.cache.getQueryData<SearchRecovery>(['search',generation,'operation']);
  act(()=>hook.result.current.refineResults({...original,sort:'fastest'},generation,hook.result.current.refinementToken));
  expect(original.sort).toBe('cheapest');expect(hook.result.current.state.resultSort).toBe('fastest');
  if(entry==='date')act(()=>hook.result.current.commitDates({...hook.result.current.state.draft,departureDate:'2026-10-26'}));
  if(entry==='filter')await act(async()=>{const draft=hook.result.current.state.draft,filters={refundableOnly:true};hook.result.current.edit({filters});await hook.result.current.submit({...draft,filters},true);});
  if(entry==='refresh')await act(()=>hook.result.current.submit(original,true));
  if(entry==='form')await act(()=>hook.result.current.submit());
  await waitFor(()=>expect(client.startSearch).toHaveBeenCalledTimes(2));
  expect(vi.mocked(client.startSearch).mock.calls[1]![0].query.sort).toBe('fastest');expect(hook.result.current.state.resultSort).toBe('fastest');
  expect(hook.cache.getQueryData(['search',generation,'operation'])).toBe(evidence);expect(evidence?.snapshot.query.sort).toBe('cheapest');expect(original.sort).toBe('cheapest');hook.unmount();
 });
 it.each(['preset','saved'] as const)('lets an explicit %s ranking replace the displayed preference before submission',async entry=>{
  const client={startSearch:vi.fn(async(request:SearchRequest)=>recovery(request)),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const hook=setup(client);await act(()=>hook.result.current.submit());
  act(()=>hook.result.current.refineResults({...query,sort:'fastest'},hook.result.current.state.generation!,hook.result.current.refinementToken));
  const requested={...query,departureDate:'2026-10-26',sort:'fewest-connections' as const};
  if(entry==='preset'){act(()=>hook.result.current.preset(requested));await act(()=>hook.result.current.submit());}
  else act(()=>hook.result.current.openSavedSearch(requested));
  await waitFor(()=>expect(client.startSearch).toHaveBeenCalledTimes(2));
  expect(vi.mocked(client.startSearch).mock.calls[1]![0].query).toMatchObject({departureDate:'2026-10-26',sort:'fewest-connections'});
  expect(hook.result.current.state.resultSort).toBe('fewest-connections');hook.unmount();
 });
});

describe('form choice result invalidation',()=>{
 const choices={...catalog,classChoices:[...catalog.classChoices,{mode:'flight' as const,code:'business',name:'تجاری'}]};
 it('fences and aborts an unresolved start immediately, accepts the valid edited search and cleans up the late old ID',async()=>{
  const held:{request:SearchRequest;signal:AbortSignal;release:(value:SearchRecovery)=>void}[]=[];
  const client={startSearch:vi.fn((request:SearchRequest,signal:AbortSignal)=>new Promise<SearchRecovery>(release=>held.push({request,signal,release}))),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const hook=setup(client,'/',undefined,choices);let first!:Promise<void>,second!:Promise<void>;
  act(()=>{first=hook.result.current.submit();});const oldGeneration=held[0]!.request.clientGeneration;
  act(()=>hook.result.current.edit({classCode:'business'}));
  expect(held[0]!.signal.aborted).toBe(true);expect(hook.result.current.state.searchId).toBeUndefined();expect(hook.result.current.state.generation).not.toBe(oldGeneration);
  expect(hook.result.current.accepted).toBe(false);expect(hook.result.current.pending).toBe(false);expect(hook.result.current.validity.valid).toBe(true);
  act(()=>{second=hook.result.current.submit();});expect(held).toHaveLength(2);expect(held[1]!.request.query.classCode).toBe('business');
  const fresh=recovery(held[1]!.request);fresh.snapshot.searchId='edited-search';
  await act(async()=>{held[1]!.release(fresh);await second;});
  const late=recovery(held[0]!.request);late.snapshot.searchId='obsolete-search';
  await act(async()=>{held[0]!.release(late);await first;});
  expect(client.cancelSearch).toHaveBeenCalledWith('obsolete-search');expect(hook.result.current.state.searchId).toBe('edited-search');expect(hook.result.current.accepted).toBe(true);
  expect(hook.cache.getQueryCache().findAll({queryKey:['search',oldGeneration]})).toHaveLength(0);expect(hook.result.current.feedback).toBe('');hook.unmount();
 });
 it('clears an accepted comparison/selection immediately while retaining its cached terminal evidence',async()=>{
  const client={startSearch:vi.fn(async(input:SearchRequest)=>{const value=recovery(input);value.snapshot.status='complete';return value;}),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const hook=setup(client);await act(()=>hook.result.current.submit());const generation=hook.result.current.state.generation!,committed=hook.result.current.state.committed;
  const key=['search',generation,'operation'],evidence=hook.cache.getQueryData<SearchRecovery>(key),saved=structuredClone(evidence);
  act(()=>hook.result.current.pinResultItinerary('selected',generation,'operation'));
  act(()=>hook.result.current.edit({tripType:'round-trip'}));
  expect(hook.result.current.state.searchId).toBeUndefined();expect(hook.result.current.state.pinnedItineraryId).toBeUndefined();expect(hook.result.current.resultIsCurrent(generation,'operation')).toBe(false);
  expect(hook.result.current.state.committed).toBe(committed);expect(hook.cache.getQueryData(key)).toBe(evidence);expect(evidence).toEqual(saved);expect(hook.result.current.validity.valid).toBe(true);
  expect(client.cancelSearch).toHaveBeenCalledWith('operation');expect(hook.result.current.feedback).toBe('');hook.unmount();
 });
});

describe('canonical URL mount lifetime',()=>{
 it('submits a valid noncanonical round trip after StrictMode canonical replacement',async()=>{
  const client={startSearch:vi.fn(async(request:SearchRequest)=>recovery(request)),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const round={...query,tripType:'round-trip' as const,returnDate:'2026-10-28'};
  const hook=setup(client,'/?'+new URLSearchParams({q:JSON.stringify(round)}));
  await act(()=>hook.result.current.submit(undefined,true));
  expect(client.startSearch).toHaveBeenCalledTimes(1);expect(hook.result.current.accepted).toBe(true);expect(hook.result.current.state.committed?.returnDate).toBe('2026-10-28');hook.unmount();
 });
});

it('actual BrowserRouter canonical mount retains a live submit generation in StrictMode',async()=>{
 const client={startSearch:vi.fn(async(request:SearchRequest)=>recovery(request)),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
 const round={...query,tripType:'round-trip' as const,returnDate:'2026-10-28'};
 window.history.replaceState({},'', '/?'+new URLSearchParams({q:JSON.stringify(round)}));
 const cache=new QueryClient();function Wrapper({children}:{children:ReactNode}){return <StrictMode><QueryClientProvider client={cache}><BrowserRouter>{children}</BrowserRouter></QueryClientProvider></StrictMode>;}
 const hook=renderHook(()=>useSearchController(catalog,session,client),{wrapper:Wrapper});
 try {await act(()=>hook.result.current.submit(undefined,true));expect(client.startSearch).toHaveBeenCalledTimes(1);}finally{hook.unmount();window.history.replaceState({},'','/');}
});

it('StrictMode lifetime replay does not duplicate an outstanding authorized start',async()=>{
 let release!:(value:SearchRecovery)=>void;let input!:SearchRequest;
 const client={startSearch:vi.fn((request:SearchRequest)=>{input=request;return new Promise<SearchRecovery>(resolve=>{release=resolve;});}),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
 const cache=new QueryClient();let current!:ReturnType<typeof useSearchController>;
 function Harness(){current=useSearchController(catalog,session,client);const started=useRef(false);useEffect(()=>{if(!started.current){started.current=true;void current.submit();}},[]);return null;}
 const view=render(<StrictMode><QueryClientProvider client={cache}><MemoryRouter><Harness/></MemoryRouter></QueryClientProvider></StrictMode>);
 expect(client.startSearch).toHaveBeenCalledTimes(1);await act(async()=>{release(recovery(input));});expect(client.startSearch).toHaveBeenCalledTimes(1);expect(current.accepted).toBe(true);expect(current.state.generation).toBe(input.clientGeneration);view.unmount();
});

describe('live accepted result ownership',()=>{
 it.each([
  {mode:'train' as const}, {scope:'international' as const}, {originCityId:'c'}, {destinationCityId:'c'},
  {departureDate:'2026-10-26'}, {filters:{refundableOnly:true}},
 ])('rejects retained result selection synchronously after trip edit %j',async patch=>{
  const client={startSearch:vi.fn(async(request:SearchRequest)=>recovery(request)),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const hook=setup(client);await act(()=>hook.result.current.submit(query));const owner=hook.result.current;const generation=owner.state.generation!;
  expect(owner.resultSelectionIsCurrent(generation,'operation')).toBe(true);
  act(()=>{owner.edit(patch);expect(owner.resultSelectionIsCurrent(generation,'operation')).toBe(false);owner.pinResultItinerary('stale',generation,'operation');});
  expect(owner.resultIsCurrent(generation,'operation')).toBe(!('mode' in patch || 'scope' in patch));expect(hook.result.current.state.pinnedItineraryId).toBeUndefined();
  hook.unmount();
 });
 it('keeps committed evidence current while draft edits fence selection, pinning and preview',async()=>{
  const client={startSearch:vi.fn(async(request:SearchRequest)=>recovery(request)),cancelSearch:vi.fn(async()=>undefined)} as unknown as ApiClient;
  const hook=setup(client);await act(()=>hook.result.current.submit());const generation=hook.result.current.state.generation!;const owner=hook.result.current;expect(owner.resultIsCurrent(generation,'operation')).toBe(true);expect(owner.resultIsCurrent(generation,'other')).toBe(false);
  act(()=>hook.result.current.edit({filters:{refundableOnly:true}}));expect(hook.result.current.canRefineResults).toBe(false);expect(owner.resultIsCurrent(generation,'operation')).toBe(true);
  act(()=>{owner.previewResultItinerary('kept-result',generation,'operation');owner.pinResultItinerary('kept-result',generation,'operation');});expect(hook.result.current.state.pinnedItineraryId).toBeUndefined();expect(hook.result.current.state.previewItineraryId).toBeUndefined();expect(owner.resultSelectionIsCurrent(generation,'operation')).toBe(false);
  act(()=>{window.history.replaceState({},'','/');window.dispatchEvent(new PopStateEvent('popstate'));owner.previewResultItinerary('old',generation,'operation');owner.pinResultItinerary('old',generation,'operation');});expect(hook.result.current.state.pinnedItineraryId).toBeUndefined();expect(hook.result.current.state.previewItineraryId).toBeUndefined();expect(owner.resultIsCurrent(generation,'operation')).toBe(false);expect(owner.resultIsCurrent(hook.result.current.state.generation!,'operation')).toBe(false);hook.unmount();expect(owner.resultIsCurrent(generation,'operation')).toBe(false);
 });
});

it('root StrictMode replay keeps a GET-hydrated comparison owner while different real history revokes it',async()=>{
 const {serializeSearchUrl}=await import('./search-url');const restored=recovery({query,clientGeneration:'restored-generation'});restored.snapshot.status='complete';
 const start=vi.fn(),client={startSearch:start,cancelSearch:vi.fn()} as unknown as ApiClient;let current!:ReturnType<typeof useSearchController>;
 window.history.replaceState({key:'restored-entry',idx:0},'','/'+serializeSearchUrl(query));const cache=new QueryClient();
 function Restored(){current=useSearchController(catalog,session,client,{recovery:restored,draft:query});return null;}
 const view=render(<StrictMode><QueryClientProvider client={cache}><BrowserRouter><Restored/></BrowserRouter></QueryClientProvider></StrictMode>);
 try{expect(current.state.searchId).toBe(restored.snapshot.searchId);expect(current.state.generation).toBe('restored-generation');expect(current.accepted).toBe(true);expect(current.resultIsCurrent('restored-generation',restored.snapshot.searchId)).toBe(true);expect(start).not.toHaveBeenCalled();
 act(()=>{window.history.replaceState({key:'different-entry',idx:0},'','/'+serializeSearchUrl({...query,sort:'fastest'}));window.dispatchEvent(new PopStateEvent('popstate'));});await waitFor(()=>expect(current.state.draft.sort).toBe('fastest'));expect(current.state.searchId).toBeUndefined();expect(current.resultIsCurrent('restored-generation',restored.snapshot.searchId)).toBe(false);expect(start).not.toHaveBeenCalled();}
 finally{view.unmount();window.history.replaceState({},'','/');}
});
