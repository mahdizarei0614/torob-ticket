import type { Mode } from '@torob-ticket/contracts';
import type { ProjectedPoint } from '../geo/projection';
import type { RouteSegmentGeometry } from '../geo/route-geometry';

interface TrackEdge { from: ProjectedPoint; to: ProjectedPoint; start: number; length: number; mode: Mode; section: string }
export interface VehicleTrack { edges: readonly TrackEdge[]; length: number }
export interface VehiclePose { point: ProjectedPoint; angle: number; facing: 1 | -1; mode: Mode; section: string; distance: number }
export interface RoundTripVehicleTrack { track: VehicleTrack; routeLength: number; turnStart: number; turnLength: number; discontinuous: boolean }

/** A screen-sized ornamental maneuver belongs only to the vehicle, never the geographic route. */
export function buildRoundTripVehicleTrack(segments: readonly RouteSegmentGeometry[], splitSegment: number, unitsPerPixel: number): RoundTripVehicleTrack | null {
  const outbound = segments.slice(0, splitSegment), inbound = segments.slice(splitSegment);
  const outTrack = buildVehicleTrack(outbound), backTrack = buildVehicleTrack(inbound);
  const from = sampleVehiclePose(outTrack, outTrack.length), next = sampleVehiclePose(backTrack, 0);
  if (!from || !next) return null;
  const discontinuous = from.mode !== next.mode || Math.hypot(...from.point.map((value, axis) => value - next.point[axis]!)) > .000001;
  const tangent = [Math.cos(from.angle), Math.sin(from.angle)], normal = [-tangent[1]!, tangent[0]!];
  const returnTangent = discontinuous ? tangent.map(value => -value) : [Math.cos(next.angle), Math.sin(next.angle)];
  const radius = unitsPerPixel * (from.mode === 'train' ? 29 : from.mode === 'flight' ? 25 : 20);
  const forward = radius * (from.mode === 'flight' ? 2.1 : from.mode === 'train' ? 1.8 : 1.35);
  const side = radius * (from.mode === 'train' ? 1.55 : from.mode === 'flight' ? 1.1 : .95);
  const local = (forwardAmount: number, sideAmount: number): ProjectedPoint => [from.point[0] + tangent[0]! * forwardAmount + normal[0]! * sideAmount, from.point[1] + tangent[1]! * forwardAmount + normal[1]! * sideAmount, from.point[2]];
  const apex = local(forward, side);
  const lastControl: ProjectedPoint = [from.point[0] - returnTangent[0]! * forward * .6, from.point[1] - returnTangent[1]! * forward * .6, from.point[2]];
  const cubic = (a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint, t: number): ProjectedPoint => a.map((value, axis) => (1 - t) ** 3 * value + 3 * (1 - t) ** 2 * t * b[axis]! + 3 * (1 - t) * t ** 2 * c[axis]! + t ** 3 * d[axis]!) as ProjectedPoint;
  const turnPoints = Array.from({ length: 65 }, (_, index) => index <= 32
    ? cubic(from.point, local(forward * .72, 0), local(forward, side * .4), apex, index / 32)
    : cubic(apex, local(forward, side * 1.7), lastControl, from.point, (index - 32) / 32));
  const turn: RouteSegmentGeometry = { segmentId: 'vehicle-only-turnaround', mode: from.mode, transfer: false, originPlaceId: '', destinationPlaceId: '', paths: [turnPoints], geometryStatus: 'illustrative', provenance: null };
  const turnLength = buildVehicleTrack([turn]).length;
  return { track: buildVehicleTrack([...outbound, turn, ...inbound]), routeLength: outTrack.length + backTrack.length, turnStart: outTrack.length, turnLength, discontinuous };
}

export function roundTripVehicleDistance(track: RoundTripVehicleTrack, travel: number, turnProgress?: number, direction?: 'outbound' | 'return') {
  if (turnProgress !== undefined) return track.turnStart + track.turnLength * turnProgress;
  const routeDistance = track.routeLength * travel;
  // The timeline owns the leg boundary. A tolerance (or a rounded final outgoing
  // sample) must never insert the entire maneuver before the turn has begun.
  if (direction === 'outbound') return Math.min(routeDistance, track.turnStart);
  const returning = direction === 'return' || routeDistance >= track.turnStart;
  return routeDistance + (returning ? track.turnLength : 0);
}

/** Prepared once per route. Fragment boundaries never become fictitious connecting edges. */
export function buildVehicleTrack(segments: readonly RouteSegmentGeometry[]): VehicleTrack {
  const edges: TrackEdge[] = []; let length = 0;
  for (const segment of segments) segment.paths.forEach((path, fragment) => {
    const last = edges.at(-1), first = path[0];
    const section = last && first && last.mode === segment.mode && Math.hypot(last.to[0] - first[0], last.to[1] - first[1], last.to[2] - first[2]) < .000001 ? last.section : `${segment.segmentId}:${fragment}`;
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1]!, to = path[index]!;
      const size = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      if (size <= 0) continue;
      edges.push({ from, to, start: length, length: size, mode: segment.mode, section });
      length += size;
    }
  });
  return { edges, length };
}

export function sampleVehiclePose(track: VehicleTrack, distance: number): VehiclePose | null {
  if (!track.edges.length || distance < 0 || distance > track.length + .000001) return null;
  const edge = track.edges.find(item => distance < item.start + item.length) ?? track.edges.at(-1)!;
  const amount = Math.max(0, Math.min(1, (distance - edge.start) / edge.length));
  const angle = Math.atan2(edge.to[1] - edge.from[1], edge.to[0] - edge.from[0]);
  const facing = Math.cos(angle) < 0 ? -1 : 1;
  return { point: edge.from.map((value, axis) => value + (edge.to[axis]! - value) * amount) as ProjectedPoint, angle, facing, mode: edge.mode, section: edge.section, distance };
}

/** Cars follow their own path samples; never wrap to the destination behind a newly appearing head. */
export function sampleTrainWagons(track: VehicleTrack, head: VehiclePose, gap: number): (VehiclePose | null)[] {
  return [1, 2].map(index => {
    const pose = sampleVehiclePose(track, head.distance - gap * index);
    // A different fragment can lie on the other side of the projection seam or in another mode.
    return pose?.mode === 'train' && pose.section === head.section ? pose : null;
  });
}

/** Flights face their nose; side-profile vehicles remain upright while following the same tangent. */
export function vehicleRotation(pose: VehiclePose) {
  return pose.mode === 'flight' ? pose.angle - Math.PI / 2 : pose.angle - (pose.facing === -1 ? Math.PI : 0);
}
