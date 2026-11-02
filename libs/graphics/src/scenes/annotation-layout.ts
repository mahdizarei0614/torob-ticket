export interface AnnotationAnchor { id: string; x: number; y: number; width: number; height: number; preferBelow?: boolean }
export interface AnnotationPlacement extends AnnotationAnchor { left: number; top: number; leader: { x1: number; y1: number; x2: number; y2: number } | null }
export interface AnnotationPoint { x: number; y: number }
export interface AnnotationRoute { points: readonly AnnotationPoint[]; clearance?: number }
export interface AnnotationBox { left: number; top: number; width: number; height: number }
// The rendered ribbon extends 9.2px from its center; leave another 5.8px
// for the soft edge/label blur. Lane offsets are already in the supplied paths.
export const ANNOTATION_ROUTE_CLEARANCE = 15;
export const ANNOTATION_ENTRY_TRAVEL = 9;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const overlap = (a: { left: number; top: number; width: number; height: number }, b: { left: number; top: number; width: number; height: number }, gap = 7) => Math.max(0, Math.min(a.left + a.width + gap, b.left + b.width + gap) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height + gap, b.top + b.height + gap) - Math.max(a.top, b.top));
interface RouteEdge { a: AnnotationPoint; b: AnnotationPoint; clearance: number; left: number; top: number; right: number; bottom: number }
function routeEdges(routes: readonly AnnotationRoute[]): RouteEdge[] {
  return routes.flatMap(route => route.points.slice(1).flatMap((b, index) => {
    const a = route.points[index]!;
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return [];
    const clearance = Number.isFinite(route.clearance) ? Math.max(0, route.clearance!) : ANNOTATION_ROUTE_CLEARANCE;
    return [{ a, b, clearance, left: Math.min(a.x, b.x) - clearance, top: Math.min(a.y, b.y) - clearance, right: Math.max(a.x, b.x) + clearance, bottom: Math.max(a.y, b.y) + clearance }];
  }));
}
/** Segment clipping also detects a route crossing a box with BOTH vertices outside. */
function crossing(edge: RouteEdge, box: AnnotationBox): number {
  if (edge.right < box.left || edge.left > box.left + box.width || edge.bottom < box.top || edge.top > box.top + box.height) return 0;
  let from = 0, to = 1;
  for (const [start, delta, low, high] of [
    [edge.a.x, edge.b.x - edge.a.x, box.left - edge.clearance, box.left + box.width + edge.clearance],
    [edge.a.y, edge.b.y - edge.a.y, box.top - edge.clearance, box.top + box.height + edge.clearance],
  ]) {
    if (delta === 0) { if (start! < low! || start! > high!) return 0; }
    else {
      const a = (low! - start!) / delta!, b = (high! - start!) / delta!;
      from = Math.max(from, Math.min(a, b)); to = Math.min(to, Math.max(a, b));
      if (from > to) return 0;
    }
  }
  return 1 + Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y) * (to - from);
}
export function annotationCrossesRoutes(box: AnnotationBox, routes: readonly AnnotationRoute[]): boolean {
  return createAnnotationRouteCollisionTest(routes)(box);
}
export function createAnnotationRouteCollisionTest(routes: readonly AnnotationRoute[]) {
  const edges = routeEdges(routes);
  return (box: AnnotationBox) => edges.some(edge => crossing(edge, box) > 0);
}
function routeIndex(edges: readonly RouteEdge[], viewport: { width: number; height: number }) {
  const cells = new Map<string, number[]>(), size = 64;
  const xmax = Math.max(0, Math.ceil(viewport.width / size)), ymax = Math.max(0, Math.ceil(viewport.height / size));
  edges.forEach((edge, index) => {
    if (edge.right < 0 || edge.bottom < 0 || edge.left > viewport.width || edge.top > viewport.height) return;
    for (let x = clamp(Math.floor(edge.left / size), 0, xmax); x <= clamp(Math.floor(edge.right / size), 0, xmax); x++)
      for (let y = clamp(Math.floor(edge.top / size), 0, ymax); y <= clamp(Math.floor(edge.bottom / size), 0, ymax); y++) {
        const key = `${x}:${y}`, bucket = cells.get(key); if (bucket) bucket.push(index); else cells.set(key, [index]);
      }
  });
  const visited = new Uint32Array(edges.length); let stamp = 0;
  return (box: AnnotationBox) => {
    stamp++; let collisions = 0;
    for (let x = clamp(Math.floor(box.left / size), 0, xmax); x <= clamp(Math.floor((box.left + box.width) / size), 0, xmax); x++)
      for (let y = clamp(Math.floor(box.top / size), 0, ymax); y <= clamp(Math.floor((box.top + box.height) / size), 0, ymax); y++)
        for (const index of cells.get(`${x}:${y}`) ?? []) if (visited[index] !== stamp) { visited[index] = stamp; collisions += crossing(edges[index]!, box); }
    return collisions;
  };
}
/** At a fixed left edge, all route exclusions are exact forbidden intervals of
 * label-top values. Their complement finds even a subpixel clear corridor. */
