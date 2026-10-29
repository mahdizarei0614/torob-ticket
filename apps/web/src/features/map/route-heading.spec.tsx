import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import type { CatalogSnapshot, Itinerary } from '@torob-ticket/contracts';
import { group } from '../results/results-test-data';
import { catalog, query } from '../search/search-test-data';
import { MapHeading } from './trip-map';
import { routeHeading } from './route-heading';
import type { TripMapController } from './use-trip-map';
afterEach(() => vi.unstubAllGlobals());

const routeCatalog: CatalogSnapshot = { ...catalog, places: [
 { id: 'IKA', cityId: 'a', name: 'فرودگاه آغاز', kind: 'airport', code: 'IKA', point: { latitude: 35, longitude: 51 }, timeZone: 'Asia/Tehran' },
 { id: 'TBZ', cityId: 'c', name: 'فرودگاه میانی', kind: 'airport', code: 'TBZ', point: { latitude: 38, longitude: 46 }, timeZone: 'Asia/Tehran' },
 { id: 'MHD', cityId: 'b', name: 'فرودگاه پایان', kind: 'airport', code: 'MHD', point: { latitude: 36, longitude: 59 }, timeZone: 'Asia/Tehran' },
] };
const first = group('first').itinerary;
const connected: Itinerary = { ...first, itineraryId: 'connected', outbound: { segments: [{ ...first.outbound.segments[0]!, destinationPlaceId: 'TBZ', operatorId: 'demo-operator-flight-1', departureAt: '2026-10-25T08:00:00Z' }, { ...first.outbound.segments[0]!, segmentId: 'second', originPlaceId: 'TBZ' }], stops: [{ placeId: 'TBZ', waitMinutes: 45, vehicleChange: true, kind: 'connection' }] } };

it('keeps draft route identity independent of trip type while recognizing genuine service facts', () => {
 const outbound = routeHeading({ direction: 'outbound', query }, routeCatalog);
 const roundTripQuery = { ...query, tripType: 'round-trip' as const, returnDate: '2026-10-28' };
 const roundTrip = routeHeading({ direction: 'outbound', query: roundTripQuery }, routeCatalog);
 expect(roundTrip.key).toBe(outbound.key); expect(roundTrip.intentKey).toBe(outbound.intentKey);
 expect(roundTrip.bidirectional).toBe(true); expect(outbound.bidirectional).toBe(false);
 const changedService = { ...first, outbound: { ...first.outbound, segments: first.outbound.segments.map(segment => ({ ...segment, operatorId: 'demo-operator-flight-1' })) } };
 expect(routeHeading({ itinerary: changedService, direction: 'outbound', query }, routeCatalog).key).not.toBe(routeHeading({ itinerary: first, direction: 'outbound', query }, routeCatalog).key);
 expect(routeHeading({ direction: 'return', query: roundTripQuery }, routeCatalog).intentKey).not.toBe(roundTrip.intentKey);
});

