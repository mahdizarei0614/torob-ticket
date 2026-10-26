import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientError } from '@torob-ticket/client';
import { useSessionSync, type RetainedSearchLease } from './use-session-sync';
import { session, query } from './search-test-data';
const mocks = vi.hoisted(() => ({ currentSession: vi.fn(), snapshot: vi.fn(), session: vi.fn() }));
vi.mock('@torob-ticket/client', async () => { const actual = await vi.importActual<typeof import('@torob-ticket/client')>('@torob-ticket/client'); return { ...actual, apiClient: { ...actual.apiClient, ...mocks } }; });
const missing = () => new ClientError('api', 'NOT_FOUND', { code: 'NOT_FOUND', requestId: 'scope-read', fieldPaths: [], retryable: false }, 404);
beforeEach(() => { vi.resetAllMocks(); mocks.currentSession.mockResolvedValue(session); });
function setup() {
  const cache = new QueryClient(); cache.setQueryData(['consumer-bootstrap'], { session, catalog: {} }); cache.setQueryData(['search', 'old', 'retained'], { original: true });
  let current = true;
  const lease: RetainedSearchLease = { searchId: 'retained', generation: 'old', query, isCurrent: () => current };
  function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={cache}>{children}</QueryClientProvider>; }
  const hook = renderHook(({ active, value }) => useSessionSync(value, active, () => lease), { wrapper, initialProps: { active: true, value: session } });
  return { ...hook, cache, replaceSource: () => { current = false; } };
}
describe('same-metadata namespace reset recovery', () => {
  it('detects a missing retained source by scoped GET while preserving the original receipt and starting nothing', async () => {
    mocks.snapshot.mockRejectedValue(missing());
    const hook = setup(); await waitFor(() => expect(hook.result.current.revision).toBe(1));
    expect(mocks.snapshot).toHaveBeenCalledExactlyOnceWith('retained', expect.any(AbortSignal));
    expect(hook.cache.getQueryData(['search', 'old', 'retained'])).toEqual({ original: true }); expect(mocks.session).not.toHaveBeenCalled();
  });
  it('ignores late old404 after the controller has accepted a different search lease', async () => {
    let reject!: (error: unknown) => void; mocks.snapshot.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const hook = setup(); await waitFor(() => expect(mocks.snapshot).toHaveBeenCalledTimes(1));
    hook.replaceSource(); await act(async () => reject(missing()));
    expect(hook.result.current.revision).toBe(0); expect(mocks.session).not.toHaveBeenCalled();
  });
  it('ignores late old404 after covering the view or changing current configuration', async () => {
    let reject!: (error: unknown) => void; mocks.snapshot.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const hook = setup(); await waitFor(() => expect(mocks.snapshot).toHaveBeenCalledTimes(1));
    hook.rerender({ active: false, value: { ...session, scenarioRevision: 'current-new' } });
    await act(async () => reject(missing())); expect(hook.result.current.revision).toBe(0);
  });
  it('ignores late old404 after explicit resume has established a new authority epoch', async () => {
    let reject!: (error: unknown) => void; mocks.snapshot.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; })); mocks.session.mockResolvedValue(session);
    const hook = setup(); await waitFor(() => expect(mocks.snapshot).toHaveBeenCalledTimes(1));
    await act(() => hook.result.current.resume()); const revision = hook.result.current.revision;
    await act(async () => reject(missing())); expect(hook.result.current.revision).toBe(revision); expect(hook.result.current.expired).toBe(false);
  });
});
