import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { JourneyPresentation, JourneyPresentationFrame } from './journey-presentation';
import type { RouteSegmentGeometry } from '../geo/route-geometry';
import { sampleRouteDirection, staticRouteDirections } from './route-direction';
import { StaticMap } from './scene-drawing';

const plan: JourneyPresentation = { stages: [{ from: 0, to: 1, startMs: 0, arriveMs: 2000, endMs: 2000, stopIndex: null }], stops: [], durationMs: 2700 };
const frame: JourneyPresentationFrame = { reveal: .7, travel: .7, stopGlow: 0, activeStop: null, revealedStops: [], complete: false, vehicleOpacity: 1, vehicleBlur: 0 };
const roundTrip: JourneyPresentation = { ...plan, roundTrip: { splitProgress: .3, splitSegment: 1, turnStartMs: 2000, turnEndMs: 3600, mode: 'train' } };
function segment(id: string, points: [number, number, number][], mode: 'flight' | 'train' | 'bus' = 'train'): RouteSegmentGeometry {
  return { segmentId: id, mode, transfer: false, originPlaceId: 'a', destinationPlaceId: 'b', paths: [points], geometryStatus: 'illustrative', provenance: null };
}

describe('directional route light', () => {
  it('advances crests in positive canonical distance using only the supplied permitted clock', () => {
    const first = sampleRouteDirection(plan, frame, 240, 640), next = sampleRouteDirection(plan, frame, 480, 640);
    expect(first.counts[0]).toBe(4);expect(first.phase).toBeCloseTo(.1);expect(next.phase).toBeCloseTo(.2);
    // A peak of fract(local*count-phase) lies at local=(integer+phase)/count.
    expect(next.phase / next.counts[0]).toBeGreaterThan(first.phase / first.counts[0]);
    expect(sampleRouteDirection(plan, frame, 480, 640)).toEqual(next);
    expect(sampleRouteDirection(plan, frame, 2880, 640).phase).toBeCloseTo(next.phase);
  });
  it('keeps both asymmetric directions illuminated once revealed, including turn and vehicle fade', () => {
    const out = sampleRouteDirection(roundTrip, { ...frame, direction: 'outbound', travel: .28, reveal: .28 }, 1800, 1000);
    const turning = sampleRouteDirection(roundTrip, { ...frame, direction: 'outbound', travel: .3, reveal: .3, turnProgress: .3 }, 2300, 1000);
    const back = sampleRouteDirection(roundTrip, { ...frame, direction: 'return', travel: .6, reveal: .6 }, 4000, 1000);
    const faded = sampleRouteDirection(roundTrip, { ...frame, direction: 'return', reveal: 1, vehicleOpacity: 0 }, 4500, 1000);
    expect(out).toMatchObject({ split: .3, roundTrip: true });expect(out.counts).toEqual([1.875, 4.375]);
    expect(out.opacities[0]).toBeGreaterThan(0);expect(out.opacities[1]).toBe(0);
    expect(turning.opacities[0]).toBeGreaterThan(0);expect(turning.opacities[1]).toBe(0);
    expect(back.opacities.every(value => value > 0)).toBe(true);
    expect(faded.opacities).toEqual(back.opacities);
  });
  it('fades the line cue in once without depending on the separate vehicle loop', () => {
    expect(sampleRouteDirection(plan, { ...frame, travel: 0, vehicleOpacity: 0 }, 0, 500).opacities).toEqual([0, 0]);
    const entering = sampleRouteDirection(plan, { ...frame, travel: .01 }, 100, 500);
    expect(entering.opacities[0]).toBeGreaterThan(0);expect(entering.opacities[0]).toBeLessThan(.64);
    expect(sampleRouteDirection(plan, { ...frame, vehicleOpacity: 0 }, 3000, 500).opacities).toEqual([.64, 0]);
  });
  it('retains stationary cues for both reduced-motion directions even when the vehicle is hidden', () => {
    const reducedFrame = { ...frame, travel: 1, reveal: 1, vehicleOpacity: 0, complete: true, direction: 'return' as const };
    const first = sampleRouteDirection(roundTrip, reducedFrame, 0, 600, true);
    expect(first).toMatchObject({ split: .3, roundTrip: true, phase: .32, opacities: [.44, .44] });
    expect(sampleRouteDirection(roundTrip, reducedFrame, 1e8, 600, true)).toEqual(first);
  });
  it('bounds pulse density continuously under zoom and suppresses empty/nonfinite paths', () => {
    expect(sampleRouteDirection(plan, frame, 50, 1e8).counts[0]).toBe(6);
    expect(sampleRouteDirection(plan, frame, 50, 1).counts[0]).toBe(1);
    expect(sampleRouteDirection(plan, frame, 50, 320).counts[0]).toBe(2);
    expect(sampleRouteDirection(plan, frame, 50, 328).counts[0]).toBeCloseTo(2.05);
    expect(sampleRouteDirection({ ...plan, stages: [] }, frame, 0, 500).opacities).toEqual([0, 0]);
    expect(sampleRouteDirection(plan, frame, Infinity, NaN)).toMatchObject({ phase: 0, opacities: [0, 0] });
  });
  it('samples true forward edge tangents, required transfer modes and separate seam fragments', () => {
    const out = segment('out', [[0,0,0], [100,0,0]]);
    const back = segment('back', [[100,0,0], [0,0,0]], 'bus');back.transfer = true;
    expect(staticRouteDirections([out], .25).every(arrow => arrow.angle === 0 && arrow.mode === 'train')).toBe(true);
    const reverse = staticRouteDirections([out, back], .25, 1);
    expect(reverse.length).toBeGreaterThan(0);expect(reverse.filter(arrow => arrow.leg === 'return').every(arrow => arrow.angle === Math.PI && arrow.mode === 'bus' && arrow.transfer)).toBe(true);expect(reverse.some(arrow => arrow.leg === 'outbound' && arrow.mode === 'train')).toBe(true);
    const split = { ...out, paths: [[[170,0,0], [180,0,0]], [[-180,0,0], [-170,0,0]]] as [number,number,number][][] };
    const arrows = staticRouteDirections([split], .1);
    expect(arrows.length).toBeGreaterThan(0);expect(arrows.every(arrow => Math.abs(arrow.point[0]) >= 170)).toBe(true);
    expect(staticRouteDirections([out], 0)).toEqual([]);
  });
  it('renders semantic, stationary fallback arrows on both supplied legs with correctly inverted SVG rotation', () => {
    const segments = [segment('out', [[0,0,0], [100,100,0]], 'flight'), segment('back', [[100,100,0], [0,0,0]], 'bus')];
    const markup = renderToStaticMarkup(<StaticMap dots={[]} markers={[]} segments={segments} context={{ centralLongitude: 0 }} frame={{ x: 50, y: 50, width: 120, height: 120 }} viewport={{ width: 600, height: 600 }} presentation={roundTrip}/>);
    const host = document.createElement('div');host.innerHTML = markup;
    const arrows = [...host.querySelectorAll('[data-direction-arrow]')];
    expect(host.querySelector('[data-static-route-direction]')).toHaveAttribute('data-static-route-direction', 'both');
    expect(arrows.length).toBeGreaterThan(0);expect(arrows.some(arrow => arrow.getAttribute('data-direction-mode') === 'bus' && arrow.getAttribute('data-direction-leg') === 'return')).toBe(true);expect(arrows.some(arrow => arrow.getAttribute('data-direction-leg') === 'outbound')).toBe(true);
    const rotation = Number(arrows.find(arrow => arrow.getAttribute('data-direction-leg') === 'return')!.getAttribute('transform')!.match(/rotate\(([^)]+)\)/)![1]);
    // Tapering the parallel display lane slightly turns its local tangent.
    expect(Math.abs(rotation - 135)).toBeLessThan(5);expect(markup).toContain('color-mix(in srgb-linear');
    expect(markup).toContain('var(--scene-route)');expect(markup).not.toMatch(/<animate|requestAnimationFrame/);
  });
});
