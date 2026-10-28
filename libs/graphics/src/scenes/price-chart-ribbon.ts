import type { PriceChartCurvePoint } from '@torob-ticket/ui';

/** Centerline samples become a pixel-width ribbon in the vertex shader, independent of DPR. */
export function priceChartRibbon(paths: readonly (readonly PriceChartCurvePoint[])[], edgeOpacity?: readonly (readonly number[])[]) {
  const positions: number[] = [], directions: number[] = [], sides: number[] = [], opacities: number[] = [];
  paths.forEach((path, pathIndex) => {
    const vertex = (index: number, side: number, opacity: number) => {
      const point = path[index]!, before = path[Math.max(0, index - 1)]!, after = path[Math.min(path.length - 1, index + 1)]!;
      positions.push(point.x, point.y, 0); directions.push(after.x - before.x, after.y - before.y); sides.push(side);
      opacities.push(opacity);
    };
    for (let index = 0; index < path.length - 1; index++) {
      const opacity = edgeOpacity?.[pathIndex]?.[index] ?? 1;
      vertex(index, -1, opacity); vertex(index + 1, -1, opacity); vertex(index + 1, 1, opacity);
      vertex(index, -1, opacity); vertex(index + 1, 1, opacity); vertex(index, 1, opacity);
    }
  });
  return { positions, directions, sides, opacities };
}
