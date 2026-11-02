import {afterEach,describe,it,expect,vi} from 'vitest';
import {createFreeMap,type FreeMapSdk,type MapPort,type MarkerPort,type FreeMapInput,type MapEventName} from './free-map-adapter';
function mockSdk(){const events=new Map<MapEventName,Set<(event:unknown)=>void>>();const map:MapPort={on:(name,fn)=>{const set=events.get(name)??new Set();set.add(fn);events.set(name,set);},off:(name,fn)=>events.get(name)?.delete(fn),remove:vi.fn(),resize:vi.fn(),setStyle:vi.fn(),isStyleLoaded:vi.fn(()=>true),queryRenderedFeatures:vi.fn(()=>[{source:'openmaptiles'}]),getCenter:()=>({lng:51.45,lat:35.75}),getZoom:()=>13,jumpTo:vi.fn()};const markers:MarkerPort[]=[];const sdk:FreeMapSdk={createMap:vi.fn(()=>map),createMarker:vi.fn(()=>{const marker:MarkerPort={setLngLat:vi.fn(()=>marker),addTo:vi.fn(()=>marker),remove:vi.fn(),getLngLat:()=>({lng:51,lat:35}),on:vi.fn(),off:vi.fn(),setDraggable:vi.fn()};markers.push(marker);return marker;})};return {map,sdk,markers,events,emit:(name:MapEventName,event:unknown={})=>{for(const fn of events.get(name)??[])fn(event);}};}
const input=():FreeMapInput=>({center:{latitude:35,longitude:51},appearance:'light',choices:[{id:'h',name:'هتل نمونه (خیالی)',number:1,point:{latitude:35,longitude:51}}],isCurrent:()=>true,onPoint:vi.fn(),onStatus:vi.fn(),markerClassName:'marker',timeoutMs:1000});
const owned:ReturnType<typeof createFreeMap>[]=[];afterEach(()=>{owned.splice(0).forEach(c=>c.dispose());vi.useRealTimers();});
describe('free provider adapter with controlled SDK, no network',()=>{
 it('defers construction, maps native lngLat to the provisional point, keeps full accessible marker titles and cleans every owned resource',async()=>{const mock=mockSdk(),options=input(),element=document.createElement('div');const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await Promise.resolve();await Promise.resolve();expect(mock.sdk.createMap).toHaveBeenCalledTimes(1);expect(mock.sdk.createMap).toHaveBeenCalledWith(element,expect.objectContaining({style:'https://tiles.openfreemap.org/styles/bright',pitch:0,bearing:0,maxPitch:0}));mock.emit('style.load');mock.emit('load');await expect(controller.ready).resolves.toBe(true);mock.emit('click',{lngLat:{lng:52,lat:36}});expect(options.onPoint).toHaveBeenCalledWith({latitude:36,longitude:52});const button=vi.mocked(mock.sdk.createMarker).mock.calls[0]![0];expect(button.textContent).toBe('۱');expect(button.getAttribute('aria-label')).toContain('هتل نمونه (خیالی)');controller.dispose();expect(mock.map.remove).toHaveBeenCalledTimes(1);expect(mock.markers.every(m=>vi.mocked(m.remove).mock.calls.length===1)).toBe(true);mock.emit('click',{lngLat:{lng:53,lat:37}});expect(options.onPoint).toHaveBeenCalledTimes(1);});
 it('never constructs or publishes after disposal while the module import is unresolved',async()=>{const mock=mockSdk(),options=input();let resolve!:(sdk:FreeMapSdk)=>void;const pending=new Promise<FreeMapSdk>(r=>{resolve=r;});const controller=createFreeMap(document.createElement('div'),options,()=>pending);owned.push(controller);controller.dispose();resolve(mock.sdk);await Promise.resolve();await Promise.resolve();expect(mock.sdk.createMap).not.toHaveBeenCalled();await expect(controller.ready).resolves.toBe(false);expect(options.onStatus).not.toHaveBeenCalledWith('ready');});
 it('switches the provider light/dark style without losing camera, point or click ownership',async()=>{const mock=mockSdk(),options=input(),controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await Promise.resolve();await Promise.resolve();mock.emit('style.load');mock.emit('load');controller.update({appearance:'dark',choices:options.choices,point:{latitude:37,longitude:53}});expect(mock.map.setStyle).toHaveBeenCalledWith('https://tiles.openfreemap.org/styles/dark',{diff:false});expect(mock.map.jumpTo).toHaveBeenCalledWith({center:[51.45,35.75],zoom:13,pitch:0,bearing:0});expect(mock.markers.some(m=>vi.mocked(m.setLngLat).mock.calls.some(c=>c[0][0]===53&&c[0][1]===37))).toBe(true);mock.emit('click',{lngLat:{lng:54,lat:38}});expect(options.onPoint).toHaveBeenCalledWith({latitude:38,longitude:54});});
 it('bounds failed network/module loading and rejects stale transaction events without a substitute basemap',async()=>{vi.useFakeTimers();const mock=mockSdk(),options=input();let current=true;options.isCurrent=()=>current;const controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await Promise.resolve();await Promise.resolve();current=false;mock.emit('click',{lngLat:{lng:52,lat:36}});expect(options.onPoint).not.toHaveBeenCalled();current=true;await vi.advanceTimersByTimeAsync(1001);expect(options.onStatus).toHaveBeenLastCalledWith('unavailable');await expect(controller.ready).resolves.toBe(false);expect(mock.map.remove).toHaveBeenCalledTimes(1);});
 it('allows only one active provider instance and removes the prior map before mounting a replacement',async()=>{const first=mockSdk(),second=mockSdk();const a=createFreeMap(document.createElement('div'),input(),async()=>first.sdk);owned.push(a);await Promise.resolve();await Promise.resolve();const b=createFreeMap(document.createElement('div'),input(),async()=>second.sdk);owned.push(b);await Promise.resolve();await Promise.resolve();expect(first.map.remove).toHaveBeenCalledTimes(1);expect(second.sdk.createMap).toHaveBeenCalledTimes(1);a.dispose();expect(second.map.remove).not.toHaveBeenCalled();});
});

