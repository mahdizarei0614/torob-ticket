import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {GeoPointSchema,type CatalogSnapshot} from '@torob-ticket/contracts';
import {Button} from '@torob-ticket/ui';
import type {RouteSceneProps} from '@torob-ticket/graphics';
import {cityChoices} from './map-state';
import type {TripMapController} from './use-trip-map';
import {RouteTimeline} from './route-timeline';
import {RouteDirectionControl} from './route-direction-control';
import styles from './trip-map.module.css';
const NO_DOTS:[]=[];
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
function RouteSummary({map,catalog}:{map:TripMapController;catalog:CatalogSnapshot}) {
 const {view}=map;const city=(id:string)=>catalog.cities.find(city=>city.id===id)?.name??'انتخاب نشده';const modes={flight:'پرواز',train:'قطار',bus:'اتوبوس'};
 const committed=Boolean(view.inspection&&JSON.stringify(view.inspection.query)!==JSON.stringify(map.state.context.draft));
 return <><span className={styles.eyebrow}>{view.historical?'بررسی قبلی':view.inspection?committed?'سفر ثبت‌شده برای مقایسه':'مسیر پیشنهاد': 'انتخاب مسیر سفر'}</span><h2>{city(view.direction==='return'?view.query.destinationCityId:view.query.originCityId)} <span aria-hidden="true">←</span> {city(view.direction==='return'?view.query.originCityId:view.query.destinationCityId)}</h2><p>{modes[view.mode]} · {view.direction==='return'?'مسیر برگشت':'مسیر رفت'}{committed?' · با فرم ویرایش‌شده متفاوت است':''}</p></>;
}
export function TripMap({map,catalog,desktop,covered,onMotionChange}:{map:TripMapController;catalog:CatalogSnapshot;desktop:boolean;covered:boolean;onMotionChange:(active:boolean)=>void}) {
 const assets=useQuery({queryKey:['consumer-map-assets'],queryFn:({signal})=>mapAssets(signal),enabled:desktop,staleTime:Infinity,retry:false,refetchOnWindowFocus:false});
 const [target,setTarget]=useState<'origin'|'destination'>('destination');const targetRef=useRef({value:target,revision:0});
 const [visible,setVisible]=useState(()=>!document.hidden);const [reduced,setReduced]=useState(()=>typeof matchMedia!=='function'||matchMedia('(prefers-reduced-motion:reduce)').matches);
 useEffect(()=>{if(typeof matchMedia!=='function')return;const visibility=()=>setVisible(!document.hidden);const query=matchMedia('(prefers-reduced-motion:reduce)');const motion=()=>setReduced(query.matches);document.addEventListener('visibilitychange',visibility);query.addEventListener('change',motion);return()=>{document.removeEventListener('visibilitychange',visibility);query.removeEventListener('change',motion);};},[]);
 const active=desktop&&!covered&&visible&&!reduced;
 const activity=useRef(active);activity.current=active;
 useEffect(()=>{if(!active)onMotionChange(false);return()=>onMotionChange(false);},[active]);
 const view=map.view;const draft=map.state.context.draft;
 const editNetwork=JSON.stringify([draft.mode,draft.scope,draft.originCityId,draft.destinationCityId]);const displayNetwork=JSON.stringify([view.query.mode,view.query.scope,view.query.originCityId,view.query.destinationCityId]);
 const editable=editNetwork===displayNetwork;
 const choices=useMemo(()=>cityChoices(editable?draft:view.query,catalog,target).map(choice=>({...choice,enabled:editable&&choice.enabled})),[catalog,editable,editNetwork,displayNetwork,target]);
 const controlRevision=targetRef.current.revision;
 const choose=useMemo(()=> (id:string)=>{if(!map.isCurrent()||targetRef.current.revision!==controlRevision||!editable)return;map.chooseCity(target,id);if(target==='origin'){targetRef.current={value:'destination',revision:controlRevision+1};setTarget('destination');}},[map.lease,map.fitKey,map.sceneKey,controlRevision,editable,target]);
 const origin=catalog.cities.find(city=>city.id===view.query.originCityId);const destination=catalog.cities.find(city=>city.id===view.query.destinationCityId);
 const illustrative=useMemo<RouteSceneProps['illustrative']>(()=>!view.itinerary&&origin&&destination?{points:view.direction==='return'?[destination.point,origin.point]:[origin.point,destination.point],mode:view.mode,label:'مسیر کلی شهرها؛ برنامه یا قیمت یک بلیت نیست.'}:undefined,[view.itinerary,origin,destination,view.direction,view.mode]);
 const capturedCurrent=map.isCurrent;
 const reportMotion=(running:boolean)=>{if(capturedCurrent()&&(!running||activity.current))onMotionChange(running);};
 if(!desktop)return null;
 return <aside className={styles.map} aria-label="نقشه تعاملی سفر" data-map-itinerary={view.itinerary?.itineraryId} data-map-direction={view.direction} data-map-progress={view.progress} data-map-fit={map.fitKey} data-map-historical={view.historical}>
  <header className={styles.header}><RouteSummary map={map} catalog={catalog}/><Direction map={map}/></header>
  <div className={styles.cityControls}><fieldset><legend>انتخاب شهر روی نقشه</legend>{(['origin','destination'] as const).map(value=><label key={value}><input type="radio" name="map-city-target" checked={target===value} onChange={()=>{if(!capturedCurrent())return;targetRef.current={value,revision:targetRef.current.revision+1};setTarget(value);}}/>{value==='origin'?'انتخاب مبدا':'انتخاب مقصد'}</label>)}</fieldset>{!editable&&<Button variant="quiet" onPress={map.clear}>نمایش شهرهای فرم</Button>}</div>
  <div className={styles.scene}>
   <Suspense fallback={<p role="status">آماده‌سازی نقشه نقطه‌ای…</p>}><Scene portalLabels labelsVisible={visible&&!covered} places={catalog.places} dots={assets.data?(view.scope==='domestic'?assets.data.dots.dots.iran:assets.data.dots.dots.world):NO_DOTS} paths={assets.data?.geometry.paths} scope={view.scope} itinerary={view.itinerary} illustrative={illustrative} direction={view.direction} cities={choices} onCitySelect={editable?choose:undefined} fitMode={map.state.cameraMode} fitBothDirections fitKey={map.fitKey} originKey="consumer-map" projection={map.state.projection} progress={view.progress} initialCamera={map.initialCamera} onCameraIntentChange={map.saveCamera} isCurrent={capturedCurrent} animateProgress={active} onMotionChange={reportMotion} motionKey={map.sceneKey} showTimeline={false} showNotes={false}/></Suspense>
  </div>
  {assets.error&&<p role="status">داده محلی نقشه در دسترس نیست؛ انتخاب شهر و جزئیات سفر همچنان قابل استفاده است. <Button variant="quiet" onPress={()=>void assets.refetch()}>تلاش دوباره برای نقشه</Button></p>}
  <footer className={styles.footer}><div className={styles.progress}><span>{labelFor(map)}</span><output aria-label="مرحله مقایسه سفر">{new Intl.NumberFormat('fa-IR',{style:'percent',maximumFractionDigits:0}).format(view.progress)}</output></div><p>مسیر روی نقشه تقریبی است؛ برای جزئیات، توقف‌ها و زمان‌های سفر را ببینید.</p>{view.itinerary&&<details className={styles.details}><summary>توقف‌ها و جزئیات مسیر {view.direction==='return'?'برگشت':'رفت'}</summary><RouteTimeline itinerary={view.itinerary} direction={view.direction} catalog={catalog}/></details>}</footer>
 </aside>;
}
export function MobileRoutePanel({map,catalog}:{map:TripMapController;catalog:CatalogSnapshot}) {
 const {view}=map;
 return <section className={styles.mobile} aria-label="جزئیات مسیر سفر" data-mobile-itinerary={view.itinerary?.itineraryId} data-map-progress={view.progress}><div className={styles.mobileSummary}><RouteSummary map={map} catalog={catalog}/><span>{labelFor(map)}</span></div><Direction map={map}/><div className={styles.mobileDetails}>{view.itinerary?<details><summary>نمایش توقف‌ها و زمان‌های مسیر {view.direction==='return'?'برگشت':'رفت'}</summary><RouteTimeline itinerary={view.itinerary} direction={view.direction} catalog={catalog}/></details>:<p>برای زمان‌ها و توقف‌های دقیق، یکی از پیشنهادها را بررسی کنید.</p>}</div></section>;
}
