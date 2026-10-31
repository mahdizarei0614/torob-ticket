import type { GeoPoint } from '@torob-ticket/contracts';
import { projectPoint, type ProjectionContext } from '../geo/projection';
import type { SceneMarker } from './scene-surface';

/** The procedural land map owns ordinary geography when present. Do not project,
 * upload or shade a second, zero-opacity copy of those thousands of anchors. */
export function buildSceneDotData({ dots, majorCities, markers, context, hideGeography }: {
  dots: readonly GeoPoint[]; majorCities: readonly GeoPoint[]; markers: readonly SceneMarker[];
  context: ProjectionContext; hideGeography: boolean;
}) {
  const base = hideGeography ? [] : dots;
  const points = [...base.map(point => projectPoint(point, context)), ...majorCities.map(point => projectPoint(point, context)), ...markers.map(marker => {
    const point = projectPoint(marker.point, context);point[2] = .3;return point;
  })];
  return {
    position: points.flat(),
    geography: [...base.map(() => 1), ...majorCities.map(() => 1), ...markers.map(() => 0)],
    emphasis: [...base.map(() => 0), ...majorCities.map(() => .8), ...markers.map(marker => marker.enabled === false ? 0 : marker.kind === 'custom' || marker.role === 'origin' || marker.role === 'destination' ? 2 : 1)],
    phase: points.map(point => Math.sin(point[0] * 12.9898 + point[1] * 78.233) * 6.283185),
  };
}