it('animates only the stable arrow under StrictMode through repeated draft toggles, settling while covered', async () => {
 vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
 const map = { presentationView: { direction: 'outbound', query } } as unknown as TripMapController;
 const view = render(<StrictMode><MapHeading map={map} catalog={routeCatalog}/></StrictMode>);
 const heading = screen.getByRole('heading'), frame = heading.closest<HTMLElement>('[data-map-heading-key]')!;
 const labels = Array.from(heading.querySelectorAll('[data-map-city-label]'));
 const textNodes = labels.map(label => label.firstChild), codes = Array.from(heading.querySelectorAll('bdi'));
 const arrow = heading.querySelector<HTMLElement>('[data-map-heading-arrow]')!;
 await waitFor(() => expect(frame.style.opacity).toBe('1'));
 for (const tripType of ['round-trip', 'one-way', 'round-trip'] as const) {
  view.rerender(<StrictMode><MapHeading map={{ ...map, presentationView: { ...map.presentationView, query: { ...query, tripType } } }} catalog={routeCatalog}/></StrictMode>);
  expect(screen.getByRole('heading')).toBe(heading); expect(frame.style.opacity).toBe('1');
  expect(Array.from(heading.querySelectorAll('[data-map-city-label]'))).toEqual(labels);
  expect(labels.map(label => label.firstChild)).toEqual(textNodes); expect(Array.from(heading.querySelectorAll('bdi'))).toEqual(codes);
  expect(heading.querySelector('[data-map-heading-arrow]')).toBe(arrow); expect(arrow.textContent).toBe(tripType === 'round-trip' ? '↔' : '←');
  await waitFor(() => { const opacity = Number(arrow.style.opacity); expect(opacity).toBeGreaterThan(0); expect(opacity).toBeLessThan(1); }, { interval: 10 });
  await waitFor(() => expect(arrow.style.opacity).toBe('1'));
 }
 // An interrupted arrow transition settles when covered and never replays on resume.
 const single = { ...map, presentationView: { ...map.presentationView, query } };
 view.rerender(<StrictMode><MapHeading map={single} catalog={routeCatalog}/></StrictMode>);
 await waitFor(() => { const opacity = Number(arrow.style.opacity); expect(opacity).toBeGreaterThan(0); expect(opacity).toBeLessThan(1); }, { interval: 10 });
 view.rerender(<StrictMode><MapHeading map={single} catalog={routeCatalog} covered/></StrictMode>);
 expect(arrow).toHaveAttribute('data-arrow-motion', 'static'); await waitFor(() => expect(arrow.style.opacity).toBe('1'));
 view.rerender(<StrictMode><MapHeading map={single} catalog={routeCatalog}/></StrictMode>);
 expect(arrow.style.opacity).toBe('1'); expect(screen.getByRole('heading')).toBe(heading);
});

it('retains selected endpoint labels and code slots when a trip toggle clears stale service and stop metadata', () => {
 const map = { presentationView: { itinerary: connected, direction: 'outbound', query } } as unknown as TripMapController;
 const view = render(<MapHeading map={map} catalog={routeCatalog} covered/>);
 const heading = screen.getByRole('heading'), start = heading.querySelector('[data-map-city-label="a"]')!, end = heading.querySelector('[data-map-city-label="b"]')!;
 const text = [start.firstChild, end.firstChild], codes = [heading.querySelector('[data-map-city-code="a"]')!, heading.querySelector('[data-map-city-code="b"]')!];
 expect(codes.map(code => code.textContent)).toEqual(['(IKA)', '(MHD)']);
 expect(screen.getByText(/ماهان/)).toBeInTheDocument();
 for (const tripType of ['round-trip', 'one-way', 'round-trip'] as const) {
  view.rerender(<MapHeading map={{ ...map, presentationView: { ...map.presentationView, itinerary: undefined, query: { ...query, tripType } } }} catalog={routeCatalog} covered/>);
  expect(screen.getByRole('heading')).toBe(heading);
  expect(heading.querySelector('[data-map-city-label="a"]')).toBe(start); expect(heading.querySelector('[data-map-city-label="b"]')).toBe(end);
  expect([start.firstChild, end.firstChild]).toEqual(text);
  expect([heading.querySelector('[data-map-city-code="a"]'), heading.querySelector('[data-map-city-code="b"]')]).toEqual(codes);
  for (const code of codes) { expect(code).not.toBeVisible(); expect(code.textContent).toBe(''); }
  expect(heading.querySelector('[data-map-city-label="c"]')).not.toBeInTheDocument();
  expect(screen.queryByText(/ماهان/)).not.toBeInTheDocument();
 }
 // The identical original itinerary must enter as selected evidence again,
 // rather than colliding with its old retained frame key after the draft cycle.
 view.rerender(<MapHeading map={map} catalog={routeCatalog} covered/>);
 expect(screen.getByRole('heading')).not.toBe(heading);
 expect(screen.getByText(/ماهان/)).toBeInTheDocument();
 const next = { ...first, itineraryId: 'new-ticket' };
 view.rerender(<MapHeading map={{ ...map, presentationView: { ...map.presentationView, itinerary: next, query: { ...query, tripType: 'round-trip' } } }} catalog={routeCatalog} covered/>);
 expect(screen.getByRole('heading')).not.toBe(heading);
 expect(screen.getByText(/ایران‌ایر/)).toBeInTheDocument();
});

