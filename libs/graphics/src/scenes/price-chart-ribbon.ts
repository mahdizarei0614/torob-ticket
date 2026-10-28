import type { PriceChartCurvePoint } from '@torob-ticket/ui';

/** Centerline samples become a pixel-width ribbon in the vertex shader, independent of DPR. */
export function priceChartRibbon(paths: readonly (readonly PriceChartCurvePoint[])[]) {
  const positions: number[] = [], directions: number[] = [], sides: number[] = [];
  for (const path of paths) {
    const vertex = (index: number, side: number) => {
      const point = path[index]!, before = path[Math.max(0, index - 1)]!, after = path[Math.min(path.length - 1, index + 1)]!;
      positions.push(point.x, point.y, 0); directions.push(after.x - before.x, after.y - before.y); sides.push(side);
    };
    for (let index = 0; index < path.length - 1; index++) {
      vertex(index, -1); vertex(index + 1, -1); vertex(index + 1, 1);
      vertex(index, -1); vertex(index + 1, 1); vertex(index, 1);
    }
  }
  return { positions, directions, sides };
}
