import { describe, expect, it } from 'vitest';
import type { JourneyLeg, Place } from '@torob-ticket/contracts';
import type { RouteSegmentGeometry } from '../geo/route-geometry';
import { buildJourneyPresentation, buildRoundTripPresentation, sampleJourneyPresentation } from './journey-presentation';

const place = (id: string, x: number): Place => ({ id, cityId: id, name: id, kind: 'station', timeZone: 'Asia/Tehran', point: { longitude: x, latitude: 30 } });
const places = [place('a', 0), place('b', 2), place('c', 10)];
function makeRoute(ids: string[], waits: (number | undefined)[] = []) {
  const segments: RouteSegmentGeometry[] = ids.slice(1).map((id, i) => ({ segmentId: `s${i}`, originPlaceId: ids[i]!, destinationPlaceId: id, mode: 'train', transfer: false, geometryStatus: 'illustrative', provenance: null, paths: [[[places.find(item => item.id === ids[i])!.point.longitude, 30, 0], [places.find(item => item.id === id)!.point.longitude, 30, 0]]] }));
  const leg: JourneyLeg = {
    segments: segments.map((segment, i) => ({ ...segment, serviceId: 'service', operatorId: 'operator', departureAt: `2026-10-26T${String(i * 2).padStart(2, '0')}:00:00Z`, arrivalAt: `2026-10-26T${String(i * 2 + 1).padStart(2, '0')}:00:00Z`, departureTimeZone: 'Asia/Tehran', arrivalTimeZone: 'Asia/Tehran' })),
    stops: waits.map((wait, i) => ({ placeId: ids[i + 1]!, kind: 'dwell', waitMinutes: wait as number, vehicleChange: false, arrivalAt: `2026-10-26T${String(i * 2 + 1).padStart(2, '0')}:00:00Z` })),
  };
  return { segments, leg };
}

