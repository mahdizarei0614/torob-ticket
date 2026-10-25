import type {MapOptions} from 'maplibre-gl';
import {GeoPointSchema,type GeoPoint} from '@torob-ticket/contracts';
export type MapEventName='load'|'style.load'|'click'|'error'|'webglcontextlost'|'idle'|'moveend';
export interface MapPort {on:(name:MapEventName,callback:(event:unknown)=>void)=>unknown;off:(name:MapEventName,callback:(event:unknown)=>void)=>unknown;remove:()=>void;resize:()=>unknown;setStyle:(url:string)=>unknown;getCenter:()=>{lng:number;lat:number};getZoom:()=>number;jumpTo:(options:{center:[number,number];zoom:number;pitch:number;bearing:number})=>unknown;}
export interface MarkerPort {setLngLat:(point:[number,number])=>MarkerPort;addTo:(map:MapPort)=>MarkerPort;remove:()=>void;getLngLat:()=>{lng:number;lat:number};on:(name:'dragend',callback:()=>void)=>unknown;off:(name:'dragend',callback:()=>void)=>unknown;}
export interface FreeMapSdk {createMap:(element:HTMLElement,options:Omit<MapOptions,'container'>)=>MapPort;createMarker:(element:HTMLElement,draggable:boolean)=>MarkerPort;}
export interface MapChoice {id:string;name:string;point:GeoPoint;number?:number}
export interface MapCamera {center:GeoPoint;zoom:number}
export type FreeMapStatus='loading'|'ready'|'unavailable';
export interface FreeMapInput {center:GeoPoint;appearance:'light'|'dark';choices:MapChoice[];point?:GeoPoint;isCurrent:()=>boolean;onPoint:(point:GeoPoint)=>void;onStatus:(status:FreeMapStatus)=>void;markerClassName:string;camera?:MapCamera;timeoutMs?:number;}
export interface FreeMapController {ready:Promise<boolean>;update:(input:Pick<FreeMapInput,'appearance'|'choices'|'point'>)=>void;getCamera:()=>MapCamera|undefined;dispose:()=>void;}
export const FREE_MAP_STYLES={light:'https://vector.openstreetmap.org/styles/shortbread/colorful.json',dark:'https://vector.openstreetmap.org/styles/shortbread/shadow.json'} as const;
let active:FreeMapController|undefined;
/** Controlled SDK seam; a disposed async import can never construct a later map. */
export function createFreeMap(element:HTMLElement,input:FreeMapInput,load:()=>Promise<FreeMapSdk>):FreeMapController{
 active?.dispose();let closed=false,map:MapPort|undefined,sdk:FreeMapSdk|undefined,timer:ReturnType<typeof setTimeout>|undefined,observer:ResizeObserver|undefined;
 let appearance=input.appearance,choices=input.choices,point=input.point,savedCamera:MapCamera|undefined=input.camera,markerKey='';
 let selected:MarkerPort|undefined;const markers:{marker:MarkerPort;stop:()=>void}[]=[];const listeners:{name:MapEventName;fn:(event:unknown)=>void}[]=[];
 let settle!:(ready:boolean)=>void;const ready=new Promise<boolean>(resolve=>{settle=resolve;});
 const owns=()=>!closed&&active===controller&&input.isCurrent();
 const notify=(status:FreeMapStatus)=>{if(owns())input.onStatus(status);};
 function stopTimer(){clearTimeout(timer);timer=undefined;}
 function camera(){return map?{center:{latitude:map.getCenter().lat,longitude:map.getCenter().lng},zoom:map.getZoom()}:savedCamera;}
 function reportCamera(){if(!owns())return;const value=camera();if(value)element.dataset['freeMapCamera']=JSON.stringify(value);}
 function removeMarkers(){for(const item of markers.splice(0)){item.stop();item.marker.remove();}selected=undefined;}
 function cleanup(){stopTimer();observer?.disconnect();observer=undefined;for(const {name,fn}of listeners.splice(0))map?.off(name,fn);removeMarkers();if(map){savedCamera=camera();map.remove();map=undefined;}element.replaceChildren();}
 function fail(){if(closed)return;notify('unavailable');cleanup();closed=true;if(active===controller)active=undefined;settle(false);}
 function bounded(){stopTimer();timer=setTimeout(fail,input.timeoutMs??15000);}
 function emitPoint(value:unknown){if(!owns())return;const parsed=GeoPointSchema.safeParse(value);if(parsed.success)input.onPoint(parsed.data);}
 function addMarker(choice:MapChoice,draggable=false){
  if(!sdk||!map)return;const button=document.createElement('button');button.type='button';button.className=input.markerClassName;button.textContent=choice.number===undefined?(draggable?'●':'•'):new Intl.NumberFormat('fa-IR').format(choice.number);button.title=choice.name;button.setAttribute('aria-label',choice.name+'، انتخاب موقعیت مرجع');button.dataset['mapChoiceId']=choice.id;if(draggable)button.dataset['customPoint']='true';
  const marker=sdk.createMarker(button,draggable).setLngLat([choice.point.longitude,choice.point.latitude]).addTo(map);
  const click=(event:MouseEvent)=>{event.stopPropagation();const p=draggable?marker.getLngLat():{lat:choice.point.latitude,lng:choice.point.longitude};emitPoint({latitude:p.lat,longitude:p.lng});};
  const drag=()=>{const p=marker.getLngLat();emitPoint({latitude:p.lat,longitude:p.lng});};button.addEventListener('click',click);if(draggable)marker.on('dragend',drag);
  markers.push({marker,stop:()=>{button.removeEventListener('click',click);if(draggable)marker.off('dragend',drag);}});if(draggable)selected=marker;
 }
 function drawMarkers(){if(!sdk||!map)return;const key=JSON.stringify(choices);if(key!==markerKey){removeMarkers();markerKey=key;for(const choice of choices)addMarker(choice);}
  if(point){if(selected)selected.setLngLat([point.longitude,point.latitude]);else addMarker({id:'custom-point',name:'نقطه انتخابی موقت',point},true);}else if(selected){const item=markers.find(item=>item.marker===selected);item?.stop();selected.remove();const index=markers.findIndex(item=>item.marker===selected);if(index>=0)markers.splice(index,1);selected=undefined;}}
 function on(name:MapEventName,fn:(event:unknown)=>void){map?.on(name,fn);listeners.push({name,fn});}
 const controller:FreeMapController={ready,update(next){if(closed)return;choices=next.choices;point=next.point;if(map&&next.appearance!==appearance){savedCamera=camera();appearance=next.appearance;notify('loading');bounded();map.setStyle(FREE_MAP_STYLES[appearance]);if(savedCamera)map.jumpTo({center:[savedCamera.center.longitude,savedCamera.center.latitude],zoom:savedCamera.zoom,pitch:0,bearing:0});element.dataset['freeMapAppearance']=appearance;}else appearance=next.appearance;drawMarkers();},getCamera:camera,dispose(){if(closed)return;closed=true;cleanup();if(active===controller)active=undefined;settle(false);}};
 active=controller;notify('loading');bounded();
 let pending:Promise<FreeMapSdk>;try{pending=load();}catch{fail();return controller;}
 void pending.then(runtime=>{
  if(!owns())return;
  sdk=runtime;const initial=savedCamera??{center:input.center,zoom:12.5};
  map=sdk.createMap(element,{style:FREE_MAP_STYLES[appearance],center:[initial.center.longitude,initial.center.latitude],zoom:initial.zoom,pitch:0,bearing:0,maxPitch:0,dragRotate:false,touchPitch:false,attributionControl:{compact:false},locale:{'NavigationControl.ZoomIn':'بزرگ‌نمایی','NavigationControl.ZoomOut':'کوچک‌نمایی','Map.Title':'نقشه انتخاب موقعیت'}});
  element.dataset['freeMapAppearance']=appearance;
  on('click',event=>{if(event&&typeof event==='object'&&'lngLat'in event){const p=event.lngLat as {lng?:unknown;lat?:unknown};emitPoint({longitude:typeof p.lng==='number'&&Number.isFinite(p.lng)?((p.lng+180)%360+360)%360-180:p.lng,latitude:p.lat});}});
  const loaded=()=>{if(!owns())return;stopTimer();notify('ready');reportCamera();settle(true);};
  on('load',loaded);on('idle',loaded);on('style.load',()=>{if(owns()&&savedCamera)map?.jumpTo({center:[savedCamera.center.longitude,savedCamera.center.latitude],zoom:savedCamera.zoom,pitch:0,bearing:0});});on('moveend',reportCamera);on('error',fail);on('webglcontextlost',fail);
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>{if(owns())map?.resize();});observer.observe(element);}
  drawMarkers();reportCamera();
 }).catch(fail);
 return controller;
}
