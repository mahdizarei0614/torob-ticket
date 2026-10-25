import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubscribeSearchOptions } from '@torob-ticket/client';
import { useResults } from './use-results';
import { group, observedAt, recovery } from './results-test-data';
import { query } from '../search/search-test-data';
import { selectedQuote } from './results-reducer';
afterEach(() => vi.useRealTimers());
function setup(initial = recovery([group('a')])) {
 const cache = new QueryClient({defaultOptions:{queries:{retry:false}}}); cache.setQueryData(['search','generation','search'],initial);
 let options!: SubscribeSearchOptions; const stop = vi.fn(); const subscribe = vi.fn((value: SubscribeSearchOptions) => { options=value; return stop; });
 function Wrapper({children}:{children:ReactNode}) { return <QueryClientProvider client={cache}>{children}</QueryClientProvider>; }
 const hook=renderHook(()=>useResults('generation','search',query,undefined,subscribe),{wrapper:Wrapper});
 return { ...hook,cache,subscribe,stop,options:()=>options };
}
describe('owned result stream and immutable expiry',()=>{
 it('starts from the actual cached atomic cursor, receives stream snapshots and ignores wrong query/generation',async()=>{
  const hook=setup(); expect(hook.options().sequence).toBe(1);
  const late=recovery([group('cheaper'),group('a')],3);
  act(()=>hook.options().onEvent({type:'snapshot',searchId:'search',clientGeneration:'generation',sequence:3,payload:late.snapshot}));
  expect(hook.result.current.state.latest?.sequence).toBe(3);
  const wrong=recovery([group('bad')],5);wrong.snapshot.query={...query,departureDate:'2026-10-26'};
  act(()=>hook.options().onSnapshot?.(wrong)); expect(hook.result.current.state.latest?.sequence).toBe(3);
  wrong.snapshot.query=query;wrong.snapshot.clientGeneration='other';act(()=>hook.options().onSnapshot?.(wrong));expect(hook.result.current.state.latest?.sequence).toBe(3);
  hook.unmount();expect(hook.stop).toHaveBeenCalledOnce();
  act(()=>hook.options().onSnapshot?.(recovery([group('too-late')],9)));
  expect(hook.cache.getQueryData(['search','generation','search'])).toMatchObject({sequence:3});
 });
 it('does not reopen a completed stream and exposes truthful connection recovery without clearing received data',async()=>{
  const initial=recovery([group('a')]);initial.snapshot.status='complete';const complete=setup(initial);
  expect(complete.subscribe).not.toHaveBeenCalled();expect(complete.result.current.state.adopted?.snapshot.groups).toHaveLength(1);complete.unmount();
  const active=setup();act(()=>active.options().onError?.(new Error('stream-failed')));expect(active.result.current.connectionError).toBe(true);expect(active.result.current.state.adopted?.snapshot.groups).toHaveLength(1);
  act(()=>active.options().onSnapshot?.(recovery([group('a')],2)));expect(active.result.current.connectionError).toBe(false);active.unmount();
 });
 it('expires consecutive mounted quote deadlines without a self-triggering render loop or retiming observations',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(observedAt));const first=group('a'),second=group('b');second.eligibleQuotes[0]!.expiresAt='2026-10-25T06:11:00.000Z';
  const hook=setup(recovery([first,second]));
  act(()=>hook.result.current.dispatch({type:'select',selection:{groupId:'a',quoteId:'a-quote',version:1},now:Date.now()}));
  expect(selectedQuote(hook.result.current.state,hook.result.current.now)).toBeDefined();
  act(()=>vi.advanceTimersByTime(599999));expect(selectedQuote(hook.result.current.state,hook.result.current.now)).toBeDefined();
  act(()=>vi.advanceTimersByTime(1));expect(selectedQuote(hook.result.current.state,hook.result.current.now)).toBeUndefined();
  act(()=>hook.result.current.dispatch({type:'select',selection:{groupId:'b',quoteId:'b-quote',version:1},now:Date.now()}));expect(selectedQuote(hook.result.current.state,hook.result.current.now)).toBeDefined();
  act(()=>vi.advanceTimersByTime(60000));expect(selectedQuote(hook.result.current.state,hook.result.current.now)).toBeUndefined();
  expect(hook.result.current.state.adopted?.snapshot.groups[0]?.eligibleQuotes[0]?.observedAt).toBe(observedAt);expect(vi.getTimerCount()).toBeLessThan(5);hook.unmount();
 });
 it('leaves results empty when no accepted operation exists in cache instead of launching an implicit search',async()=>{
  const cache=new QueryClient();const subscribe=vi.fn(()=>vi.fn());
  function Wrapper({children}:{children:ReactNode}){return <QueryClientProvider client={cache}>{children}</QueryClientProvider>;}
  const hook=renderHook(()=>useResults('g','id',query,undefined,subscribe),{wrapper:Wrapper});
  await waitFor(()=>expect(hook.result.current.state.adopted).toBeUndefined());expect(subscribe).not.toHaveBeenCalled();hook.unmount();
 });
});
