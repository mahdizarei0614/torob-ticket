import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiClient, ClientError, type ApiClient } from '@torob-ticket/client';
import type { DatePriceQuery, DatePriceSnapshot, SessionInfo } from '@torob-ticket/contracts';
import { datePriceJobs, staleDateState, type DateJobState } from './date-price-jobs';
import { datePriceIdentityForSession, observationFresh } from './date-state';
function retainHistorical(cache: QueryClient, key: string, snapshot: DatePriceSnapshot) {
  cache.setQueryData<DatePriceSnapshot>(['date-prices',key,'historical',snapshot.datePriceId,snapshot.observedAt],snapshot);
  const current = cache.getQueryData<DatePriceSnapshot>(['date-prices',key]);
  if (current && !observationFresh(current)) { cache.setQueryData(['date-prices',key,'historical',current.datePriceId,current.observedAt],current); cache.removeQueries({ queryKey: ['date-prices',key], exact: true }); }
}
export function useDatePrices(request: DatePriceQuery | undefined, session: SessionInfo, enabled = true, client: ApiClient = apiClient) {
  const cache = useQueryClient(); const [revision, setRevision] = useState(0);
  const [state, setState] = useState<DateJobState & { key?: string }>({ waiting: false });
  const key = request ? datePriceIdentityForSession(request, session) : undefined;
  const latest = useRef(request); latest.current = request;
  const retried = useRef(false);
  useEffect(() => {
    if (!key || !enabled || !latest.current) return;
    let release: (() => void) | undefined; let alive = true;
    const timer = setTimeout(() => { release = datePriceJobs(client).acquire(latest.current!, session, next => { if (!alive) return; if (next.snapshot) cache.setQueryData<DatePriceSnapshot>(['date-prices', key], next.snapshot); if (next.staleSnapshot) retainHistorical(cache,key,next.staleSnapshot); setState({ ...next, key }); }, retried.current); retried.current = false; }, 120);
    return () => { alive = false; clearTimeout(timer); release?.(); };
  }, [key, enabled, revision, session, client, cache]);
  const matching = enabled && state.key === key ? state : { waiting: !!request && enabled };
  // Never expose an expired receipt/current value, including the render before effects run.
  const current = matching.snapshot?.status === 'complete' && !observationFresh(matching.snapshot) ? { ...staleDateState(matching.snapshot), key } : matching;
  useEffect(() => {
    const snapshot = matching.snapshot; if (!snapshot || snapshot.status !== 'complete') return;
    const expire = () => { if (key) retainHistorical(cache,key,snapshot); setState(previous => previous.key === key && previous.snapshot === snapshot ? { ...staleDateState(snapshot), key } : previous); };
    const remaining = Date.parse(snapshot.observedAt) + 60000 - Date.now();
    if (remaining <= 0 || !observationFresh(snapshot)) { expire(); return; }
    const timer = setTimeout(expire,remaining); return () => clearTimeout(timer);
  }, [matching.snapshot, key, cache]);
  const retryable = !!current.error && (!(current.error instanceof ClientError) || current.error.kind === 'network' || current.error.api?.retryable) || !!current.snapshot?.cells.some(cell => cell.status === 'unavailable' && cell.retryable);
  function retry() { if (!retryable) return; retried.current = true; setState({ waiting: true, key }); setRevision(value => value + 1); }
  const retryRef = useRef(retry); retryRef.current = retry;
  useEffect(() => { if (!retryable) return; const online = () => retryRef.current(); window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, [retryable]);
  return { ...current, stale: current.error instanceof ClientError && current.error.message === 'date-prices-stale', retryable, retry };
}