it('settles arrow changes immediately under reduced motion without retiring the city heading', async () => {
 vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
 const map = { presentationView: { direction: 'outbound', query } } as unknown as TripMapController;
 const view = render(<MapHeading map={map} catalog={routeCatalog}/>);
 const heading = screen.getByRole('heading'), arrow = heading.querySelector<HTMLElement>('[data-map-heading-arrow]')!;
 view.rerender(<MapHeading map={{ ...map, presentationView: { ...map.presentationView, query: { ...query, tripType: 'round-trip' } } }} catalog={routeCatalog}/>);
 expect(screen.getByRole('heading')).toBe(heading); expect(arrow).toHaveAttribute('data-arrow-motion', 'static');
 expect(arrow.textContent).toBe('↔'); expect(arrow.style.opacity).not.toBe('0');
 await waitFor(() => expect(arrow.style.opacity).toBe('1'));
});

it('uses the chosen service stops, operator, origin-local departure and transport codes', () => {
 const initial = routeHeading({ itinerary: first, direction: 'outbound', query }, routeCatalog);
 const next = routeHeading({ itinerary: connected, direction: 'outbound', query }, routeCatalog);
 expect(initial.labels).toEqual(['آغاز', 'پایان']);
 expect(next.labels).toEqual(['آغاز', 'دیگر', 'پایان']);
 expect(next.service).toContain('ماهان');
 expect(next.service).not.toBe(initial.service);
 expect(next.codes).toBe('IKA → TBZ → MHD');
 expect(next.nodes.map(node => [node.label, node.code])).toEqual([['آغاز', 'IKA'], ['دیگر', 'TBZ'], ['پایان', 'MHD']]);
 expect(next.key).not.toBe(initial.key);
 const unknown = routeHeading({ itinerary: { ...connected, outbound: { ...connected.outbound, stops: [{ ...connected.outbound.stops[0]!, placeId: 'unmapped' }] } }, direction: 'outbound', query }, routeCatalog);
 expect(unknown.labels).toEqual(['آغاز', 'نام محل اعلام نشده', 'پایان']);
});

it('updates the visible heading for a new pinned ticket and keeps hover inspection out of it', async () => {
 const map = { presentationView: { itinerary: first, direction: 'outbound', query }, view: { itinerary: connected, direction: 'outbound', query } } as unknown as TripMapController;
 const view = render(<MapHeading map={map} catalog={routeCatalog} covered/>);
 expect(screen.getByRole('heading')).toHaveTextContent('آغاز');
 expect(screen.getByRole('heading')).not.toHaveTextContent('دیگر');
 expect(screen.getByText(/ایران‌ایر/)).toBeVisible();
 view.rerender(<MapHeading map={{ ...map, presentationView: { ...map.presentationView, itinerary: connected } }} catalog={routeCatalog} covered/>);
 expect(screen.getByRole('heading')).toHaveTextContent('دیگر');
 expect(screen.getByText(/ماهان/)).toBeVisible();
 const leaving = screen.queryByText(/ایران‌ایر/);
 if (leaving) expect(leaving.closest('[data-map-heading-key]')).toHaveAttribute('aria-hidden', 'true');
 await waitFor(() => expect(screen.queryByText(/ایران‌ایر/)).not.toBeInTheDocument());
});