function verticalGaps(edges: readonly RouteEdge[], blockers: readonly AnnotationBox[], left: number, width: number, height: number, bottom: number): [number, number][] {
  const intervals: [number, number][] = [];
  for (const edge of edges) {
    if (edge.right < left || edge.left > left + width) continue;
    const dx = edge.b.x - edge.a.x;
    let from = 0, to = 1;
    if (dx !== 0) {
      const a = (left - edge.clearance - edge.a.x) / dx, b = (left + width + edge.clearance - edge.a.x) / dx;
      from = Math.max(0, Math.min(a, b)); to = Math.min(1, Math.max(a, b));
      if (from > to) continue;
    }
    const first = edge.a.y + (edge.b.y - edge.a.y) * from, last = edge.a.y + (edge.b.y - edge.a.y) * to;
    intervals.push([Math.min(first, last) - edge.clearance - height, Math.max(first, last) + edge.clearance]);
  }
  for (const box of blockers) if (box.left <= left + width && box.left + box.width >= left) intervals.push([box.top - height, box.top + box.height]);
  const gaps: [number, number][] = []; let cursor = 8;
  for (const [from, to] of intervals.filter(([a, b]) => b >= 8 && a <= bottom).sort((a, b) => a[0] - b[0])) {
    if (from > cursor + .001) gaps.push([cursor, Math.min(bottom, from)]);
    cursor = Math.max(cursor, to); if (cursor >= bottom) break;
  }
  if (cursor < bottom) gaps.push([cursor, bottom]);
  return gaps;
}

