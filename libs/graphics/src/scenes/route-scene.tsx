import { memo, useMemo } from 'react';
import type { GeoPoint, Itinerary, Mode, Place } from '@torob-ticket/contracts';
import { buildRouteGeometry, type IllustrativePath, type RouteSegmentGeometry } from '../geo/route-geometry';
import { DEFAULT_PROJECTION, fitRouteBounds, projectRoute, type ProjectionContext } from '../geo/projection';
import { SceneCamera, SceneSurface, useCameraIntent, type SceneMarker } from './scene-surface';
import { SceneDrawing, StaticMap } from './scene-drawing';
import styles from './scenes.module.css';
const NO_PATHS: readonly IllustrativePath[] = [];
export interface RouteSceneProps {
  places: readonly Place[]; dots: readonly GeoPoint[]; scope: 'domestic' | 'international';
  itinerary?: Itinerary; direction?: 'outbound' | 'return'; paths?: readonly IllustrativePath[];
  /** Explicit pre-itinerary seam: display-only endpoints, never a priced or fabricated itinerary. */
  illustrative?: { points: GeoPoint[]; mode: Mode; label: string };
  fitMode?: 'route' | 'geography'; projection?: ProjectionContext; fitKey: string; originKey?: string; progress?: 0 | .35 | .7 | 1; reveal?: number;
  onPlaceSelect?: (placeId: string) => void;
}
export const RouteScene = memo(function RouteScene({ places, dots, scope, itinerary, direction = 'outbound', paths = NO_PATHS, illustrative, projection = DEFAULT_PROJECTION, fitMode = 'route', fitKey, originKey = '', progress = 0, reveal = 1, onPlaceSelect }: RouteSceneProps) {
  const leg = itinerary && (direction === 'outbound' ? itinerary.outbound : itinerary.return);
  const segments = useMemo<readonly RouteSegmentGeometry[]>(() => {
    if (itinerary && leg) return buildRouteGeometry(itinerary, places, paths, direction, projection);
    if (!illustrative) return [];
    return [{ segmentId: 'endpoint-illustration', mode: illustrative.mode, transfer: false, originPlaceId: '', destinationPlaceId: '', paths: projectRoute(illustrative.points, projection), geometryStatus: 'illustrative', provenance: { source: illustrative.label, revision: 'endpoint-v1', illustrative: true, navigation: false } }];
  }, [itinerary, leg, places, paths, direction, projection, illustrative]);
  const markers = useMemo<SceneMarker[]>(() => {
    const ids = leg ? [...new Set([...leg.segments.flatMap(segment => [segment.originPlaceId, segment.destinationPlaceId]), ...leg.stops.map(stop => stop.placeId)])] : [];
    // Public place selection remains available even before a specific itinerary exists.
    return places.filter(place => ids.includes(place.id) || (!leg && !!onPlaceSelect)).map(place => ({ id: place.id, name: `${place.name}${place.code ? ` (${place.code})` : ''}`, point: place.point, kind: 'place' }));
  }, [places, leg, onPlaceSelect]);
  const bounds = useMemo(() => {
    const projected = segments.flatMap(segment => segment.paths);
    return projected.length && fitMode === 'route' ? fitRouteBounds(projected) : scope === 'domestic' ? { x: 54, y: 32.5, width: 22, height: 17 } : { x: 0, y: 15, width: 360, height: 160 };
  }, [segments, scope, fitMode]);
  const [camera, setCamera] = useCameraIntent(bounds, fitKey, originKey);
  const label = 'نقشه مسیر';
  return <div data-route-scene data-direction={direction} data-progress={progress}>
    <SceneSurface label={label} camera={camera} setZoom={zoom => setCamera(value => ({ ...value, zoom }))} context={projection} markers={markers} onMarkerSelect={onPlaceSelect}
      fallback={frame => <StaticMap dots={dots} markers={markers} segments={segments} context={projection} frame={frame} />}>
      {frame => <><SceneCamera frame={frame} /><SceneDrawing dots={dots} markers={markers} segments={segments} context={projection} frame={frame} mode={itinerary?.mode ?? illustrative?.mode} progress={progress} reveal={reveal} /></>}
    </SceneSurface>
    <p role="note">مسیرها نمونه و تقریبی‌اند؛ راهنمای مسیریابی نیستند. پیشرفت نشان‌دهنده مقایسه و ارجاع است؛ رزرو تأیید نمی‌شود.</p>
    {!leg && <p>{illustrative?.label ?? (itinerary ? 'اطلاعات مسیر برگشت موجود نیست.' : 'برای نمایش مسیر، مبدأ و مقصد را انتخاب کنید.')}</p>}
    <RouteTimeline itinerary={itinerary} places={places} direction={direction} />
    {segments.some(segment => segment.geometryStatus === 'unavailable') && <p role="status">هندسه بخشی از مسیر موجود نیست؛ مشخصات آن در فهرست مسیر حفظ شده است.</p>}
  </div>;
});
export function RouteTimeline({ itinerary, places, direction = 'outbound' }: Pick<RouteSceneProps, 'itinerary' | 'places' | 'direction'>) {
  const leg = itinerary && (direction === 'outbound' ? itinerary.outbound : itinerary.return);
  if (!leg) return null;
  const name = (id: string) => places.find(place => place.id === id)?.name ?? `مکان نامعلوم (${id})`;
  const modes = { flight: 'پرواز', train: 'قطار', bus: 'اتوبوس' };
  return <div>
    <ol className={styles.timeline} aria-label="ترتیب بخش‌های مسیر">{leg.segments.map(segment => <li key={segment.segmentId} data-segment-id={segment.segmentId} data-transfer={segment.mode !== itinerary!.mode}>
      {segment.mode !== itinerary!.mode ? 'انتقال زمینی ضروری · ' : ''}{modes[segment.mode]} · {name(segment.originPlaceId)} ← {name(segment.destinationPlaceId)}
      <div><time dir="ltr">{segment.departureAt}</time> ← <time dir="ltr">{segment.arrivalAt}</time></div>
    </li>)}</ol>
    {!!leg.stops.length && <ol className={styles.timeline} aria-label="توقف‌های اعلام‌شده">{leg.stops.map((stop, i) => <li key={`${stop.placeId}-${i}`} data-stop-place={stop.placeId}>
      {name(stop.placeId)} · توقف {stop.waitMinutes} دقیقه · {stop.vehicleChange ? 'تعویض وسیله' : 'بدون تعویض وسیله'} · {stop.kind === 'ground-transfer' ? 'انتقال زمینی' : stop.kind === 'technical-stop' ? 'توقف فنی' : stop.kind === 'connection' ? 'اتصال' : 'توقف'}
      <div>ورود: <span dir="ltr">{stop.arrivalAt ?? 'نامعلوم'}</span> · خروج: <span dir="ltr">{stop.departureAt ?? 'نامعلوم'}</span></div>
    </li>)}</ol>}
  </div>;
}
