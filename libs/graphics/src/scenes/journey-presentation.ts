import type { GeoPoint, JourneyLeg, Mode, Place } from '@torob-ticket/contracts';
import { displayPlaceName } from '@torob-ticket/ui';
import type { RouteSegmentGeometry } from '../geo/route-geometry';

export interface JourneyPresentationStop {
  id: string;
  placeId: string;
  name: string;
  point: GeoPoint;
  progress: number;
  waitMinutes: number | null;
  arriveMs: number;
  endMs: number;
}
export interface JourneyPresentationStage {
  from: number;
  to: number;
  startMs: number;
  arriveMs: number;
  endMs: number;
  stopIndex: number | null;
}
/** Visual timing only. It never changes quote, selection or referral progress. */
export interface JourneyPresentation {
  stages: JourneyPresentationStage[];
  stops: JourneyPresentationStop[];
  durationMs: number;
  roundTrip?: {
    splitProgress: number;
    splitSegment: number;
    turnStartMs: number;
    turnEndMs: number;
    mode: Mode;
  };
}
export interface JourneyPresentationFrame {
  reveal: number;
  travel: number;
  stopGlow: number;
  activeStop: number | null;
  revealedStops: { id: string; waitMinutes: number | null; count: number | null }[];
  complete: boolean;
  vehicleOpacity: number;
  vehicleBlur: number;
  direction?: 'outbound' | 'return';
  turnProgress?: number;
  vehiclePoint?: readonly number[];
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);

export function buildJourneyPresentation(segments: readonly RouteSegmentGeometry[], leg: JourneyLeg | undefined, places: readonly Place[], cityNames: Readonly<Record<string, string>> = {}): JourneyPresentation {
  const lengths = segments.map(segment => segment.paths.reduce((sum, path) => sum + path.slice(1).reduce((length, point, i) => length + Math.hypot(point[0] - path[i]![0], point[1] - path[i]![1], point[2] - path[i]![2]), 0), 0));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (!leg || !segments.length || total <= 0) return { stages: [], stops: [], durationMs: 0 };
  const stages: JourneyPresentationStage[] = [];
  const stops: JourneyPresentationStop[] = [];
  const usedStops = new Set<number>();
  let distance = 0;
  let time = 0;
  segments.forEach((segment, index) => {
    const from = distance / total;
    distance += lengths[index]!;
    const to = distance / total;
    const canonical = leg.segments.find(item => item.segmentId === segment.segmentId);
    const duration = lengths[index]! > 0 ? 1700 + 900 * (to - from) : 0;
    const arriveMs = time + duration;
    // Match occurrences, not a set of place IDs: a returning journey can visit a city twice.
    const stopIndex = leg.stops.findIndex((stop, occurrence) => !usedStops.has(occurrence) && stop.placeId === segment.destinationPlaceId && (!stop.arrivalAt || !canonical || stop.arrivalAt === canonical.arrivalAt));
    const stop = stopIndex < 0 ? undefined : leg.stops[stopIndex];
    const place = stop && places.find(item => item.id === stop.placeId);
    let visualStop: number | null = null;
    let endMs = arriveMs;
    if (stop && place) {
      usedStops.add(stopIndex);
      visualStop = stops.length;
      endMs += 1100;
      stops.push({ id: `${segment.segmentId}:stop:${stopIndex}`, placeId: place.id, name: cityNames[place.cityId] ?? displayPlaceName(place), point: place.point, progress: to, waitMinutes: Number.isFinite(stop.waitMinutes) && stop.waitMinutes >= 0 ? stop.waitMinutes : null, arriveMs, endMs });
    }
    stages.push({ from, to, startMs: time, arriveMs, endMs, stopIndex: visualStop });
    time = endMs;
  });
  return { stages, stops, durationMs: time + 700 };
}

