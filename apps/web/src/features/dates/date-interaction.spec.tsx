import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@torob-ticket/client';
import type { SearchRequest } from '@torob-ticket/contracts';
import { useSearchController } from '../search/use-search-controller';
import { catalog, query, session } from '../search/search-test-data';
import { serializeSearchUrl } from '../search/search-url';
import { DateWheel } from './date-wheel';
import { commitDate } from './date-state';
afterEach(() => vi.useRealTimers());
describe('date gesture authorization is fenced by external intent changes', () => {
  function setup() {
    const client = { startSearch: vi.fn(async (request: SearchRequest) => ({ snapshot: { searchId: 'selected-date', query: request.query, clientGeneration: request.clientGeneration, status: 'collecting', groups: [], providerStatuses: [], coverage: { complete: false, expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [] }, observedAt: session.anchorInstant }, sequence: 0 })), cancelSearch: vi.fn(async () => undefined) } as unknown as ApiClient;
    let back!: () => void, edit!: () => void;
    function Harness() { const controller = useSearchController(catalog,session,client); const navigate = useNavigate(); back = () => { void navigate(-1); }; edit = () => controller.edit({ party: { adults: 2, children: 0, infants: 0 } }); return <DateWheel dates={['2026-10-25','2026-10-26','2026-10-27']} value={controller.state.draft.departureDate} cells={[]} interaction={controller.dateInteractions} onPreview={date => controller.dispatch({ type: 'preview-date',date })} onCommit={date => controller.commitDates(commitDate(controller.state.draft,'outbound',date))} />; }
    const view = render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/',serializeSearchUrl(query)]} initialIndex={1}><Harness /></MemoryRouter></QueryClientProvider>);
    return { client, back: () => back(), edit: () => edit(), ...view };
  }
  it.each(['router','native'])('cancels a pending wheel settle on %s history restoring the identical departure', async navigation => {
    vi.useFakeTimers(); const view = setup(); fireEvent.keyDown(screen.getByRole('listbox'),{key:'ArrowDown'});
    act(() => { if (navigation === 'router') view.back(); else { window.history.replaceState(null,'','/'); window.dispatchEvent(new PopStateEvent('popstate')); vi.advanceTimersByTime(300); } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); }); expect(view.client.startSearch).not.toHaveBeenCalled(); expect(screen.getByRole('listbox')).toHaveAttribute('data-preview-date',query.departureDate); view.unmount();
  });
  it('cancels old-basis timers on nondate edits and authorizes a fresh gesture once', async () => {
    vi.useFakeTimers(); const view = setup(); fireEvent.keyDown(screen.getByRole('listbox'),{key:'ArrowDown'}); act(() => view.edit());
    await act(async () => { await vi.advanceTimersByTimeAsync(300); }); expect(view.client.startSearch).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('listbox'),{key:'ArrowDown'}); await act(async () => { await vi.advanceTimersByTimeAsync(300); }); expect(view.client.startSearch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ query: expect.objectContaining({ departureDate: '2026-10-26', party: { adults: 2,children: 0,infants: 0 } }) }),expect.any(AbortSignal)); view.unmount();
  });
});
