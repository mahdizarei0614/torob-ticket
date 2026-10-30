import type {MapOptions} from 'maplibre-gl';
import {GeoPointSchema,type GeoPoint,type Mode} from '@torob-ticket/contracts';
import {layoutMapLabels,type MapLabelInput,type MapLabelRect,type MapPixel} from './free-map-label-layout';

export type MapEventName='load'|'style.load'|'click'|'error'|'webglcontextlost'|'idle'|'move'|'moveend'|'resize';
export interface MapPort {
 on:(name:MapEventName,callback:(event:unknown)=>void)=>unknown;
 off:(name:MapEventName,callback:(event:unknown)=>void)=>unknown;
 remove:()=>void;resize:()=>unknown;setStyle:(url:string)=>unknown;stop?:()=>unknown;
 getCenter:()=>{lng:number;lat:number};getZoom:()=>number;
 jumpTo:(options:{center:[number,number];zoom:number;pitch:number;bearing:number})=>unknown;
 fitBounds?:(bounds:[[number,number],[number,number]],options:{padding:number;maxZoom:number;duration:number})=>unknown;
 getBounds?:()=>{contains:(point:[number,number])=>boolean};
 easeTo?:(options:{center:[number,number];duration:number})=>unknown;
 project?:(point:[number,number])=>MapPixel;
}
export interface MarkerPort {setLngLat:(point:[number,number])=>MarkerPort;addTo:(map:MapPort)=>MarkerPort;remove:()=>void;getLngLat:()=>{lng:number;lat:number};on:(name:'dragend',callback:()=>void)=>unknown;off:(name:'dragend',callback:()=>void)=>unknown;setDraggable?:(draggable:boolean)=>unknown;}
export interface FreeMapSdk {createMap:(element:HTMLElement,options:Omit<MapOptions,'container'>)=>MapPort;createMarker:(element:HTMLElement,draggable:boolean)=>MarkerPort;}
export interface MapChoice {id:string;name:string;point:GeoPoint;number?:number;kind?:'hotel'|'arrival'|'landmark';code?:string;mode?:Mode}
export interface MapCamera {center:GeoPoint;zoom:number}
export type FreeMapStatus='loading'|'ready'|'unavailable';
export interface FreeMapInput {
 center:GeoPoint;appearance:'light'|'dark';choices:MapChoice[];point?:GeoPoint;
 isCurrent:()=>boolean;onPoint:(point:GeoPoint)=>void;onStatus:(status:FreeMapStatus)=>void;
 markerClassName:string;camera?:MapCamera;timeoutMs?:number;
 discovery?:boolean;pickingPoint?:boolean;selectedHotelId?:string;
 onSelectHotel?:(hotelId:string)=>void;motionEnabled?:boolean;
}
export type FreeMapUpdate=Pick<FreeMapInput,'appearance'|'choices'|'point'|'pickingPoint'|'selectedHotelId'|'motionEnabled'>;
export interface FreeMapController {ready:Promise<boolean>;update:(input:FreeMapUpdate)=>void;getCamera:()=>MapCamera|undefined;dispose:()=>void;}
export const FREE_MAP_STYLES={light:'https://vector.openstreetmap.org/styles/shortbread/colorful.json',dark:'https://vector.openstreetmap.org/styles/shortbread/shadow.json'} as const;
let active:FreeMapController|undefined;
interface MarkerRecord {choice:MapChoice;element:HTMLElement;marker:MarkerPort;stop:()=>void;offset?:MapPixel;leader?:SVGGElement}
const svgNamespace='http://www.w3.org/2000/svg';
function pinIcon(choice:MapChoice):SVGSVGElement {
 const svg=document.createElementNS(svgNamespace,'svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS(svgNamespace,'path');
 const paths={flight:'M3 11l7-1 3-7 2 1-1 6 6 3v2l-7-1-3 6-2-1 1-6-6 1z',train:'M3 6h14l4 5v6H3zM6 6v6h12M10 6v6M15 6v6M6 17v2m12-2v2M2 21h20',bus:'M3 6h14l4 5v6H3zM6 9h3m3 0h3m3 1 2 3M7 17a2 2 0 1 0 0 .1m10-.1a2 2 0 1 0 0 .1'};
 path.setAttribute('d',choice.id==='custom-point'?'M12 2v5m0 10v5M2 12h5m10 0h5M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10':choice.kind==='arrival'?(choice.mode?paths[choice.mode]:'M4 20V7h16v13M2 20h20M8 7V4h8v3M8 11h2m4 0h2m-8 4h2m4 0h2'):'M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13ZM9 13V7h6v6M9 10h6');
 svg.append(path);return svg;
}
function setMarkerContent(element:HTMLElement,choice:MapChoice,discovery:boolean,customPoint:boolean){
 element.replaceChildren();element.title=choice.name;element.dataset['mapChoiceId']=choice.id;
 if(customPoint)element.dataset['customPoint']='true';
 if(discovery){
  element.dataset['mapChoiceKind']=choice.kind??'landmark';element.dir='rtl';
  if(choice.kind==='hotel')element.dataset['mapHotelId']=choice.id;
  if(choice.kind==='arrival')element.dataset['mapArrivalId']=choice.id;
  element.setAttribute('aria-label',choice.kind==='arrival'?`نقطه رسیدن: ${choice.name}${choice.code?` (${choice.code})`:''}`:choice.name);
  const pin=document.createElement('span');pin.dataset['markerPin']='';pin.setAttribute('aria-hidden','true');pin.append(pinIcon(choice));
  const name=document.createElement('span');name.dataset['markerName']='';name.setAttribute('aria-hidden','true');name.textContent=choice.name;
  if(choice.code){const code=document.createElement('bdi');code.textContent=` (${choice.code})`;name.append(code);}
  element.append(pin,name);
 }else{
  element.textContent=choice.number===undefined?(customPoint?'●':'•'):new Intl.NumberFormat('fa-IR').format(choice.number);
  element.setAttribute('aria-label',choice.name+'، انتخاب موقعیت مرجع');
 }
}

/** One lazy provider map with keyed native markers and controlled selection. */
export function createFreeMap(element:HTMLElement,input:FreeMapInput,load:()=>Promise<FreeMapSdk>):FreeMapController{
 active?.dispose();let closed=false,map:MapPort|undefined,sdk:FreeMapSdk|undefined,timer:ReturnType<typeof setTimeout>|undefined,observer:ResizeObserver|undefined;
 let appearance=input.appearance,choices=input.choices,point=input.point,savedCamera:MapCamera|undefined=input.camera;
 let pickingPoint=input.pickingPoint,selectedHotelId=input.selectedHotelId,motionEnabled=input.motionEnabled!==false,fitKey='';
 let hoveredHotelId:string|undefined,focusedHotelId:string|undefined,leaders:SVGSVGElement|undefined,layoutGeometryKey='';
 const records=new Map<string,MarkerRecord>();let selectedPoint:MarkerRecord|undefined;
 const listeners:{name:MapEventName;fn:(event:unknown)=>void}[]=[];
 let settle!:(ready:boolean)=>void;const ready=new Promise<boolean>(resolve=>{settle=resolve;});
 const owns=()=>!closed&&active===controller&&input.isCurrent();
 const notify=(status:FreeMapStatus)=>{if(owns())input.onStatus(status);};
 const canPick=()=>!input.discovery||pickingPoint===true;
 function stopTimer(){clearTimeout(timer);timer=undefined;}
 function camera(){return map?{center:{latitude:map.getCenter().lat,longitude:map.getCenter().lng},zoom:map.getZoom()}:savedCamera;}
 function reportCamera(){if(!owns())return;const value=camera();if(value)element.dataset['freeMapCamera']=JSON.stringify(value);}
 function removeRecord(record:MarkerRecord){record.stop();record.marker.remove();record.leader?.remove();if(hoveredHotelId===record.choice.id)hoveredHotelId=undefined;if(focusedHotelId===record.choice.id)focusedHotelId=undefined;}
 function cleanup(){stopTimer();observer?.disconnect();observer=undefined;for(const {name,fn}of listeners.splice(0))map?.off(name,fn);for(const record of records.values())removeRecord(record);records.clear();if(selectedPoint)removeRecord(selectedPoint);selectedPoint=undefined;leaders?.remove();leaders=undefined;if(map){savedCamera=camera();map.remove();map=undefined;}element.replaceChildren();delete element.dataset['freeMapCamera'];delete element.dataset['selectedHotelId'];delete element.dataset['pickingPoint'];delete element.dataset['freeMapAppearance'];delete element.dataset['hotelMapLabels'];}
 function fail(){if(closed)return;notify('unavailable');cleanup();closed=true;if(active===controller)active=undefined;settle(false);}
 function bounded(){stopTimer();timer=setTimeout(fail,input.timeoutMs??15000);}
 function emitPoint(value:unknown){if(!owns()||!canPick())return;const parsed=GeoPointSchema.safeParse(value);if(parsed.success)input.onPoint(parsed.data);}
 function makeMarker(choice:MapChoice,customPoint=false):MarkerRecord|undefined {
  if(!sdk||!map)return undefined;
  const isArrival=input.discovery&&choice.kind==='arrival',draggable=customPoint&&canPick();
  const node=document.createElement(isArrival?'div':'button');
  if(node instanceof HTMLButtonElement)node.type='button';else node.setAttribute('role','img');
  node.className=input.markerClassName;setMarkerContent(node,choice,Boolean(input.discovery),customPoint);
  const marker=sdk.createMarker(node,draggable).setLngLat([choice.point.longitude,choice.point.latitude]).addTo(map);
  const record:MarkerRecord={choice,element:node,marker,stop:()=>undefined};
  const click=(event:Event)=>{
   event.stopPropagation();if(!owns()||record.choice.kind==='arrival'&&input.discovery)return;
   if(input.discovery&&record.choice.kind==='hotel'){
    // MapLibre prevents mouse-down's default focus even for custom buttons.
    node.focus({preventScroll:true});if(!owns())return;
    if(!canPick()){input.onSelectHotel?.(record.choice.id);return;}
   }
   const p=customPoint?marker.getLngLat():{lat:record.choice.point.latitude,lng:record.choice.point.longitude};emitPoint({latitude:p.lat,longitude:p.lng});
  };
  const drag=()=>{const p=marker.getLngLat();emitPoint({latitude:p.lat,longitude:p.lng});};
  const enter=()=>{if(owns()&&record.choice.kind==='hotel'){hoveredHotelId=record.choice.id;layoutMarkers();}};
  const leave=()=>{if(hoveredHotelId===record.choice.id){hoveredHotelId=undefined;layoutMarkers();}};
  const focus=()=>{if(owns()&&record.choice.kind==='hotel'){focusedHotelId=record.choice.id;layoutMarkers();}};
  const blur=(event:Event)=>{if(focusedHotelId===record.choice.id){const target='relatedTarget'in event?event.relatedTarget:undefined,id=target instanceof HTMLElement?target.dataset['mapHotelId']:undefined;focusedHotelId=id&&records.get(id)?.element===target?id:undefined;layoutMarkers();}};
  node.addEventListener('click',click);if(customPoint)marker.on('dragend',drag);
  if(input.discovery&&choice.kind==='hotel'){node.addEventListener('mouseenter',enter);node.addEventListener('mouseleave',leave);node.addEventListener('focus',focus);node.addEventListener('blur',blur);}
  record.stop=()=>{node.removeEventListener('click',click);node.removeEventListener('mouseenter',enter);node.removeEventListener('mouseleave',leave);node.removeEventListener('focus',focus);node.removeEventListener('blur',blur);if(customPoint)marker.off('dragend',drag);};
  return record;
 }
 function layoutMarkers(){
  if(!owns()||!input.discovery||!map?.project)return;
  const width=element.clientWidth,height=element.clientHeight;if(width<50||height<50)return;
  const geometryKey=`${width}:${height}:${Math.round(map.getZoom()*4)}`,changedGeometry=geometryKey!==layoutGeometryKey;layoutGeometryKey=geometryKey;
  if(!leaders){leaders=document.createElementNS(svgNamespace,'svg');leaders.dataset['hotelMapLeaders']='';leaders.setAttribute('aria-hidden','true');element.append(leaders);}
  leaders.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const candidates:MapLabelInput[]=[],obstacles:MapLabelRect[]=[{left:8,top:8,right:52,bottom:82}];
  const projected=new Map<string,MapPixel>();
  for(const record of [...records.values(),...(selectedPoint?[selectedPoint]:[])]){
   const {choice}=record,anchor=map.project([choice.point.longitude,choice.point.latitude]);if(!Number.isFinite(anchor.x)||!Number.isFinite(anchor.y))continue;
   const name=record.element.querySelector<HTMLElement>('[data-marker-name]');
   const maxWidth=choice.kind==='arrival'?Math.min(240,width-24):width<600?124:selectedHotelId===choice.id?220:148;
   name?.style.setProperty('max-width',`${maxWidth}px`);
   const labelWidth=Math.min(maxWidth,name?.offsetWidth||choice.name.length*6.5+12),labelHeight=name?.offsetHeight||23;
   if(choice.kind==='hotel'){
    projected.set(choice.id,anchor);candidates.push({id:choice.id,anchor,width:Math.max(44,labelWidth),height:39+labelHeight,priority:focusedHotelId===choice.id?3:selectedHotelId===choice.id?2:hoveredHotelId===choice.id?1:0,previous:changedGeometry?undefined:record.offset,collapsed:record.element.dataset['mapLabelCollapsed']==='true',locked:focusedHotelId===choice.id||hoveredHotelId===choice.id});
   }else if(anchor.x>=0&&anchor.x<=width&&anchor.y>=0&&anchor.y<=height){
    // Arrival and reference anchors never move; only their text can tuck inside an edge.
    const adjustment=Math.max(8+labelWidth/2,Math.min(width-8-labelWidth/2,anchor.x))-anchor.x;
    name?.style.setProperty('--map-label-adjust-x',`${adjustment}px`);
    obstacles.push({left:anchor.x-labelWidth/2+adjustment,right:anchor.x+labelWidth/2+adjustment,top:anchor.y-17-labelHeight,bottom:anchor.y+22});
   }
  }
  const placed=layoutMapLabels(candidates,{width,height},obstacles),byId=new Map(placed.map(value=>[value.id,value]));let collapsed=false;
  for(const record of records.values()){
   if(record.choice.kind!=='hotel')continue;
   const placement=byId.get(record.choice.id),anchor=projected.get(record.choice.id);
   const offset=placement&&anchor?{x:placement.center.x-anchor.x,y:placement.center.y-anchor.y}:{x:0,y:0};record.offset=offset;
   record.element.style.setProperty('--map-offset-x',`${offset.x}px`);record.element.style.setProperty('--map-offset-y',`${offset.y}px`);
   const name=record.element.querySelector<HTMLElement>('[data-marker-name]');name?.style.setProperty('--map-label-adjust-x',`${placement?.labelShift?.x??0}px`);name?.style.setProperty('--map-label-adjust-y',`${placement?.labelShift?.y??0}px`);
   record.element.dataset['mapLabelCollapsed']=String(placement?.collapsed??false);record.element.dataset['mapLabelOffset']=`${Math.round(offset.x)},${Math.round(offset.y)}`;
   record.element.style.zIndex=focusedHotelId===record.choice.id?'8':selectedHotelId===record.choice.id?'7':hoveredHotelId===record.choice.id?'6':'2';
   collapsed||=placement?.collapsed??false;
   if(!record.leader){const group=document.createElementNS(svgNamespace,'g');group.dataset['mapLeaderId']=record.choice.id;group.append(document.createElementNS(svgNamespace,'line'),document.createElementNS(svgNamespace,'circle'));leaders.append(group);record.leader=group;}
   record.leader.dataset['selected']=String(record.choice.id===selectedHotelId);
   record.leader.style.display=placement&&anchor&&Math.hypot(offset.x,offset.y)>3?'':'none';
   if(placement&&anchor){
    const line=record.leader.children[0]!,dot=record.leader.children[1]!;
    line.setAttribute('x1',String(anchor.x));line.setAttribute('y1',String(anchor.y));line.setAttribute('x2',String(placement.center.x));line.setAttribute('y2',String(placement.center.y));
    dot.setAttribute('cx',String(anchor.x));dot.setAttribute('cy',String(anchor.y));dot.setAttribute('r','2.5');
   }
  }
  element.dataset['hotelMapLabels']=collapsed?'compact':'named';
 }
 function fitDiscovery(){
  if(!input.discovery||!map?.fitBounds)return false;
  const shown=Array.from(records.values()).filter(record=>record.choice.kind==='hotel'||record.choice.kind==='arrival');
  if(!shown.some(record=>record.choice.kind==='hotel'))return false;
  const key=JSON.stringify(shown.map(({choice})=>[choice.id,choice.point.latitude,choice.point.longitude]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  if(key===fitKey)return false;const restoring=!fitKey&&Boolean(input.camera);fitKey=key;if(restoring)return false;
  const reference=shown.find(record=>record.choice.kind==='arrival')?.choice.point.longitude??input.center.longitude;
  const points=shown.map(({choice})=>{const longitude=choice.point.longitude,delta=longitude-reference;return [delta>180?longitude-360:delta< -180?longitude+360:longitude,choice.point.latitude] as [number,number];});
  map.fitBounds([[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]],{padding:56,maxZoom:13.2,duration:motionEnabled?560:0});
  return true;
 }
 function focusSelected(){
  const record=selectedHotelId?records.get(selectedHotelId):undefined;
  if(!input.discovery||!map||record?.choice.kind!=='hotel')return;
  const p:[number,number]=[record.choice.point.longitude,record.choice.point.latitude];
  if(map.getBounds?.().contains(p))return;
  if(map.easeTo)map.easeTo({center:p,duration:motionEnabled?420:0});
  else map.jumpTo({center:p,zoom:map.getZoom(),pitch:0,bearing:0});
 }
 function drawMarkers(){
  if(!sdk||!map)return false;
  const present=new Set<string>();
  for(const choice of choices){
   if(present.has(choice.id)||!GeoPointSchema.safeParse(choice.point).success)continue;present.add(choice.id);
   let record=records.get(choice.id);
   if(record&&record.choice.kind!==choice.kind){removeRecord(record);records.delete(choice.id);record=undefined;}
   if(!record){record=makeMarker(choice);if(record)records.set(choice.id,record);}
   else if(JSON.stringify(record.choice)!==JSON.stringify(choice)){record.choice=choice;setMarkerContent(record.element,choice,Boolean(input.discovery),false);record.marker.setLngLat([choice.point.longitude,choice.point.latitude]);}
   if(record&&input.discovery&&choice.kind==='hotel'){
    const selected=selectedHotelId===choice.id;record.element.setAttribute('aria-pressed',String(selected));record.element.setAttribute('aria-label',canPick()?`انتخاب موقعیت ${choice.name}`:`انتخاب ${choice.name} روی نقشه`);record.element.dataset['selected']=String(selected);record.element.style.zIndex=selected?'5':'2';
   }
  }
  for(const [id,record]of records)if(!present.has(id)){removeRecord(record);records.delete(id);}
  if(point&&GeoPointSchema.safeParse(point).success){
   if(selectedPoint){selectedPoint.choice={...selectedPoint.choice,point};selectedPoint.marker.setLngLat([point.longitude,point.latitude]);}
   else selectedPoint=makeMarker({id:'custom-point',name:input.discovery?'موقعیت مرجع':'نقطه انتخابی موقت',point},true);
   selectedPoint?.marker.setDraggable?.(canPick());
   if(selectedPoint?.element instanceof HTMLButtonElement)selectedPoint.element.disabled=!canPick();
  }else if(selectedPoint){removeRecord(selectedPoint);selectedPoint=undefined;}
  if(selectedHotelId&&records.get(selectedHotelId)?.choice.kind==='hotel')element.dataset['selectedHotelId']=selectedHotelId;else delete element.dataset['selectedHotelId'];
  element.dataset['pickingPoint']=String(canPick());
  const fitted=fitDiscovery();layoutMarkers();return fitted;
 }
 function on(name:MapEventName,fn:(event:unknown)=>void){map?.on(name,fn);listeners.push({name,fn});}
 const controller:FreeMapController={ready,update(next){
  if(closed)return;
  const changed=next.selectedHotelId!==selectedHotelId,wasMoving=motionEnabled;
  choices=next.choices;point=next.point;pickingPoint=next.pickingPoint;selectedHotelId=next.selectedHotelId;motionEnabled=next.motionEnabled!==false;
  if(wasMoving&&!motionEnabled)map?.stop?.();
  if(map&&next.appearance!==appearance){savedCamera=camera();appearance=next.appearance;notify('loading');bounded();map.setStyle(FREE_MAP_STYLES[appearance]);if(savedCamera)map.jumpTo({center:[savedCamera.center.longitude,savedCamera.center.latitude],zoom:savedCamera.zoom,pitch:0,bearing:0});element.dataset['freeMapAppearance']=appearance;}else appearance=next.appearance;
  const fitted=drawMarkers();if(changed&&!fitted)focusSelected();
 },getCamera:camera,dispose(){if(closed)return;closed=true;cleanup();if(active===controller)active=undefined;settle(false);}};
 active=controller;notify('loading');bounded();
 let pending:Promise<FreeMapSdk>;try{pending=load();}catch{fail();return controller;}
 void pending.then(runtime=>{
  if(!owns())return;
  sdk=runtime;const initial=savedCamera??{center:input.center,zoom:12.5};
  map=sdk.createMap(element,{style:FREE_MAP_STYLES[appearance],center:[initial.center.longitude,initial.center.latitude],zoom:initial.zoom,pitch:0,bearing:0,maxPitch:0,dragRotate:false,touchPitch:false,attributionControl:{compact:false},locale:{'NavigationControl.ZoomIn':'بزرگ‌نمایی','NavigationControl.ZoomOut':'کوچک‌نمایی','Map.Title':input.discovery?'نقشه اقامتگاه‌ها و نقطه رسیدن':'نقشه انتخاب موقعیت'}});
  element.dataset['freeMapAppearance']=appearance;
  on('click',event=>{if(event&&typeof event==='object'&&'lngLat'in event){const p=event.lngLat as {lng?:unknown;lat?:unknown};emitPoint({longitude:typeof p.lng==='number'&&Number.isFinite(p.lng)?((p.lng+180)%360+360)%360-180:p.lng,latitude:p.lat});}});
  const loaded=()=>{if(!owns())return;stopTimer();notify('ready');layoutMarkers();reportCamera();settle(true);};
  on('load',loaded);on('idle',loaded);on('style.load',()=>{if(owns()&&savedCamera)map?.jumpTo({center:[savedCamera.center.longitude,savedCamera.center.latitude],zoom:savedCamera.zoom,pitch:0,bearing:0});});on('move',layoutMarkers);on('resize',layoutMarkers);on('moveend',()=>{layoutMarkers();reportCamera();});on('error',fail);on('webglcontextlost',fail);
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>{if(owns()){map?.resize();layoutMarkers();}});observer.observe(element);}
  drawMarkers();reportCamera();
 }).catch(fail);
 return controller;
}
