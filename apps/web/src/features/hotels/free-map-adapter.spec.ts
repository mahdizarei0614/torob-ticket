import {afterEach,describe,it,expect,vi} from 'vitest';
import {createFreeMap,type FreeMapSdk,type MapPort,type MarkerPort,type FreeMapInput,type MapEventName} from './free-map-adapter';
function mockSdk(){const events=new Map<MapEventName,Set<(event:unknown)=>void>>();const map:MapPort={on:(name,fn)=>{const set=events.get(name)??new Set();set.add(fn);events.set(name,set);},off:(name,fn)=>events.get(name)?.delete(fn),remove:vi.fn(),resize:vi.fn(),setStyle:vi.fn(),getCenter:()=>({lng:51.45,lat:35.75}),getZoom:()=>13,jumpTo:vi.fn()};const markers:MarkerPort[]=[];const sdk:FreeMapSdk={createMap:vi.fn(()=>map),createMarker:vi.fn(()=>{const marker:MarkerPort={setLngLat:vi.fn(()=>marker),addTo:vi.fn(()=>marker),remove:vi.fn(),getLngLat:()=>({lng:51,lat:35}),on:vi.fn(),off:vi.fn(),setDraggable:vi.fn()};markers.push(marker);return marker;})};return {map,sdk,markers,events,emit:(name:MapEventName,event:unknown={})=>{for(const fn of events.get(name)??[])fn(event);}};}
const input=():FreeMapInput=>({center:{latitude:35,longitude:51},appearance:'light',choices:[{id:'h',name:'هتل نمونه (خیالی)',number:1,point:{latitude:35,longitude:51}}],isCurrent:()=>true,onPoint:vi.fn(),onStatus:vi.fn(),markerClassName:'marker',timeoutMs:1000});
const owned:ReturnType<typeof createFreeMap>[]=[];afterEach(()=>{owned.splice(0).forEach(c=>c.dispose());vi.useRealTimers();});
describe('free provider adapter with controlled SDK, no network',()=>{
 it('defers construction, maps native lngLat to the provisional point, keeps full accessible marker titles and cleans every owned resource',async()=>{const mock=mockSdk(),options=input(),element=document.createElement('div');const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await Promise.resolve();await Promise.resolve();expect(mock.sdk.createMap).toHaveBeenCalledTimes(1);expect(mock.sdk.createMap).toHaveBeenCalledWith(element,expect.objectContaining({style:'https://vector.openstreetmap.org/styles/shortbread/colorful.json',pitch:0,bearing:0,maxPitch:0}));mock.emit('load');await expect(controller.ready).resolves.toBe(true);mock.emit('click',{lngLat:{lng:52,lat:36}});expect(options.onPoint).toHaveBeenCalledWith({latitude:36,longitude:52});const button=vi.mocked(mock.sdk.createMarker).mock.calls[0]![0];expect(button.textContent).toBe('۱');expect(button.getAttribute('aria-label')).toContain('هتل نمونه (خیالی)');controller.dispose();expect(mock.map.remove).toHaveBeenCalledTimes(1);expect(mock.markers.every(m=>vi.mocked(m.remove).mock.calls.length===1)).toBe(true);mock.emit('click',{lngLat:{lng:53,lat:37}});expect(options.onPoint).toHaveBeenCalledTimes(1);});
 it('never constructs or publishes after disposal while the module import is unresolved',async()=>{const mock=mockSdk(),options=input();let resolve!:(sdk:FreeMapSdk)=>void;const pending=new Promise<FreeMapSdk>(r=>{resolve=r;});const controller=createFreeMap(document.createElement('div'),options,()=>pending);owned.push(controller);controller.dispose();resolve(mock.sdk);await Promise.resolve();await Promise.resolve();expect(mock.sdk.createMap).not.toHaveBeenCalled();await expect(controller.ready).resolves.toBe(false);expect(options.onStatus).not.toHaveBeenCalledWith('ready');});
 it('switches official light/dark style without losing camera, point or click ownership',async()=>{const mock=mockSdk(),options=input(),controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await Promise.resolve();await Promise.resolve();mock.emit('load');controller.update({appearance:'dark',choices:options.choices,point:{latitude:37,longitude:53}});expect(mock.map.setStyle).toHaveBeenCalledWith('https://vector.openstreetmap.org/styles/shortbread/shadow.json');expect(mock.map.jumpTo).toHaveBeenCalledWith({center:[51.45,35.75],zoom:13,pitch:0,bearing:0});expect(mock.markers.some(m=>vi.mocked(m.setLngLat).mock.calls.some(c=>c[0][0]===53&&c[0][1]===37))).toBe(true);mock.emit('click',{lngLat:{lng:54,lat:38}});expect(options.onPoint).toHaveBeenCalledWith({latitude:38,longitude:54});});
 it('bounds failed network/module loading and rejects stale transaction events without a substitute basemap',async()=>{vi.useFakeTimers();const mock=mockSdk(),options=input();let current=true;options.isCurrent=()=>current;const controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await Promise.resolve();await Promise.resolve();current=false;mock.emit('click',{lngLat:{lng:52,lat:36}});expect(options.onPoint).not.toHaveBeenCalled();current=true;await vi.advanceTimersByTimeAsync(1001);expect(options.onStatus).toHaveBeenLastCalledWith('unavailable');await expect(controller.ready).resolves.toBe(false);expect(mock.map.remove).toHaveBeenCalledTimes(1);});
 it('allows only one active provider instance and removes the prior map before mounting a replacement',async()=>{const first=mockSdk(),second=mockSdk();const a=createFreeMap(document.createElement('div'),input(),async()=>first.sdk);owned.push(a);await Promise.resolve();await Promise.resolve();const b=createFreeMap(document.createElement('div'),input(),async()=>second.sdk);owned.push(b);await Promise.resolve();await Promise.resolve();expect(first.map.remove).toHaveBeenCalledTimes(1);expect(second.sdk.createMap).toHaveBeenCalledTimes(1);a.dispose();expect(second.map.remove).not.toHaveBeenCalled();});
});

