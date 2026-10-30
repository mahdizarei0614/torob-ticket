import { describe, expect, it } from 'vitest';
import type { ProjectedPoint } from './projection';
import type { RouteSegmentGeometry } from './route-geometry';
import { createRouteRibbonGeometry } from './route-buffer';
import { offsetPresentationPath, presentationRoutePaths } from './route-lanes';

const route = (id: string, points: ProjectedPoint[], mode: 'flight' | 'train' | 'bus' = 'train'): RouteSegmentGeometry => ({ segmentId: id, originPlaceId: id + '-a', destinationPlaceId: id + '-b', mode, transfer: false, paths: [points], geometryStatus: 'illustrative', provenance: null });
describe('round-trip presentation lanes', () => {
  it.each(['flight', 'train', 'bus'] as const)('separates fully coincident reverse %s sections while keeping source anchors and true arc progress', mode => {
    const source = [route('out', [[0,0,0], [10,0,0]], mode), route('back', [[10,0,0], [0,0,0]], mode)];
    const before = JSON.stringify(source);source.forEach(segment => { segment.paths.forEach(path => { path.forEach(Object.freeze);Object.freeze(path); });Object.freeze(segment.paths);Object.freeze(segment); });
    const paths = presentationRoutePaths(source, 1), out = offsetPresentationPath(paths[0]!, .1), back = offsetPresentationPath(paths[1]!, .1);
    expect(paths.every(path => path.points.length >= 7)).toBe(true);
    expect(Math.max(...out.map(point => point[1]))).toBeCloseTo(.38);expect(Math.min(...back.map(point => point[1]))).toBeCloseTo(-.38);
    for (const [index, path] of paths.entries()) { const points = offsetPresentationPath(path, .1);expect(points[0]).toEqual(source[index]!.paths[0]![0]);expect(points.at(-1)).toEqual(source[index]!.paths[0]!.at(-1)); }
    expect(JSON.stringify(source)).toBe(before);
    const buffer = createRouteRibbonGeometry(source, 1);expect(buffer.userData['routeLength']).toBeCloseTo(20);
    expect(new Set(buffer.getAttribute('routeLeg').array)).toEqual(new Set([0, 1]));
    expect([...buffer.getAttribute('routeOverlap').array].some(value => value > .99)).toBe(true);
    expect([...buffer.getAttribute('position').array].filter((_, index) => index % 3 === 1).every(value => value === 0)).toBe(true);
    expect(buffer.getAttribute('routeProgress').getX(buffer.getAttribute('routeProgress').count - 1)).toBeCloseTo(1);buffer.dispose();
  });
  it('offsets just the shared section of an asymmetric return and keeps each intermediate stop exact', () => {
    const source = [route('a-b', [[0,0,0], [5,0,0]]), route('b-d', [[5,0,0], [10,5,0]]), route('d-c', [[10,5,0], [8,0,0]]), route('c-b', [[8,0,0], [5,0,0]]), route('b-a', [[5,0,0], [0,0,0]])];
    const paths = presentationRoutePaths(source, 2);
    expect(paths.map(path => path.overlap.some(value => Math.abs(value) > 0))).toEqual([true, false, false, false, true]);
    for (let i = 0; i < paths.length; i++) { const display = offsetPresentationPath(paths[i]!, .1);expect(display[0]).toEqual(source[i]!.paths[0]![0]);expect(display.at(-1)).toEqual(source[i]!.paths[0]!.at(-1)); }
  });
  it('recognizes the same path with different collinear vertex subdivision', () => {
    const paths = presentationRoutePaths([route('out', [[0,0,0], [10,0,0]]), route('back', [[10,0,0], [7,0,0], [3,0,0], [0,0,0]])], 1);
    expect(paths.every(path => path.overlap.some(value => value > 0))).toBe(true);
  });
  it('recognizes full coverage across several opposite fragments when only one leg stops midway', () => {
    const paths = presentationRoutePaths([route('a-b', [[0,0,0], [5,0,0]]), route('b-d', [[5,0,0], [10,0,0]]), route('d-a', [[10,0,0], [0,0,0]])], 2);
    expect(paths.every(path => path.overlap.some(value => value > 0))).toBe(true);
    expect(offsetPresentationPath(paths[0]!, .1).at(-1)).toEqual([5,0,0]);
    expect(offsetPresentationPath(paths[1]!, .1)[0]).toEqual([5,0,0]);
  });
  it('does not move one-way, merely parallel, crossing or differently curved paths', () => {
    const out = route('out', [[0,0,0], [10,0,0]]);
    expect(presentationRoutePaths([out])[0]!.overlap.every(value => value === 0)).toBe(true);
    for (const other of [route('nearby', [[10,.01,0], [0,.01,0]]), route('crossing', [[5,-5,0], [5,5,0]]), route('curve', [[10,0,0], [5,3,0], [0,0,0]])]) {
      expect(presentationRoutePaths([out, other], 1).every(path => path.overlap.every(value => value === 0))).toBe(true);
    }
  });
  it('also separates the rare same-orientation shared section using opposite handedness', () => {
    const paths = presentationRoutePaths([route('out', [[0,0,0], [10,0,0]]), route('back', [[0,0,0], [10,0,0]])], 1);
    expect(paths[0]!.overlap.some(value => value > 0)).toBe(true);expect(paths[1]!.overlap.some(value => value < 0)).toBe(true);
    expect(offsetPresentationPath(paths[0]!, .1).some(point => point[1] > 0)).toBe(true);expect(offsetPresentationPath(paths[1]!, .1).some(point => point[1] < 0)).toBe(true);
  });
  it('matches each reversed seam fragment independently and never joins the longitude gap', () => {
    const out = { ...route('out', []), paths: [[[170,0,0], [180,0,0]], [[-180,0,0], [-170,0,0]]] as ProjectedPoint[][] };
    const back = { ...route('back', []), paths: [[[-170,0,0], [-180,0,0]], [[180,0,0], [170,0,0]]] as ProjectedPoint[][] };
    const paths = presentationRoutePaths([out, back], 1);expect(paths).toHaveLength(4);expect(paths.every(path => path.overlap.some(value => value > 0))).toBe(true);
    const buffer = createRouteRibbonGeometry([out, back], 1), positions = buffer.getAttribute('position');
    for (let i = 0; i < positions.count; i += 6) expect(Math.abs(positions.getX(i + 2) - positions.getX(i))).toBeLessThanOrEqual(10);
    buffer.dispose();
  });
});
