import {forwardRef,lazy,Suspense,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {GeoPointSchema,type CatalogSnapshot} from '@torob-ticket/contracts';
import {Button,useMotionPolicy} from '@torob-ticket/ui';
import {AnimatePresence,motion,useAnimationControls,useIsPresent,usePresence} from 'motion/react';
import type {RouteSceneProps} from '@torob-ticket/graphics';
import type {TripMapController} from './use-trip-map';
import {RouteTimeline} from './route-timeline';
import {RouteDirectionControl} from './route-direction-control';
import {routeHeading} from './route-heading';
import {ProvinceBoundaryAsset} from './province-boundaries';
import styles from './trip-map.module.css';
const NO_DOTS:[]=[];
// Authored cartographic emphasis only; no population, inventory or ranking inference.
const MAJOR_CITIES=new Set(['tehran','mashhad','isfahan','shiraz','tabriz','istanbul','dubai','doha','london','paris','frankfurt','bangkok','kuala-lumpur','tokyo','new-york']);
const Scene=lazy(()=>import('@torob-ticket/graphics').then(module=>({default:module.RouteScene})));
const Dots=z.object({revision:z.string(),navigation:z.literal(false),dots:z.object({iran:z.array(GeoPointSchema).max(16000),world:z.array(GeoPointSchema).max(16000)})});
const Coordinate=z.tuple([z.number().finite(),z.number().finite()]);
const Ring=z.array(Coordinate).min(4).max(30000);
const Polygon=z.array(Ring).min(1).max(2000);
const Countries=z.object({features:z.array(z.object({properties:z.object({countryCode:z.string()}),geometry:z.discriminatedUnion('type',[z.object({type:z.literal('Polygon'),coordinates:Polygon}),z.object({type:z.literal('MultiPolygon'),coordinates:z.array(Polygon).min(1).max(2000)})])})).max(300)});
const ContextCities=z.object({navigation:z.literal(false),cities:z.array(z.object({id:z.string(),name:z.string(),point:GeoPointSchema,tier:z.union([z.literal(0),z.literal(1),z.literal(2)])})).max(150)});
const Paths=z.object({revision:z.string(),navigation:z.literal(false),illustrative:z.literal(true),paths:z.array(z.object({originPlaceId:z.string(),destinationPlaceId:z.string(),points:z.array(GeoPointSchema).min(2).max(1000),provenance:z.object({source:z.string(),revision:z.string(),illustrative:z.literal(true),navigation:z.literal(false)})})).max(1000)});
async function mapAssets(signal:AbortSignal) {
 const [dots,paths,countries,cities,provinces]=await Promise.all(['/geography/consumer-geography.json','/geography/route-geometry.json','/geography/world.geojson','/geography/world-context-cities.json','/geography/iran-provinces.json'].map(async path=>{const response=await fetch(path,{signal});if(!response.ok)throw new Error('bundled-map-unavailable');return response.json();}));
 const countriesParsed=Countries.parse(countries).features;
 return {dots:Dots.parse(dots),geometry:Paths.parse(paths),iran:countriesParsed.filter(country=>country.properties.countryCode==='IR'),provinceBoundaries:ProvinceBoundaryAsset.parse(provinces).boundaries,worldContext:{countries:countriesParsed,cities:ContextCities.parse(cities).cities}};
}
export function useDesktopMap() {
 const [desktop,setDesktop]=useState(()=>typeof matchMedia==='function'&&matchMedia('(min-width:1120px)').matches);
 useEffect(()=>{if(typeof matchMedia!=='function')return;const query=matchMedia('(min-width:1120px)');const update=()=>setDesktop(query.matches);query.addEventListener('change',update);update();return()=>query.removeEventListener('change',update);},[]);
 return desktop;
}
const labelFor=(map:TripMapController)=>map.view.progress===1?'ارجاع به فروشنده ثبت شده':map.view.selectedValid?'پیشنهاد برای مقایسه انتخاب شده':map.view.historical?'مسیر بررسی قبلی؛ بدون پیشنهاد قابل ادامه':map.view.inspection?'در حال بررسی این مسیر':map.view.progress===.35?'در حال مقایسه پیشنهادها':'مسیر کلی شهرها؛ پیش از انتخاب پیشنهاد';
function Direction({map}:{map:TripMapController}) {return <RouteDirectionControl value={map.view.direction} hasReturn={Boolean(map.view.itinerary?.return||!map.view.itinerary&&map.view.query.tripType==='round-trip'&&map.view.query.returnDate)} onChange={map.direction}/>;}
const HeadingFrame=forwardRef<HTMLDivElement,{heading:ReturnType<typeof routeHeading>;disabled:boolean}>(function HeadingFrame({heading,disabled},ref) {
 const present=useIsPresent();const policy=useMotionPolicy({disabled});
 const [,safeToRemove]=usePresence();
 const controls=useAnimationControls(),entered=useRef(false);
 useLayoutEffect(()=>{
  controls.stop();let cancelled=false;
  if(!present){const exit={opacity:0,y:policy.enabled?-7:0};if(!policy.enabled)controls.set(exit);else{const complete=()=>{if(!cancelled)safeToRemove?.();};void controls.start({...exit,transition:{duration:.3,ease:'easeOut'}}).then(complete,complete);}return()=>{cancelled=true;controls.stop();};}
  const fresh=!entered.current;entered.current=true;if(!policy.enabled||!fresh)controls.set({opacity:1,y:0});else{controls.set({opacity:0,y:9});void controls.start({opacity:1,y:0,transition:{duration:.3,ease:'easeOut'}});}return()=>controls.stop();
 },[controls,present,policy.enabled,safeToRemove]);
 useEffect(()=>{if(!present&&!policy.enabled)safeToRemove?.();},[present,policy.enabled,safeToRemove]);
 return <motion.div ref={ref} className={styles.headingFrame} aria-hidden={!present||undefined} data-map-heading-key={heading.key} initial={false} animate={controls} transition={{duration:policy.enabled?.3:0,ease:'easeOut'}}>
  <h2>{heading.nodes.map((node,index)=><span key={index} className={styles.headingCity}>{index>0&&<i aria-hidden="true">{heading.bidirectional?'↔':'←'}</i>}{node.label}{node.code&&<bdi className={styles.headingCode} dir="ltr">({node.code})</bdi>}</span>)}</h2>
  {heading.service&&<p className={styles.service}><span>{heading.service}</span>{heading.showCodeRoute&&heading.codes&&<bdi dir="ltr">{heading.codes}</bdi>}</p>}
 </motion.div>;
});
export function MapHeading({map,catalog,covered=false}:{map:TripMapController;catalog:CatalogSnapshot;covered?:boolean}) {
 const heading=routeHeading(map.presentationView,catalog);const policy=useMotionPolicy({covered});
 return <div className={styles.headingSwap} data-map-heading><AnimatePresence initial={false} mode="popLayout"><HeadingFrame key={heading.key} heading={heading} disabled={!policy.enabled}/></AnimatePresence></div>;
}
function RouteSummary({map,catalog}:{map:TripMapController;catalog:CatalogSnapshot}) {
 const view=map.view;const city=(id:string)=>catalog.cities.find(city=>city.id===id)?.name??'انتخاب نشده';const modes={flight:'پرواز',train:'قطار',bus:'اتوبوس'};
 const title=<h2>{city(view.direction==='return'?view.query.destinationCityId:view.query.originCityId)} <span aria-hidden="true">←</span> {city(view.direction==='return'?view.query.originCityId:view.query.destinationCityId)}</h2>;
 const committed=Boolean(view.inspection&&JSON.stringify(view.inspection.query)!==JSON.stringify(map.state.context.draft));
 return <><span className={styles.eyebrow}>{view.historical?'بررسی قبلی':view.inspection?committed?'سفر ثبت‌شده برای مقایسه':'مسیر پیشنهاد': 'انتخاب مسیر سفر'}</span>{title}<p>{modes[view.mode]} · {view.direction==='return'?'مسیر برگشت':'مسیر رفت'}{committed?' · با فرم ویرایش‌شده متفاوت است':''}</p></>;
}
export function TripMap({map,catalog,desktop,covered,onMotionChange,onHotelDock}:{map:TripMapController;catalog:CatalogSnapshot;desktop:boolean;covered:boolean;onMotionChange:(active:boolean)=>void;onHotelDock?:(element:HTMLDivElement|null)=>void}) {
 const assets=useQuery({queryKey:['consumer-map-assets'],queryFn:({signal})=>mapAssets(signal),enabled:desktop,staleTime:Infinity,retry:false,refetchOnWindowFocus:false});
 const [visible,setVisible]=useState(()=>!document.hidden);const [reduced,setReduced]=useState(()=>typeof matchMedia!=='function'||matchMedia('(prefers-reduced-motion:reduce)').matches);
 useEffect(()=>{if(typeof matchMedia!=='function')return;const visibility=()=>setVisible(!document.hidden);const query=matchMedia('(prefers-reduced-motion:reduce)');const motion=()=>setReduced(query.matches);document.addEventListener('visibilitychange',visibility);query.addEventListener('change',motion);return()=>{document.removeEventListener('visibilitychange',visibility);query.removeEventListener('change',motion);};},[]);
 const active=desktop&&!covered&&visible&&!reduced;
 const activity=useRef(active);activity.current=active;
 // Visible ambience owns the loop even after a finite route finishes or a
 // covered scene's cleanup reports its previous animation has stopped.
 useEffect(()=>{activity.current=active;onMotionChange(active);return()=>{activity.current=false;onMotionChange(false);};},[active,onMotionChange]);
 const view=map.presentationView;
 const origin=catalog.cities.find(city=>city.id===view.query.originCityId);const destination=catalog.cities.find(city=>city.id===view.query.destinationCityId);
 const presentationData=useMemo<Omit<NonNullable<RouteSceneProps['presentation']>,'active'|'reducedMotion'>>(()=>{
  const leg=view.itinerary&&(view.direction==='return'?view.itinerary.return:view.itinerary.outbound);
  const endpoints:Array<NonNullable<RouteSceneProps['presentation']>['endpoints'][number]>=[];
  const start=view.direction==='return'?destination:origin;const end=view.direction==='return'?origin:destination;
  const point=(placeId:string|undefined)=>catalog.places.find(place=>place.id===placeId)?.point;
  if(start)endpoints.push({id:start.id,name:start.name,point:point(leg?.segments[0]?.originPlaceId)??start.point,role:'origin'});
  if(end)endpoints.push({id:end.id,name:end.name,point:point(leg?.segments.at(-1)?.destinationPlaceId)??end.point,role:'destination'});
  return {key:map.presentationSceneKey,endpoints,majorCities:catalog.cities.filter(city=>MAJOR_CITIES.has(city.id)&&(view.scope==='international'||city.countryCode==='IR')).map(city=>city.point),cityNames:Object.fromEntries(catalog.cities.map(city=>[city.id,city.name]))};
 },[origin,destination,view.itinerary,view.direction,view.scope,map.presentationSceneKey,catalog]);
 const presentation={...presentationData,active,reducedMotion:reduced};
 const capturedCurrent=map.isPresentationCurrent;
 const reportMotion=()=>onMotionChange(activity.current);
 if(!desktop)return null;
 return <aside className={styles.map} aria-label="نقشه سفر" data-map-itinerary={view.itinerary?.itineraryId} data-map-direction={view.direction} data-map-progress={view.progress} data-map-fit={map.fitKey} data-map-historical={view.historical}>
  <header className={styles.header}><MapHeading map={map} catalog={catalog} covered={covered}/></header>
  <div className={styles.scene}>
   <Suspense fallback={<p role="status">آماده‌سازی نقشه…</p>}><Scene featherGeography labelsVisible={false} showControls={false} places={catalog.places} dots={assets.data?(view.scope==='domestic'?assets.data.dots.dots.iran:assets.data.dots.dots.world):NO_DOTS} provinceBoundaries={assets.data?.provinceBoundaries} paths={assets.data?.geometry.paths} worldContext={view.scope==='international'?assets.data?.worldContext:undefined} geography={view.scope==='domestic'?assets.data?.iran:undefined} scope={view.scope} itinerary={view.itinerary} presentation={presentation} direction={view.direction} fitMode={map.state.cameraMode} fitBothDirections fitKey={map.fitKey} originKey="consumer-map" projection={map.state.projection} progress={view.progress} initialCamera={map.initialCamera} onCameraIntentChange={map.savePresentationCamera} isCurrent={capturedCurrent} animateProgress={active} onMotionChange={reportMotion} motionKey={map.presentationSceneKey} showTimeline={false} showNotes={false}/></Suspense>
  </div>
  {assets.error&&<p role="status">داده محلی نقشه در دسترس نیست؛ انتخاب شهر در فرم سفر همچنان قابل استفاده است. <Button variant="quiet" onPress={()=>void assets.refetch()}>تلاش دوباره برای نقشه</Button></p>}
  <div ref={onHotelDock} className={styles.hotelDock} data-map-hotel-dock />
 </aside>;
}
export function MobileRoutePanel({map,catalog}:{map:TripMapController;catalog:CatalogSnapshot}) {
 const {view}=map;
 if(!view.itinerary)return null;
 return <section className={styles.mobile} aria-label="جزئیات مسیر سفر" data-mobile-itinerary={view.itinerary?.itineraryId} data-map-progress={view.progress}><div className={styles.mobileSummary}><RouteSummary map={map} catalog={catalog}/><span>{labelFor(map)}</span></div><Direction map={map}/><div className={styles.mobileDetails}>{view.itinerary?<details><summary>نمایش توقف‌ها و زمان‌های مسیر {view.direction==='return'?'برگشت':'رفت'}</summary><RouteTimeline itinerary={view.itinerary} direction={view.direction} catalog={catalog}/></details>:<p>برای زمان‌ها و توقف‌های دقیق، یکی از پیشنهادها را بررسی کنید.</p>}</div></section>;
}
