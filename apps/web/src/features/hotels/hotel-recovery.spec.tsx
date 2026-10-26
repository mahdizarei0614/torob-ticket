import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient, } from '@torob-ticket/client';
import { useHotelDiscovery } from './use-hotel-discovery';
import { tripKey } from './hotel-state';
import { catalog, session, query } from '../search/search-test-data';

describe('independent stay recovery authority', () => {
  it('retains dates, rooms, child ages, point and dialog while revoking a pending old revision', async () => {
    const committed = { ...query, party: { adults: 3, children: 2, infants: 0, childAges: [5, 8] } };
    const trip = { query: committed, draftKey: tripKey(committed), available: true };
    let finish!: (value: unknown) => void;
    const startHotelSearch = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const client = { startHotelSearch } as unknown as ApiClient;
    const hook = renderHook(({ authorityKey }) => useHotelDiscovery({ trip, catalog, session, authorityKey, client }), { initialProps: { authorityKey: 'old' } });
    act(() => hook.result.current.openDialog());
    act(() => hook.result.current.edit({ checkIn: '2026-10-27', checkOut: '2026-10-30', rooms: 2, childAges: ['5', '8'], arrivalConfirmed: true, customPoint: { latitude: 35, longitude: 51 }, sort: 'location-distance' }));
    const draft = structuredClone(hook.result.current.state.draft);
    act(() => { void hook.result.current.submit(); });
    expect(startHotelSearch).toHaveBeenCalledTimes(1);
    const oldQuery = hook.result.current.state.requested!;
    hook.rerender({ authorityKey: 'new' });
    expect(hook.result.current.state.draft).toEqual(draft); expect(hook.result.current.open).toBe(true);
    expect(hook.result.current.authorityStale).toBe(true); expect(hook.result.current.selected).toBeUndefined();
    await act(async () => finish({ hotelSearchId: 'old', query: oldQuery, status: 'empty', hotels: [], quotes: [], results: [], observedAt: session.anchorInstant }));
    expect(hook.result.current.state.snapshot).toBeUndefined(); expect(startHotelSearch).toHaveBeenCalledTimes(1);
  });
  it('allows local edits during expiry but never starts a stay mutation before explicit resume', () => {
    const startHotelSearch = vi.fn(); const trip = { query, draftKey: tripKey(query), available: true };
    const hook = renderHook(() => useHotelDiscovery({ trip, catalog, session, authorityKey: 'expired', blocked: true, client: { startHotelSearch } as unknown as ApiClient }));
    act(() => hook.result.current.openDialog()); act(() => hook.result.current.edit({ checkOut: '2026-10-29', arrivalConfirmed: true }));
    act(() => { void hook.result.current.submit(); });
    expect(hook.result.current.state.draft.checkOut).toBe('2026-10-29'); expect(startHotelSearch).not.toHaveBeenCalled();
  });
});
