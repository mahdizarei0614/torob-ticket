import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { RouteSegmentGeometry } from './route-geometry';
/** Nonindexed GL_LINES: each edge owns two vertices; fragments never share a connector. */
export function createRouteLineGeometry(segments: readonly RouteSegmentGeometry[]) {
  const positions: number[] = [], progresses: number[] = [], kinds: number[] = [];
  const total = segments.reduce((sum, segment) => sum + segment.paths.reduce((sum, path) => sum + Math.max(0, path.length - 1), 0), 0);
  let edge = 0;
  for (const segment of segments) for (const path of segment.paths) for (let i = 1; i < path.length; i++) {
    positions.push(...path[i - 1]!, ...path[i]!);
    progresses.push(edge / Math.max(1, total), ++edge / Math.max(1, total)); kinds.push(segment.transfer ? 1 : 0, segment.transfer ? 1 : 0);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('routeProgress', new Float32BufferAttribute(progresses, 1));
  geometry.setAttribute('routeKind', new Float32BufferAttribute(kinds, 1));
  return geometry;
}
