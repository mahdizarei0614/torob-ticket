import { useEffect, useReducer, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, subscribeSearch, type ApiClient, type SubscribeSearchOptions } from '@torob-ticket/client';
import type { SearchRecovery, TransportSearchQuery } from '@torob-ticket/contracts';
import { serializeSearchUrl } from '../search/search-url';
import { createResultsState, resultsReducer, type ResultsState } from './results-reducer';
export function useResults(generation: string, searchId: string, query: TransportSearchQuery, client: ApiClient = apiClient, subscribe: (options: SubscribeSearchOptions) => () => void = subscribeSearch, restore?:Pick<ResultsState,'frozen'|'selected'|'dismissedSuggestion'>) {
 const cache = useQueryClient();
 const key = ['search', generation, searchId];
 const stored = useQuery({ queryKey: key, queryFn: ({ signal }) => client.snapshot(searchId, signal), enabled: false, staleTime: Infinity, retry: false });
 const [state, dispatch] = useReducer(resultsReducer, undefined, () => ({...createResultsState(generation, searchId),...restore}));
 const [connectionError, setConnectionError] = useState(false);
 const [now, setNow] = useState(Date.now);
 useEffect(() => {
  let live = true;
  const accept = (recovery: SearchRecovery) => {
   if (!live || recovery.snapshot.searchId !== searchId || recovery.snapshot.clientGeneration !== generation || serializeSearchUrl(recovery.snapshot.query) !== serializeSearchUrl(query)) return;
   const prior = cache.getQueryData<SearchRecovery>(key);
   if (prior && recovery.sequence < prior.sequence) return;
   cache.setQueryData(key, recovery); dispatch({ type: 'receive', recovery }); setConnectionError(false);
  };
  const initial = cache.getQueryData<SearchRecovery>(key);
  if (initial) accept(initial);
  if (!initial || initial.snapshot.status !== 'collecting') return () => { live = false; };
  const stop = subscribe({ searchId, clientGeneration: generation, sequence: initial.sequence,
   onEvent: event => { if (event.type !== 'provider-status') accept({ sequence: event.sequence, snapshot: event.payload }); },
   onSnapshot: accept, onError: () => { if (live) setConnectionError(true); },
  });
  return () => { live = false; stop(); };
 }, [generation, searchId, cache, client, subscribe]);
 // Expiry is derived from original timestamps and updates even without another provider event.
 useEffect(() => {
  const expiries = state.adopted?.snapshot.groups.flatMap(group => group.eligibleQuotes.map(quote => Date.parse(quote.expiresAt))) ?? [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule() {
   const current = Date.now(); setNow(current);
   const next = expiries.filter(time => time > current).sort((a,b) => a-b)[0];
   if (next !== undefined) timer = setTimeout(schedule, Math.max(0,next-current));
  }
  schedule();
  return () => clearTimeout(timer);
 }, [state.adopted]);
 return { state, dispatch, now, connectionError, stored: stored.data };
}
