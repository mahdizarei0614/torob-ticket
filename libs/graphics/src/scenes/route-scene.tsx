import {displayPlaceName} from '@torob-ticket/ui';
import { memo, useMemo, useEffect, useLayoutEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import type { City, GeoPoint, Itinerary, Mode, Place } from '@torob-ticket/contracts';
import { buildRouteGeometry, type IllustrativePath, type RouteSegmentGeometry } from '../geo/route-geometry';
import { DEFAULT_PROJECTION, fitRouteBounds, projectPoint, projectRoute, type ProjectionContext, type RouteBounds } from '../geo/projection';
import { SceneCamera, SceneSurface, useCameraIntent, frameForAspect, type CameraIntent, type SceneMarker } from './scene-surface';
import { SceneDrawing, StaticMap } from './scene-drawing';
import { useGraphics } from '../graphics-provider';
import { buildJourneyPresentation, sampleJourneyPresentation, type JourneyPresentation, type JourneyPresentationFrame } from './journey-presentation';
import { placeAnnotations } from './annotation-layout';
import { createSceneFrameStore, fitPresentationBounds, type SceneFrameStore } from './camera-transition';
import { contextCityLabels, DOMESTIC_DOT_BASE_SPACING, INTERNATIONAL_DOT_BASE_SPACING, worldDotWeights, type ContextCity, type ContextLabel, type WorldCountry, type WorldContext } from '../geo/world-context';
import { WorldGeography, StaticWorldGeography } from './world-geography';
import { EndpointPresence, endpointEdgeOpacity } from './endpoint-presence';
import styles from './scenes.module.css';
import presentationStyles from './route-presentation.module.css';
export interface RouteCityMarker { city:City;enabled:boolean;role:'origin'|'destination'|'network' }
const NO_CITIES:readonly RouteCityMarker[]=[];
const NO_PATHS: readonly IllustrativePath[] = [];
export interface RoutePresentationEndpoint { id: string; name: string; point: GeoPoint; role: 'origin' | 'destination' }
export interface RoutePresentation {
  key: string;
  endpoints: readonly RoutePresentationEndpoint[];
  majorCities?: readonly GeoPoint[];
  cityNames?: Readonly<Record<string, string>>;
  active: boolean;
  reducedMotion: boolean;
}
export interface RouteSceneProps {
  places: readonly Place[]; dots: readonly GeoPoint[]; scope: 'domestic' | 'international';
  itinerary?: Itinerary; direction?: 'outbound' | 'return'; paths?: readonly IllustrativePath[];
  /** Explicit pre-itinerary seam: display-only endpoints, never a priced or fabricated itinerary. */
  illustrative?: { points: GeoPoint[]; mode: Mode; label: string };
  fitMode?: 'route' | 'geography'; projection?: ProjectionContext; fitKey: string; originKey?: string; progress?: 0 | .35 | .7 | 1; reveal?: number;
  cities?:readonly RouteCityMarker[]; onCitySelect?:(cityId:string)=>void;
  initialCamera?:CameraIntent; onCameraIntentChange?:(camera:CameraIntent)=>void; isCurrent?:()=>boolean;
  portalLabels?:boolean; labelsVisible?:boolean; showControls?:boolean;fitBothDirections?:boolean; showTimeline?:boolean; showNotes?:boolean;
  animateProgress?:boolean; onMotionChange?:(active:boolean)=>void; motionKey?:string;
  onPlaceSelect?: (placeId: string) => void;
  /** Selected journey visual choreography; independent of comparison/referral progress. */
  presentation?: RoutePresentation;
  /** Locally bundled cartographic context; does not add selectable destinations. */
  worldContext?: WorldContext;
  geography?:readonly WorldCountry[];
}
export const RouteScene = memo(function RouteScene({ places, dots, scope, itinerary, direction = 'outbound', paths = NO_PATHS, illustrative, projection = DEFAULT_PROJECTION, fitMode = 'route', fitKey, originKey = '', progress = 0, reveal = 1, onPlaceSelect,cities=NO_CITIES,onCitySelect,initialCamera,onCameraIntentChange,isCurrent=()=>true,fitBothDirections=false,showTimeline=true,showNotes=true,animateProgress=false,onMotionChange,motionKey,portalLabels=false,labelsVisible=true,showControls=true,presentation,worldContext,geography }: RouteSceneProps) {
  const { status } = useGraphics();
  const pointer = useRef({ x: 0, y: 0, active: false });
  const cameraFrames = useMemo(()=>createSceneFrameStore(),[]);
  const leg = itinerary && (direction === 'outbound' ? itinerary.outbound : itinerary.return);
  const segments = useMemo<readonly RouteSegmentGeometry[]>(() => {
    if (itinerary && leg) return buildRouteGeometry(itinerary, places, paths, direction, projection);
    if (!illustrative) return [];
    return [{ segmentId: 'endpoint-illustration', mode: illustrative.mode, transfer: false, originPlaceId: '', destinationPlaceId: '', paths: projectRoute(illustrative.points, projection), geometryStatus: 'illustrative', provenance: { source: illustrative.label, revision: 'endpoint-v1', illustrative: true, navigation: false } }];
  }, [itinerary, leg, places, paths, direction, projection, illustrative]);
  const plan = useMemo(() => buildJourneyPresentation(segments, leg, places, presentation?.cityNames), [segments, leg, places, presentation?.cityNames]);
  const endpoints = useMemo(() => (presentation?.endpoints ?? []).map(endpoint => {
    const placeId = endpoint.role === 'origin' ? leg?.segments[0]?.originPlaceId : leg?.segments.at(-1)?.destinationPlaceId;
    const place = placeId && places.find(item => item.id === placeId);
    return place ? { ...endpoint, point: place.point } : endpoint;
  }), [presentation?.endpoints, leg, places]);
  const store = useMemo(() => createPresentationStore(sampleJourneyPresentation(plan, 0)), [plan, presentation?.key]);
  const reportPresentation = useCallback((value: JourneyPresentationFrame) => { if (isCurrent()) store.update(value); }, [isCurrent, store]);
  const placeSelectable=Boolean(onPlaceSelect);const citySelectable=Boolean(onCitySelect);
  const markers = useMemo<SceneMarker[]>(() => {
    if (presentation) return [
      ...endpoints.map(endpoint => ({ ...endpoint, id: `endpoint:${endpoint.id}:${endpoint.role}`, kind: 'city' as const, selectable: false, showLabel: false })),
      ...plan.stops.map(stop => ({ id: stop.id, name: stop.name, point: stop.point, kind: 'place' as const, selectable: false, showLabel: false })),
    ];
    const ids = leg ? [...new Set([...leg.segments.flatMap(segment => [segment.originPlaceId, segment.destinationPlaceId]), ...leg.stops.map(stop => stop.placeId)])] : [];
    // Public place selection remains available even before a specific itinerary exists.
    return [...places.filter(place => ids.includes(place.id) || (!leg && placeSelectable)).map(place => ({ id: place.id, name: `${displayPlaceName(place)}${place.code ? ` (${place.code})` : ''}`, point: place.point, kind: 'place' as const,selectable:placeSelectable,showLabel:!cities.length })),...cities.map(item=>({id:'city:'+item.city.id,cityId:item.city.id,name:item.city.name+(item.role==='origin'?' · مبدا':item.role==='destination'?' · مقصد':''),point:item.city.point,kind:'city' as const,enabled:item.enabled,role:item.role,selectable:citySelectable}))];
  }, [places, leg, placeSelectable,cities,citySelectable,Boolean(presentation),endpoints,plan]);
  // Endpoint names and halos share one DOM presence lifetime, including exit fades.
  const drawnMarkers=useMemo(()=>presentation?markers.filter(marker=>marker.role!=='origin'&&marker.role!=='destination'):markers,[markers,Boolean(presentation)]);
  const cameraSegments=useMemo(()=>fitBothDirections && itinerary?.return ? [...buildRouteGeometry(itinerary,places,paths,'outbound',projection),...buildRouteGeometry(itinerary,places,paths,'return',projection)] : segments,[fitBothDirections,itinerary,places,paths,projection,segments]);
  const overview = useMemo(() => {
    if (scope === 'international') return { x: 0, y: 15, width: 360, height: 160 };
    const [x] = projectPoint({ longitude: 54, latitude: 32.5 }, projection);
    // Preserve the authored Iran viewport unless the caller's cut splits that extent.
    // Split geography occupies both ends of [-180,180], requiring the full frame.
    const crossesSeam = x - 11 < -180 || x + 11 > 180;
    return { x: crossesSeam ? 0 : x, y: 32.5, width: crossesSeam ? 360 : 22, height: 17 };
  },[scope,projection]);
  const bounds = useMemo(() => {
    const projected = cameraSegments.flatMap(segment => segment.paths);
    const selectedPoints = [...endpoints.map(endpoint=>projectPoint(endpoint.point,projection)),...plan.stops.map(stop=>projectPoint(stop.point,projection))];
    if (presentation && scope==='international' && endpoints.length>=2) return fitPresentationBounds([...projected,selectedPoints]);
    if (projected.length && fitMode==='route') return presentation ? fitPresentationBounds([...projected,selectedPoints]) : fitRouteBounds(projected);
    return overview;
  },[cameraSegments,scope,fitMode,projection,endpoints,plan,Boolean(presentation),overview]);
  const presentationFitKey=presentation ? `${fitKey}:${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}` : fitKey;
  const [camera, setCamera] = useCameraIntent(bounds, presentationFitKey, originKey,initialCamera);
  useEffect(()=>{if(isCurrent()) onCameraIntentChange?.(camera);},[camera,onCameraIntentChange,isCurrent]);
  const chooseMarker=(id:string)=>{if(!isCurrent()) return;const city=cities.find(item=>'city:'+item.city.id===id);if(city){if(city.enabled) onCitySelect?.(city.city.id);}else onPlaceSelect?.(id);};
  const label = 'نقشه مسیر';
  const world=presentation && scope==='international'?worldContext:undefined;
  const land=presentation ? world?.countries??geography:undefined;
  return <div data-route-scene data-world-country-borders={world?.countries.length??0} data-direction={direction} data-progress={progress}>
    <SceneSurface portalLabels={presentation ? true : portalLabels} labelsVisible={labelsVisible && !presentation} showControls={showControls} label={label} camera={camera} setZoom={zoom => setCamera(value => ({ ...value, zoom }))} context={projection} markers={markers} onMarkerSelect={onPlaceSelect||onCitySelect?chooseMarker:undefined} isCurrent={isCurrent} markerSelectLabel={cities.length?'انتخاب شهر روی نقشه':undefined}
      pointer={presentation ? pointer : undefined}
      displayFrame={presentation ? cameraFrames : undefined}
      overlay={presentation ? (frame,dimensions) => <PresentationOverlay plan={plan} store={store} endpoints={endpoints} worldContext={world} dotSpacing={land?scope==='domestic'?DOMESTIC_DOT_BASE_SPACING:INTERNATIONAL_DOT_BASE_SPACING:undefined} dotRefinement={scope==='domestic'?2:4} context={projection} frame={frame} cameraFrames={cameraFrames} dimensions={dimensions} reducedMotion={presentation.reducedMotion} finalState={status !== 'ready' && status !== 'loading'} active={presentation.active} /> : undefined}
      fallback={frame => <StaticMap hideGeography={Boolean(land)} background={land ? <StaticWorldGeography countries={land} context={projection} frame={frame} domestic={scope==='domestic'}/> : undefined} dots={dots} markers={drawnMarkers} segments={segments} context={projection} frame={frame} progress={presentation ? 1 : progress} mode={itinerary?.mode??illustrative?.mode} presentation={presentation ? plan : undefined} majorCities={presentation?.majorCities} />}>
      {frame => <><SceneCamera frame={frame} transition={presentation ? {active:presentation.active,reducedMotion:presentation.reducedMotion,initialFrame:initialCamera?undefined:frameForAspect({...overview,zoom:1},frame.width/frame.height),projectionLongitude:projection.centralLongitude,store:cameraFrames}:undefined} /><SceneDrawing hideGeography={Boolean(land)} dots={dots} markers={drawnMarkers} segments={segments} context={projection} frame={frame} mode={itinerary?.mode ?? illustrative?.mode} progress={progress} reveal={reveal} animateProgress={animateProgress} onMotionChange={onMotionChange} motionKey={motionKey} presentation={presentation ? plan : undefined} presentationKey={presentation?.key} presentationReducedMotion={presentation?.reducedMotion} onPresentationFrame={presentation ? reportPresentation : undefined} pointer={presentation ? pointer : undefined} ambientMotion={presentation?.active} majorCities={presentation?.majorCities} />{land && <WorldGeography countries={land} context={projection} frame={frame} pointer={pointer} reducedMotion={presentation!.reducedMotion} domestic={scope==='domestic'} active={presentation!.active} resetKey={presentation!.key}/>}</>}
    </SceneSurface>
    {showNotes && <p role="note">مسیر روی نقشه تقریبی است و راهنمای مسیریابی نیست.</p>}
    {showNotes && !leg && <p>{illustrative?.label ?? (itinerary ? 'اطلاعات مسیر برگشت موجود نیست.' : 'برای نمایش مسیر، مبدأ و مقصد را انتخاب کنید.')}</p>}
    {showTimeline && <RouteTimeline itinerary={itinerary} places={places} direction={direction} />}
    {segments.some(segment => segment.geometryStatus === 'unavailable') && <p role="status">هندسه بخشی از مسیر موجود نیست؛ مشخصات آن در فهرست مسیر حفظ شده است.</p>}
  </div>;
});

function createPresentationStore(initial: JourneyPresentationFrame) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update: (next: JourneyPresentationFrame) => { value = next; listeners.forEach(listener => listener()); },
  };
}
function PresentationOverlay({ plan, store, endpoints, context, frame:targetFrame, cameraFrames, dimensions, reducedMotion, finalState, active, worldContext, dotSpacing, dotRefinement }: {
  plan: JourneyPresentation; store: ReturnType<typeof createPresentationStore>; endpoints: readonly RoutePresentationEndpoint[];
  worldContext?:WorldContext; dotSpacing?:number; dotRefinement:number; context: ProjectionContext; frame: RouteBounds; cameraFrames:SceneFrameStore; dimensions: {width:number;height:number}; reducedMotion: boolean; finalState: boolean; active: boolean;
}) {
  const sampled = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const displayedFrame = useSyncExternalStore(cameraFrames.subscribe,cameraFrames.getSnapshot,cameraFrames.getSnapshot);
  const frame = reducedMotion || finalState ? targetFrame : displayedFrame ?? targetFrame;
  const finalFrame = useMemo(() => sampleJourneyPresentation(plan, 0, { reducedMotion: true }), [plan]);
  const current = reducedMotion || finalState ? finalFrame : sampled;
  // Reserve all selected-stop label positions from the start, so revealed facts do not move earlier labels.
  const placements = useMemo(() => {
    const points = [...endpoints.map(endpoint => ({ ...endpoint, id: `endpoint:${endpoint.role}:${endpoint.id}`, width: 132, height: 44, preferBelow: endpoint.role === 'destination' })), ...plan.stops.map((stop,index) => ({ ...stop, width: 144, height: 40, preferBelow: index % 2 === 1 }))];
    const anchors = points.map(item => { const [x,y] = projectPoint(item.point,context); return {id:item.id,width:item.width,height:item.height,preferBelow:item.preferBelow,x:dimensions.width*(.5+(x-frame.x)/frame.width),y:dimensions.height*(.5-(y-frame.y)/frame.height)}; }).filter(item=>item.x>=0 && item.y>=0 && item.x<=dimensions.width && item.y<=dimensions.height);
    return new Map(placeAnnotations(anchors,dimensions).map(item=>[item.id,item]));
  },[endpoints,plan,context,frame.x,frame.y,frame.width,frame.height,dimensions.width,dimensions.height]);
  const contextual=useMemo(()=>{
    if(!worldContext)return [];
    const reserved=[...placements.values()].flatMap(item=>[{left:item.left,top:item.top,width:item.width,height:item.height},{left:item.x-22,top:item.y-22,width:44,height:44}]);
    return contextCityLabels(worldContext.cities,frame,dimensions,context,reserved,new Set([...endpoints.flatMap(endpoint=>[endpoint.id,endpoint.name]),...plan.stops.map(stop=>stop.name)]));
  },[worldContext,placements,endpoints,plan,frame,dimensions,context]);
  const textPosition = (id:string) => { const item=placements.get(id);return item ? {left:item.left-item.x,top:item.top-item.y,width:item.width,height:item.height}:undefined; };
  const visibleLabels = new Set([...endpoints.map(endpoint=>`endpoint:${endpoint.role}:${endpoint.id}`),...current.revealedStops.map(stop=>stop.id)]);
  const number = (value: number) => value.toLocaleString('fa-IR');
  const position = (point: GeoPoint) => {
    const [x, y] = projectPoint(point, context);
    return { left: `${50 + (x - frame.x) / frame.width * 100}%`, top: `${50 - (y - frame.y) / frame.height * 100}%` };
  };
  const visible = (point: GeoPoint) => { const [x, y] = projectPoint(point, context); return Math.abs(x - frame.x) <= frame.width / 2 && Math.abs(y - frame.y) <= frame.height / 2; };
  return <div className={presentationStyles.overlay} data-route-presentation data-context-label-count={contextual.length} data-map-dot-spacing={dotSpacing} data-map-dot-refinement={dotRefinement} data-map-dot-weights={dotSpacing?worldDotWeights(frame.width/dimensions.width,dotSpacing,dotRefinement).map(value=>value.toFixed(3)).join(','):undefined} data-route-reveal={current.reveal.toFixed(3)} data-route-travel={current.travel.toFixed(3)} data-vehicle-opacity={current.vehicleOpacity.toFixed(3)} data-vehicle-blur={current.vehicleBlur.toFixed(3)} data-route-complete={current.complete} data-journey-phase={current.complete ? 'complete' : current.activeStop === null ? 'travel' : 'stop'} data-reduced-motion={reducedMotion} data-motion-active={active} aria-label="نقاط مسیر انتخاب‌شده" role="group">
    {worldContext && <div className={presentationStyles.contextCities} aria-hidden="true">{worldContext.cities.map(city=>{const p=projectPoint(city.point,context);return <ContextCityName key={city.id} city={city} label={contextual.find(item=>item.id===city.id)} x={dimensions.width*(.5+(p[0]-frame.x)/frame.width)} y={dimensions.height*(.5-(p[1]-frame.y)/frame.height)}/>;})}</div>}
    <svg className={presentationStyles.leaders} viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} aria-hidden="true">{[...placements.values()].filter(item=>item.leader && visibleLabels.has(item.id)).map(item=><line key={item.id} {...item.leader!} />)}</svg>
    <EndpointPresence reducedMotion={reducedMotion} endpoints={endpoints.map(endpoint=>{
      const [x,y]=projectPoint(endpoint.point,context),left=dimensions.width*(.5+(x-frame.x)/frame.width),top=dimensions.height*(.5-(y-frame.y)/frame.height);
      return {...endpoint,key:`${endpoint.role}:${endpoint.id}:${endpoint.point.longitude}:${endpoint.point.latitude}`,arrived:endpoint.role==='origin'||current.complete,left,top,opacity:endpointEdgeOpacity(left,top,dimensions.width,dimensions.height),text:textPosition(`endpoint:${endpoint.role}:${endpoint.id}`)??{left:-66,top:-58,width:132,height:44}};
    })}/>
    {current.revealedStops.map((revealed, index) => {
      const stop = plan.stops.find(item => item.id === revealed.id);
      if (!stop || !visible(stop.point)) return null;
      return <div key={stop.id} className={presentationStyles.stop} style={position(stop.point)} data-route-stop={stop.placeId} data-journey-stop={stop.id} data-stop-occurrence={stop.id} data-wait-minutes={revealed.count ?? 'unknown'} data-side={index % 2 ? 'below' : 'above'} data-stop-active={plan.stops[current.activeStop ?? -1]?.id === stop.id}>
        <span className={presentationStyles.stopOrbit} aria-hidden="true" />
        <div className={presentationStyles.stopText} style={textPosition(stop.id)} dir="rtl"><strong>{stop.name}</strong><span aria-label={stop.waitMinutes === null ? 'زمان توقف نامعلوم' : `توقف ${number(stop.waitMinutes)} دقیقه`}><span data-wait-count>{revealed.count === null ? 'نامعلوم' : number(revealed.count)}</span>{revealed.count !== null && ' دقیقه توقف'}</span></div>
      </div>;
    })}
  </div>;
}


function ContextCityName({city,label,x,y}:{city:ContextCity;label?:ContextLabel;x:number;y:number}){
  const last=useRef({offset:7,width:70});
  const placement=label?{offset:label.top-label.y,width:label.width}:last.current;
  useLayoutEffect(()=>{if(label)last.current={offset:label.top-label.y,width:label.width};},[label]);
  return <span data-context-city={city.id} data-visible={Boolean(label)} className={presentationStyles.contextCity} style={{left:x-placement.width/2,top:y+placement.offset,width:placement.width,opacity:label?.opacity??0}}><i style={{left:placement.width/2-1.5,top:-placement.offset-1.5}}/>{city.name}</span>;
}

export function RouteTimeline({ itinerary, places, direction = 'outbound' }: Pick<RouteSceneProps, 'itinerary' | 'places' | 'direction'>) {
  const leg = itinerary && (direction === 'outbound' ? itinerary.outbound : itinerary.return);
  if (!leg) return null;
  const name = (id: string) => displayPlaceName(places.find(place => place.id === id));
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
