import { describe, expect, it } from 'vitest';
import { fitRouteBounds, projectPoint, projectRoute } from './projection';
describe('geographic route safety', () => {
  it('splits the antimeridian instead of drawing an accidental world-spanning edge', () => {
    const paths = projectRoute([{ longitude: 179, latitude: 30 }, { longitude: -179, latitude: 32 }]);
    expect(paths).toHaveLength(2);
    expect(paths.every(path => path.every(point => point.every(Number.isFinite)))).toBe(true);
    expect(paths.every(path => Math.abs(path.at(-1)![0] - path[0]![0]) <= 2)).toBe(true);
  });
  it('fits coincident endpoints with a finite positive camera extent', () => {
    const fit = fitRouteBounds(projectRoute([{ longitude: 51, latitude: 35 }, { longitude: 51, latitude: 35 }]));
    expect(fit.width).toBeGreaterThan(0); expect(fit.height).toBeGreaterThan(0);
    expect(Object.values(fit).every(Number.isFinite)).toBe(true);
  });
  it('bounds polar projection and rejects nonfinite input before buffer creation', () => {
    expect(projectPoint({ longitude: 180, latitude: 90 }).every(Number.isFinite)).toBe(true);
    expect(() => projectPoint({ longitude: NaN, latitude: 10 })).toThrow();
    expect(() => fitRouteBounds([])).toThrow();
  });
});

import { buildRouteGeometry, pointAlongRoute, vehicleAlongRoute, type IllustrativePath } from './route-geometry';
import { contextForPoints, unprojectPoint } from './projection';
import { containsPoint, sampleGeography, type AreaGeometry } from './geography';
import fixtures from './route-geometry.fixture.json';
import { ItinerarySchema, PlaceSchema } from '@torob-ticket/contracts';
const places = fixtures.places.map(place => PlaceSchema.parse(place));
const paths = fixtures.paths as IllustrativePath[];
it('keeps all canonical endpoints, repeated visits and explicit airport transfer in actual segment order', () => {
  for (const scenario of fixtures.scenarios) {
    const itinerary = ItinerarySchema.parse(scenario.itinerary);
    for (const direction of ['outbound', 'return'] as const) {
      if (direction === 'return' && !itinerary.return) continue;
      const leg = direction === 'outbound' ? itinerary.outbound : itinerary.return!;
      const geometry = buildRouteGeometry(itinerary, places, paths, direction);
      expect(geometry.map(segment => segment.segmentId)).toEqual(leg.segments.map(segment => segment.segmentId));
      geometry.forEach((segment, i) => {
        expect(segment.paths[0]![0]).toEqual(projectPoint(places.find(place => place.id === leg.segments[i]!.originPlaceId)!.point));
        const end = segment.paths.at(-1)!.at(-1)!;
        const expected = projectPoint(places.find(place => place.id === leg.segments[i]!.destinationPlaceId)!.point);
        expect(end[0]).toBeCloseTo(expected[0]); expect(end[1]).toBeCloseTo(expected[1]); expect(end[2]).toBeCloseTo(0);
      });
    }
  }
  const transfer = ItinerarySchema.parse(fixtures.scenarios.at(-1)!.itinerary);
  const actual = buildRouteGeometry(transfer, places, paths);
  expect(actual.map(segment => [segment.mode, segment.transfer])).toEqual([['flight', false], ['bus', true]]);
  expect(vehicleAlongRoute(actual, 1).mode).toBe('bus');
  expect(vehicleAlongRoute(actual, 0).mode).toBe('flight');
  const repeated = { ...transfer, outbound: { segments: [...transfer.outbound.segments, { ...transfer.outbound.segments[0]!, segmentId: 'repeat' }], stops: [...transfer.outbound.stops].reverse() } };
  expect(buildRouteGeometry(repeated, places, paths).map(segment => segment.segmentId)).toEqual([...transfer.outbound.segments.map(segment => segment.segmentId), 'repeat']);
});
it('curves/elevates flights, segments rail, winds buses; absent bus path stays explicitly unavailable', () => {
  const byMode = (mode: string) => ItinerarySchema.parse(fixtures.scenarios.find(scenario => scenario.itinerary.mode === mode)!.itinerary);
  const flight = buildRouteGeometry(byMode('flight'), places, paths)[0]!;
  expect(flight.paths[0]!.some(point => point[2] > 0)).toBe(true);
  expect(flight.paths[0]).toHaveLength(49);
  expect(buildRouteGeometry(byMode('train'), places, paths)[0]!.paths[0]).toHaveLength(2);
  const bus = buildRouteGeometry(byMode('bus'), places, paths)[0]!;
  expect(bus.paths[0]).toHaveLength(97);
  // The road is a smooth interpolation of all thirteen authored waypoints.
  const authored = paths.find(path => path.originPlaceId === bus.originPlaceId && path.destinationPlaceId === bus.destinationPlaceId)!;
  authored.points.forEach((point, index) => expect(bus.paths[0]![index * 8]).toEqual(projectPoint(point)));
  expect(buildRouteGeometry(byMode('bus'), places, [])[0]).toMatchObject({ geometryStatus: 'unavailable', paths: [] });
  expect(() => buildRouteGeometry(byMode('bus'), places, paths.map(path => ({ ...path, points: [{ longitude: 0, latitude: 0 }, ...path.points.slice(1)] })))).toThrow('exact transport endpoints');
});
it('projects long routes, recenters a seam journey and inverses marker coordinates consistently', () => {
  const points = [{ longitude: 170, latitude: 70 }, { longitude: -170, latitude: -80 }];
  const context = contextForPoints(points);
  const projected = projectRoute(points, context);
  expect(projected).toHaveLength(1);
  expect(fitRouteBounds(projected).width).toBeLessThan(30);
  points.forEach(point => { const p = projectPoint(point, context); expect(unprojectPoint(p[0], p[1], context)).toEqual(point); });
  const fragments = projectRoute(points);
  for (const progress of [0, .35, .7, 1]) expect(pointAlongRoute(fragments, progress).every(Number.isFinite)).toBe(true);
  expect(pointAlongRoute([[[2, 3, 0], [2, 3, 0]]], .7)).toEqual([2, 3, 0]);
});
it('samples full polygon holes/multipolygons with a bounded deterministic budget', () => {
  const outer = [[0,0],[5,0],[5,5],[0,5],[0,0]], hole = [[1,1],[4,1],[4,4],[1,4],[1,1]];
  const geometry: AreaGeometry = { type: 'MultiPolygon', coordinates: [[outer, hole], [[[7,0],[8,0],[8,1],[7,1],[7,0]]]] };
  expect(containsPoint(geometry, { longitude: 2, latitude: 2 })).toBe(false);
  expect(containsPoint(geometry, { longitude: 7.5, latitude: .5 })).toBe(true);
  const dots = sampleGeography([geometry], { west: 0, east: 9, south: 0, north: 5 }, .5);
  expect(dots.some(point => point.longitude > 1 && point.longitude < 4 && point.latitude > 1 && point.latitude < 4)).toBe(false);
  expect(dots).toEqual(sampleGeography([geometry], { west: 0, east: 9, south: 0, north: 5 }, .5));
  expect(() => sampleGeography([geometry], { west: 0, east: 9, south: 0, north: 5 }, .0001)).toThrow('Unbounded');
  expect(fixtures.dotCounts.world).toBeLessThan(16000); expect(fixtures.dotCounts.iran).toBeLessThan(16000);
});


