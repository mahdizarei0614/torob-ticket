import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItinerarySchema, PlaceSchema, type GeoPoint } from '@torob-ticket/contracts';
import { GraphicsProvider } from '../graphics-provider';
import { projectPoint } from '../geo/projection';
import fixtures from '../geo/route-geometry.fixture.json';
import { RouteScene, type RouteSceneProps } from './route-scene';
// Test actual public DOM/camera lifecycle. GPU compilation has separate real-browser coverage.
vi.mock('../shared-renderer', () => ({ default: () => null }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() { /* Stable initial viewport aspect. */ } disconnect() { /* No native observer in jsdom. */ } }));
afterEach(() => vi.unstubAllGlobals());
const dots: GeoPoint[] = [{ longitude: 44.2, latitude: 26 }, { longitude: 54, latitude: 32.5 }, { longitude: 63.2, latitude: 39.5 }];
const places = fixtures.places.map(place => PlaceSchema.parse(place));
const itinerary = ItinerarySchema.parse(fixtures.scenarios[0]!.itinerary);
const preview = ItinerarySchema.parse(fixtures.scenarios[1]!.itinerary);
const base: RouteSceneProps = { places, dots, scope: 'domestic', fitKey: 'initial', projection: { centralLongitude: 54 } };
function element(props: RouteSceneProps) { return <GraphicsProvider><RouteScene {...props} /></GraphicsProvider>; }
function camera(container: HTMLElement) { return JSON.parse(container.querySelector<HTMLElement>('[data-route-scene] [data-camera]')!.dataset['camera']!) as { x: number; y: number; width: number; height: number; zoom: number }; }
function expectVisible(container: HTMLElement, points: readonly GeoPoint[], props: RouteSceneProps) {
  const frame = camera(container);
  for (const point of points) { const projected = projectPoint(point, props.projection); expect(Math.abs(projected[0] - frame.x)).toBeLessThanOrEqual(frame.width / 2); expect(Math.abs(projected[1] - frame.y)).toBeLessThanOrEqual(frame.height / 2); }
}
describe('public RouteScene projection and camera intent', () => {
  it.each(['empty', 'geography', 'illustrative'] as const)('keeps the domestic %s overview visible in a nonzero caller projection', async seam => {
    const props: RouteSceneProps = { ...base, ...(seam === 'geography' ? { itinerary, fitMode: 'geography' } : seam === 'illustrative' ? { illustrative: { points: dots, mode: 'flight', label: 'Illustrative endpoints' }, fitMode: 'geography' } : {}) };
    const view = render(element(props)); await act(async () => undefined);
    expect(camera(view.container).x).toBe(0); expectVisible(view.container, dots, props);
    if (seam !== 'geography') expect(view.container.querySelector('[data-segment-id]')).toBeNull();
  });
  it('fits an unpriced illustrative route using its projected endpoint bounds', async () => {
    const props: RouteSceneProps = { ...base, illustrative: { points: dots, mode: 'flight', label: 'Illustrative endpoints' } };
    const view = render(element(props)); await act(async () => undefined);
    expect(camera(view.container).x).toBeCloseTo(-.3); expectVisible(view.container, dots, props);
    expect(view.container.querySelector('[data-segment-id]')).toBeNull();
  });
  it('preserves preview/context changes until explicit fit or origin intent, then uses the current projected bounds', async () => {
    const props: RouteSceneProps = { ...base, itinerary, fitMode: 'geography', originKey: 'pinned-origin' };
    const view = render(element(props)); await act(async () => undefined);
    const initial = camera(view.container); expect(initial.x).toBe(0);
    const next = { ...props, itinerary: preview, projection: { centralLongitude: 10 } };
    view.rerender(element(next)); expect(camera(view.container)).toEqual(initial);
    view.rerender(element({ ...next, fitKey: 'deliberate-fit' })); expect(camera(view.container).x).toBe(44); expectVisible(view.container, dots, next);
    view.rerender(element({ ...next, fitKey: 'deliberate-fit', projection: { centralLongitude: 54 }, originKey: 'new-origin' })); expect(camera(view.container).x).toBe(0);
  });
  it('keeps the default composition and seam-straddling Iran/world overviews finite and visible', async () => {
    const view = render(element({ ...base, projection: { centralLongitude: 0 } })); await act(async () => undefined);
    expect(camera(view.container)).toMatchObject({ x: 54, y: 32.5, height: 17, zoom: 1 }); expect(camera(view.container).width).toBeCloseTo(23.8);
    const seam = { ...base, projection: { centralLongitude: -126 }, fitKey: 'seam-overview' };
    view.rerender(element(seam)); expectVisible(view.container, dots, seam); expect(camera(view.container).x).toBe(0); expect(camera(view.container).width).toBe(360);
    const worldDots = [{ longitude: -179, latitude: -59 }, { longitude: 179, latitude: 85 }, { longitude: 54, latitude: 32.5 }];
    const world: RouteSceneProps = { ...base, scope: 'international', dots: worldDots, projection: { centralLongitude: 54 }, fitKey: 'world-overview' };
    view.rerender(element(world)); expectVisible(view.container, worldDots, world); expect(camera(view.container).x).toBe(0); expect(camera(view.container).width).toBe(360);
  });
});
