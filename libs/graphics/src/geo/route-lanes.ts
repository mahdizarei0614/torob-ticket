import type { ProjectedPoint } from './projection';
import type { RouteSegmentGeometry } from './route-geometry';

const EPSILON = 1e-7;
const length = (a: ProjectedPoint, b: ProjectedPoint) => Math.hypot(...b.map((value, axis) => value - a[axis]!));
const smooth = (value: number) => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };
export const ROUTE_LANE_OFFSET_PX = 3.8;
export interface PresentationRoutePath {
  segment: RouteSegmentGeometry; pathIndex: number; leg: 0 | 1;
  points: ProjectedPoint[]; overlap: number[];
}

/** Exact spatial coverage, independent of vertex subdivision. Merely sharing
 * endpoints, crossing once or running nearby is not a coincident section. */
function coveredBy(path: readonly ProjectedPoint[], others: readonly (readonly ProjectedPoint[])[]) {
  let edges = 0;
  for (let index = 1; index < path.length; index++) {
    const a = path[index - 1]!, b = path[index]!, dx = b[0] - a[0], dy = b[1] - a[1], size = Math.hypot(dx, dy);
    if (size < EPSILON) continue;
    edges++;
    const intervals: [number, number][] = [];
    for (const other of others) for (let j = 1; j < other.length; j++) {
      const c = other[j - 1]!, d = other[j]!;
      if (Math.abs((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / size > EPSILON || Math.abs((d[0] - a[0]) * dy - (d[1] - a[1]) * dx) / size > EPSILON) continue;
      const first = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (size * size), last = ((d[0] - a[0]) * dx + (d[1] - a[1]) * dy) / (size * size);
      const from = Math.max(0, Math.min(first, last)), to = Math.min(1, Math.max(first, last));
      if (to > from) intervals.push([from, to]);
    }
    let covered = 0;
    for (const [from, to] of intervals.sort((left, right) => left[0] - right[0])) {
      if (from > covered + EPSILON / size) break;
      covered = Math.max(covered, to);
    }
    if (covered < 1 - EPSILON / size) return false;
  }
  return edges > 0;
}
function sameOrientation(path: readonly ProjectedPoint[], other: readonly ProjectedPoint[]) {
  const a = path[0]!, b = path.find(point => Math.hypot(point[0] - a[0], point[1] - a[1]) > EPSILON)!;
  const dx = b[0] - a[0], dy = b[1] - a[1], middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (let index = 1; index < other.length; index++) {
    const c = other[index - 1]!, d = other[index]!, ox = d[0] - c[0], oy = d[1] - c[1], square = ox * ox + oy * oy;
    if (!square) continue;
    const t = ((middle[0]! - c[0]) * ox + (middle[1]! - c[1]) * oy) / square;
    if (t >= -EPSILON && t <= 1 + EPSILON && Math.hypot(c[0] + t * ox - middle[0]!, c[1] + t * oy - middle[1]!) <= EPSILON) return dx * ox + dy * oy > 0;
  }
  return undefined;
}
export function presentationPathNormal(path: readonly ProjectedPoint[], index: number): [number, number] {
  const before = path[Math.max(0, index - 1)]!, after = path[Math.min(path.length - 1, index + 1)]!;
  const dx = after[0] - before[0], dy = after[1] - before[1], size = Math.hypot(dx, dy) || 1;
  return [-dy / size, dx / size];
}
/** Prepared once per canonical route, never in the frame loop. Positions remain
 * on the source polyline; only the presentation lane attribute gains an offset. */
export function presentationRoutePaths(segments: readonly RouteSegmentGeometry[], splitSegment?: number): PresentationRoutePath[] {
  const paths = segments.flatMap((segment, index) => segment.paths.map((points, pathIndex) => ({ segment, pathIndex, points, leg: (splitSegment !== undefined && index >= splitSegment ? 1 : 0) as 0 | 1 })));
  return paths.map(item => {
    const others = splitSegment === undefined ? [] : paths.filter(candidate => candidate.leg !== item.leg);
    if (!coveredBy(item.points, others.map(other => other.points))) return { ...item, overlap: item.points.map(() => 0) };
    // Reversing the canonical tangent already reverses its normal. Equal handed
    // offsets separate reverse travel; equal-direction shared paths need -1.
    const same = others.map(other => sameOrientation(item.points, other.points)).find(value => value !== undefined);
    const lane = item.leg && same ? -1 : 1;
    const cumulative = [0];
    for (let i = 1; i < item.points.length; i++) cumulative.push(cumulative.at(-1)! + length(item.points[i - 1]!, item.points[i]!));
    const total = cumulative.at(-1)!;
    const fractions = [...new Set([...cumulative.map(value => value / total), .06, .14, .5, .86, .94])].sort((a, b) => a - b);
    const points = fractions.map(fraction => {
      const distance = fraction * total, index = Math.max(1, cumulative.findIndex(value => value >= distance));
      const before = item.points[index - 1]!, after = item.points[index]!, span = cumulative[index]! - cumulative[index - 1]!;
      const amount = span > 0 ? (distance - cumulative[index - 1]!) / span : 0;
      return before.map((value, axis) => value + (after[axis]! - value) * amount) as ProjectedPoint;
    });
    return { ...item, points, overlap: fractions.map(fraction => lane * smooth(fraction / .16) * smooth((1 - fraction) / .16)) };
  });
}
/** SVG uses exactly the vertex shader's normal displacement. Sources, vehicles,
 * camera bounds and arc-length timing continue to use the canonical geometry. */
export function offsetPresentationPath(path: PresentationRoutePath, unitsPerPixel: number): ProjectedPoint[] {
  return path.points.map((point, index) => {
    const normal = presentationPathNormal(path.points, index), offset = path.overlap[index]! * unitsPerPixel * ROUTE_LANE_OFFSET_PX;
    return [point[0] + normal[0] * offset, point[1] + normal[1] * offset, point[2]];
  });
}
