import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, ClientError, type ApiClient } from '@torob-ticket/client';
import type { CatalogSnapshot, SessionInfo, TransportSearchQuery } from '@torob-ticket/contracts';
import { createSearchState, searchReducer } from './search-reducer';
import { searchStartPool, startCapacityMessage, unresolvedStartLimit } from './search-start-pool';
import { initialDraft, parseSearchUrl, serializeSearchUrl, validateDraft, type SearchDraft } from './search-url';
export function errorMessage(error: unknown): string {
  if (error instanceof ClientError) {
    if (error.api?.code === 'SESSION_EXPIRED') return 'نشست نمایشی منقضی شده است. صفحه را تازه کنید و جست‌وجو را دوباره انجام دهید.';
    if (error.api?.code === 'SEARCH_LIMIT') return 'دو جست‌وجو در این نشست فعال است. چند لحظه صبر کنید و دوباره تلاش کنید.';
    if (error.api?.code === 'AGE_REQUIRED') return 'سن مسافران برای این مسیر لازم است؛ اطلاعات سن را کامل کنید.';
    if (error.kind === 'network') return 'ارتباط برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.';
    if (error.api?.code === 'UNSUPPORTED_ROUTE') return 'این مسیر پشتیبانی نمی‌شود؛ مبدا و مقصد را بررسی کنید.';
  }
  return 'درخواست قابل پردازش نبود. اطلاعات سفر را بررسی کنید و دوباره تلاش کنید.';
}
/** URL owns committed intent; reducer owns reversible local interaction; Query owns server data. */
export function useSearchController(catalog: CatalogSnapshot, session: SessionInfo, client: ApiClient = apiClient) {
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const initial = useRef(parseSearchUrl(location.search, catalog, session));
  const [state, dispatch] = useReducer(searchReducer, undefined, () => ({ ...createSearchState(initial.current.query ?? initialDraft(catalog, session)), committed: initial.current.query, generation: crypto.randomUUID(), notice: initial.current.message ?? '' }));
  const generation = useRef(state.generation);
  const ownedSearchId = useRef<string | undefined>(undefined);
  const ownNavigation = useRef<string | undefined>(undefined);
  const live = useRef(true);
  const starts = searchStartPool(client);
  const startSnapshot = useSyncExternalStore(starts.subscribe, starts.getSnapshot);
  const pendingGeneration = useRef<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [accepted, setAccepted] = useState(false);
  const resetting = startSnapshot.resetting;
  const startLimitReached = startSnapshot.count >= unresolvedStartLimit;
  useEffect(() => { live.current = true; return () => { live.current = false; generation.current = undefined; }; }, []);
  useEffect(() => {
    if (ownNavigation.current === location.search) { ownNavigation.current = undefined; return; }
    const parsed = parseSearchUrl(location.search, catalog, session);
    const next = crypto.randomUUID();
    generation.current = next;
    dispatch({ type: 'restore', draft: parsed.query ?? initialDraft(catalog, session), query: parsed.query, generation: next, notice: parsed.message });
    setFeedback(''); setAccepted(false); setPending(false);
    if (parsed.query) {
      const canonical = serializeSearchUrl(parsed.query);
      if (canonical !== location.search) { ownNavigation.current = canonical; void navigate({ pathname: '/', search: canonical }, { replace: true }); }
    }
  }, [location.key, location.search, catalog, session, navigate]);
  const validity = validateDraft(state.draft, catalog, session);
  function edit(patch: Partial<SearchDraft>) { dispatch({ type: 'draft', patch, catalog }); setFeedback(''); }
  function preset(draft: SearchDraft) { dispatch({ type: 'preset', draft }); setFeedback(''); }
  async function submit(query: TransportSearchQuery = validity.query!) {
    if (!query || starts.getSnapshot().resetting || pendingGeneration.current === generation.current) return;
    const checked = validateDraft(query, catalog, session);
    if (!checked.valid) { setFeedback(checked.errors.join(' ')); return; }
    const slot = starts.reserve();
    if (!slot) return;
    const next = crypto.randomUUID();
    generation.current = next;
    pendingGeneration.current = next;
    const priorId = ownedSearchId.current;
    dispatch({ type: 'commit', query: checked.query!, generation: next });
    setPending(true); setAccepted(false); setFeedback('');
    const search = serializeSearchUrl(checked.query!);
    if (location.search !== search) { ownNavigation.current = search; void navigate({ pathname: '/', search }); }
    // Do not abort a POST whose operation ID may already exist. A stale reply is
    // retained only long enough to cancel exactly that operation in this session.
    await (async () => {
      try {
        const recovery = await client.startSearch({ query: checked.query!, clientGeneration: next, ...(priorId ? { supersedesSearchId: priorId } : {}) }, slot.signal);
        if (!live.current || starts.epoch !== slot.epoch || generation.current !== next || recovery.snapshot.clientGeneration !== next) { await client.cancelSearch(recovery.snapshot.searchId).catch(() => undefined); return; }
        if (serializeSearchUrl(recovery.snapshot.query) !== serializeSearchUrl(checked.query!)) { await client.cancelSearch(recovery.snapshot.searchId).catch(() => undefined); throw new ClientError('schema', 'search-response-query-mismatch'); }
        ownedSearchId.current = recovery.snapshot.searchId;
        cache.setQueryData(['search', next, recovery.snapshot.searchId], recovery);
        dispatch({ type: 'adopt', generation: next, searchId: recovery.snapshot.searchId });
        setAccepted(true);
      } catch (error) { if (live.current && generation.current === next) setFeedback(errorMessage(error)); }
      finally {
        if (pendingGeneration.current === next) pendingGeneration.current = undefined;
        if (live.current && generation.current === next) setPending(false);
        slot.finish();
      }
    })();
  }
  async function reset() {
    if (!starts.beginReset()) return;
    generation.current = crypto.randomUUID(); setAccepted(false); setPending(false); setFeedback('');
    // Fetch cancellation settles immediately in browsers. Bound custom transports
    // too; the server reset atomically fences/cancels the old namespace.
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([Promise.allSettled(starts.pending()), new Promise<void>(resolve => { timer = setTimeout(resolve, 1500); })]);
    clearTimeout(timer);
    try {
      const next = await client.reset();
      cache.removeQueries({ queryKey: ['search'] });
      const valid = state.committed && validateDraft(state.committed, catalog, next);
      window.location.assign(valid && valid.valid ? serializeSearchUrl(valid.query!) : '/');
    } catch (error) { setFeedback(errorMessage(error)); starts.resetFailed(); }
  }
  return { state, dispatch, edit, preset, submit, reset, validity, pending, resetting, feedback, accepted, startLimitReached, unresolvedStarts: startSnapshot.count, capacityMessage: startLimitReached && !resetting ? startCapacityMessage : '' };
}