describe('real basemap readiness and recoverable provider errors',()=>{
 it('waits for actual rendered streets after a transient tile error, then stops readiness probes',async()=>{
  vi.useFakeTimers();const mock=mockSdk(),options=input();
  vi.mocked(mock.map.queryRenderedFeatures).mockReturnValue([]);
  const controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await flush();
  mock.emit('style.load');mock.emit('error',{tile:{},error:new Error('temporary tile failure')});mock.emit('load');mock.emit('idle');
  expect(options.onStatus).toHaveBeenLastCalledWith('loading');expect(mock.map.remove).not.toHaveBeenCalled();
  vi.mocked(mock.map.queryRenderedFeatures).mockReturnValue([{source:'openmaptiles'}]);mock.emit('idle');
  await expect(controller.ready).resolves.toBe(true);expect(options.onStatus).toHaveBeenLastCalledWith('ready');
  const probes=vi.mocked(mock.map.queryRenderedFeatures).mock.calls.length;
  mock.emit('idle');mock.emit('load');mock.emit('error',{error:new Error('unavailable optional glyph')});await vi.advanceTimersByTimeAsync(2000);
  expect(mock.map.queryRenderedFeatures).toHaveBeenCalledTimes(probes);expect(mock.map.remove).not.toHaveBeenCalled();
 });

 it('never accepts DOM hotel pins, other sources or a settled all-tile failure as a basemap',async()=>{
  vi.useFakeTimers();const mock=mockSdk(),options=discovery(),element=document.createElement('div');
  vi.mocked(mock.map.queryRenderedFeatures).mockReturnValue([]);
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  expect(markerNode(mock,'hotel-a')).toHaveAttribute('data-map-hotel-id','hotel-a');
  mock.emit('style.load');mock.emit('error',{tile:{},error:new Error('all visible tiles failed')});mock.emit('load');mock.emit('idle');
  vi.mocked(mock.map.queryRenderedFeatures).mockReturnValue([{source:'hillshade'},{source:'hotel-pins'}]);mock.emit('idle');
  expect(options.onStatus).not.toHaveBeenCalledWith('ready');
  await vi.advanceTimersByTimeAsync(1001);await expect(controller.ready).resolves.toBe(false);
  expect(options.onStatus).toHaveBeenLastCalledWith('unavailable');expect(mock.map.remove).toHaveBeenCalledTimes(1);expect(element).not.toHaveAttribute('data-selected-hotel-id');
 });

 it('retains the current map, camera, markers and selection through post-ready tile, glyph and sprite errors',async()=>{
  vi.useFakeTimers();const mock=mockSdk(),options=discovery(),element=document.createElement('div');
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();mock.emit('style.load');mock.emit('load');
  const hotel=markerNode(mock,'hotel-a'),camera=controller.getCamera(),probes=vi.mocked(mock.map.queryRenderedFeatures).mock.calls.length;
  for(const error of [{tile:{},error:new Error('tile timeout')},{error:new Error('glyph timeout')},{error:new Error('sprite timeout')}])mock.emit('error',error);
  mock.emit('idle');await vi.advanceTimersByTimeAsync(10000);hotel.click();
  expect(options.onStatus).toHaveBeenLastCalledWith('ready');expect(controller.getCamera()).toEqual(camera);
  expect(mock.sdk.createMap).toHaveBeenCalledTimes(1);expect(mock.map.remove).not.toHaveBeenCalled();expect(mock.markers.every(marker=>vi.mocked(marker.remove).mock.calls.length===0)).toBe(true);
  expect(markerNode(mock,'hotel-a')).toBe(hotel);expect(hotel).toHaveAttribute('aria-pressed','true');expect(options.onSelectHotel).toHaveBeenCalledExactlyOnceWith('hotel-a');expect(mock.map.queryRenderedFeatures).toHaveBeenCalledTimes(probes);
 });

 it('replaces a theme style and rejects old readiness callbacks and old features until the new style renders',async()=>{
  const mock=mockSdk(),options=discovery(),element=document.createElement('div');
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const oldStyle=[...mock.events.get('style.load')!][0]!,oldIdle=[...mock.events.get('idle')!][0]!;
  mock.emit('style.load');mock.emit('load');await expect(controller.ready).resolves.toBe(true);
  const hotel=markerNode(mock,'hotel-a'),probes=vi.mocked(mock.map.queryRenderedFeatures).mock.calls.length;
  controller.update({...options,appearance:'dark'});
  expect(mock.map.setStyle).toHaveBeenCalledExactlyOnceWith('https://tiles.openfreemap.org/styles/dark',{diff:false});
  oldStyle({});oldIdle({});mock.emit('load');mock.emit('idle');
  expect(options.onStatus).toHaveBeenLastCalledWith('loading');expect(mock.map.queryRenderedFeatures).toHaveBeenCalledTimes(probes);
  mock.emit('style.load');vi.mocked(mock.map.isStyleLoaded).mockReturnValue(false);mock.emit('idle');expect(options.onStatus).toHaveBeenLastCalledWith('loading');
  vi.mocked(mock.map.isStyleLoaded).mockReturnValue(true);vi.mocked(mock.map.queryRenderedFeatures).mockReturnValue([]);mock.emit('idle');expect(options.onStatus).toHaveBeenLastCalledWith('loading');
  vi.mocked(mock.map.queryRenderedFeatures).mockReturnValue([{source:'openmaptiles'}]);mock.emit('idle');
  expect(options.onStatus).toHaveBeenLastCalledWith('ready');expect(mock.sdk.createMap).toHaveBeenCalledTimes(1);expect(markerNode(mock,'hotel-a')).toBe(hotel);
  expect(mock.map.jumpTo).toHaveBeenLastCalledWith({center:[51.45,35.75],zoom:13,pitch:0,bearing:0});expect(element).toHaveAttribute('data-selected-hotel-id','hotel-a');
 });

 it('bounds an unavailable replacement style and fences retained callbacks after teardown',async()=>{
  vi.useFakeTimers();const mock=mockSdk(),options=discovery(),element=document.createElement('div');
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();mock.emit('style.load');mock.emit('load');
  controller.update({...options,appearance:'dark'});const style=[...mock.events.get('style.load')!][0]!,idle=[...mock.events.get('idle')!][0]!,hotel=markerNode(mock,'hotel-a');
  mock.emit('error',{error:new Error('style unavailable')});mock.emit('idle');expect(options.onStatus).toHaveBeenLastCalledWith('loading');
  await vi.advanceTimersByTimeAsync(1001);expect(options.onStatus).toHaveBeenLastCalledWith('unavailable');expect(mock.map.remove).toHaveBeenCalledTimes(1);
  const probes=vi.mocked(mock.map.queryRenderedFeatures).mock.calls.length;style({});idle({});hotel.click();
  expect(mock.map.queryRenderedFeatures).toHaveBeenCalledTimes(probes);expect(options.onStatus).toHaveBeenLastCalledWith('unavailable');expect(options.onSelectHotel).not.toHaveBeenCalled();
 });

 it('fails immediately when a style replacement throws and removes its owned map exactly once',async()=>{
  const mock=mockSdk(),options=input(),controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await flush();mock.emit('style.load');mock.emit('load');
  vi.mocked(mock.map.setStyle).mockImplementation(()=>{throw new Error('invalid provider style');});
  expect(()=>controller.update({...options,appearance:'dark'})).not.toThrow();expect(options.onStatus).toHaveBeenLastCalledWith('unavailable');expect(mock.map.remove).toHaveBeenCalledTimes(1);
  controller.dispose();expect(mock.map.remove).toHaveBeenCalledTimes(1);
 });

 it('handles an SDK rejection without mounting a substitute map',async()=>{
  const options=input(),element=document.createElement('div'),controller=createFreeMap(element,options,()=>Promise.reject(new Error('SDK unavailable')));owned.push(controller);
  await expect(controller.ready).resolves.toBe(false);expect(options.onStatus).toHaveBeenLastCalledWith('unavailable');expect(element).toBeEmptyDOMElement();
 });
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
  const element=document.createElement('div'),controller=createFreeMap(element,{...options,selectedHotelId:undefined},async()=>mock.sdk);owned.push(controller);await flush();expect(element).toHaveAttribute('data-free-map-motion','finite');
  controller.update({...options,selectedHotelId:'hotel-a'});expect(mock.map.easeTo).toHaveBeenLastCalledWith({center:[51.22,35.45],duration:420});
  controller.update({...options,selectedHotelId:'hotel-b',motionEnabled:false});expect(mock.map.stop).toHaveBeenCalledTimes(1);expect(mock.map.easeTo).toHaveBeenLastCalledWith({center:[51.26,35.48],duration:0});expect(element).toHaveAttribute('data-free-map-motion','static');expect(markerNode(mock,'hotel-a').querySelector('[data-marker-pin]')).toHaveAttribute('data-marker-enter','false');
  controller.update({...options,selectedHotelId:'not-in-this-city'});expect(mock.map.easeTo).toHaveBeenCalledTimes(2);expect(mock.map.fitBounds).toHaveBeenCalledTimes(1);expect(element).toHaveAttribute('data-free-map-motion','finite');expect(markerNode(mock,'hotel-a').querySelector('[data-marker-pin]')).toHaveAttribute('data-marker-enter','false');
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
 it('chooses a real cluster aggregate during reference picking, while ordinary and retired cluster actions retain zoom authority',async()=>{
  const mock=mockSdk(),options=discovery(),element=document.createElement('div');mock.map.project=()=>({x:100,y:100});mock.map.fitBounds=vi.fn();
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();const count=vi.mocked(mock.sdk.createMarker).mock.calls.map(call=>call[0]).find(node=>node.hasAttribute('data-map-cluster'))!,fits=vi.mocked(mock.map.fitBounds).mock.calls.length;
  controller.update({...options,pickingPoint:true});expect(count).toHaveAccessibleName('انتخاب موقعیت گروه ۲ هتل');count.click();expect(mock.map.fitBounds).toHaveBeenCalledTimes(fits);expect(options.onSelectHotel).not.toHaveBeenCalled();expect(options.onPoint).toHaveBeenCalledTimes(1);expect(vi.mocked(options.onPoint).mock.calls[0]![0].latitude).toBeCloseTo((35.45+35.48)/2,8);expect(vi.mocked(options.onPoint).mock.calls[0]![0].longitude).toBeCloseTo((51.22+51.26)/2,8);
  controller.update({...options,pickingPoint:false});expect(count).toHaveAccessibleName('بزرگ‌نمایی برای نمایش ۲ هتل');count.click();expect(mock.map.fitBounds).toHaveBeenCalledTimes(fits+1);expect(options.onPoint).toHaveBeenCalledTimes(1);
  controller.dispose();count.click();expect(mock.map.fitBounds).toHaveBeenCalledTimes(fits+1);expect(options.onPoint).toHaveBeenCalledTimes(1);
 });
 it('accepts native lngLat getters and ignores missing or malformed bare-map event coordinates',async()=>{
  const mock=mockSdk(),options={...discovery(),pickingPoint:true},controller=createFreeMap(document.createElement('div'),options,async()=>mock.sdk);owned.push(controller);await flush();
  class LngLat {get lng(){return 181;}get lat(){return 40;}}
  mock.emit('click',{lngLat:new LngLat()});expect(options.onPoint).toHaveBeenCalledExactlyOnceWith({latitude:40,longitude:-179});
  for(const event of [null,{}, {lngLat:null},{lngLat:'invalid'},{lngLat:{lng:NaN,lat:40}},{lngLat:{lng:50,lat:100}}])expect(()=>mock.emit('click',event)).not.toThrow();expect(options.onPoint).toHaveBeenCalledTimes(1);
 });

 it('uses current selection and point mode when the SDK resolves after those props changed',async()=>{
  const mock=mockSdk(),options=discovery();let resolve!:(sdk:FreeMapSdk)=>void;const pending=new Promise<FreeMapSdk>(r=>{resolve=r;});
  const controller=createFreeMap(document.createElement('div'),{...options,choices:options.choices.slice(0,1)},()=>pending);owned.push(controller);
  controller.update({...options,appearance:'dark',selectedHotelId:'hotel-b',pickingPoint:true,motionEnabled:false});resolve(mock.sdk);await flush();
  expect(mock.sdk.createMap).toHaveBeenCalledWith(expect.any(HTMLElement),expect.objectContaining({style:'https://tiles.openfreemap.org/styles/dark'}));
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

 it('keeps hotel pins at source anchors and reveals only the latest hovered or focused name, including after selection and sorting',async()=>{
  const mock=mockSdk(),options=discovery(),element=document.createElement('div');let width=1035,height=230,pan=0;
  Object.defineProperties(element,{clientWidth:{get:()=>width},clientHeight:{get:()=>height}});
  options.choices=[options.choices[0]!,...Array.from({length:14},(_,index)=>({id:`hotel-${String(index).padStart(2,'0')}`,name:`هتل آفتاب ${index}`,kind:'hotel' as const,point:{latitude:35.45+index*.002,longitude:51.22}}))];options.selectedHotelId='hotel-00';
  mock.map.project=([longitude,latitude])=>longitude===51.15?{x:700+pan,y:170}:{x:90+(latitude-35.45)/.002*64+pan,y:80};
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const hotels=options.choices.filter(choice=>choice.kind==='hotel').map(choice=>markerNode(mock,choice.id)),arrival=markerNode(mock,'arrival:IKA');
  expect(element).toHaveAttribute('data-hotel-map-labels','hover');expect(hotels.every(node=>node.dataset['mapLabelVisible']==='false'&&node.dataset['mapLabelOffset']==='0,0')).toBe(true);
  expect(element.querySelector('[data-hotel-map-leaders]')).toBeNull();expect(hotels.every(node=>!node.hasAttribute('title')&&!node.style.getPropertyValue('--map-offset-x'))).toBe(true);
  expect(arrival.querySelector('[data-marker-name]')).toHaveTextContent('فرودگاه امام خمینی');
  const visible=()=>hotels.filter(node=>node.dataset['mapLabelVisible']==='true');
  hotels[13]!.dispatchEvent(new MouseEvent('mouseenter'));expect(visible()).toEqual([hotels[13]]);
  document.body.append(element);element.append(...hotels);hotels[0]!.focus();expect(visible()).toEqual([hotels[0]]);
  hotels[13]!.dispatchEvent(new MouseEvent('mouseenter'));expect(visible()).toEqual([hotels[13]]);hotels[13]!.dispatchEvent(new MouseEvent('mouseleave'));expect(visible()).toEqual([hotels[0]]);
  hotels[0]!.blur();expect(visible()).toEqual([]);
  controller.update({...options,choices:[...options.choices].reverse(),selectedHotelId:'hotel-13'});expect(visible()).toEqual([]);
  expect(mock.sdk.createMap).toHaveBeenCalledTimes(1);expect(mock.sdk.createMarker).toHaveBeenCalledTimes(15);expect(mock.markers.every(marker=>!vi.mocked(marker.remove).mock.calls.length)).toBe(true);
  expect(mock.markers.slice(1).every((marker,index)=>vi.mocked(marker.setLngLat).mock.calls.every(call=>call[0][0]===51.22&&call[0][1]===35.45+index*.002))).toBe(true);
  controller.update({...options,selectedHotelId:'hotel-13',pickingPoint:true});hotels[13]!.click();expect(options.onPoint).toHaveBeenLastCalledWith({latitude:35.45+13*.002,longitude:51.22});
  width=360;height=250;pan=30;mock.map.project=([longitude,latitude])=>longitude===51.15?{x:250,y:170}:{x:10+(35.45+13*.002-latitude)*40000,y:12};mock.emit('resize');
  expect(hotels[13]).toHaveAttribute('data-map-tooltip-placement','below');expect(hotels[13]).toHaveAttribute('data-map-label-offset','0,0');expect(visible()).toEqual([hotels[13]]);
  const move=[...(mock.events.get('move')??[])][0]!;controller.dispose();expect(mock.events.get('move')?.size).toBe(0);expect(mock.events.get('resize')?.size).toBe(0);move({});expect(element.childElementCount).toBe(0);expect(visible()).toEqual([]);element.remove();
 });
 it('repositions only the inspected tooltip when the map moves near an edge and never shows an offscreen label inside the viewport',async()=>{
  const mock=mockSdk(),options=discovery(),element=document.createElement('div');let x=180,y=100;
  Object.defineProperties(element,{clientWidth:{value:360},clientHeight:{value:230}});mock.map.project=([longitude])=>longitude===51.26?{x,y}:{x:1000,y:1000};
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const hotel=markerNode(mock,'hotel-b'),name=hotel.querySelector<HTMLElement>('[data-marker-name]')!;
  hotel.dispatchEvent(new MouseEvent('mouseenter'));expect(hotel).toHaveAttribute('data-map-label-visible','true');expect(hotel).toHaveAttribute('data-map-tooltip-offset','0,0');
  x=4;y=8;mock.emit('move');expect(hotel).toHaveAttribute('data-map-tooltip-placement','below');expect(Number.parseFloat(name.style.getPropertyValue('--map-label-adjust-x'))).toBeGreaterThan(0);expect(hotel).toHaveAttribute('data-map-label-offset','0,0');
  x=-5;mock.emit('move');expect(hotel).toHaveAttribute('data-map-label-visible','false');expect(hotel).toHaveAttribute('data-map-tooltip-placement','offscreen');
  expect(mock.markers[2]!.setLngLat).toHaveBeenCalledExactlyOnceWith([51.26,35.48]);
 });
 it('rejects stale hover/focus events and removes every tooltip listener when the marker or controller retires',async()=>{
  const mock=mockSdk(),options=discovery(),element=document.createElement('div');let current=true;options.isCurrent=()=>current;
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();const hotel=markerNode(mock,'hotel-b');
  current=false;hotel.dispatchEvent(new MouseEvent('mouseenter'));hotel.dispatchEvent(new FocusEvent('focus'));expect(hotel).toHaveAttribute('data-map-label-visible','false');
  current=true;hotel.dispatchEvent(new MouseEvent('mouseenter'));expect(hotel).toHaveAttribute('data-map-label-visible','true');
  controller.update({...options,choices:options.choices.filter(choice=>choice.id!=='hotel-b')});expect(hotel).toHaveAttribute('data-map-label-visible','false');hotel.dispatchEvent(new MouseEvent('mouseenter'));hotel.dispatchEvent(new FocusEvent('focus'));hotel.click();expect(hotel).toHaveAttribute('data-map-label-visible','false');expect(options.onSelectHotel).not.toHaveBeenCalled();
  controller.dispose();markerNode(mock,'hotel-a').dispatchEvent(new MouseEvent('mouseenter'));expect(markerNode(mock,'hotel-a')).toHaveAttribute('data-map-label-visible','false');
 });
 it('aggregates a crowded overview honestly, zooms count bounds, and reveals the same true-anchor markers as screen separation grows',async()=>{
  const mock=mockSdk(),element=document.createElement('div'),options=discovery();let zoom=11;
  Object.defineProperties(element,{clientWidth:{value:720},clientHeight:{value:300}});
  options.selectedHotelId=undefined;options.choices=[options.choices[0]!,...Array.from({length:14},(_,index)=>({id:`hotel-${String(index).padStart(2,'0')}`,name:`هتل ${index}`,kind:'hotel' as const,point:{latitude:36.3+index*.001,longitude:59.6+index*.001}}))];
  mock.map.getZoom=()=>zoom;mock.map.project=([lng,lat])=>({x:360+(lng-59.606)*900*2**(zoom-11),y:150-(lat-36.306)*900*2**(zoom-11)});mock.map.fitBounds=vi.fn();
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const hotels=options.choices.filter(choice=>choice.kind==='hotel').map(choice=>markerNode(mock,choice.id));
  const count=vi.mocked(mock.sdk.createMarker).mock.calls.map(call=>call[0]).find(node=>node.hasAttribute('data-map-cluster'))!;
  expect(count).toHaveAttribute('data-map-cluster-count','14');expect(JSON.parse(count.dataset['mapClusterMembers']!)).toEqual(hotels.map(node=>node.dataset['mapHotelId']));expect(count).toHaveAccessibleName('بزرگ‌نمایی برای نمایش ۱۴ هتل');
  expect(hotels.every(node=>node.hidden&&node.inert&&node.tabIndex===-1&&(node as HTMLButtonElement).disabled)).toBe(true);
  hotels[0]!.dispatchEvent(new MouseEvent('mouseenter'));hotels[0]!.dispatchEvent(new FocusEvent('focus'));hotels[0]!.click();expect(options.onSelectHotel).not.toHaveBeenCalled();expect(hotels[0]).toHaveAttribute('data-map-label-visible','false');
  expect(markerNode(mock,'arrival:IKA').hidden).toBe(false);expect(markerNode(mock,'arrival:IKA').querySelector('[data-marker-name]')).toHaveTextContent('فرودگاه امام خمینی');
  const markersBefore=mock.sdk.createMarker;controller.update({...options,choices:[...options.choices].reverse(),appearance:'dark'});mock.emit('style.load');expect(markersBefore).toHaveBeenCalledTimes(16);expect(mock.sdk.createMap).toHaveBeenCalledTimes(1);expect(count.hidden).toBe(false);
  count.click();expect(mock.map.fitBounds).toHaveBeenLastCalledWith([[59.6,36.3],[59.6+13*.001,36.3+13*.001]],{padding:64,maxZoom:14,duration:560});expect(options.onPoint).not.toHaveBeenCalled();
  zoom=18;mock.emit('move');expect(count.hidden).toBe(true);expect(hotels.every(node=>!node.hidden&&!node.inert&&node.tabIndex===0&&!(node as HTMLButtonElement).disabled)).toBe(true);expect(hotels.every(node=>node.dataset['mapLabelVisible']==='false'&&node.dataset['mapLabelOffset']==='0,0')).toBe(true);
  hotels[7]!.dispatchEvent(new MouseEvent('mouseenter'));expect(hotels[7]).toHaveAttribute('data-map-label-visible','true');hotels[7]!.click();expect(options.onSelectHotel).toHaveBeenCalledExactlyOnceWith('hotel-07');
  const calls=vi.mocked(mock.map.fitBounds).mock.calls.length;count.click();expect(mock.map.fitBounds).toHaveBeenCalledTimes(calls);
  for(let index=0;index<14;index++)expect(mock.markers[index+1]!.setLngLat).toHaveBeenCalledExactlyOnceWith([59.6+index*.001,36.3+index*.001]);
  expect(mock.sdk.createMarker).toHaveBeenCalledTimes(16);
 });
 it('zooms a controlled card selection until its actual pin clears neighbours, without revealing names or emitting reference edits',async()=>{
  const mock=mockSdk(),element=document.createElement('div'),options=discovery();let zoom=11;
  Object.defineProperties(element,{clientWidth:{value:720},clientHeight:{value:300}});options.selectedHotelId=undefined;
  mock.map.getZoom=()=>zoom;mock.map.getBounds=()=>({contains:()=>true});mock.map.project=([lng,lat])=>({x:360+(lng-51.24)*300*2**(zoom-11),y:150-(lat-35.46)*300*2**(zoom-11)});
  mock.map.easeTo=vi.fn(next=>{zoom=next.zoom??zoom;mock.emit('move');});
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();expect(markerNode(mock,'hotel-b').hidden).toBe(true);
  controller.update({...options,selectedHotelId:'hotel-b'});
  expect(mock.map.easeTo).toHaveBeenCalledExactlyOnceWith({center:[51.26,35.48],zoom:expect.any(Number),duration:420});expect(zoom).toBeGreaterThan(11);expect(markerNode(mock,'hotel-b').hidden).toBe(false);expect(markerNode(mock,'hotel-b')).toHaveAttribute('data-map-label-visible','false');expect(markerNode(mock,'hotel-b')).toHaveAttribute('aria-pressed','true');
  expect(options.onSelectHotel).not.toHaveBeenCalled();expect(options.onPoint).not.toHaveBeenCalled();
  const hotel=markerNode(mock,'hotel-b');hotel.dispatchEvent(new MouseEvent('mouseenter'));expect(hotel).toHaveAttribute('data-map-label-visible','true');
  controller.update({...options,selectedHotelId:'hotel-b',choices:[...options.choices].reverse()});expect(mock.map.easeTo).toHaveBeenCalledTimes(1);expect(mock.sdk.createMap).toHaveBeenCalledTimes(1);expect(mock.sdk.createMarker).toHaveBeenCalledTimes(4);
 });
 it('fences retired count clicks and disposes cluster listeners with current ownership and reduced-motion camera authority',async()=>{
  const mock=mockSdk(),element=document.createElement('div'),options=discovery();let current=true;options.isCurrent=()=>current;mock.map.project=()=>({x:100,y:100});mock.map.fitBounds=vi.fn();
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const count=vi.mocked(mock.sdk.createMarker).mock.calls.map(call=>call[0]).find(node=>node.hasAttribute('data-map-cluster'))!;
  current=false;count.click();expect(mock.map.fitBounds).toHaveBeenCalledTimes(1);
  current=true;controller.update({...options,motionEnabled:false});count.click();expect(mock.map.fitBounds).toHaveBeenLastCalledWith([[51.22,35.45],[51.26,35.48]],{padding:64,maxZoom:16,duration:0});
  controller.update({...options,choices:options.choices.filter(choice=>choice.id!=='hotel-b')});const total=vi.mocked(mock.map.fitBounds).mock.calls.length;count.click();expect(mock.map.fitBounds).toHaveBeenCalledTimes(total);expect(count.hidden).toBe(true);
  expect(markerNode(mock,'hotel-a').hidden).toBe(false);controller.dispose();count.dispatchEvent(new MouseEvent('click'));expect(mock.map.fitBounds).toHaveBeenCalledTimes(total);expect(mock.markers.every(marker=>vi.mocked(marker.remove).mock.calls.length===1)).toBe(true);
 });
 it('makes zoom progress for a viewport-spanning overlap chain and transfers focus to a fully visible real pin after scaling and recentering',async()=>{
  const mock=mockSdk(),element=document.createElement('div'),options=discovery();let zoom=11,center=51.226;
  Object.defineProperties(element,{clientWidth:{value:720},clientHeight:{value:300}});options.selectedHotelId=undefined;
  options.choices=[options.choices[0]!,...Array.from({length:13},(_,index)=>({id:`hotel-${String(index).padStart(2,'0')}`,name:`هتل ${index}`,kind:'hotel' as const,point:{latitude:35.45,longitude:51.22+index*.001}}))];
  mock.map.getZoom=()=>zoom;mock.map.project=([lng])=>({x:360+(lng-center)*49000*2**(zoom-11),y:150});mock.map.fitBounds=vi.fn();mock.map.easeTo=vi.fn(next=>{zoom=11.15;mock.emit('move');zoom=next.zoom??zoom;center=next.center[0];mock.emit('move');});
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();
  const nodes=vi.mocked(mock.sdk.createMarker).mock.calls.map(call=>call[0]),count=nodes.find(node=>node.hasAttribute('data-map-cluster'))!,canvas=document.createElement('canvas');canvas.tabIndex=0;document.body.append(element);element.append(canvas,...nodes);
  count.click();expect(mock.map.easeTo).toHaveBeenCalledExactlyOnceWith({center:expect.any(Array),zoom:12.25,duration:560});expect(mock.map.fitBounds).toHaveBeenCalledTimes(1);expect(count.hidden).toBe(true);
  expect(canvas).toHaveFocus();mock.emit('moveend');
  const first=markerNode(mock,'hotel-00'),visible=markerNode(mock,'hotel-04');expect(first.hidden).toBe(false);expect(first).not.toHaveFocus();expect(visible).toHaveFocus();expect(visible).toHaveAttribute('data-map-label-visible','true');expect(first).toHaveAttribute('data-map-label-visible','false');expect(options.onSelectHotel).not.toHaveBeenCalled();expect(options.onPoint).not.toHaveBeenCalled();
  zoom=11;center=51.226;mock.emit('move');const replacement=vi.mocked(mock.sdk.createMarker).mock.calls.map(call=>call[0]).reverse().find(node=>node.hasAttribute('data-map-cluster'))!;element.append(replacement);replacement.click();expect(canvas).toHaveFocus();
  const outside=document.createElement('button');document.body.append(outside);outside.focus();mock.emit('moveend');expect(outside).toHaveFocus();
  controller.dispose();element.remove();outside.remove();
 });
 it('shows the explicitly selected genuine pin at the zoom ceiling even for constructed identical property coordinates',async()=>{
  const mock=mockSdk(),element=document.createElement('div'),options=discovery();let zoom=13;
  options.selectedHotelId=undefined;options.choices=options.choices.map(choice=>choice.kind==='hotel'?{...choice,point:{latitude:35.45,longitude:51.22}}:choice);
  mock.map.getZoom=()=>zoom;mock.map.getBounds=()=>({contains:()=>true});mock.map.project=()=>({x:100,y:100});mock.map.easeTo=vi.fn(next=>{zoom=next.zoom??zoom;mock.emit('move');});
  const controller=createFreeMap(element,options,async()=>mock.sdk);owned.push(controller);await flush();controller.update({...options,selectedHotelId:'hotel-a'});
  expect(zoom).toBe(20);expect(markerNode(mock,'hotel-a').hidden).toBe(false);expect(markerNode(mock,'hotel-b').hidden).toBe(true);
  controller.update({...options,selectedHotelId:'hotel-b'});expect(markerNode(mock,'hotel-b').hidden).toBe(false);expect(markerNode(mock,'hotel-a').hidden).toBe(true);expect(markerNode(mock,'hotel-b')).toHaveAttribute('data-map-label-offset','0,0');
  expect(mock.markers[1]!.setLngLat).toHaveBeenCalledExactlyOnceWith([51.22,35.45]);expect(mock.markers[2]!.setLngLat).toHaveBeenCalledExactlyOnceWith([51.22,35.45]);expect(options.onSelectHotel).not.toHaveBeenCalled();expect(options.onPoint).not.toHaveBeenCalled();
 });
});