const discovery=():FreeMapInput=>({...input(),discovery:true,pickingPoint:false,selectedHotelId:'hotel-a',onSelectHotel:vi.fn(),choices:[
 {id:'arrival:IKA',name:'فرودگاه امام خمینی',code:'IKA',mode:'flight',kind:'arrival',point:{latitude:35.42,longitude:51.15}},
 {id:'hotel-a',name:'هتل آفتاب',kind:'hotel',point:{latitude:35.45,longitude:51.22}},
 {id:'hotel-b',name:'هتل ماه',kind:'hotel',point:{latitude:35.48,longitude:51.26}},
]});
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function markerNode(mock:ReturnType<typeof mockSdk>,id:string){return vi.mocked(mock.sdk.createMarker).mock.calls.map(call=>call[0]).find(node=>node.dataset['mapChoiceId']===id)!;}

describe('arrival hotel map controlled markers and geometry',()=>{
 it('distinguishes the actual static arrival hub from named hotel buttons and does not change reference on ordinary clicks',async()=>{
  const mock=mockSdk(),options=discovery(),controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await flush();
  const arrival=markerNode(mock,'arrival:IKA'),hotel=markerNode(mock,'hotel-a');
  expect(arrival.tagName).toBe('DIV');expect(arrival).toHaveAttribute('role','img');expect(arrival).toHaveAccessibleName('نقطه رسیدن: فرودگاه امام خمینی (IKA)');expect(arrival.querySelector('bdi')).toHaveTextContent('(IKA)');
  expect(hotel.tagName).toBe('BUTTON');expect(hotel).toHaveAccessibleName('انتخاب هتل آفتاب روی نقشه');expect(hotel.querySelector('[data-marker-name]')).toHaveTextContent('هتل آفتاب');expect(hotel).toHaveAttribute('aria-pressed','true');
  hotel.click();arrival.click();mock.emit('click',{lngLat:{lng:52,lat:36}});
  expect(options.onSelectHotel).toHaveBeenCalledExactlyOnceWith('hotel-a');expect(options.onPoint).not.toHaveBeenCalled();
 });

 it('focuses a current clicked hotel despite SDK-prevented mouse focus and never steals focus through a stale owner',async()=>{
  const mock=mockSdk(),options=discovery(),element=document.createElement('div');let current=true;options.isCurrent=()=>current;document.body.append(element);
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const hotel=markerNode(mock,'hotel-a'),arrival=markerNode(mock,'arrival:IKA'),outside=document.createElement('button');element.append(hotel,arrival);document.body.append(outside);
  const focus=vi.spyOn(hotel,'focus');hotel.addEventListener('mousedown',event=>event.preventDefault());
  outside.focus();expect(hotel.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))).toBe(false);expect(outside).toHaveFocus();hotel.click();
  expect(focus).toHaveBeenCalledExactlyOnceWith({preventScroll:true});expect(hotel).toHaveFocus();expect(options.onSelectHotel).toHaveBeenCalledExactlyOnceWith('hotel-a');
  current=false;outside.focus();hotel.click();expect(outside).toHaveFocus();expect(focus).toHaveBeenCalledTimes(1);expect(options.onSelectHotel).toHaveBeenCalledTimes(1);
  current=true;arrival.click();expect(outside).toHaveFocus();controller.dispose();hotel.click();expect(outside).toHaveFocus();expect(focus).toHaveBeenCalledTimes(1);element.remove();outside.remove();
 });

 it('retains the native focused marker and camera across sorting, selected-state updates and equal geometry',async()=>{
  const mock=mockSdk(),options=discovery(),element=document.createElement('div');document.body.append(element);
  mock.map.fitBounds=vi.fn();mock.map.getBounds=()=>({contains:()=>true});mock.map.easeTo=vi.fn();
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const button=markerNode(mock,'hotel-a');element.append(button);button.focus();expect(button).toHaveFocus();
  controller.update({...options,choices:[...options.choices].reverse(),selectedHotelId:'hotel-b'});
  expect(mock.sdk.createMap).toHaveBeenCalledTimes(1);expect(mock.sdk.createMarker).toHaveBeenCalledTimes(3);expect(mock.markers.every(marker=>!vi.mocked(marker.remove).mock.calls.length)).toBe(true);
  expect(button).toHaveFocus();expect(button).toHaveAttribute('aria-pressed','false');expect(markerNode(mock,'hotel-b')).toHaveAttribute('aria-pressed','true');expect(element.dataset['selectedHotelId']).toBe('hotel-b');
  expect(mock.map.fitBounds).toHaveBeenCalledTimes(1);expect(mock.map.fitBounds).toHaveBeenCalledWith([[51.15,35.42],[51.26,35.48]],{padding:56,maxZoom:13.2,duration:560});expect(mock.map.easeTo).not.toHaveBeenCalled();
  controller.dispose();element.remove();
 });

 it('brings an offscreen selected hotel back smoothly, respects reduced motion and never focuses an unknown id',async()=>{
  const mock=mockSdk(),options=discovery();mock.map.fitBounds=vi.fn();mock.map.getBounds=()=>({contains:()=>false});mock.map.easeTo=vi.fn();mock.map.stop=vi.fn();
  const controller=createFreeMap(document.createElement('div'),{...options,selectedHotelId:undefined},async()=>mock.sdk);owned.push(controller);await flush();
  controller.update({...options,selectedHotelId:'hotel-a'});expect(mock.map.easeTo).toHaveBeenLastCalledWith({center:[51.22,35.45],duration:420});
  controller.update({...options,selectedHotelId:'hotel-b',motionEnabled:false});expect(mock.map.stop).toHaveBeenCalledTimes(1);expect(mock.map.easeTo).toHaveBeenLastCalledWith({center:[51.26,35.48],duration:0});
  controller.update({...options,selectedHotelId:'not-in-this-city'});expect(mock.map.easeTo).toHaveBeenCalledTimes(2);expect(mock.map.fitBounds).toHaveBeenCalledTimes(1);
 });

 it('only changes a custom reference during an explicit pick, with matching labels and drag authority',async()=>{
  const mock=mockSdk(),options={...discovery(),point:{latitude:35.5,longitude:51.2}};
  const controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await flush();
  const hotel=markerNode(mock,'hotel-b'),reference=markerNode(mock,'custom-point'),marker=mock.markers.at(-1)!;
  expect(reference).toBeDisabled();expect(marker.setDraggable).toHaveBeenLastCalledWith(false);
  controller.update({...options,pickingPoint:true});expect(hotel).toHaveAccessibleName('انتخاب موقعیت هتل ماه');expect(reference).not.toBeDisabled();expect(marker.setDraggable).toHaveBeenLastCalledWith(true);
  hotel.click();expect(options.onPoint).toHaveBeenLastCalledWith({latitude:35.48,longitude:51.26});expect(options.onSelectHotel).not.toHaveBeenCalled();
  mock.emit('click',{lngLat:{lng:181,lat:40}});expect(options.onPoint).toHaveBeenLastCalledWith({latitude:40,longitude:-179});
  controller.update({...options,pickingPoint:false});expect(reference).toBeDisabled();hotel.click();expect(options.onSelectHotel).toHaveBeenCalledExactlyOnceWith('hotel-b');
  mock.emit('click',{lngLat:{lng:52,lat:36}});expect(options.onPoint).toHaveBeenCalledTimes(2);
 });

 it('uses current selection and point mode when the SDK resolves after those props changed',async()=>{
  const mock=mockSdk(),options=discovery();let resolve!:(sdk:FreeMapSdk)=>void;const pending=new Promise<FreeMapSdk>(r=>{resolve=r;});
  const controller=createFreeMap(document.createElement('div'),{...options,choices:options.choices.slice(0,1)},()=>pending);owned.push(controller);
  controller.update({...options,appearance:'dark',selectedHotelId:'hotel-b',pickingPoint:true,motionEnabled:false});resolve(mock.sdk);await flush();
  expect(mock.sdk.createMap).toHaveBeenCalledWith(expect.any(HTMLElement),expect.objectContaining({style:'https://vector.openstreetmap.org/styles/shortbread/shadow.json'}));
  expect(markerNode(mock,'hotel-b')).toHaveAttribute('aria-pressed','true');expect(markerNode(mock,'hotel-b')).toHaveAccessibleName('انتخاب موقعیت هتل ماه');
  markerNode(mock,'hotel-b').click();expect(options.onPoint).toHaveBeenCalledExactlyOnceWith({latitude:35.48,longitude:51.26});expect(options.onSelectHotel).not.toHaveBeenCalled();
 });

 it('removes retired marker listeners and fences all callbacks after ownership is revoked or a map fails',async()=>{
  const mock=mockSdk(),options=discovery(),element=document.createElement('div');let current=true;options.isCurrent=()=>current;
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const retired=markerNode(mock,'hotel-b');controller.update({...options,choices:options.choices.filter(choice=>choice.id!=='hotel-b')});retired.click();expect(options.onSelectHotel).not.toHaveBeenCalled();
  current=false;markerNode(mock,'hotel-a').click();expect(options.onSelectHotel).not.toHaveBeenCalled();current=true;mock.emit('webglcontextlost');
  await expect(controller.ready).resolves.toBe(false);expect(options.onStatus).toHaveBeenLastCalledWith('unavailable');expect(mock.map.remove).toHaveBeenCalledTimes(1);markerNode(mock,'hotel-a').click();expect(options.onSelectHotel).not.toHaveBeenCalled();
  expect(mock.markers.every(marker=>vi.mocked(marker.remove).mock.calls.length===1)).toBe(true);expect(element).not.toHaveAttribute('data-selected-hotel-id');expect(element).not.toHaveAttribute('data-free-map-camera');
 });

 it('fits the short antimeridian neighborhood and rejects duplicate or invalid positions',async()=>{
  const mock=mockSdk(),options=discovery();mock.map.fitBounds=vi.fn();
  options.choices=[{id:'arrival:AP',name:'فرودگاه',kind:'arrival',point:{latitude:-15,longitude:179.8}},{id:'h',name:'هتل',kind:'hotel',point:{latitude:-15.02,longitude:-179.7}},{id:'h',name:'هتل تکراری',kind:'hotel',point:{latitude:0,longitude:0}},{id:'bad',name:'موقعیت نامعتبر',kind:'hotel',point:{latitude:100,longitude:0}}];
  const controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await flush();
  expect(mock.sdk.createMarker).toHaveBeenCalledTimes(2);const bounds=vi.mocked(mock.map.fitBounds).mock.calls[0]![0];expect(bounds[1][0]-bounds[0][0]).toBeLessThan(1);expect(bounds[0][1]).toBe(-15.02);expect(bounds[1][1]).toBe(-15);
 });

 it('restores a saved manual camera on retry instead of refitting unchanged hotel geometry',async()=>{
  const mock=mockSdk(),options={...discovery(),camera:{center:{latitude:35.6,longitude:51.4},zoom:14}};mock.map.fitBounds=vi.fn();
  const controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await flush();
  expect(mock.sdk.createMap).toHaveBeenCalledWith(expect.any(HTMLElement),expect.objectContaining({center:[51.4,35.6],zoom:14}));expect(mock.map.fitBounds).not.toHaveBeenCalled();
 });

 it('declutters coincident named hotel buttons with true-coordinate leaders and recomputes on native camera/viewport events without remounting',async()=>{
  const mock=mockSdk(),options=discovery(),element=document.createElement('div');let width=1035,height=230,pan=0;
  Object.defineProperties(element,{clientWidth:{get:()=>width},clientHeight:{get:()=>height}});
  options.choices=[options.choices[0]!,...Array.from({length:14},(_,index)=>({id:`hotel-${String(index).padStart(2,'0')}`,name:`هتل آفتاب ${index}`,kind:'hotel' as const,point:{latitude:35.45,longitude:51.22}}))];options.selectedHotelId='hotel-00';
  mock.map.project=([longitude])=>longitude===51.15?{x:700+pan,y:170}:{x:450+pan,y:80};
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const hotels=options.choices.filter(choice=>choice.kind==='hotel').map(choice=>markerNode(mock,choice.id)),arrival=markerNode(mock,'arrival:IKA');
  expect(element).toHaveAttribute('data-hotel-map-labels','named');expect(new Set(hotels.map(node=>node.dataset['mapLabelOffset'])).size).toBe(14);expect(arrival.style.getPropertyValue('--map-offset-x')).toBe('');
  const leader=element.querySelector('[data-map-leader-id="hotel-00"]')!;expect(leader.querySelector('line')).toHaveAttribute('x1','450');expect(leader.querySelector('circle')).toHaveAttribute('cy','80');
  expect(mock.markers.slice(1).every(marker=>vi.mocked(marker.setLngLat).mock.calls.every(call=>call[0][0]===51.22&&call[0][1]===35.45))).toBe(true);
  document.body.append(element);element.append(hotels[0]!);hotels[0]!.focus();
  controller.update({...options,choices:[...options.choices].reverse(),selectedHotelId:'hotel-13'});
  expect(hotels[0]).toHaveFocus();expect(mock.sdk.createMap).toHaveBeenCalledTimes(1);expect(mock.sdk.createMarker).toHaveBeenCalledTimes(15);expect(mock.markers.every(marker=>!vi.mocked(marker.remove).mock.calls.length)).toBe(true);
  controller.update({...options,selectedHotelId:'hotel-13',pickingPoint:true});hotels[13]!.click();expect(options.onPoint).toHaveBeenLastCalledWith({latitude:35.45,longitude:51.22});
  pan=30;mock.emit('move');expect(leader.querySelector('line')).toHaveAttribute('x1','480');
  width=360;height=250;mock.map.project=()=>({x:180,y:100});mock.emit('resize');expect(element).toHaveAttribute('data-hotel-map-labels','compact');expect(hotels[13]).toHaveAttribute('data-map-label-collapsed','false');expect(hotels[0]).toHaveAttribute('data-map-label-collapsed','false');
  const compact=hotels.find(node=>node.dataset['mapLabelCollapsed']==='true')!,offset=compact.dataset['mapLabelOffset'];element.append(compact);compact.dispatchEvent(new MouseEvent('mouseenter'));expect(compact).toHaveAttribute('data-map-label-collapsed','false');expect(compact.dataset['mapLabelOffset']).toBe(offset);compact.click();expect(options.onPoint).toHaveBeenLastCalledWith({latitude:35.45,longitude:51.22});
  compact.dispatchEvent(new MouseEvent('mouseleave'));const beforeFocus=compact.dataset['mapLabelOffset'];compact.focus();expect(compact).toHaveFocus();expect(compact.dataset['mapLabelOffset']).toBe(beforeFocus);expect(compact).toHaveAttribute('data-map-label-collapsed','false');
  const retiredMove=[...(mock.events.get('move')??[])][0]!;controller.dispose();expect(element.querySelector('[data-hotel-map-leaders]')).toBeNull();expect(mock.events.get('move')?.size).toBe(0);expect(mock.events.get('resize')?.size).toBe(0);retiredMove({});expect(element.childElementCount).toBe(0);element.remove();
 });
});
