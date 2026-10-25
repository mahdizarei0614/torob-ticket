import type { GeoPoint } from '@torob-ticket/contracts';
/** Degrees in a local equirectangular frame. One context is shared by map, route and inverse input. */
export interface ProjectionContext { centralLongitude: number }
export type ProjectedPoint = [number, number, number];
export interface RouteBounds { x: number; y: number; width: number; height: number }
export const DEFAULT_PROJECTION: ProjectionContext = { centralLongitude: 0 };
export function wrapLongitude(value: number) { return ((value + 180) % 360 + 360) % 360 - 180; }
export function projectPoint(point: GeoPoint, context: ProjectionContext = DEFAULT_PROJECTION): ProjectedPoint {
  if (![point.longitude, point.latitude, context.centralLongitude].every(Number.isFinite)) throw new RangeError('Nonfinite geography');
  return [wrapLongitude(point.longitude - context.centralLongitude), Math.max(-90, Math.min(90, point.latitude)), 0];
}
export function unprojectPoint(x: number, y: number, context: ProjectionContext = DEFAULT_PROJECTION): GeoPoint {
  if (![x, y, context.centralLongitude].every(Number.isFinite)) throw new RangeError('Nonfinite geography');
  return { longitude: wrapLongitude(x + context.centralLongitude), latitude: Math.max(-90, Math.min(90, y)) };
}
/** Split at the frame's seam, inserting matching boundary points, never a 358-degree edge. */
export function projectRoute(points: readonly GeoPoint[], context: ProjectionContext = DEFAULT_PROJECTION): ProjectedPoint[][] {
  if (!points.length) return [];
  const result: ProjectedPoint[][] = [[projectPoint(points[0]!, context)]];
  for (const point of points.slice(1)) {
    const next = projectPoint(point, context); const path = result.at(-1)!; const previous = path.at(-1)!;
    const difference = next[0] - previous[0];
    if (Math.abs(difference) > 180) {
      const adjusted = next[0] + (difference > 0 ? -360 : 360);
      const boundary = difference > 0 ? -180 : 180;
      const t = (boundary - previous[0]) / (adjusted - previous[0]);
      const y = previous[1] + (next[1] - previous[1]) * t;
      path.push([boundary, y, 0]); result.push([[-boundary, y, 0], next]);
    } else path.push(next);
  }
  return result;
}
export function fitRouteBounds(paths: readonly (readonly ProjectedPoint[])[]): RouteBounds {
  const points = paths.flat();
  if (!points.length || !points.every(point => point.every(Number.isFinite))) throw new RangeError('Finite nonempty bounds required');
  const xs = points.map(point => point[0]); const ys = points.map(point => point[1]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2,
    width: Math.max(0.06, (Math.max(...xs) - Math.min(...xs)) * 1.3), height: Math.max(0.06, (Math.max(...ys) - Math.min(...ys)) * 1.3) };
}
/** Center long seam-crossing journeys deliberately, without changing context during preview. */
export function contextForPoints(points: readonly GeoPoint[]): ProjectionContext {
  if (!points.length) return DEFAULT_PROJECTION;
  const first = points[0]!.longitude;
  const unwrapped = points.map(point => first + wrapLongitude(point.longitude - first));
  return { centralLongitude: wrapLongitude((Math.min(...unwrapped) + Math.max(...unwrapped)) / 2) };
}
