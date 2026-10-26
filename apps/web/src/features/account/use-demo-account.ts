import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { apiClient, ClientError, type ApiClient } from '@torob-ticket/client';
import type { DemoIdentity, SavedSearch, SaveSearchInput } from '@torob-ticket/contracts';
import { searchStartPool } from '../search/search-start-pool';
export function accountError(error: unknown) { if (error instanceof ClientError) {
    if (error.api?.code === 'IDENTITY_REQUIRED')
        return 'برای دسترسی به جست‌وجوهای ذخیره‌شده، دوباره وارد شوید.';
    if (error.api?.code === 'SAVED_SEARCH_LIMIT')
        return '۲۰ جست‌وجوی متفاوت ذخیره شده است. یکی را حذف کنید و دوباره ذخیره کنید.';
    if (error.api?.code === 'SESSION_EXPIRED')
        return 'دسترسی به حساب پایان یافته است. صفحه را تازه کنید.';
    if (error.kind === 'network')
        return 'ارتباط برقرار نشد. دوباره تلاش کنید.';
} return 'اطلاعات حساب دریافت یا ذخیره نشد. دوباره تلاش کنید.'; }
/** Account authority is separate from the immutable consumer bootstrap/query controller. */
export function useDemoAccount(initialIdentity: DemoIdentity | null, client: ApiClient = apiClient) {
    const pool = searchStartPool(client);
    const reset = useSyncExternalStore(pool.subscribe, pool.getSnapshot);
    const [identity, setIdentity] = useState(initialIdentity);
    const [items, setItems] = useState<SavedSearch[]>([]);
    const [ready, setReady] = useState(false);
    const [pending, setPending] = useState<'read' | 'write' | null>(null);
    const [listStatus, setListStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
    const [error, setError] = useState('');
    const [,publishLifetime]=useState(0);
    const identityRef = useRef(identity);
    identityRef.current = identity;
    const live = useRef(true), epoch = useRef(0), sandbox = useRef(pool.epoch), request = useRef<AbortController | undefined>(undefined), writing = useRef(false);
    function valid(token: number, scope: number) { return live.current && epoch.current === token && pool.epoch === scope && !pool.getSnapshot().resetting; }
    function clear() { setIdentity(null); setItems([]); setReady(false); setListStatus('idle'); }
    // Republish current view leases before paint after a lifecycle replay/resume.
    // Cleanup still fences the previous lifetime's pending requests and real unmount.
    useLayoutEffect(() => { live.current = true; publishLifetime(value=>value+1); return () => { live.current = false; epoch.current++; request.current?.abort(); }; }, []);
    useEffect(() => { if (sandbox.current !== pool.epoch || reset.resetting) {
        sandbox.current = pool.epoch;
        epoch.current++;
        request.current?.abort();
        writing.current = false;
        setPending(null);
        setError('');
        clear();
    } }, [reset.resetting, pool.epoch]);
    async function run(kind: 'read' | 'write', work: (signal: AbortSignal, current: () => boolean) => Promise<void>) { if (!live.current || pool.getSnapshot().resetting || writing.current || pool.epoch !== renderedScope || epoch.current !== renderedEpoch)
        return false; const token = ++epoch.current, scope = pool.epoch; sandbox.current = scope; request.current?.abort(); const controller = new AbortController(); request.current = controller; writing.current = kind === 'write'; setPending(kind); setError(''); const current = () => valid(token, scope); try {
        await work(controller.signal, current);
        return current();
    }
    catch (e) {
        if (current() && !controller.signal.aborted) {
            if (e instanceof ClientError && ['IDENTITY_REQUIRED', 'SESSION_EXPIRED'].includes(e.api?.code ?? '')) {
                setIdentity(null);
                setItems([]);
                setReady(false);
            }
            setError(accountError(e));
            setListStatus('error');
        }
        return false;
    }
    finally {
        if (current()) {
            writing.current = false;
            setPending(null);
        }
    } }
    async function load(signal: AbortSignal, current: () => boolean) { setListStatus('loading'); const result = await client.listSavedSearches(signal); if (current()) {
        setItems(result.items);
        setListStatus('complete');
    } }
    function refresh() { return run('read', async (signal, current) => { const result = await client.authState(signal); if (!current())
        return; setIdentity(result.identity); setReady(true); if (result.identity)
        await load(signal, current);
    else {
        setItems([]);
        setListStatus('idle');
    } }); }
    function signIn() { return run('write', async (signal, current) => { const result = await client.signIn(signal); if (!current())
        return; setIdentity(result.identity); setReady(true); if (result.identity)
        await load(signal, current); }); }
    function signOut() { return run('write', async (signal, current) => { const result = await client.signOut(signal); if (current()) {
        setIdentity(result.identity);
        setItems([]);
        setListStatus('idle');
        setReady(true);
    } }); }
    function save(input: SaveSearchInput) { return run('write', async (signal, current) => { await client.saveSearch(input, signal); if (current())
        await load(signal, current); }); }
    function remove(id: string) { return run('write', async (signal, current) => { await client.deleteSavedSearch(id, signal); if (current())
        await load(signal, current); }); }
    const renderedEpoch = epoch.current, renderedScope = pool.epoch, renderedIdentity = identity?.identityId;
    const isCurrent = () => valid(renderedEpoch, renderedScope) && !writing.current && identityRef.current?.identityId === renderedIdentity;
    return { identity, items, ready, pending, listStatus, error, refresh, signIn, signOut, save, remove, isCurrent, resetting: reset.resetting };
}
export type DemoAccount = ReturnType<typeof useDemoAccount>;
