import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import type { Mode } from '@torob-ticket/contracts';
import type { ProjectedPoint } from '../geo/projection';
import type { RouteSegmentGeometry } from '../geo/route-geometry';
import { buildVehicleTrack, sampleTrainWagons, sampleVehiclePose, vehicleRotation } from './vehicle-motion';
import { StaticMap } from './scene-drawing';

const segment = (paths: ProjectedPoint[][], mode: Mode = 'train', id = 'a'): RouteSegmentGeometry => ({ segmentId: id, paths, mode, transfer: false, originPlaceId: 'from', destinationPlaceId: 'to', geometryStatus: 'illustrative', provenance: null });
describe('vehicle tangent and train consist', () => {
  it.each(['flight', 'train', 'bus'] as const)('orients %s along an oblique local path', mode => {
    const pose = sampleVehiclePose(buildVehicleTrack([segment([[[0, 0, 0], [10, 10, 0]]], mode)]), 5)!;
    expect(pose.angle).toBeCloseTo(Math.PI / 4);
    expect(vehicleRotation(pose)).toBeCloseTo(mode === 'flight' ? -Math.PI / 4 : Math.PI / 4);
    const reverse = sampleVehiclePose(buildVehicleTrack([segment([[[10, 10, 0], [0, 0, 0]]], mode)]), 5)!;
    expect(reverse.facing).toBe(-1);
    if (mode !== 'flight') expect(Math.cos(vehicleRotation(reverse)) * reverse.facing).toBeLessThan(0);
  });
  it('places two wagons on their own distance samples around a corner and across a continuous stop', () => {
    const track = buildVehicleTrack([segment([[[0, 0, 0], [10, 0, 0]]]), segment([[[10, 0, 0], [10, 10, 0]]], 'train', 'b')]);
    const head = sampleVehiclePose(track, 12)!;
    const wagons = sampleTrainWagons(track, head, 3);
    expect(head.point).toEqual([10, 2, 0]); expect(head.angle).toBeCloseTo(Math.PI / 2);
    expect(wagons.map(item => item?.point)).toEqual([[9, 0, 0], [6, 0, 0]]);
    expect(wagons[0]!.angle).toBe(0);
    expect(sampleTrainWagons(track, sampleVehiclePose(track, 2)!, 3)).toEqual([null, null]);
  });
  it('never derives a tangent or carriage across the projection seam or an intervening mode', () => {
    const seam = buildVehicleTrack([segment([[[178, 0, 0], [180, 0, 0]], [[-180, 0, 0], [-175, 0, 0]]])]);
    const head = sampleVehiclePose(seam, 2.1)!;
    expect(head.point[0]).toBeCloseTo(-179.9); expect(head.angle).toBe(0);
    expect(sampleTrainWagons(seam, head, 1)).toEqual([null, null]);
    const mixed = buildVehicleTrack([segment([[[0, 0, 0], [10, 0, 0]]], 'bus'), segment([[[10, 0, 0], [20, 0, 0]]], 'train', 'b')]);
    expect(sampleTrainWagons(mixed, sampleVehiclePose(mixed, 11)!, 3)).toEqual([null, null]);
  });
  it('keeps a tangent-aligned locomotive and two wagons in the settled SVG fallback', () => {
    const view = render(createElement(StaticMap, { dots: [], markers: [], segments: [segment([[[0, 0, 0], [10, 0, 0], [10, 10, 0]]])], context: { centralLongitude: 0 }, frame: { x: 5, y: 5, width: 20, height: 20 }, mode: 'train', presentation: { stages: [], stops: [], durationMs: 0 } }));
    const parts = [...view.container.querySelectorAll('[data-static-vehicle]')];
    expect(parts).toHaveLength(3); expect(parts.map(part => part.getAttribute('data-static-vehicle'))).toEqual(['head', 'wagon-1', 'wagon-2']);
    expect(parts.every(part => part.getAttribute('transform')?.includes('rotate(-90)'))).toBe(true);
    expect(new Set(parts.map(part => part.getAttribute('transform'))).size).toBe(3);
  });
});
