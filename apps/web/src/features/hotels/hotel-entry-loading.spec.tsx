import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from '@torob-ticket/client';
import { HotelEntry } from './hotel-entry';
import type { FreeLocationMapProps } from './free-location-map';
import type { SearchController, TripMapController } from '../map/use-trip-map';
import { createSearchState } from '../search/search-reducer';
import { query, session } from '../search/search-test-data';
import { group } from '../results/results-test-data';
import { arrivalCatalog, arrivalSnapshot } from './arrival-hotel-test-data';

const deferred = vi.hoisted(() => {
  let release!: () => void;
  return { ready: new Promise<void>(resolve => { release = resolve; }), release: () => release() };
});
vi.mock('./hotel-dialog', async importOriginal => { await deferred.ready; return importOriginal(); });
vi.mock('./free-location-map', () => ({ FreeLocationMap: (props: FreeLocationMapProps) => <section aria-label="arrival map">{props.choices.find(choice => choice.kind === 'arrival')?.name}</section> }));
afterEach(() => vi.restoreAllMocks());

it('keeps a cold hotel frame dismissable while the static discovery owner loads its actual one-night data', async () => {
  const requests = vi.spyOn(apiClient, 'startHotelSearch').mockImplementation(async input => arrivalSnapshot(input));
  const controller = { state: { ...createSearchState(query), committed: query, generation: 'g', searchId: 's' }, resetting: false, pending: false, startLimitReached: false, resultIsCurrent: () => true, submit: vi.fn() } as unknown as SearchController;
  controller.currentIntent = () => controller.state;
  const row = group('arrival'), itinerary = { ...row.itinerary, outbound: { ...row.itinerary.outbound, segments: row.itinerary.outbound.segments.map(segment => ({ ...segment, arrivalAt: '2026-10-25T22:00:00Z' })) } };
  const quote = { ...row.eligibleQuotes[0]!, observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() };
  const map = { state: { selection: { quote, inspection: { itinerary, query, owner: { generation: 'g', searchId: 's' } }, valid: true, source: 'result' } } } as unknown as TripMapController;
  const covered = vi.fn();
  render(<HotelEntry controller={controller} map={map} catalog={arrivalCatalog} session={session} onCovered={covered} />);
  const trigger = screen.getByRole('button', { name: 'مقایسه اقامتگاه‌های پایان' });
  fireEvent.click(trigger);
  expect(screen.getByRole('heading', { name: 'هتل‌های پایان' })).toBeVisible();
  expect(screen.getByRole('status', { name: 'در حال آماده‌سازی اقامتگاه‌ها' })).toBeVisible();
  expect(covered).toHaveBeenLastCalledWith(true);
  await waitFor(() => expect(requests).toHaveBeenCalledTimes(1));
  expect(requests.mock.calls[0]![0]).toMatchObject({ checkIn: '2026-10-26', checkOut: '2026-10-27', arrivalPlaceId: 'MHD' });
  fireEvent.click(screen.getByRole('button', { name: 'بستن' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(covered).toHaveBeenLastCalledWith(false);
  await act(async () => { deferred.release(); });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(await screen.findByRole('list', { name: 'هتل‌ها و قیمت اقامت' })).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'ظرفیت اتاق' })).toHaveValue('1');
  expect(controller.submit).not.toHaveBeenCalled();
});
