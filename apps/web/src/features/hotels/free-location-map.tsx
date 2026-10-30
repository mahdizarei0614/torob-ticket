import {useLayoutEffect,useRef,useState} from 'react';
import type {GeoPoint} from '@torob-ticket/contracts';
import {Button,useTheme,useMotionPolicy} from '@torob-ticket/ui';
import {createFreeMap,type FreeMapController,type FreeMapInput,type FreeMapStatus,type MapCamera,type MapChoice} from './free-map-adapter';
import {loadFreeMapSdk} from './free-map-sdk';
import styles from './hotels.module.css';
import mapStyles from './hotel-map.module.css';
export interface FreeLocationMapProps {identity:string;center:GeoPoint;choices:MapChoice[];point?:GeoPoint;isCurrent:()=>boolean;onPoint:(point:GeoPoint)=>void;variant?:'picker'|'discovery';active?:boolean;pickingPoint?:boolean;selectedHotelId?:string;onSelectHotel?:(hotelId:string)=>void;}
/** One lazy provider map per arrival context; selections and ordering update in place. */
export function FreeLocationMap(props:FreeLocationMapProps){
 const {appearance}=useTheme(),policy=useMotionPolicy();const element=useRef<HTMLDivElement>(null),controller=useRef<FreeMapController|undefined>(undefined),camera=useRef<MapCamera|undefined>(undefined),identity=useRef(props.identity);const latest=useRef(props);latest.current=props;const discovery=props.variant==='discovery';
 const [status,setStatus]=useState<FreeMapStatus>('loading'),[attempt,setAttempt]=useState(0);
 useLayoutEffect(()=>{if(identity.current!==props.identity){camera.current=undefined;identity.current=props.identity;}if(!element.current||props.active===false)return;let live=true;const current=()=>live&&latest.current.active!==false&&latest.current.isCurrent();const options:FreeMapInput={center:latest.current.center,appearance,choices:latest.current.choices,point:latest.current.point,isCurrent:current,onPoint:p=>{if(current())latest.current.onPoint(p);},onSelectHotel:id=>{if(current())latest.current.onSelectHotel?.(id);},onStatus:value=>{if(current())setStatus(value);},markerClassName:discovery?mapStyles.marker!:styles.mapMarker!,camera:camera.current,discovery,pickingPoint:latest.current.pickingPoint,selectedHotelId:latest.current.selectedHotelId,motionEnabled:policy.enabled};
  const owned=createFreeMap(element.current,options,loadFreeMapSdk);controller.current=owned;
  return()=>{live=false;camera.current=owned.getCamera();owned.dispose();if(controller.current===owned)controller.current=undefined;};
 },[props.identity,props.active,attempt,discovery]);
 useLayoutEffect(()=>{controller.current?.update({appearance,choices:props.choices,point:props.point,pickingPoint:props.pickingPoint,selectedHotelId:props.selectedHotelId,motionEnabled:policy.enabled});},[appearance,props.choices,props.point,props.pickingPoint,props.selectedHotelId,policy.enabled]);
 return <section className={discovery?mapStyles.frame:styles.freeMap} aria-label={discovery?'نقشه اقامتگاه‌ها و نقطه رسیدن':'نقشه شهری انتخاب موقعیت'} data-hotel-map={discovery||undefined} data-free-map-active={props.active!==false} data-free-map-status={status} data-free-map-provider="OpenStreetMap" data-selected-hotel-id={props.selectedHotelId} data-picking-point={discovery?Boolean(props.pickingPoint):undefined}>
  <div ref={element} className={discovery?mapStyles.root:styles.mapRoot} data-free-map-container dir="ltr"/>
  {status==='loading'&&<p role="status" className={discovery?mapStyles.status:styles.mapStatus}>در حال دریافت نقشه شهری…</p>}
  {status==='unavailable'&&<div className={discovery?mapStyles.unavailable:styles.mapUnavailable} role="status"><strong>نقشه شهری در دسترس نیست.</strong><p>{discovery?'اقامتگاه‌ها و قیمت‌ها در کارت‌های پایین در دسترس‌اند.':'با نشانه‌های فهرست یا مختصات می‌توانید موقعیت را انتخاب کنید.'}</p>{discovery&&props.pickingPoint&&<div className={mapStyles.fallback} aria-label="موقعیت‌های مرجع در دسترس">{props.choices.map(choice=><Button key={choice.id} variant="quiet" onPress={()=>{const current=latest.current;if(current.active!==false&&current.identity===props.identity&&current.pickingPoint&&current.isCurrent()&&current.choices.some(item=>item.id===choice.id&&item.point.latitude===choice.point.latitude&&item.point.longitude===choice.point.longitude))current.onPoint(choice.point);}}>{choice.name}</Button>)}</div>}<Button variant="secondary" onPress={()=>{if(latest.current.active!==false&&latest.current.isCurrent())setAttempt(n=>n+1);}}>تلاش دوباره برای نقشه شهری</Button></div>}
  <p className={discovery?mapStyles.credits:styles.mapCredits}>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · سبک <a href="https://github.com/versatiles-org/versatiles-style" target="_blank" rel="noreferrer">VersaTiles</a></p>
 </section>;
}
