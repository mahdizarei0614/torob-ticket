export interface AnnotationAnchor { id: string; x: number; y: number; width: number; height: number; preferBelow?: boolean }
export interface AnnotationPlacement extends AnnotationAnchor { left: number; top: number; leader: { x1: number; y1: number; x2: number; y2: number } | null }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const overlap = (a: { left: number; top: number; width: number; height: number }, b: { left: number; top: number; width: number; height: number }, gap = 7) => Math.max(0, Math.min(a.left + a.width + gap, b.left + b.width + gap) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height + gap, b.top + b.height + gap) - Math.max(a.top, b.top));

/** Deterministic bounded label placement. Geography anchors never move. Input order is priority. */
export function placeAnnotations(anchors: readonly AnnotationAnchor[], viewport: { width: number; height: number }): AnnotationPlacement[] {
  const placed: AnnotationPlacement[] = [];
  for (const anchor of anchors) {
    const width = Math.min(anchor.width, Math.max(1, viewport.width - 16));
    const height = Math.min(anchor.height, Math.max(1, viewport.height - 16));
    let best = { left: 8, top: 8, score: Infinity };
    const sides = anchor.preferBelow ? [1, -1] : [-1, 1];
    for (const ring of [0, 1, 2, 3]) for (const side of sides) for (const column of [0, -1, 1]) {
      const left = clamp(anchor.x - width / 2 + column * (width / 2 + 12), 8, viewport.width - width - 8);
      const top = clamp(anchor.y + (side < 0 ? -height - 18 : 18) + side * ring * (height + 8), 8, viewport.height - height - 8);
      const candidate = { left, top, width, height };
      const collisions = placed.reduce((sum, other) => sum + overlap(candidate, other), 0);
      const coveredAnchors = anchors.reduce((sum, point) => sum + overlap(candidate, { left: point.x - 12, top: point.y - 12, width: 24, height: 24 }, 0), 0);
      const distance = Math.hypot(left + width / 2 - anchor.x, top + height / 2 - anchor.y);
      const score = collisions * 10000 + coveredAnchors * 100 + distance + ring * 2;
      if (score < best.score) best = { left, top, score };
    }
    const x2 = clamp(anchor.x, best.left, best.left + width);
    const y2 = clamp(anchor.y, best.top, best.top + height);
    const length = Math.hypot(x2 - anchor.x, y2 - anchor.y);
    const leader = length > 20 ? { x1: anchor.x + (x2 - anchor.x) * 12 / length, y1: anchor.y + (y2 - anchor.y) * 12 / length, x2, y2 } : null;
    placed.push({ ...anchor, left: best.left, top: best.top, width, height, leader });
  }
  return placed;
}
