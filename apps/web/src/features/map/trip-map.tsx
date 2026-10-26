import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {GeoPointSchema,type CatalogSnapshot} from '@torob-ticket/contracts';
import {Button} from '@torob-ticket/ui';
import type {RouteSceneProps} from '@torob-ticket/graphics';
import type {TripMapController} from './use-trip-map';
import {RouteTimeline} from './route-timeline';
import {RouteDirectionControl} from './route-direction-control';
import styles from './trip-map.module.css';
const NO_DOTS:[]=[];
// Authored cartographic emphasis only; no population, inventory or ranking inference.
const MAJOR_CITIES=new Set(['tehran','mashhad','isfahan','shiraz','tabriz','istanbul','dubai','doha','london','paris','frankfurt','bangkok','kuala-lumpur','tokyo','new-york']);
const Scene=lazy(()=>import('@torob-ticket/graphics').then(module=>({default:module.RouteScene})));
const Dots=z.object({revision:z.string(),navigation:z.literal(false),dots:z.object({iran:z.array(GeoPointSchema).max(16000),world:z.array(GeoPointSchema).max(16000)})});
const Paths=z.object({revision:z.string(),navigation:z.literal(false),illustrative:z.literal(true),paths:z.array(z.object({originPlaceId:z.string(),destinationPlaceId:z.string(),points:z.array(GeoPointSchema).min(2).max(1000),provenance:z.object({source:z.string(),revision:z.string(),illustrative:z.literal(true),navigation:z.literal(false)})})).max(1000)});
async function mapAssets(signal:AbortSignal) {
 const [dots,paths]=await Promise.all(['/geography/consumer-geography.json','/geography/route-geometry.json'].map(async path=>{const response=await fetch(path,{signal});if(!response.ok)throw new Error('bundled-map-unavailable');return response.json();}));
 return {dots:Dots.parse(dots),geometry:Paths.parse(paths)};
}
export function useDesktopMap() {
 const [desktop,setDesktop]=useState(()=>typeof matchMedia==='function'&&matchMedia('(min-width:1120px)').matches);
 useEffect(()=>{if(typeof matchMedia!=='function')return;const query=matchMedia('(min-width:1120px)');const update=()=>setDesktop(query.matches);query.addEventListener('change',update);update();return()=>query.removeEventListener('change',update);},[]);
 return desktop;
}
const labelFor=(map:TripMapController)=>map.view.progress===1?'ارجاع به فروشنده ثبت شده':map.view.selectedValid?'پیشنهاد برای مقایسه انتخاب شده':map.view.historical?'مسیر بررسی قبلی؛ بدون پیشنهاد قابل ادامه':map.view.inspection?'در حال بررسی این مسیر':map.view.progress===.35?'در حال مقایسه پیشنهادها':'مسیر کلی شهرها؛ پیش از انتخاب پیشنهاد';
function Direction({map}:{map:TripMapController}) {return <RouteDirectionControl value={map.view.direction} hasReturn={Boolean(map.view.itinerary?.return||!map.view.itinerary&&map.view.query.tripType==='round-trip'&&map.view.query.returnDate)} onChange={map.direction}/>;}
function RouteSummary({map,catalog,compact=false}:{map:TripMapController;catalog:CatalogSnapshot;compact?:boolean}) {
 const view=compact?map.presentationView:map.view;const city=(id:string)=>catalog.cities.find(city=>city.id===id)?.name??'انتخاب نشده';const modes={flight:'پرواز',train:'قطار',bus:'اتوبوس'};
 const title=<h2>{city(view.direction==='return'?view.query.destinationCityId:view.query.originCityId)} <span aria-hidden="true">←</span> {city(view.direction==='return'?view.query.originCityId:view.query.destinationCityId)}</h2>;
 if(compact)return title;
 const committed=Boolean(view.inspection&&JSON.stringify(view.inspection.query)!==JSON.stringify(map.state.context.draft));
 return <><span className={styles.eyebrow}>{view.historical?'بررسی قبلی':view.inspection?committed?'سفر ثبت‌شده برای مقایسه':'مسیر پیشنهاد': 'انتخاب مسیر سفر'}</span>{title}<p>{modes[view.mode]} · {view.direction==='return'?'مسیر برگشت':'مسیر رفت'}{committed?' · با فرم ویرایش‌شده متفاوت است':''}</p></>;
}
export function TripMap({map,catalog,desktop,covered,onMotionChange}:{map:TripMapController;catalog:CatalogSnapshot;desktop:boolean;covered:boolean;onMotionChange:(active:boolean)=>void}) {
 const assets=useQuery({queryKey:['consumer-map-assets'],queryFn:({signal})=>mapAssets(signal),enabled:desktop,staleTime:Infinity,retry:false,refetchOnWindowFocus:false});
 const [visible,setVisible]=useState(()=>!document.hidden);const [reduced,setReduced]=useState(()=>typeof matchMedia!=='function'||matchMedia('(prefers-reduced-motion:reduce)').matches);
 useEffect(()=>{if(typeof matchMedia!=='function')return;const visibility=()=>setVisible(!document.hidden);const query=matchMedia('(prefers-reduced-motion:reduce)');const motion=()=>setReduced(query.matches);document.addEventListener('visibilitychange',visibility);query.addEventListener('change',motion);return()=>{document.removeEventListener('visibilitychange',visibility);query.removeEventListener('change',motion);};},[]);
 const active=desktop&&!covered&&visible&&!reduced;
 const activity=useRef(active);activity.current=active;
 useEffect(()=>{if(!active)onMotionChange(false);return()=>onMotionChange(false);},[active]);
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
 const reportMotion=(running:boolean)=>{if(capturedCurrent()&&(!running||activity.current))onMotionChange(running);};
 if(!desktop)return null;
 return <aside className={styles.map} aria-label="نقشه سفر" data-map-itinerary={view.itinerary?.itineraryId} data-map-direction={view.direction} data-map-progress={view.progress} data-map-fit={map.fitKey} data-map-historical={view.historical}>
  <header className={styles.header}><RouteSummary map={map} catalog={catalog} compact/></header>
  <div className={styles.scene}>
   <Suspense fallback={<p role="status">آماده‌سازی نقشه…</p>}><Scene labelsVisible={false} showControls={false} places={catalog.places} dots={assets.data?(view.scope==='domestic'?assets.data.dots.dots.iran:assets.data.dots.dots.world):NO_DOTS} paths={assets.data?.geometry.paths} scope={view.scope} itinerary={view.itinerary} presentation={presentation} direction={view.direction} fitMode={map.state.cameraMode} fitBothDirections fitKey={map.fitKey} originKey="consumer-map" projection={map.state.projection} progress={view.progress} initialCamera={map.initialCamera} onCameraIntentChange={map.savePresentationCamera} isCurrent={capturedCurrent} animateProgress={active} onMotionChange={reportMotion} motionKey={map.presentationSceneKey} showTimeline={false} showNotes={false}/></Suspense>
  </div>
  {assets.error&&<p role="status">داده محلی نقشه در دسترس نیست؛ انتخاب شهر در فرم سفر همچنان قابل استفاده است. <Button variant="quiet" onPress={()=>void assets.refetch()}>تلاش دوباره برای نقشه</Button></p>}

 </aside>;
}
export function MobileRoutePanel({map,catalog}:{map:TripMapController;catalog:CatalogSnapshot}) {
 const {view}=map;
 return <section className={styles.mobile} aria-label="جزئیات مسیر سفر" data-mobile-itinerary={view.itinerary?.itineraryId} data-map-progress={view.progress}><div className={styles.mobileSummary}><RouteSummary map={map} catalog={catalog}/><span>{labelFor(map)}</span></div><Direction map={map}/><div className={styles.mobileDetails}>{view.itinerary?<details><summary>نمایش توقف‌ها و زمان‌های مسیر {view.direction==='return'?'برگشت':'رفت'}</summary><RouteTimeline itinerary={view.itinerary} direction={view.direction} catalog={catalog}/></details>:<p>برای زمان‌ها و توقف‌های دقیق، یکی از پیشنهادها را بررسی کنید.</p>}</div></section>;
}
