import { memo, useMemo } from 'react';
import type { GeoPoint } from '@torob-ticket/contracts';
import { sampleGeography, type AreaGeometry } from '../geo/geography';
import { DEFAULT_PROJECTION, fitRouteBounds, projectRoute, unprojectPoint, type ProjectionContext } from '../geo/projection';
import type { RouteSegmentGeometry } from '../geo/route-geometry';
import { SceneCamera, SceneSurface, useCameraIntent, type SceneMarker } from './scene-surface';
import { SceneDrawing, StaticMap } from './scene-drawing';
import styles from './scenes.module.css';
export interface LocationSceneProps {
  destinationBoundary: AreaGeometry; landmarks: readonly SceneMarker[]; accommodations: readonly SceneMarker[];
  customPoint?: GeoPoint; onPointChange: (point: GeoPoint) => void; fitKey: string; projection?: ProjectionContext;
}
/** Location input remains semantic DOM and is available at all viewport sizes and renderer states. */
export const LocationScene = memo(function LocationScene({ destinationBoundary, landmarks, accommodations, customPoint, onPointChange, fitKey, projection = DEFAULT_PROJECTION }: LocationSceneProps) {
  const rings = useMemo(() => destinationBoundary.type === 'Polygon' ? destinationBoundary.coordinates as number[][][] : (destinationBoundary.coordinates as number[][][][]).flat(), [destinationBoundary]);
  const segments = useMemo<RouteSegmentGeometry[]>(() => rings.map((ring, i) => ({ segmentId: `extent-${i}`, mode: 'train', transfer: false, originPlaceId: '', destinationPlaceId: '', paths: projectRoute(ring.map(point => ({ longitude: point[0]!, latitude: point[1]! })), projection), geometryStatus: 'illustrative', provenance: { source: 'bundled illustrative destination extent; not municipal boundaries', revision: 'geography-v1', illustrative: true, navigation: false } })), [rings, projection]);
  const bounds = useMemo(() => fitRouteBounds(segments.flatMap(segment => segment.paths)), [segments]);
  const dots = useMemo(() => {
    const coordinates = rings.flat(); const xs = coordinates.map(point => point[0]!); const ys = coordinates.map(point => point[1]!);
    const box = { west: Math.min(...xs), east: Math.max(...xs), south: Math.min(...ys), north: Math.max(...ys) };
    return sampleGeography([destinationBoundary], box, Math.max(box.east - box.west, box.north - box.south) / 45);
  }, [destinationBoundary, rings]);
  const markers = useMemo<SceneMarker[]>(() => [...landmarks, ...accommodations, ...(customPoint ? [{ id: 'custom-point', name: 'نقطه انتخابی', point: customPoint, kind: 'custom' as const }] : [])], [landmarks, accommodations, customPoint]);
  const [camera, setCamera] = useCameraIntent(bounds, fitKey, 'location');
  const current = customPoint ?? unprojectPoint(bounds.x, bounds.y, projection);
  return <div data-location-scene>
    <SceneSurface label="انتخاب موقعیت" camera={camera} setZoom={zoom => setCamera(value => ({ ...value, zoom }))} context={projection} markers={markers}
      onPointChange={onPointChange} onMarkerSelect={id => { const marker = markers.find(marker => marker.id === id); if (marker) onPointChange(marker.point); }}
      fallback={frame => <StaticMap dots={dots} markers={markers} segments={segments} context={projection} frame={frame} />}>
      {frame => <><SceneCamera frame={frame} /><SceneDrawing dots={dots} markers={markers} segments={segments} context={projection} frame={frame} /></>}
    </SceneSurface>
    <div className={styles.coordinates}>
      <label>عرض جغرافیایی<input aria-label="عرض جغرافیایی" type="number" dir="ltr" min="-90" max="90" step="0.001" value={Number(current.latitude.toFixed(6))} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= -90 && value <= 90) onPointChange({ ...current, latitude: value }); }} /></label>
      <label>طول جغرافیایی<input aria-label="طول جغرافیایی" type="number" dir="ltr" min="-180" max="180" step="0.001" value={Number(current.longitude.toFixed(6))} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= -180 && value <= 180) onPointChange({ ...current, longitude: value }); }} /></label>
    </div>
    <p role="note">محدوده نمایشی و اقامتگاه‌های خیالی؛ فاصله‌ها خط مستقیم‌اند. نقشه راهنمای خیابان یا مسیر زنده نیست.</p>
  </div>;
});
