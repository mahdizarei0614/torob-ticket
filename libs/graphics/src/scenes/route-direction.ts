import type { JourneyPresentation, JourneyPresentationFrame } from './journey-presentation';
import type { RouteSegmentGeometry } from '../geo/route-geometry';
import { buildVehicleTrack, sampleVehiclePose, type VehiclePose } from './vehicle-motion';

export interface RouteDirectionFrame {
  split: number; roundTrip: boolean; phase: number;
  counts: [number, number]; opacities: [number, number];
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const x = clamp(value); return x * x * (3 - 2 * x); };

/** The host's accumulated, permitted route time is the only clock. Increasing
 * phase moves the shader's crests toward increasing canonical arc length. */
export function sampleRouteDirection(plan: JourneyPresentation, frame: JourneyPresentationFrame, elapsedMs: number, routeLengthPx: number, reducedMotion = false): RouteDirectionFrame {
  const split = plan.roundTrip?.splitProgress ?? 1;
  const length = Number.isFinite(routeLengthPx) ? Math.max(0, routeLengthPx) : 0;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const phase = reducedMotion ? .32 : (elapsed / 2400) % 1;
  const opacity = reducedMotion ? .44 : .64 * smooth(elapsed / 400);
  const count = (size: number) => Math.max(1, Math.min(6, size / 160));
  return { split, roundTrip: Boolean(plan.roundTrip), phase, counts: [count(length * split), count(length * (1 - split))],
    opacities: [plan.stages.length && length * split >= 1 ? opacity : 0,
      plan.roundTrip && frame.reveal > split && length * (1 - split) >= 1 ? opacity : 0] };
}

export interface StaticRouteDirection extends VehiclePose { leg: 'outbound' | 'return'; transfer: boolean }
/** The static renderer shows both supplied directions for a complete round trip,
 * just like the reduced GPU frame. Samples retain real edge tangents/modes and
 * never invent a connector between projection fragments. */
export function staticRouteDirections(segments: readonly RouteSegmentGeometry[], unitsPerPixel: number, splitSegment?: number): StaticRouteDirection[] {
  if (!Number.isFinite(unitsPerPixel) || unitsPerPixel <= 0) return [];
  const legs = splitSegment === undefined ? [segments] : [segments.slice(0, splitSegment), segments.slice(splitSegment)];
  return legs.flatMap((legSegments, legIndex) => {
    const track = buildVehicleTrack(legSegments);
    const count = Math.max(1, Math.min(6, Math.round(track.length / unitsPerPixel / 160)));
    return Array.from({ length: count }, (_, index) => {
    const pose = sampleVehiclePose(track, track.length * (index + .5) / count);
    if (!pose) return null;
    const section = track.edges.filter(edge => edge.section === pose.section);
    const start = section[0]!.start, end = section.at(-1)!.start + section.at(-1)!.length;
    if (end - start < unitsPerPixel * 26) return null;
    // A regularly spaced sample can land exactly at a seam. Move its decoration
    // inside that same real fragment rather than drawing across the empty gap.
      const final = sampleVehiclePose(track, Math.min(end - unitsPerPixel * 6, Math.max(start + unitsPerPixel * 20, pose.distance)));
      return final ? { ...final, leg: legIndex ? 'return' as const : 'outbound' as const,
        transfer: legSegments.find(segment => final.section.startsWith(segment.segmentId + ':'))?.transfer ?? false } : null;
    }).filter((pose): pose is StaticRouteDirection => Boolean(pose));
  });
}
