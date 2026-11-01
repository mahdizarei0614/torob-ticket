import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, ClientError, type ApiClient } from '@torob-ticket/client';
import type { DatePriceQuery, DatePriceSnapshot, SessionInfo } from '@torob-ticket/contracts';
import { datePriceJobs, type DateJobState } from './date-price-jobs';
import { datePriceIdentityForSession } from './date-state';
export function useDatePrices(request: DatePriceQuery | undefined, session: SessionInfo, enabled = true, client: ApiClient = apiClient) {
  const cache = useQueryClient(); const [revision, setRevision] = useState(0);
  const [state, setState] = useState<DateJobState & { key?: string }>({ waiting: false });
  const key = request ? datePriceIdentityForSession(request, session) : undefined;
  const latest = useRef({ request, session }); latest.current = { request, session };
  const retried = useRef(false);
  useEffect(() => {
    if (!key || !enabled || !latest.current.request) return;
    let release: (() => void) | undefined; let alive = true;
    const timer = setTimeout(() => {
      const current = latest.current;
      if (!current.request || datePriceIdentityForSession(current.request, current.session) !== key) return;
      release = datePriceJobs(client).acquire(current.request, current.session, next => { if (!alive) return; if (next.snapshot) cache.setQueryData<DatePriceSnapshot>(['date-prices', key], next.snapshot); setState({ ...next, key }); }, retried.current);
      retried.current = false;
    }, 120);
    return () => { alive = false; clearTimeout(timer); release?.(); };
  }, [key, enabled, revision, client, cache]);
  // A matching session/query owns estimates until its identity changes; elapsed time alone does not retire them.
  const current = enabled && state.key === key ? state : { waiting: !!request && enabled };
  const retryable = !!current.error && (!(current.error instanceof ClientError) || current.error.kind === 'network' || current.error.api?.retryable) || !!current.snapshot?.cells.some(cell => cell.status === 'unavailable' && cell.retryable);
  function retry() { if (!retryable) return; retried.current = true; setState({ waiting: true, key }); setRevision(value => value + 1); }
  const retryRef = useRef(retry); retryRef.current = retry;
  const automaticRecovery = useRef<{ key?: string; attempted: boolean }>({ attempted: false });
  useEffect(() => {
    if (automaticRecovery.current.key !== key) automaticRecovery.current = { key, attempted: false };
    if (!enabled || !key || !retryable || current.waiting || (current.snapshot?.status === 'checking' && !current.error) || automaticRecovery.current.attempted) return;
    // Recover a transient failure once, without periodically refreshing valid estimates.
    const timer = setTimeout(() => {
      if (automaticRecovery.current.key !== key || automaticRecovery.current.attempted) return;
      automaticRecovery.current.attempted = true;
      retryRef.current();
    }, 1500);
    return () => clearTimeout(timer);
  }, [key, enabled, retryable, current.waiting, current.snapshot?.status, current.error]);
  useEffect(() => { if (!retryable) return; const online = () => retryRef.current(); window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, [retryable]);
  return { ...current, retryable, retry };
}
