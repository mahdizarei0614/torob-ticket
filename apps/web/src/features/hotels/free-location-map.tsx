import {useLayoutEffect,useRef,useState} from 'react';
import type {GeoPoint} from '@torob-ticket/contracts';
import {Button,useTheme} from '@torob-ticket/ui';
import {createFreeMap,type FreeMapController,type FreeMapInput,type FreeMapStatus,type MapCamera,type MapChoice} from './free-map-adapter';
import {loadFreeMapSdk} from './free-map-sdk';
import styles from './hotels.module.css';
export interface FreeLocationMapProps {identity:string;center:GeoPoint;choices:MapChoice[];point?:GeoPoint;isCurrent:()=>boolean;onPoint:(point:GeoPoint)=>void;}
/** One provider map per live point transaction; vendor loading is explicitly optional. */
export function FreeLocationMap(props:FreeLocationMapProps){
 const {appearance}=useTheme();const element=useRef<HTMLDivElement>(null),controller=useRef<FreeMapController|undefined>(undefined),camera=useRef<MapCamera|undefined>(undefined);const latest=useRef(props);latest.current=props;
 const [status,setStatus]=useState<FreeMapStatus>('loading'),[attempt,setAttempt]=useState(0);
 useLayoutEffect(()=>{if(!element.current)return;let live=true;const options:FreeMapInput={center:latest.current.center,appearance,choices:latest.current.choices,point:latest.current.point,isCurrent:()=>live&&latest.current.isCurrent(),onPoint:p=>{if(live&&latest.current.isCurrent())latest.current.onPoint(p);},onStatus:value=>{if(live&&latest.current.isCurrent())setStatus(value);},markerClassName:styles.mapMarker!,camera:camera.current};
  const owned=createFreeMap(element.current,options,loadFreeMapSdk);controller.current=owned;
  return()=>{live=false;camera.current=owned.getCamera();owned.dispose();if(controller.current===owned)controller.current=undefined;};
 },[props.identity,attempt]);
 useLayoutEffect(()=>{controller.current?.update({appearance,choices:props.choices,point:props.point});},[appearance,props.choices,props.point]);
 return <section className={styles.freeMap} aria-label="نقشه شهری انتخاب موقعیت" data-free-map-status={status} data-free-map-provider="OpenFreeMap">
  <div ref={element} className={styles.mapRoot} data-free-map-container dir="ltr"/>
  {status==='loading'&&<p role="status" className={styles.mapStatus}>در حال دریافت نقشه شهری…</p>}
  {status==='unavailable'&&<div className={styles.mapUnavailable} role="status"><strong>نقشه شهری در دسترس نیست.</strong><p>با نشانه‌های فهرست یا مختصات می‌توانید موقعیت را انتخاب کنید.</p><Button variant="secondary" onPress={()=>{if(latest.current.isCurrent())setAttempt(n=>n+1);}}>تلاش دوباره برای نقشه شهری</Button></div>}
  <p className={styles.mapCredits}><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · داده‌های <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></p>
 </section>;
}