/** Combine supplied legs, retaining their own stop occurrences and actual relative lengths. */
export function buildRoundTripPresentation(outbound: readonly RouteSegmentGeometry[], outboundLeg: JourneyLeg, inbound: readonly RouteSegmentGeometry[], returnLeg: JourneyLeg, places: readonly Place[], cityNames: Readonly<Record<string, string>> = {}): JourneyPresentation {
  const first = buildJourneyPresentation(outbound, outboundLeg, places, cityNames);
  const second = buildJourneyPresentation(inbound, returnLeg, places, cityNames);
  if (!first.stages.length || !second.stages.length) return first;
  const length = (segments: readonly RouteSegmentGeometry[]) => segments.reduce((total, segment) => total + segment.paths.reduce((sum, path) => sum + path.slice(1).reduce((distance, point, index) => distance + Math.hypot(...point.map((value, axis) => value - path[index]![axis]!)), 0), 0), 0);
  const outLength = length(outbound), backLength = length(inbound);
  const splitProgress = outLength / (outLength + backLength);
  const turnStartMs = first.stages.at(-1)!.endMs;
  const mode = outbound.at(-1)!.mode;
  const turnEndMs = turnStartMs + (mode === 'train' ? 2100 : mode === 'flight' ? 1650 : 1400);
  const remap = (value: number, isReturn: boolean) => isReturn ? splitProgress + value * (1 - splitProgress) : value * splitProgress;
  const stages = [first, second].flatMap((plan, direction) => plan.stages.map(stage => ({ ...stage,
    from: remap(stage.from, Boolean(direction)), to: remap(stage.to, Boolean(direction)),
    startMs: stage.startMs + (direction ? turnEndMs : 0), arriveMs: stage.arriveMs + (direction ? turnEndMs : 0), endMs: stage.endMs + (direction ? turnEndMs : 0),
    stopIndex: stage.stopIndex === null ? null : stage.stopIndex + (direction ? first.stops.length : 0),
  })));
  const stops = [first, second].flatMap((plan, direction) => plan.stops.map(stop => ({ ...stop,
    id: `${direction ? 'return' : 'outbound'}:${stop.id}`, progress: remap(stop.progress, Boolean(direction)),
    arriveMs: stop.arriveMs + (direction ? turnEndMs : 0), endMs: stop.endMs + (direction ? turnEndMs : 0),
  })));
  return { stages, stops, durationMs: turnEndMs + second.durationMs, roundTrip: { splitProgress, splitSegment: outbound.length, turnStartMs, turnEndMs, mode } };
}

export function sampleJourneyPresentation(plan: JourneyPresentation, elapsedMs: number, { reducedMotion = false }: { reducedMotion?: boolean } = {}): JourneyPresentationFrame {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const complete = reducedMotion || !plan.stages.length || elapsed >= plan.durationMs;
  const revealedStops = plan.stops.filter(stop => complete || elapsed >= stop.arriveMs).map(stop => {
    const amount = complete ? 1 : 1 - Math.pow(1 - clamp((elapsed - stop.arriveMs) / Math.max(1, stop.endMs - stop.arriveMs)), 3);
    return { id: stop.id, waitMinutes: stop.waitMinutes, count: stop.waitMinutes === null ? null : Math.round(stop.waitMinutes * amount) };
  });
  if (reducedMotion || !plan.stages.length) return { reveal: 1, travel: 1, stopGlow: 0, activeStop: null, revealedStops, complete: true, vehicleOpacity: plan.roundTrip ? 0 : 1, vehicleBlur: 0, ...(plan.roundTrip ? { direction: 'return' as const } : {}) };
  // After the first draw, repeat only decorative motion. Revealed facts never reset.
  const time = complete ? ((elapsed - plan.durationMs) / 1.8) % plan.durationMs : elapsed;
  if (plan.roundTrip && time >= plan.roundTrip.turnStartMs && time < plan.roundTrip.turnEndMs) return {
    reveal: complete ? 1 : plan.roundTrip.splitProgress, travel: plan.roundTrip.splitProgress, stopGlow: 0, activeStop: null, revealedStops, complete,
    vehicleOpacity: 1, vehicleBlur: 0, direction: 'outbound',
    turnProgress: ease(clamp((time - plan.roundTrip.turnStartMs) / (plan.roundTrip.turnEndMs - plan.roundTrip.turnStartMs))),
  };
  // Once drawn, only the strand repeats; the route and revealed facts stay present.
  const stage = plan.stages.find(item => time < item.endMs) ?? plan.stages.at(-1)!;
  const travelling = time < stage.arriveMs;
  const amount = travelling ? ease(clamp((time - stage.startMs) / Math.max(1, stage.arriveMs - stage.startMs))) : 1;
  const travel = stage.from + (stage.to - stage.from) * amount;
  const activeStop = !travelling && time < stage.endMs ? stage.stopIndex : null;
  const stopGlow = activeStop === null ? 0 : Math.sin(Math.PI * clamp((time - stage.arriveMs) / Math.max(1, stage.endMs - stage.arriveMs)));
  const arrival = plan.stages.at(-1)!.arriveMs;
  const entrance = ease(clamp(time / 330));
  const departure = 1 - ease(clamp((time - arrival + 160) / 500));
  const vehicleOpacity = entrance * departure;
  return { reveal: complete ? 1 : travel, travel, stopGlow, activeStop, revealedStops, complete, vehicleOpacity, vehicleBlur: 1 - vehicleOpacity,
    ...(plan.roundTrip ? { direction: time >= plan.roundTrip.turnEndMs ? 'return' as const : 'outbound' as const } : {}) };
}