it('uses the selected return leg and falls back to form city names before a ticket is pinned', () => {
 const itinerary = { ...first, return: { segments: [{ ...first.outbound.segments[0]!, originPlaceId: 'MHD', destinationPlaceId: 'IKA' }], stops: [] } };
 expect(routeHeading({ itinerary, direction: 'return', query }, routeCatalog).labels).toEqual(['پایان', 'آغاز']);
 expect(routeHeading({ direction: 'return', query }, routeCatalog)).toMatchObject({ labels: ['پایان', 'آغاز'], service: undefined, codes: undefined });
 const wholeTrip = routeHeading({ itinerary, direction: 'outbound', query }, routeCatalog);
 expect(wholeTrip.labels).toEqual(['آغاز', 'پایان']);
 expect(wholeTrip.bidirectional).toBe(true);
 expect(wholeTrip.codes).toBe('IKA → MHD → IKA');
 expect(wholeTrip.service).toContain('رفت'); expect(wholeTrip.service).toContain('برگشت');
});

it('shows a double arrow and adjacent bidi-safe airport codes, retaining asymmetric return facilities', () => {
 const withSecondAirport: CatalogSnapshot = { ...routeCatalog, places: [...routeCatalog.places, { ...routeCatalog.places[0]!, id: 'THR', code: 'THR' }] };
 const itinerary = { ...first, return: { segments: [{ ...first.outbound.segments[0]!, originPlaceId: 'MHD', destinationPlaceId: 'THR' }], stops: [] } };
 const heading = routeHeading({ itinerary, direction: 'outbound', query }, withSecondAirport);
 expect(heading.nodes.map(node => node.code)).toEqual(['IKA / THR', 'MHD']);
 expect(heading.codes).toBe('IKA → MHD → THR');
 render(<MapHeading map={{ presentationView: { itinerary, direction: 'outbound', query } } as unknown as TripMapController} catalog={withSecondAirport} covered/>);
 const title = screen.getByRole('heading');
 expect(title).toHaveTextContent('آغاز(IKA / THR)↔پایان(MHD)');
 expect(title.querySelectorAll('bdi[dir="ltr"]')).toHaveLength(2);
 expect(routeHeading({ direction: 'outbound', query: { ...query, tripType: 'round-trip' } }, withSecondAirport)).toMatchObject({ bidirectional: true, labels: ['آغاز', 'پایان'] });
 expect(routeHeading({ itinerary, direction: 'return', query }, withSecondAirport).bidirectional).toBe(false);
});

it('does not present internal rail or bus fixture IDs as genuine public codes', () => {
 const ground: CatalogSnapshot = { ...routeCatalog, places: routeCatalog.places.map(place => ({ ...place, kind: 'station', code: `internal-${place.id}` })) };
 const heading = routeHeading({ itinerary: connected, direction: 'outbound', query }, ground);
 expect(heading.nodes.every(node => node.code === undefined)).toBe(true);
 expect(heading.codes).toBeUndefined();
 const draft = routeHeading({ direction: 'outbound', query }, routeCatalog);
 expect(draft.nodes.every(node => node.code === undefined)).toBe(true);
});

it('fades and finitely removes the previous heading under actual normal motion', async () => {
 vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
 const map = { presentationView: { itinerary: first, direction: 'outbound', query } } as unknown as TripMapController;
 const view = render(<MapHeading map={map} catalog={routeCatalog}/>);
 const previous = screen.getByText(/ایران‌ایر/).closest<HTMLElement>('[data-map-heading-key]')!;
 await waitFor(() => expect(previous.style.opacity).toBe('1'));
 view.rerender(<MapHeading map={{ ...map, presentationView: { ...map.presentationView, itinerary: connected } }} catalog={routeCatalog}/>);
 expect(previous).toHaveAttribute('aria-hidden', 'true');
 await waitFor(() => { const opacity = Number(previous.style.opacity); expect(opacity).toBeGreaterThan(0); expect(opacity).toBeLessThan(1); }, { interval: 10 });
 await waitFor(() => expect(previous).not.toBeInTheDocument(), { timeout: 1500 });
 expect(screen.getByRole('heading')).toHaveTextContent('دیگر');
});
