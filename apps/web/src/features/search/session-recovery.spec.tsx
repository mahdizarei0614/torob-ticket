import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionInfo } from '@torob-ticket/contracts';
import { useSessionSync } from './use-session-sync';
import { session } from './search-test-data';
const mocks = vi.hoisted(() => ({ currentSession: vi.fn(), session: vi.fn(), catalogReadonly: vi.fn() }));
vi.mock('@torob-ticket/client', async () => { const actual = await vi.importActual<typeof import('@torob-ticket/client')>('@torob-ticket/client'); return { ...actual, apiClient: { ...actual.apiClient, ...mocks } }; });
beforeEach(() => vi.resetAllMocks());
function setup() {
  const cache = new QueryClient(); cache.setQueryData(['consumer-bootstrap'], { session, catalog: {} });
  function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={cache}>{children}</QueryClientProvider>; }
  return { cache, ...renderHook(() => useSessionSync(session, true), { wrapper }) };
}
describe('foreground recovery metadata ownership', () => {
  it('coalesces focus to the latest read and invalidates only current date inventory', async () => {
    const pending: ((value: SessionInfo) => void)[] = [];
    mocks.currentSession.mockImplementation(() => new Promise<SessionInfo>(resolve => pending.push(resolve)));
    const hook = setup();
    for (const key of [['search', 'g', 's'], ['hotel-location-assets'], ['referral', 'r'], ['date-prices', 'x', 'historical', 'old'], ['unrelated']]) hook.cache.setQueryData(key, { preserved: true });
    hook.cache.setQueryData(['date-prices', 'x'], { stale: true });
    act(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus')); });
    expect(mocks.currentSession).toHaveBeenCalledTimes(1);
    await act(async () => pending[0]!({ ...session, scenarioRevision: 'next' }));
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1]!({ ...session, scenarioRevision: 'next' }));
    expect(hook.result.current.revision).toBe(1);
    expect(hook.cache.getQueryData(['date-prices', 'x'])).toBeUndefined();
    for (const key of [['search', 'g', 's'], ['hotel-location-assets'], ['referral', 'r'], ['date-prices', 'x', 'historical', 'old'], ['unrelated']]) expect(hook.cache.getQueryData(key)).toEqual({ preserved: true });
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it('does not let an earlier foreground response undo a later expiry notification', async () => {
    let release!: (value: SessionInfo) => void;
    mocks.currentSession.mockReturnValue(new Promise<SessionInfo>(resolve => { release = resolve; }));
    const hook = setup(); act(() => hook.result.current.reportExpired());
    await act(async () => release(session));
    expect(hook.result.current.expired).toBe(true);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it('resumes only explicitly and does not start a search or clear immutable evidence', async () => {
    mocks.currentSession.mockReturnValue(new Promise(() => undefined)); mocks.session.mockResolvedValue({ ...session, anchorInstant: '2026-10-28T00:00:00Z' });
    const hook = setup(); hook.cache.setQueryData(['search', 'g', 'old'], { original: true });
    act(() => hook.result.current.reportExpired()); expect(mocks.session).not.toHaveBeenCalled();
    await act(() => hook.result.current.resume());
    expect(mocks.session).toHaveBeenCalledTimes(1); expect(hook.result.current.expired).toBe(false);
    expect(hook.cache.getQueryData(['search', 'g', 'old'])).toEqual({ original: true });
  });
});