import { createRouteLineGeometry, createRouteRibbonGeometry } from './route-buffer';
it('keeps antimeridian fragments disconnected in the final GPU line buffer', () => {
  const paths = projectRoute([{ longitude: 179, latitude: 30 }, { longitude: -179, latitude: 32 }]);
  const geometry = createRouteLineGeometry([{ segmentId: 'seam', mode: 'train', transfer: false, originPlaceId: 'a', destinationPlaceId: 'b', paths, geometryStatus: 'illustrative', provenance: null }]);
  const positions = geometry.getAttribute('position');
  expect(geometry.getIndex()).toBeNull(); expect(positions.count).toBe(4);
  for (let i = 0; i < positions.count; i += 2) expect(Math.abs(positions.getX(i + 1) - positions.getX(i))).toBeLessThanOrEqual(2);
  geometry.dispose();
});

it('uses physical arc length for route reveal and preserves fragment boundaries in GPU ribbons', () => {
  const segment = { segmentId: 'road', mode: 'bus' as const, transfer: false, originPlaceId: 'a', destinationPlaceId: 'b', paths: [[[0,0,0],[1,0,0],[4,0,0]]] as [number,number,number][][], geometryStatus: 'illustrative' as const, provenance: null };
  const geometry = createRouteRibbonGeometry([segment]);
  const progress = geometry.getAttribute('routeProgress');
  // A one-unit first edge occupies a quarter of the reveal, regardless of point count.
  expect(progress.getX(2)).toBeCloseTo(.25);
  expect(progress.getX(progress.count - 1)).toBe(1);
  expect(geometry.getAttribute('routeMode').getX(0)).toBe(2);
  expect(Array.from(geometry.getAttribute('routeNormal').array).every(Number.isFinite)).toBe(true);
  geometry.dispose();
  const split = createRouteRibbonGeometry([{ ...segment, paths: projectRoute([{ longitude: 179, latitude: 30 }, { longitude: -179, latitude: 32 }]) }]);
  const position = split.getAttribute('position');
  expect(position.count).toBe(12);
  for (let i = 0; i < position.count; i += 6) expect(Math.abs(position.getX(i + 2) - position.getX(i))).toBeLessThanOrEqual(2);
  split.dispose();
});

it('keeps vertical flight routes visibly arched in the map plane', () => {
  const base = ItinerarySchema.parse(fixtures.scenarios.find(scenario => scenario.itinerary.mode === 'flight')!.itinerary);
  const source = base.outbound.segments[0]!;
  const verticalPlaces = places.map(place => place.id === source.destinationPlaceId ? { ...place, point: { latitude: 50, longitude: places.find(item => item.id === source.originPlaceId)!.point.longitude } } : place);
  const path = buildRouteGeometry({ ...base, outbound: { ...base.outbound, segments: [source] } }, verticalPlaces, [])[0]!.paths[0]!;
  expect(Math.abs(path[24]![0] - path[0]![0])).toBeGreaterThan(.1);
  expect(path.at(-1)![0]).toBeCloseTo(path[0]![0]);
});
