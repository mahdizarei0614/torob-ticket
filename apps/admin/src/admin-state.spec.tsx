import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useContext } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AdminContext, type AdminContextValue } from './admin-context';
import { AdminState, useAdmin } from './admin-state';

const mocks = vi.hoisted(() => ({ session: vi.fn(), config: vi.fn(), catalog: vi.fn() }));
vi.mock('@torob-ticket/client', async () => {
  const actual = await vi.importActual<typeof import('@torob-ticket/client')>('@torob-ticket/client');
  return { ...actual, apiClient: { ...actual.apiClient, session: mocks.session, catalogReadonly: mocks.catalog }, adminClient: { ...actual.adminClient, config: mocks.config } };
});
const session = { seed: 1, anchorInstant: '2026-10-25T00:00:00Z', scenario: 'normal' as const, fixtureVersion: 'showcase-v1', catalogRevision: 'catalog-v1', mappingRevision: 'mapping-v1', scenarioRevision: 'revision-one', expiresAt: '2026-11-25T00:00:00Z', identity: null };
const config = { session, revision: 'revision-one', providers: [] };
const catalog = { fixtureVersion: session.fixtureVersion, catalogRevision: session.catalogRevision, cities: [], places: [], supportedConnections: [], classChoices: [], providerCapabilities: [] };
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue(session); mocks.config.mockResolvedValue(config); mocks.catalog.mockResolvedValue(catalog); });

it('reads the stable leaf provider through the public hook without bootstrapping or replacing its authority', () => {
  const value: AdminContextValue = { epoch: 4, config, catalog, busy: false, feedback: 'saved', error: '', resume: async () => undefined, run: async (action, done) => { done?.(await action()); }, refresh: () => undefined, reset: async () => undefined };
  let observed: AdminContextValue | undefined;
  function Consumer() { observed = useAdmin(); return null; }
  render(<AdminContext.Provider value={value}><Consumer /></AdminContext.Provider>);
  expect(observed).toBe(value);
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.config).not.toHaveBeenCalled();
});

it('shares the same live provider value with hook and direct consumers while preserving bootstrap and mutation locking', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let current!: AdminContextValue;
  let direct: AdminContextValue | undefined;
  function Consumer() { current = useAdmin(); direct = useContext(AdminContext); return null; }
  const view = render(<QueryClientProvider client={cache}><AdminState><Consumer /></AdminState></QueryClientProvider>);
  try {
    await waitFor(() => expect(current.catalog).toBe(catalog));
    expect(direct).toBe(current); expect(mocks.session).toHaveBeenCalledTimes(1);
    let release!: (value: string) => void;
    const action = vi.fn(() => new Promise<string>(done => { release = done; }));
    const duplicate = vi.fn(async () => 'duplicate'), done = vi.fn();
    let operation!: Promise<void>;
    act(() => { operation = current.run(action, done); void current.run(duplicate); });
    expect(current.busy).toBe(true); expect(direct).toBe(current); expect(duplicate).not.toHaveBeenCalled();
    await act(async () => { release('accepted'); await operation; });
    expect(done).toHaveBeenCalledExactlyOnceWith('accepted');
    expect(current.busy).toBe(false); expect(current.feedback).toBe('Changes saved. Existing recorded evidence is retained.');
    expect(direct).toBe(current); expect(mocks.session).toHaveBeenCalledTimes(1); expect(mocks.config).toHaveBeenCalledTimes(2);
  } finally { view.unmount(); cache.clear(); }
});
