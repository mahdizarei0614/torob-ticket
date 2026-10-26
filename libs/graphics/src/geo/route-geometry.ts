import type { GeoPoint, Itinerary, JourneyLeg, Mode, Place } from '@torob-ticket/contracts';
import { DEFAULT_PROJECTION, projectRoute, wrapLongitude, type ProjectedPoint, type ProjectionContext } from './projection';
export interface IllustrativePath {
  originPlaceId: string; destinationPlaceId: string; points: GeoPoint[];
  provenance: { source: string; revision: string; illustrative: true; navigation: false };
}
export interface RouteSegmentGeometry {
  segmentId: string; mode: Mode; transfer: boolean; originPlaceId: string; destinationPlaceId: string;
  paths: ProjectedPoint[][]; geometryStatus: 'illustrative' | 'unavailable'; provenance: IllustrativePath['provenance'] | null;
}
export function legForDirection(itinerary: Itinerary, direction: 'outbound' | 'return'): JourneyLeg {
  const leg = direction === 'outbound' ? itinerary.outbound : itinerary.return;
  if (!leg) throw new RangeError('Return direction is unavailable');
  return leg;
}
/** Segment order is authoritative; stops supply facts only, never reordered geometry. */
export function buildRouteGeometry(itinerary: Itinerary, places: readonly Place[], authoredPaths: readonly IllustrativePath[], direction: 'outbound' | 'return' = 'outbound', context: ProjectionContext = DEFAULT_PROJECTION): RouteSegmentGeometry[] {
  return legForDirection(itinerary, direction).segments.map(segment => {
    const a = places.find(place => place.id === segment.originPlaceId); const b = places.find(place => place.id === segment.destinationPlaceId);
    const transfer = segment.mode !== itinerary.mode;
    const base = { segmentId: segment.segmentId, mode: segment.mode, transfer, originPlaceId: segment.originPlaceId, destinationPlaceId: segment.destinationPlaceId };
    if (!a || !b) return { ...base, paths: [], geometryStatus: 'unavailable', provenance: null };
    const authored = authoredPaths.find(path => path.originPlaceId === a.id && path.destinationPlaceId === b.id);
    if (segment.mode === 'bus' && !authored) return { ...base, paths: [], geometryStatus: 'unavailable', provenance: null };
    if (authored && (!samePoint(authored.points[0], a.point) || !samePoint(authored.points.at(-1), b.point))) throw new RangeError('Authored path must match exact transport endpoints');
    const points = segment.mode === 'bus' ? authored!.points : [a.point, b.point];
    const paths = projectRoute(points, context);
    if (segment.mode === 'bus') {
      // Smooth only inside each projected fragment; never bridge the longitude seam.
      for (let index = 0; index < paths.length; index++) paths[index] = smoothRoad(paths[index]!);
    }
    if (segment.mode === 'flight') {
      for (let index = 0; index < paths.length; index++) {
        const path = paths[index]!; const start = path[0]!; const end = path.at(-1)!;
        const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
        const dx = end[0] - start[0], dy = end[1] - start[1];
        const orientation = dx < 0 ? -1 : 1;
        const nx = distance ? -dy / distance * orientation : 0;
        const ny = distance ? dx / distance * orientation : 0;
        paths[index] = Array.from({ length: 49 }, (_, n) => {
          const t = n / 48; const lift = Math.sin(Math.PI * t);
          return [Math.max(-180, Math.min(180, start[0] + dx * t + nx * distance * .19 * lift)), start[1] + dy * t + ny * distance * .19 * lift, Math.min(2, distance * .025) * lift];
        });
      }
    }
    return { ...base, paths, geometryStatus: 'illustrative', provenance: authored?.provenance ?? { source: 'canonical transport endpoints', revision: 'route-v1', illustrative: true, navigation: false } };
  });
}
/** Cubic interpolation retains every authored waypoint and both exact transport endpoints. */
function smoothRoad(path: readonly ProjectedPoint[]): ProjectedPoint[] {
  if (path.length < 3) return [...path];
  const result: ProjectedPoint[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[Math.max(0, i - 1)]!, b = path[i]!, c = path[i + 1]!, d = path[Math.min(path.length - 1, i + 2)]!;
    for (let sample = 0; sample < 8; sample++) {
      const t = sample / 8, t2 = t * t, t3 = t2 * t;
      const point = b.map((value, axis) => .5 * ((2 * value) + (-a[axis]! + c[axis]!) * t + (2 * a[axis]! - 5 * value + 4 * c[axis]! - d[axis]!) * t2 + (-a[axis]! + 3 * value - 3 * c[axis]! + d[axis]!) * t3)) as ProjectedPoint;
      point[0] = Math.max(-180, Math.min(180, point[0]));
      result.push(point);
    }
  }
  result.push([...path.at(-1)!]);
  return result;
}
function samePoint(a: GeoPoint | undefined, b: GeoPoint) { return !!a && a.latitude === b.latitude && a.longitude === b.longitude; }
/** Arc-length progress over separate fragments; no teleport edge across the projection seam. */
export function pointAlongRoute(paths: readonly (readonly ProjectedPoint[])[], progress: number): ProjectedPoint {
  const edges = paths.flatMap(path => path.slice(1).map((end, i) => ({ start: path[i]!, end, length: Math.hypot(...end.map((value, j) => value - path[i]![j]!) ) })));
  let remaining = edges.reduce((sum, edge) => sum + edge.length, 0) * Math.max(0, Math.min(1, progress));
  for (const edge of edges) {
    if (edge.length > 0 && remaining <= edge.length) { const t = remaining / edge.length; return edge.start.map((value, i) => value + (edge.end[i]! - value) * t) as ProjectedPoint; }
    remaining -= edge.length;
  }
  return paths.at(-1)?.at(-1) ?? [0, 0, 0];
}
/** Used by asset generation: finite waypoints with a documented fictional winding shape. */
export function authorWindingPath(a: GeoPoint, b: GeoPoint): GeoPoint[] {
  const dx = wrapLongitude(b.longitude - a.longitude); const dy = b.latitude - a.latitude;
  const norm = Math.hypot(dx, dy); const amplitude = Math.min(.32, norm * .055);
  if (!norm) return [{ ...a }, { ...b }];
  return Array.from({ length: 13 }, (_, i) => {
    if (i === 0) return { ...a }; if (i === 12) return { ...b };
    const t = i / 12; const offset = Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI) * amplitude;
    return { longitude: wrapLongitude(a.longitude + dx * t - dy / norm * offset), latitude: a.latitude + dy * t + dx / norm * offset };
  });
}

/** Vehicle mode follows the actual segment, including a required ground transfer. */
export function vehicleAlongRoute(segments: readonly RouteSegmentGeometry[], progress: number): { point: ProjectedPoint; mode: Mode | undefined } {
  const lengths = segments.map(segment => segment.paths.reduce((sum, path) => sum + path.slice(1).reduce((sum, end, i) => sum + Math.hypot(...end.map((value, j) => value - path[i]![j]!)), 0), 0));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const distance = total * Math.max(0, Math.min(1, progress));
  let start = 0;
  for (let i = 0; i < segments.length; i++) {
    const length = lengths[i]!;
    if (length > 0 && (distance < start + length || i === segments.length - 1)) return { point: pointAlongRoute(segments[i]!.paths, (distance - start) / length), mode: segments[i]!.mode };
    start += length;
  }
  const last = segments.at(-1);
  return { point: pointAlongRoute(segments.flatMap(segment => segment.paths), progress), mode: last?.mode };
}
