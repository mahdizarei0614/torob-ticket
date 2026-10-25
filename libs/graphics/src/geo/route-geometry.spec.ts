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
  expect(bus.paths[0]).toHaveLength(13);
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


import { createRouteLineGeometry } from './route-buffer';
it('keeps antimeridian fragments disconnected in the final GPU line buffer', () => {
  const paths = projectRoute([{ longitude: 179, latitude: 30 }, { longitude: -179, latitude: 32 }]);
  const geometry = createRouteLineGeometry([{ segmentId: 'seam', mode: 'train', transfer: false, originPlaceId: 'a', destinationPlaceId: 'b', paths, geometryStatus: 'illustrative', provenance: null }]);
  const positions = geometry.getAttribute('position');
  expect(geometry.getIndex()).toBeNull(); expect(positions.count).toBe(4);
  for (let i = 0; i < positions.count; i += 2) expect(Math.abs(positions.getX(i + 1) - positions.getX(i))).toBeLessThanOrEqual(2);
  geometry.dispose();
});
