import type { Mode } from '@torob-ticket/contracts';
import type { ProjectedPoint } from '../geo/projection';
import type { RouteSegmentGeometry } from '../geo/route-geometry';

interface TrackEdge { from: ProjectedPoint; to: ProjectedPoint; start: number; length: number; mode: Mode; section: string }
export interface VehicleTrack { edges: readonly TrackEdge[]; length: number }
export interface VehiclePose { point: ProjectedPoint; angle: number; facing: 1 | -1; mode: Mode; section: string; distance: number }

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
