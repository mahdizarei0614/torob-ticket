import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {CatalogSnapshot,Itinerary,SearchRecovery,TransportSearchQuery} from '@torob-ticket/contracts';
import {buildRouteGeometry,contextForPoints,projectPoint,presentationRoutePaths,offsetPresentationPath,type IllustrativePath,type RouteBounds} from '@torob-ticket/graphics/geometry';

const evidence=process.env.ROUTE_LABEL_EVIDENCE_DIR??'docs/evidence/adjustments/route-label-clearance/browser';
const base:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-08',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const map=(page:Page)=>page.getByRole('complementary',{name:'نقشه سفر',exact:true});
const results=(page:Page)=>page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});
const record=(name:string,data:unknown)=>{mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,name+'.json'),JSON.stringify(data,null,2)+'\n');};
interface Point {x:number;y:number}
interface Box {left:number;top:number;width:number;height:number}
// Independent postcondition: segment/rectangle intersection, including edges
// whose two endpoints are outside. No annotation-placement helper is called.
function intersects(a:Point,b:Point,box:Box,padding=13){
 const left=box.left-padding,right=box.left+box.width+padding,top=box.top-padding,bottom=box.top+box.height+padding;
 const inside=(p:Point)=>p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom;
 if(inside(a)||inside(b))return true;
 const cross=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const edge=(c:Point,d:Point)=>{
  if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.min(a.x,b.x)>Math.max(c.x,d.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.min(a.y,b.y)>Math.max(c.y,d.y))return false;
  return cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
 };
 return edge({x:left,y:top},{x:right,y:top})||edge({x:right,y:top},{x:right,y:bottom})||edge({x:right,y:bottom},{x:left,y:bottom})||edge({x:left,y:bottom},{x:left,y:top});
}
async function choose(page:Page,context:BrowserContext,query:TransportSearchQuery,gpu=true){
 expect((await context.cookies()).length).toBe(0);
 expect((await context.request.post('/api/v1/demo/session',{data:{seed:6161,scenario:'normal',anchorInstant:'2026-11-02T06:00:00Z'}})).status()).toBe(201);
 await page.goto('/?q='+encodeURIComponent(JSON.stringify(query)));
 await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();
 await expect(results(page)).toHaveAttribute('data-status','complete',{timeout:30000});
 const id=await results(page).getAttribute('data-search-id');
 const recovery=await (await context.request.get('/api/v1/searches/'+id)).json() as SearchRecovery;
 const catalog=await (await context.request.get('/api/v1/catalog')).json() as CatalogSnapshot;
 const paths=await (await context.request.get('/geography/route-geometry.json')).json() as {paths:IllustrativePath[]};
 const available=new Set(await results(page).locator('article[data-quote-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-quote-id'))));
 const choices=recovery.snapshot.groups.filter(group=>group.eligibleQuotes.some(quote=>available.has(quote.quoteId)));
 const group=query.mode==='flight'&&query.scope==='domestic'
  ? choices.find(group=>group.itinerary.outbound.stops.some(stop=>stop.placeId==='ifn'))
  : [...choices].sort((a,b)=>(b.itinerary.outbound.stops.length+(b.itinerary.return?.stops.length??0))-(a.itinerary.outbound.stops.length+(a.itinerary.return?.stops.length??0)))[0];
 expect(group).toBeTruthy();
 const quote=group!.eligibleQuotes.find(quote=>available.has(quote.quoteId))!;
 await results(page).locator(`article[data-quote-id="${quote.quoteId}"] [data-card-select]`).press('Space');
 await expect(map(page)).toHaveAttribute('data-map-itinerary',group!.itinerary.itineraryId);
 await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete','true',{timeout:35000});
 if(gpu)await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status','ready');
 await page.evaluate(()=>document.fonts.ready);
 return {itinerary:group!.itinerary,catalog,paths:paths.paths};
}
async function sample(page:Page,facts:{itinerary:Itinerary;catalog:CatalogSnapshot;paths:IllustrativePath[]}){
 const dom=await page.evaluate(()=>{
  const view=document.querySelector<HTMLElement>('[data-route-scene] [data-camera]')!,overlay=document.querySelector<HTMLElement>('[data-route-presentation]')!;
  const rect=view.getBoundingClientRect();
  const labels=Array.from(overlay.querySelectorAll<HTMLElement>('[data-route-endpoint] [dir="rtl"],[data-route-stop] > [dir="rtl"]')).flatMap(node=>{
   const parent=node.closest<HTMLElement>('[data-route-endpoint],[data-route-stop]')!,r=node.getBoundingClientRect();
   const css=getComputedStyle(node);
   if(parent.getAttribute('aria-hidden')==='true'||Number(getComputedStyle(parent).opacity)<.05||Number(css.opacity)<.05||css.display==='none'||css.visibility==='hidden'||!r.width||!r.height)return [];
   return [{text:node.textContent,id:parent.dataset['routeStop']??parent.dataset['routeEndpoint'],occurrence:parent.dataset['stopOccurrence'],direction:parent.dataset['stopDirection'],waitMinutes:parent.dataset['waitMinutes'],left:r.left-rect.left,top:r.top-rect.top,width:r.width,height:r.height,scrollWidth:node.scrollWidth,scrollHeight:node.scrollHeight}];
  });
  const contextLabels=Array.from(overlay.querySelectorAll<HTMLElement>('[data-context-city][data-visible="true"]')).flatMap(node=>{
   const name=node.querySelector<HTMLElement>('span')??node,r=name.getBoundingClientRect(),css=getComputedStyle(name);
   if(Number(getComputedStyle(node).opacity)<.05||css.visibility==='hidden'||css.display==='none'||!r.width||!r.height)return [];
   return [{id:node.dataset['contextCity'],text:name.textContent,left:r.left-rect.left,top:r.top-rect.top,width:r.width,height:r.height,overflowX:css.overflowX,uncontainedText:css.overflowX==='visible'&&name.scrollWidth>Math.ceil(r.width)+1}];
  });
  return {frame:JSON.parse(view.dataset['camera']!) as RouteBounds,width:rect.width,height:rect.height,labels,contextLabels};
 });
 const legs=[facts.itinerary.outbound,...(facts.itinerary.return?[facts.itinerary.return]:[])];
 const ids=new Set(legs.flatMap(leg=>leg.segments.flatMap(segment=>[segment.originPlaceId,segment.destinationPlaceId])));
 const projection=contextForPoints(facts.catalog.places.filter(place=>ids.has(place.id)).map(place=>place.point));
 const outbound=buildRouteGeometry(facts.itinerary,facts.catalog.places,facts.paths,'outbound',projection);
 const inbound=facts.itinerary.return?buildRouteGeometry(facts.itinerary,facts.catalog.places,facts.paths,'return',projection):[];
 const paths=presentationRoutePaths([...outbound,...inbound],inbound.length?outbound.length:undefined).map(path=>offsetPresentationPath(path,dom.frame.width/dom.width).map(point=>({x:dom.width*(.5+(point[0]-dom.frame.x)/dom.frame.width),y:dom.height*(.5-(point[1]-dom.frame.y)/dom.frame.height)})));
 const boxes=[...dom.labels,...dom.contextLabels];
 const pointOnScreen=(id:string)=>{const place=facts.catalog.places.find(place=>place.id===id)!;const [x,y]=projectPoint(place.point,projection);return {x:dom.width*(.5+(x-dom.frame.x)/dom.frame.width),y:dom.height*(.5-(y-dom.frame.y)/dom.frame.height)};};
 const expectedVisible=legs.flatMap((leg,index)=>leg.stops.flatMap(stop=>{const p=pointOnScreen(stop.placeId);return p.x>=0&&p.x<=dom.width&&p.y>=0&&p.y<=dom.height?[{id:stop.placeId,direction:facts.itinerary.return?(index?'return':'outbound'):undefined,waitMinutes:String(stop.waitMinutes)}]:[];}));
 const missingVisibleFacts=expectedVisible.filter(expected=>!dom.labels.some(label=>label.occurrence&&label.id===expected.id&&label.direction===expected.direction&&label.waitMinutes===expected.waitMinutes));
 const endpointIds=[legs[0]!.segments[0]!.originPlaceId,legs[0]!.segments.at(-1)!.destinationPlaceId];
 const missingVisibleEndpoints=endpointIds.flatMap((id,index)=>{const p=pointOnScreen(id),t=Math.max(0,Math.min(1,Math.min(p.x,p.y,dom.width-p.x,dom.height-p.y)/42)),role=index?'destination':'origin';return t*t*(3-2*t)>=.05&&!dom.labels.some(label=>!label.occurrence&&label.id===role)?[role]:[];});
 const collisions=boxes.flatMap(label=>paths.flatMap((path,route)=>path.slice(1).flatMap((b,index)=>intersects(path[index]!,b,label)?[{label:label.id,text:label.text,route,edge:index}]:[])));
 const labelCollisions=boxes.flatMap((a,index)=>boxes.slice(index+1).flatMap(b=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top?[{first:a.id,second:b.id}]:[]));
 return {...dom,routeFragments:paths.length,routeEdges:paths.reduce((n,path)=>n+path.length-1,0),expectedVisible,missingVisibleFacts,missingVisibleEndpoints,collisions,labelCollisions};
}
async function clear(page:Page,facts:Parameters<typeof sample>[1],name:string){
 // ResizeObserver/camera publication completes after the viewport itself changes.
 // Wait for ALL postconditions, not only route clearance with stale old bounds.
 await expect.poll(async()=>{const current=await sample(page,facts);record(name+'-last-sample',current);return current.labels.length>0&&current.missingVisibleFacts.length===0&&current.missingVisibleEndpoints.length===0&&current.collisions.length===0&&current.labelCollisions.length===0&&!current.contextLabels.some(label=>label.uncontainedText)&&current.labels.every(label=>label.left>=7&&label.top>=7&&label.left+label.width<=current.width-7&&label.top+label.height<=current.height-7&&label.scrollWidth<=Math.ceil(label.width)+1&&label.scrollHeight<=Math.ceil(label.height)+1);},{timeout:10000}).toBe(true);
 const actual=await sample(page,facts);expect(actual.collisions).toEqual([]);expect(actual.labelCollisions).toEqual([]);
 expect(actual.missingVisibleFacts).toEqual([]);expect(actual.missingVisibleEndpoints).toEqual([]);
 expect(actual.contextLabels.some(label=>label.uncontainedText)).toBe(false);
 for(const label of actual.labels){expect(label.left).toBeGreaterThanOrEqual(7);expect(label.top).toBeGreaterThanOrEqual(7);expect(label.left+label.width).toBeLessThanOrEqual(actual.width-7);expect(label.top+label.height).toBeLessThanOrEqual(actual.height-7);expect(label.scrollWidth).toBeLessThanOrEqual(Math.ceil(label.width)+1);expect(label.scrollHeight).toBeLessThanOrEqual(Math.ceil(label.height)+1);}
 record(name,{...actual,method:'Actual visible DOM text boxes versus canonical rendered path/lane geometry from real API/catalog/local assets; independent13px segment-box postcondition. No placement helper, fake response or forced coordinates.'});
 return actual;
}
function allFacts(actual:Awaited<ReturnType<typeof sample>>,itinerary:Itinerary){
 const expected=[itinerary.outbound,...(itinerary.return?[itinerary.return]:[])].flatMap((leg,index)=>leg.stops.map(stop=>({id:stop.placeId,direction:itinerary.return?(index?'return':'outbound'):undefined,waitMinutes:String(stop.waitMinutes)})));
 const order=(value:{id?:string;direction?:string;waitMinutes?:string})=>JSON.stringify([value.id,value.direction,value.waitMinutes]);
 expect(actual.labels.filter(label=>label.occurrence).map(order).sort()).toEqual(expected.map(order).sort());
 expect(actual.labels.filter(label=>!label.occurrence)).toHaveLength(2);
 expect(actual.labels.every(label=>!label.occurrence||label.text?.includes('دقیقه توقف'))).toBe(true);
}
test.describe('@route-label-clearance general vehicle annotations',()=>{
 test.afterEach(async({context},info)=>{for(const page of context.pages())await page.close();const response=await context.request.post('/api/v1/demo/reset',{data:{}});expect(response.status()).toBe(201);record('cleanup-'+info.title.replace(/[^a-z0-9]+/gi,'-').slice(0,100),{status:response.status(),scope:'Only this test-owned fresh reviewer.'});});
 for(const mode of ['flight','train','bus'] as const)for(const tripType of ['one-way','round-trip'] as const)test(`${mode} ${tripType} keeps actual names and waits clear through resize and zoom`,async({page,context,browser})=>{
  test.setTimeout(90000);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:1000});
  const query:TransportSearchQuery={...base,mode,tripType,classCode:mode==='flight'?'economy':mode==='train'?'seat':'standard',...(tripType==='round-trip'?{returnDate:'2026-11-16',...(mode!=='flight'?{scope:'international' as const,destinationCityId:'istanbul'}:{})}:{})};
  const facts=await choose(page,context,query),prefix=mode+'-'+tripType;
  const initial=await clear(page,facts,prefix+'-initial');expect(initial.labels.length).toBeGreaterThanOrEqual(2);
  allFacts(initial,facts.itinerary);
  if(mode==='flight')expect(initial.labels.some(label=>label.id==='ifn'&&label.text?.includes('دقیقه توقف'))).toBe(true);
  if(tripType==='round-trip')expect(facts.itinerary.outbound.stops.length+(facts.itinerary.return?.stops.length??0)).toBeGreaterThan(0);
  await page.setViewportSize({width:1160,height:800});await clear(page,facts,prefix+'-narrow');
  const view=map(page).locator('[data-camera]'),rect=await view.boundingBox();await page.mouse.move(rect!.x+rect!.width/2,rect!.y+rect!.height/2);
  await page.keyboard.down('Control');await page.mouse.wheel(0,-40);await page.keyboard.up('Control');
  await expect.poll(async()=>JSON.parse((await view.getAttribute('data-camera'))!).zoom).toBeGreaterThan(1);await clear(page,facts,prefix+'-zoomed');
  mkdirSync(evidence,{recursive:true});await page.screenshot({path:join(evidence,prefix+'.png')});
  record(prefix+'-facts',{browser:browser.version(),itinerary:facts.itinerary,labelsAtInitial:initial.labels,source:'Actual normalized provider itinerary; no route facts rewritten.'});
 });
 test('multi-stop asymmetric long-haul flight keeps both leg facts clear',async({page,context,browser})=>{
  test.setTimeout(90000);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:1000});
  const facts=await choose(page,context,{...base,scope:'international',destinationCityId:'los-angeles',tripType:'round-trip',returnDate:'2026-11-16'});
  expect(facts.itinerary.outbound.stops.length+facts.itinerary.return!.stops.length).toBeGreaterThanOrEqual(3);
  allFacts(await clear(page,facts,'long-haul'),facts.itinerary);mkdirSync(evidence,{recursive:true});await page.screenshot({path:join(evidence,'long-haul.png')});record('long-haul-facts',{browser:browser.version(),itinerary:facts.itinerary});
 });
 test('static fallback keeps bus city and wait labels clear of the actual road',async({page,context})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:string,...args:unknown[]){return kind==='webgl2'?null:Reflect.apply(original,this,[kind,...args]);} as typeof original;});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1280,height:900});
  const facts=await choose(page,context,{...base,mode:'bus',classCode:'standard',scope:'international',destinationCityId:'istanbul',tripType:'round-trip',returnDate:'2026-11-16'},false);
  await expect(page.locator('canvas')).toHaveCount(0);await expect(map(page).locator('[data-static-route-direction="both"]').first()).toBeVisible();
  allFacts(await clear(page,facts,'static-bus'),facts.itinerary);mkdirSync(evidence,{recursive:true});await page.screenshot({path:join(evidence,'static-bus.png')});
 });
});