describe('selected-journey visual choreography', () => {
  it('plays supplied outbound/return geometry and separate stop occurrences, then fades at the original start before repeating', () => {
    const out = makeRoute(['a', 'b', 'c'], [45]), back = makeRoute(['c', 'b', 'a'], [18]);
    const plan = buildRoundTripPresentation(out.segments, out.leg, back.segments, back.leg, places);
    const turn = plan.roundTrip!;
    expect(turn.splitProgress).toBeCloseTo(.5);
    expect(plan.stops.map(stop => [stop.id.split(':')[0], stop.waitMinutes])).toEqual([['outbound', 45], ['return', 18]]);
    const outbound = sampleJourneyPresentation(plan, turn.turnStartMs - 50);
    expect(outbound.direction).toBe('outbound'); expect(outbound.travel).toBeLessThanOrEqual(.5); expect(outbound.vehicleOpacity).toBe(1);
    const maneuver = sampleJourneyPresentation(plan, (turn.turnStartMs + turn.turnEndMs) / 2);
    expect(maneuver).toMatchObject({ direction: 'outbound', turnProgress: .5, travel: .5, vehicleOpacity: 1 });
    const returning = sampleJourneyPresentation(plan, turn.turnEndMs + 700);
    expect(returning.direction).toBe('return'); expect(returning.travel).toBeGreaterThan(.5); expect(returning.turnProgress).toBeUndefined();
    const returnStop = plan.stops[1]!;
    expect(sampleJourneyPresentation(plan, returnStop.arriveMs).revealedStops.map(stop=>stop.count)).toEqual([45, 0]);
    expect(sampleJourneyPresentation(plan, plan.durationMs - 1)).toMatchObject({ travel: 1, vehicleOpacity: 0, vehicleBlur: 1, direction: 'return', complete: false });
    expect(sampleJourneyPresentation(plan, plan.durationMs + 800 * 1.8)).toMatchObject({ reveal: 1, vehicleOpacity: 1, direction: 'outbound', complete: true });
    expect(sampleJourneyPresentation(plan, 0, { reducedMotion: true })).toMatchObject({ reveal: 1, travel: 1, vehicleOpacity: 0, direction: 'return', complete: true });
    expect(buildRoundTripPresentation(out.segments, out.leg, [], back.leg, places)).not.toHaveProperty('roundTrip');
  });

  it.each(['flight', 'train', 'bus'] as const)('loops the full %s round trip and turn while keeping canonical facts final', mode => {
    const make = (ids: string[], wait: number) => {
      const route = makeRoute(ids, [wait]);
      return { segments: route.segments.map(segment => ({ ...segment, mode })), leg: { ...route.leg, segments: route.leg.segments.map(segment => ({ ...segment, mode })) } };
    };
    const out = make(['a', 'b', 'c'], 45), back = make(['c', 'b', 'a'], 18);
    const plan = buildRoundTripPresentation(out.segments, out.leg, back.segments, back.leg, places);
    const turn = plan.roundTrip!;
    const loopAt = (time: number, cycle = 0) => sampleJourneyPresentation(plan, plan.durationMs + (time + cycle * plan.durationMs) * 1.8);
    expect(loopAt(0)).toMatchObject({ reveal: 1, travel: 0, vehicleOpacity: 0, direction: 'outbound', complete: true });
    const departure = loopAt(800);
    expect(departure.travel).toBeGreaterThan(0); expect(departure.travel).toBeLessThan(turn.splitProgress);
    expect(loopAt((turn.turnStartMs + turn.turnEndMs) / 2)).toMatchObject({ reveal: 1, turnProgress: .5, direction: 'outbound', complete: true });
    const returning = loopAt(turn.turnEndMs + 700, 2);
    expect(returning.travel).toBeGreaterThan(turn.splitProgress); expect(returning.vehicleOpacity).toBe(1); expect(returning.direction).toBe('return');
    expect(returning.revealedStops.map(stop => stop.count)).toEqual([45, 18]);
    expect(loopAt(plan.durationMs - 1)).toMatchObject({ reveal: 1, vehicleOpacity: 0, vehicleBlur: 1 });
    expect(sampleJourneyPresentation(plan, plan.durationMs * 100, { reducedMotion: true }).vehicleOpacity).toBe(0);
  });

  it('draws by arc length, pauses at a stop, counts its declared wait, and only then travels onward', () => {
    const { segments, leg } = makeRoute(['a', 'b', 'c'], [90]);
    const plan = buildJourneyPresentation(segments, leg, places, { b: 'شهر میانی' });
    const first = plan.stages[0]!;
    expect(plan.stops[0]).toMatchObject({ name: 'شهر میانی', progress: .2, waitMinutes: 90 });
    const early = sampleJourneyPresentation(plan, first.arriveMs - 1);
    expect(early.reveal).toBeLessThan(.2); expect(early.revealedStops).toEqual([]);
    const arrival = sampleJourneyPresentation(plan, first.arriveMs);
    expect(arrival.reveal).toBe(.2); expect(arrival.activeStop).toBe(0); expect(arrival.revealedStops[0]!.count).toBe(0);
    const middle = sampleJourneyPresentation(plan, (first.arriveMs + first.endMs) / 2);
    expect(middle.reveal).toBe(.2); expect(middle.stopGlow).toBeCloseTo(1);
    expect(middle.revealedStops[0]!.count).toBeGreaterThan(0); expect(middle.revealedStops[0]!.count).toBeLessThan(90);
    const onward = sampleJourneyPresentation(plan, first.endMs + 200);
    expect(onward.reveal).toBeGreaterThan(.2); expect(onward.revealedStops[0]!.count).toBe(90);
  });

  it('preserves repeated city visits as separate canonical occurrences', () => {
    const { segments, leg } = makeRoute(['a', 'b', 'a', 'b', 'c'], [15, 20, 45]);
    const plan = buildJourneyPresentation(segments, leg, places);
    expect(plan.stops.map(stop => [stop.placeId, stop.waitMinutes])).toEqual([['b', 15], ['a', 20], ['b', 45]]);
    expect(new Set(plan.stops.map(stop => stop.id)).size).toBe(3);
    expect(plan.stops[2]!.progress).toBeGreaterThan(plan.stops[0]!.progress);
    expect(sampleJourneyPresentation(plan, plan.stops[2]!.arriveMs - 1).revealedStops).toHaveLength(2);
  });

  it('keeps unknown wait values distinct from a known zero', () => {
    const { segments, leg } = makeRoute(['a', 'b', 'a', 'c'], [undefined, 0]);
    const plan = buildJourneyPresentation(segments, leg, places);
    const final = sampleJourneyPresentation(plan, 0, { reducedMotion: true });
    expect(final.revealedStops.map(stop => [stop.waitMinutes, stop.count])).toEqual([[null, null], [0, 0]]);
  });

  it('repeats only the light strand after drawing, keeping revealed stop facts final', () => {
    const { segments, leg } = makeRoute(['a', 'b', 'c'], [45]);
    const plan = buildJourneyPresentation(segments, leg, places);
    const nextPass = sampleJourneyPresentation(plan, plan.durationMs + plan.stops[0]!.arriveMs * 1.8 + 500);
    expect(nextPass).toMatchObject({ reveal: 1, travel: .2, activeStop: 0, complete: true });
    expect(nextPass.stopGlow).toBeGreaterThan(0); expect(nextPass.revealedStops[0]!.count).toBe(45);
  });

  it('settles reduced motion directly and starts a newly selected plan at the origin', () => {
    const { segments, leg } = makeRoute(['a', 'b', 'c'], [45]);
    const plan = buildJourneyPresentation(segments, leg, places);
    expect(sampleJourneyPresentation(plan, 0, { reducedMotion: true })).toMatchObject({ reveal: 1, travel: 1, complete: true, activeStop: null, stopGlow: 0 });
    expect(sampleJourneyPresentation(plan, 0)).toMatchObject({ reveal: 0, travel: 0, complete: false, revealedStops: [] });
  });

  it('does not invent geometry or stops when no priced itinerary or route geometry exists', () => {
    const { segments, leg } = makeRoute(['a', 'b', 'c'], [45]);
    expect(buildJourneyPresentation(segments, undefined, places)).toEqual({ stages: [], stops: [], durationMs: 0 });
    const missing = segments.map(segment => ({ ...segment, paths: [] }));
    expect(buildJourneyPresentation(missing, leg, places)).toEqual({ stages: [], stops: [], durationMs: 0 });
  });

  it('softly blurs/fades the vehicle across arrival and loop restart without retracting route facts', () => {
    const { segments, leg } = makeRoute(['a', 'b', 'c'], [45]);
    const plan = buildJourneyPresentation(segments, leg, places);
    const end = plan.stages.at(-1)!.arriveMs;
    const middle = sampleJourneyPresentation(plan, end);
    expect(middle.vehicleOpacity).toBeGreaterThan(0); expect(middle.vehicleOpacity).toBeLessThan(1); expect(middle.vehicleBlur).toBeGreaterThan(0);
    const before = sampleJourneyPresentation(plan, plan.durationMs - 1), after = sampleJourneyPresentation(plan, plan.durationMs + 1);
    expect(before.vehicleOpacity).toBe(0); expect(after.vehicleOpacity).toBeLessThan(.001);
    expect(after.reveal).toBe(1); expect(after.revealedStops[0]!.count).toBe(45);
    expect(sampleJourneyPresentation(plan, plan.durationMs + 330 * 1.8).vehicleOpacity).toBe(1);
    expect(sampleJourneyPresentation(plan, 0, { reducedMotion: true })).toMatchObject({ vehicleOpacity: 1, vehicleBlur: 0 });
  });
});