/** Deterministic bounded label placement. Geography anchors never move. Input order is priority. */
export function placeAnnotations(anchors: readonly AnnotationAnchor[], viewport: { width: number; height: number }, routes: readonly AnnotationRoute[] = [], previous: readonly AnnotationPlacement[] = []): AnnotationPlacement[] {
  const placed: AnnotationPlacement[] = [];
  const edges = routeEdges(routes), routeCollisions = routeIndex(edges, viewport);
  for (const anchor of anchors) {
    const width = Math.min(anchor.width, Math.max(1, viewport.width - 16));
    const height = Math.min(anchor.height, Math.max(1, viewport.height - 16 - ANNOTATION_ENTRY_TRAVEL));
    let best = { left: 8, top: 8, score: Infinity, route: Infinity, labels: Infinity, anchors: Infinity };
    const candidates = new Set<string>();
    const old = previous.find(item => item.id === anchor.id);
    const consider = (proposedLeft: number, proposedTop: number) => {
      const left = clamp(proposedLeft, 8, Math.max(8, viewport.width - width - 8));
      const top = clamp(proposedTop, 8, Math.max(8, viewport.height - height - 8 - ANNOTATION_ENTRY_TRAVEL));
      const key = `${left}:${top}`; if (candidates.has(key)) return; candidates.add(key);
      const candidate = { left, top, width, height: height + ANNOTATION_ENTRY_TRAVEL };
      const route = routeCollisions(candidate);
      const labels = placed.reduce((sum, other) => sum + overlap(candidate, { ...other, height: other.height + ANNOTATION_ENTRY_TRAVEL }), 0);
      const coveredAnchors = anchors.reduce((sum, point) => sum + overlap(candidate, { left: point.x - 12, top: point.y - 12, width: 24, height: 24 }, 0), 0);
      const distance = Math.hypot(left + width / 2 - anchor.x, top + (height + ANNOTATION_ENTRY_TRAVEL) / 2 - anchor.y);
      // Hard route clearance comes first. If no wholly clear box exists in a
      // genuinely overcrowded viewport, the finite result minimizes conflict.
      const movement = old ? Math.hypot(left - anchor.x - old.left + old.x, top - anchor.y - old.top + old.y) : 0;
      const score = route * 10000 + labels * 100 + coveredAnchors + distance + movement * .35;
      const comparison = [Number(route > 0) - Number(best.route > 0), Number(labels > 0) - Number(best.labels > 0), Number(coveredAnchors > 0) - Number(best.anchors > 0), score - best.score].find(value => value !== 0);
      if (comparison === undefined || comparison < 0) best = { left, top, score, route, labels, anchors: coveredAnchors };
    };
    if (old) consider(anchor.x + old.left - old.x, anchor.y + old.top - old.y);
    const sides = anchor.preferBelow ? [1, -1] : [-1, 1];
    if (!old || best.route > 0 || best.labels > 0 || best.anchors > 0) {
      for (const ring of [0, 1, 2, 3]) for (const side of sides) for (const column of [0, -1, 1]) {
        consider(anchor.x - width / 2 + column * (width / 2 + 12), anchor.y + (side < 0 ? -height - 18 - ANNOTATION_ENTRY_TRAVEL : 18) + side * ring * (height + 8));
      }
    }
    if (best.route > 0 || best.labels > 0 || best.anchors > 0) {
      // A bounded screen-space fallback, not a larger and larger anchor ring.
      // Spatial buckets reject distant route edges before exact clipping.
      const right = Math.max(8, viewport.width - width - 8), bottom = Math.max(8, viewport.height - height - 8 - ANNOTATION_ENTRY_TRAVEL);
      const xstep = Math.max(24, Math.min(48, width / 2), (right - 8) / 20), ystep = Math.max(16, Math.min(24, height / 2), (bottom - 8) / 24);
      const xs = [8, right], ys = [8, bottom];
      for (let x = 8 + xstep; x < right; x += xstep) xs.push(x);
      for (let y = 8 + ystep; y < bottom; y += ystep) ys.push(y);
      for (const top of ys) for (const left of xs) consider(left, top);
      if (best.route > 0 || best.labels > 0 || best.anchors > 0) {
        const blockers = [
          ...placed.map(box => ({ left: box.left - 7, top: box.top - 7, width: box.width + 14, height: box.height + ANNOTATION_ENTRY_TRAVEL + 14 })),
          ...anchors.map(point => ({ left: point.x - 12, top: point.y - 12, width: 24, height: 24 })),
        ];
        const nearby = [...xs, anchor.x - width / 2, ...(old ? [anchor.x + old.left - old.x] : []), ...blockers.flatMap(box => [box.left - width - .5, box.left + box.width + .5]), ...edges.flatMap(edge => [edge.left - width - .5, edge.right + .5])];
        const columns = [...new Set(nearby.map(left => clamp(left, 8, right)))].sort((a, b) => Math.abs(a + width / 2 - anchor.x) - Math.abs(b + width / 2 - anchor.x)).slice(0, 64);
        for (const left of columns) {
          for (const [from, to] of verticalGaps(edges, blockers, left, width, height + ANNOTATION_ENTRY_TRAVEL, bottom)) {
            const inset = Math.min(.5, (to - from) / 2);
            consider(left, clamp(anchor.y - height - 18 - ANNOTATION_ENTRY_TRAVEL, from + inset, to - inset));
          }
          if (best.route === 0 && best.labels === 0 && best.anchors === 0) break;
        }
      }
    }
    const x2 = clamp(anchor.x, best.left, best.left + width);
    const y2 = clamp(anchor.y, best.top, best.top + height);
    const length = Math.hypot(x2 - anchor.x, y2 - anchor.y);
    const leader = length > 20 ? { x1: anchor.x + (x2 - anchor.x) * 12 / length, y1: anchor.y + (y2 - anchor.y) * 12 / length, x2, y2 } : null;
    placed.push({ ...anchor, left: best.left, top: best.top, width, height, leader });
  }
  return placed;
}
