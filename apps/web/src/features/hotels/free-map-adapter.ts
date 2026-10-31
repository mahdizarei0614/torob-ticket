import type {MapOptions} from 'maplibre-gl';
import {GeoPointSchema,type GeoPoint,type Mode} from '@torob-ticket/contracts';
import {placeMapTooltip,type MapPixel} from './free-map-label-layout';
import {groupMapHotels,selectedHotelZoom,type MapHotelGroup} from './free-map-clusters';

export type MapEventName='load'|'style.load'|'click'|'error'|'webglcontextlost'|'idle'|'move'|'moveend'|'resize';
export interface MapPort {
 on:(name:MapEventName,callback:(event:unknown)=>void)=>unknown;
 off:(name:MapEventName,callback:(event:unknown)=>void)=>unknown;
 remove:()=>void;resize:()=>unknown;setStyle:(url:string)=>unknown;stop?:()=>unknown;
 getCenter:()=>{lng:number;lat:number};getZoom:()=>number;
 jumpTo:(options:{center:[number,number];zoom:number;pitch:number;bearing:number})=>unknown;
 fitBounds?:(bounds:[[number,number],[number,number]],options:{padding:number;maxZoom:number;duration:number})=>unknown;
 getBounds?:()=>{contains:(point:[number,number])=>boolean};
 easeTo?:(options:{center:[number,number];zoom?:number;duration:number})=>unknown;
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
interface MarkerRecord {choice:MapChoice;element:HTMLElement;marker:MarkerPort;stop:()=>void}
interface ClusterRecord {ids:string[];point:GeoPoint;element:HTMLButtonElement;marker:MarkerPort;stop:()=>void}
const svgNamespace='http://www.w3.org/2000/svg';
function pinIcon(choice:MapChoice):SVGSVGElement {
 const svg=document.createElementNS(svgNamespace,'svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS(svgNamespace,'path');
 const paths={flight:'M3 11l7-1 3-7 2 1-1 6 6 3v2l-7-1-3 6-2-1 1-6-6 1z',train:'M3 6h14l4 5v6H3zM6 6v6h12M10 6v6M15 6v6M6 17v2m12-2v2M2 21h20',bus:'M3 6h14l4 5v6H3zM6 9h3m3 0h3m3 1 2 3M7 17a2 2 0 1 0 0 .1m10-.1a2 2 0 1 0 0 .1'};
 path.setAttribute('d',choice.id==='custom-point'?'M12 2v5m0 10v5M2 12h5m10 0h5M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10':choice.kind==='arrival'?(choice.mode?paths[choice.mode]:'M4 20V7h16v13M2 20h20M8 7V4h8v3M8 11h2m4 0h2m-8 4h2m4 0h2'):'M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13ZM9 13V7h6v6M9 10h6');
 svg.append(path);return svg;
}
function setMarkerContent(element:HTMLElement,choice:MapChoice,discovery:boolean,customPoint:boolean,moving:boolean){
 element.replaceChildren();if(discovery)element.removeAttribute('title');else element.title=choice.name;element.dataset['mapChoiceId']=choice.id;
 if(customPoint)element.dataset['customPoint']='true';
 if(discovery){
  element.dataset['mapChoiceKind']=choice.kind??'landmark';element.dir='rtl';
  if(choice.kind==='hotel'){element.dataset['mapHotelId']=choice.id;element.dataset['mapLabelVisible']='false';element.dataset['mapLabelOffset']='0,0';}
  if(choice.kind==='arrival')element.dataset['mapArrivalId']=choice.id;
  element.setAttribute('aria-label',choice.kind==='arrival'?`نقطه رسیدن: ${choice.name}${choice.code?` (${choice.code})`:''}`:choice.name);
  const pin=document.createElement('span');pin.dataset['markerPin']='';pin.dataset['markerEnter']=String(moving);pin.setAttribute('aria-hidden','true');pin.append(pinIcon(choice));
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
 let hoveredHotelId:string|undefined,focusedHotelId:string|undefined,lastInteraction:'hover'|'focus'='hover';
 let selectionFocusId:string|undefined;
 let pendingClusterFocus:{ids:string[];target:HTMLElement}|undefined;
 const records=new Map<string,MarkerRecord>(),clusters=new Map<string,ClusterRecord>();let selectedPoint:MarkerRecord|undefined;
 const listeners:{name:MapEventName;fn:(event:unknown)=>void}[]=[];
 let settle!:(ready:boolean)=>void;const ready=new Promise<boolean>(resolve=>{settle=resolve;});
 const owns=()=>!closed&&active===controller&&input.isCurrent();
 const notify=(status:FreeMapStatus)=>{if(owns())input.onStatus(status);};
 const canPick=()=>!input.discovery||pickingPoint===true;
 function stopTimer(){clearTimeout(timer);timer=undefined;}
 function camera(){return map?{center:{latitude:map.getCenter().lat,longitude:map.getCenter().lng},zoom:map.getZoom()}:savedCamera;}
 function reportCamera(){if(!owns())return;const value=camera();if(value)element.dataset['freeMapCamera']=JSON.stringify(value);}
 function removeRecord(record:MarkerRecord){record.stop();record.element.dataset['mapLabelVisible']='false';record.marker.remove();if(hoveredHotelId===record.choice.id)hoveredHotelId=undefined;if(focusedHotelId===record.choice.id)focusedHotelId=undefined;}
 function cleanup(){stopTimer();observer?.disconnect();observer=undefined;pendingClusterFocus=undefined;for(const {name,fn}of listeners.splice(0))map?.off(name,fn);for(const record of records.values())removeRecord(record);records.clear();for(const cluster of clusters.values())removeCluster(cluster);clusters.clear();if(selectedPoint)removeRecord(selectedPoint);selectedPoint=undefined;if(map){savedCamera=camera();map.remove();map=undefined;}element.replaceChildren();delete element.dataset['freeMapCamera'];delete element.dataset['selectedHotelId'];delete element.dataset['pickingPoint'];delete element.dataset['freeMapAppearance'];delete element.dataset['hotelMapLabels'];delete element.dataset['freeMapMotion'];}
 function fail(){if(closed)return;notify('unavailable');cleanup();closed=true;if(active===controller)active=undefined;settle(false);}
 function bounded(){stopTimer();timer=setTimeout(fail,input.timeoutMs??15000);}
 function emitPoint(value:unknown){if(!owns()||!canPick())return;const parsed=GeoPointSchema.safeParse(value);if(parsed.success)input.onPoint(parsed.data);}
 function makeMarker(choice:MapChoice,customPoint=false):MarkerRecord|undefined {
  if(!sdk||!map)return undefined;
  const isArrival=input.discovery&&choice.kind==='arrival',draggable=customPoint&&canPick();
  const node=document.createElement(isArrival?'div':'button');
  if(node instanceof HTMLButtonElement)node.type='button';else node.setAttribute('role','img');
  node.className=input.markerClassName;setMarkerContent(node,choice,Boolean(input.discovery),customPoint,motionEnabled);
  const marker=sdk.createMarker(node,draggable).setLngLat([choice.point.longitude,choice.point.latitude]).addTo(map);
  const record:MarkerRecord={choice,element:node,marker,stop:()=>undefined};
  const click=(event:Event)=>{
   event.stopPropagation();if(!owns()||node.hidden||node.inert||record.choice.kind==='arrival'&&input.discovery)return;
   if(input.discovery&&record.choice.kind==='hotel'){
    // MapLibre prevents mouse-down's default focus even for custom buttons.
    node.focus({preventScroll:true});if(!owns())return;
    if(!canPick()){input.onSelectHotel?.(record.choice.id);return;}
   }
   const p=customPoint?marker.getLngLat():{lat:record.choice.point.latitude,lng:record.choice.point.longitude};emitPoint({latitude:p.lat,longitude:p.lng});
  };
  const drag=()=>{const p=marker.getLngLat();emitPoint({latitude:p.lat,longitude:p.lng});};
  const enter=()=>{if(owns()&&!node.hidden&&!node.inert&&record.choice.kind==='hotel'){hoveredHotelId=record.choice.id;lastInteraction='hover';layoutMarkers();}};
  const leave=()=>{if(hoveredHotelId===record.choice.id){hoveredHotelId=undefined;layoutMarkers();}};
  const focus=()=>{if(owns()&&!node.hidden&&!node.inert&&record.choice.kind==='hotel'){focusedHotelId=record.choice.id;lastInteraction='focus';layoutMarkers();}};
  const blur=(event:Event)=>{if(focusedHotelId===record.choice.id){const target='relatedTarget'in event?event.relatedTarget:undefined,id=target instanceof HTMLElement?target.dataset['mapHotelId']:undefined;focusedHotelId=id&&records.get(id)?.element===target?id:undefined;layoutMarkers();}};
  node.addEventListener('click',click);if(customPoint)marker.on('dragend',drag);
  if(input.discovery&&choice.kind==='hotel'){node.addEventListener('mouseenter',enter);node.addEventListener('mouseleave',leave);node.addEventListener('focus',focus);node.addEventListener('blur',blur);}
  record.stop=()=>{node.removeEventListener('click',click);node.removeEventListener('mouseenter',enter);node.removeEventListener('mouseleave',leave);node.removeEventListener('focus',focus);node.removeEventListener('blur',blur);if(customPoint)marker.off('dragend',drag);};
  return record;
 }
 function memberBounds(ids:string[]){
  const members=ids.flatMap(id=>{const record=records.get(id);return record?.choice.kind==='hotel'?[record.choice.point]:[];});
  if(!members.length)return undefined;
  const reference=members[0]!.longitude,points=members.map(point=>{const delta=point.longitude-reference;return [delta>180?point.longitude-360:delta< -180?point.longitude+360:point.longitude,point.latitude] as [number,number];});
  return {points,bounds:[[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]] as [[number,number],[number,number]]};
 }
 function removeCluster(cluster:ClusterRecord){cluster.stop();cluster.element.disabled=true;cluster.element.hidden=true;cluster.marker.remove();}
 function visibleFocusTarget(ids:string[]){
  if(!map?.project)return undefined;
  const inside=(point:GeoPoint)=>{const pixel=map!.project!([point.longitude,point.latitude]);return pixel.x>=30&&pixel.x<=element.clientWidth-30&&pixel.y>=30&&pixel.y<=element.clientHeight-30;};
  const exposed=ids.map(id=>records.get(id)).find(record=>record&&!record.element.hidden&&inside(record.choice.point));
  const successor=[...clusters.values()].find(cluster=>cluster.ids.some(id=>ids.includes(id))&&inside(cluster.point));
  return exposed?.element??successor?.element;
 }
 function settleClusterFocus(){
  const pending=pendingClusterFocus;pendingClusterFocus=undefined;
  if(!owns()||!pending||document.activeElement!==pending.target)return;
  visibleFocusTarget(pending.ids)?.focus({preventScroll:true});
 }
 function makeCluster(group:MapHotelGroup,point:GeoPoint):ClusterRecord|undefined{
  if(!map||!sdk)return undefined;
  const node=document.createElement('button');node.type='button';node.className=input.markerClassName;node.dir='rtl';node.dataset['mapCluster']='';
  const pin=document.createElement('span');pin.dataset['markerPin']='';pin.setAttribute('aria-hidden','true');node.append(pin);
  const marker=sdk.createMarker(node,false).setLngLat([point.longitude,point.latitude]).addTo(map);
  const record:ClusterRecord={ids:group.ids,point,element:node,marker,stop:()=>undefined};
  const click=(event:Event)=>{
   event.stopPropagation();if(!owns()||node.disabled||clusters.get(group.key)!==record||!map)return;
   node.focus({preventScroll:true});if(!owns())return;
   if(canPick()){emitPoint(record.point);return;}
   const geometry=memberBounds(record.ids);if(!geometry)return;
   const current=map.getZoom(),zoom=Math.min(20,current+3),duration=motionEnabled?560:0;
   const pixels=map.project?geometry.points.map(point=>map!.project!(point)):[],span=(axis:'x'|'y')=>Math.max(...pixels.map(point=>point[axis]))-Math.min(...pixels.map(point=>point[axis]));
   const scale=Math.min(Math.max(1,element.clientWidth-128)/span('x'),Math.max(1,element.clientHeight-128)/span('y'));
   // A transitive overlap chain can already span the viewport: fitting it
   // again would make no progress. Deepen the aggregate's area in that case.
   if(map.fitBounds&&(!pixels.length||Math.log2(scale)>=.85||current>=20))map.fitBounds(geometry.bounds,{padding:64,maxZoom:zoom,duration});
   else if(map.easeTo)map.easeTo({center:[record.point.longitude,record.point.latitude],zoom:Math.min(20,current+1.25),duration});
   else map.jumpTo({center:[record.point.longitude,record.point.latitude],zoom:Math.min(20,current+1.25),pitch:0,bearing:0});
  };
  node.addEventListener('click',click);record.stop=()=>node.removeEventListener('click',click);return record;
 }
 function layoutClusters(){
  if(!map?.project)return;
  const hotels=[...records.values()].filter(record=>record.choice.kind==='hotel');
  const groups=groupMapHotels(hotels.map(({choice})=>({id:choice.id,point:map!.project!([choice.point.longitude,choice.point.latitude])})));
  const grouped=new Set<string>(),present=new Set<string>();
  for(const group of groups){
   if(group.ids.length<2)continue;
   // Distinct sourced properties normally separate before zoom20. If exact
   // coordinates coincide, an explicitly inspected property still has its
   // genuine pin; the remaining count keeps its genuine aggregate centroid.
   const ids=map.getZoom()>=19.99&&selectionFocusId===selectedHotelId?group.ids.filter(id=>id!==selectedHotelId):group.ids;
   if(!ids.length)continue;
   ids.forEach(id=>grouped.add(id));
   const key=JSON.stringify(ids),geometry=memberBounds(ids);if(!geometry)continue;
   present.add(key);
   const point={longitude:((geometry.points.reduce((sum,p)=>sum+p[0],0)/ids.length+180)%360+360)%360-180,latitude:geometry.points.reduce((sum,p)=>sum+p[1],0)/ids.length};
   let cluster=clusters.get(key);if(!cluster){cluster=makeCluster({...group,key,ids},point);if(cluster)clusters.set(key,cluster);}
   if(!cluster)continue;
   if(cluster.point.latitude!==point.latitude||cluster.point.longitude!==point.longitude){cluster.point=point;cluster.marker.setLngLat([point.longitude,point.latitude]);}
   cluster.ids=ids;const count=new Intl.NumberFormat('fa-IR').format(ids.length);
   cluster.element.dataset['mapClusterCount']=String(ids.length);cluster.element.dataset['mapClusterMembers']=JSON.stringify(ids);cluster.element.setAttribute('aria-label',canPick()?`انتخاب موقعیت گروه ${count} هتل`:`بزرگ‌نمایی برای نمایش ${count} هتل`);
   const pin=cluster.element.querySelector<HTMLElement>('[data-marker-pin]')!;if(pin.textContent!==count)pin.textContent=count;
   cluster.element.style.zIndex='3';
  }
  let transferFocus:string[]|undefined;
  for(const [key,cluster]of clusters)if(!present.has(key)){if(document.activeElement===cluster.element)transferFocus=cluster.ids;removeCluster(cluster);clusters.delete(key);}
  for(const {choice,element:node}of hotels){
   const hidden=grouped.has(choice.id);node.hidden=hidden;node.inert=hidden;node.tabIndex=hidden?-1:0;if(node instanceof HTMLButtonElement)node.disabled=hidden;
   node.dataset['mapGrouped']=String(hidden);node.dataset['mapLabelOffset']='0,0';
   if(hidden){if(hoveredHotelId===choice.id)hoveredHotelId=undefined;if(focusedHotelId===choice.id)focusedHotelId=undefined;}
  }
  if(transferFocus){
   // Hold keyboard focus on the existing map canvas while its camera settles;
   // an edge member visible at the first split can leave the view mid-ease.
   const target=element.querySelector<HTMLCanvasElement>('canvas')??visibleFocusTarget(transferFocus);
   if(target){pendingClusterFocus={ids:transferFocus,target};target.focus({preventScroll:true});}
  }
 }
 function layoutMarkers(){
  if(!owns()||!input.discovery)return;
  layoutClusters();
  const activeName=lastInteraction==='hover'?hoveredHotelId??focusedHotelId:focusedHotelId??hoveredHotelId;
  element.dataset['hotelMapLabels']='hover';
  const width=element.clientWidth,height=element.clientHeight;
  for(const record of [...records.values(),...(selectedPoint?[selectedPoint]:[])]){
   const {choice}=record,node=record.element,name=node.querySelector<HTMLElement>('[data-marker-name]');
   if(choice.kind==='hotel'){
    node.dataset['mapLabelVisible']=String(!node.hidden&&choice.id===activeName);node.dataset['mapLabelOffset']='0,0';
    node.style.zIndex=choice.id===activeName?'8':choice.id===selectedHotelId?'6':'2';
    if(node.hidden||choice.id!==activeName){node.dataset['mapTooltipPlacement']='hidden';continue;}
   }
   if(!map?.project||!name||width<50||height<50)continue;
   const anchor=map.project([choice.point.longitude,choice.point.latitude]);
   const maxWidth=Math.min(choice.kind==='arrival'?240:260,width-16);
   name.style.setProperty('max-width',`${maxWidth}px`);name.style.setProperty('max-height',`${height-16}px`);
   const label={width:name.offsetWidth||Math.min(maxWidth,choice.name.length*6.5+12),height:name.offsetHeight||23};
   const placement=placeMapTooltip(anchor,label,{width,height});
   if(choice.kind==='hotel'&&!placement)node.dataset['mapLabelVisible']='false';
   name.style.setProperty('--map-label-adjust-x',`${placement?.shift.x??0}px`);name.style.setProperty('--map-label-adjust-y',`${placement?.shift.y??0}px`);
   node.dataset['mapTooltipPlacement']=placement?.side??'offscreen';
   node.dataset['mapTooltipOffset']=`${Math.round(placement?.shift.x??0)},${Math.round(placement?.shift.y??0)}`;
  }
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
  selectionFocusId=record.choice.id;
  const p:[number,number]=[record.choice.point.longitude,record.choice.point.latitude];
  const current=map.getZoom(),zoom=map.project?selectedHotelZoom(map.project(p),[...records.values()].filter(other=>other.choice.kind==='hotel'&&other!==record).map(({choice})=>map!.project!([choice.point.longitude,choice.point.latitude])),current):current;
  if(map.getBounds?.().contains(p)&&zoom<=current){layoutMarkers();return;}
  if(map.easeTo)map.easeTo({center:p,...(zoom>current?{zoom}:{}),duration:motionEnabled?420:0});
  else map.jumpTo({center:p,zoom,pitch:0,bearing:0});
 }
 function drawMarkers(){
  if(!sdk||!map)return false;
  const present=new Set<string>();
  for(const choice of choices){
   if(present.has(choice.id)||!GeoPointSchema.safeParse(choice.point).success)continue;present.add(choice.id);
   let record=records.get(choice.id);
   if(record&&record.choice.kind!==choice.kind){removeRecord(record);records.delete(choice.id);record=undefined;}
   if(!record){record=makeMarker(choice);if(record)records.set(choice.id,record);}
   else if(JSON.stringify(record.choice)!==JSON.stringify(choice)){record.choice=choice;setMarkerContent(record.element,choice,Boolean(input.discovery),false,motionEnabled);record.marker.setLngLat([choice.point.longitude,choice.point.latitude]);}
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
  element.dataset['pickingPoint']=String(canPick());element.dataset['freeMapMotion']=motionEnabled?'finite':'static';
  if(!motionEnabled)for(const record of [...records.values(),...(selectedPoint?[selectedPoint]:[])]){const pin=record.element.querySelector<HTMLElement>('[data-marker-pin]');if(pin)pin.dataset['markerEnter']='false';}
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
  on('click',event=>{
   if(!event||typeof event!=='object'||!('lngLat'in event)||!event.lngLat||typeof event.lngLat!=='object')return;
   const p=event.lngLat as {lng?:unknown;lat?:unknown};
   emitPoint({longitude:typeof p.lng==='number'&&Number.isFinite(p.lng)?((p.lng+180)%360+360)%360-180:p.lng,latitude:p.lat});
  });
  const loaded=()=>{if(!owns())return;stopTimer();notify('ready');layoutMarkers();reportCamera();settle(true);};
  on('load',loaded);on('idle',loaded);on('style.load',()=>{if(owns()&&savedCamera)map?.jumpTo({center:[savedCamera.center.longitude,savedCamera.center.latitude],zoom:savedCamera.zoom,pitch:0,bearing:0});});on('move',layoutMarkers);on('resize',layoutMarkers);on('moveend',()=>{layoutMarkers();settleClusterFocus();reportCamera();});on('error',fail);on('webglcontextlost',fail);
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>{if(owns()){map?.resize();layoutMarkers();}});observer.observe(element);}
  drawMarkers();reportCamera();
 }).catch(fail);
 return controller;
}
