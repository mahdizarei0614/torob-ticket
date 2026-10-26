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

/** Screen-width ribbons use arc length, not sample count, so reveal and vehicle motion agree. */
export function createRouteRibbonGeometry(segments: readonly RouteSegmentGeometry[]) {
  const positions: number[] = [], normals: number[] = [], progresses: number[] = [], sides: number[] = [], kinds: number[] = [], modes: number[] = [];
  const length = (a: readonly number[], b: readonly number[]) => Math.hypot(...b.map((value, axis) => value - a[axis]!));
  const total = segments.reduce((sum, segment) => sum + segment.paths.reduce((sum, path) => sum + path.slice(1).reduce((sum, point, i) => sum + length(path[i]!, point), 0), 0), 0);
  let travelled = 0;
  for (const segment of segments) for (const path of segment.paths) {
    for (let i = 1; i < path.length; i++) {
      const start = path[i - 1]!, end = path[i]!;
      const edge = length(start, end);
      if (!edge) continue;
      const normalAt = (index: number) => {
        const before = path[Math.max(0, index - 1)]!, after = path[Math.min(path.length - 1, index + 1)]!;
        const dx = after[0] - before[0], dy = after[1] - before[1];
        const magnitude = Math.hypot(dx, dy) || 1;
        return [-dy / magnitude, dx / magnitude];
      };
      const na = normalAt(i - 1), nb = normalAt(i);
      for (const [vertex, side] of [[0, -1], [0, 1], [1, -1], [1, -1], [0, 1], [1, 1]] as const) {
        positions.push(...(vertex ? end : start)); normals.push(...(vertex ? nb : na)); sides.push(side);
        progresses.push((travelled + (vertex ? edge : 0)) / Math.max(total, .000001));
        kinds.push(segment.transfer ? 1 : 0); modes.push(segment.mode === 'train' ? 1 : segment.mode === 'bus' ? 2 : 0);
      }
      travelled += edge;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('routeNormal', new Float32BufferAttribute(normals, 2));
  geometry.setAttribute('routeProgress', new Float32BufferAttribute(progresses, 1));
  geometry.setAttribute('routeSide', new Float32BufferAttribute(sides, 1));
  geometry.setAttribute('routeKind', new Float32BufferAttribute(kinds, 1));
  geometry.setAttribute('routeMode', new Float32BufferAttribute(modes, 1));
  geometry.userData['routeLength'] = total;
  return geometry;
}
