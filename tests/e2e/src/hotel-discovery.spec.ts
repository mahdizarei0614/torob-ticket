import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {CatalogSnapshot,HotelSearchSnapshot,SearchRecovery,TransportSearchQuery} from '@torob-ticket/contracts';
const evidence=process.env.HOTEL_E2E_EVIDENCE_DIR??'docs/evidence/adjustments/arrival-hotel-discovery/native';
function record(name:string,value:unknown){mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');}
async function capture(page:Page,name:string){
 const panel=page.locator('[data-hotel-dialog]');
 // Motion also drives JavaScript fades; native CSS Animation.finished alone can capture a pending entrance.
 await expect.poll(()=>panel.evaluate(node=>!node.querySelector('[data-content-presence="exiting"]')&&Array.from(node.querySelectorAll('[data-content-presence="present"]')).every(item=>Number(getComputedStyle(item).opacity)>=.999))).toBe(true);
 await panel.evaluate(async node=>{await Promise.allSettled(node.getAnimations({subtree:true}).filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished));});
 mkdirSync(evidence,{recursive:true});await page.screenshot({path:join(evidence,name+'.png')});
}
const base:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-02',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const dialog=(page:Page,city='مشهد')=>page.getByRole('dialog',{name:`هتل‌های ${city}`,exact:true});
const hotelResult=(page:Page,city='مشهد')=>dialog(page,city).getByRole('region',{name:'نتایج مقایسه اقامتگاه‌ها',exact:true});
const isHotel=(response:{url:()=>string;request:()=>{method:()=>string}})=>response.url().endsWith('/api/v1/hotel-searches')&&response.request().method()==='POST';
function localDate(instant:string,zone:string){const parts=new Intl.DateTimeFormat('en',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');}
function nextDay(date:string){const day=new Date(date+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+1);return day.toISOString().slice(0,10);}
async function setup(page:Page,context:BrowserContext,query=base,overnight=false){
 expect(await context.cookies()).toEqual([]);expect((await context.request.post('/api/v1/demo/session',{data:{seed:6161,scenario:'normal',anchorInstant:'2026-10-29T06:00:00Z'}})).status()).toBe(201);
 await page.goto('/?q='+encodeURIComponent(JSON.stringify(query)));await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();
 const region=page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});await expect(region).toHaveAttribute('data-status','complete',{timeout:30000});
 await expect(region.getByRole('list',{name:'مسیرها و پیشنهادهای مقایسه‌شده'})).toHaveAttribute('data-result-rendering','deferred');
 const searchId=await region.getAttribute('data-search-id');const recovery=await (await context.request.get('/api/v1/searches/'+searchId)).json() as SearchRecovery;
 const catalog=await (await context.request.get('/api/v1/catalog')).json() as CatalogSnapshot;
 const zone=catalog.cities.find(city=>city.id===query.destinationCityId)!.timeZone;
 const groups=recovery.snapshot.groups.filter(group=>group.eligibleQuotes.length>0);
 const candidate=overnight?groups.find(group=>localDate(group.itinerary.outbound.segments.at(-1)!.arrivalAt,zone)>query.departureDate):groups[0];expect(candidate).toBeTruthy();
 const ids=await region.locator('article[data-quote-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-quote-id')));
 const quote=candidate!.eligibleQuotes.find(quote=>ids.includes(quote.quoteId))!;expect(quote).toBeTruthy();
 await region.locator(`article[data-quote-id="${quote.quoteId}"] [data-card-select]`).click();
 await expect(region.locator(`article[data-quote-id="${quote.quoteId}"]`)).toHaveAttribute('data-selected','true');
 return {query,catalog,itinerary:candidate!.itinerary,arrival:candidate!.itinerary.outbound.segments.at(-1)!,zone,searchId};
}
async function open(page:Page,city='مشهد'){
 const waiting=page.waitForResponse(isHotel);await page.getByRole('button',{name:`مقایسه اقامتگاه‌های ${city}`,exact:true}).click();const response=await waiting;expect(response.status()).toBe(201);const snapshot=await response.json() as HotelSearchSnapshot;
 await expect(hotelResult(page,city)).toHaveAttribute('data-hotel-search-id',snapshot.hotelSearchId);await expect(dialog(page,city).locator('[data-hotel-id]').first()).toBeVisible();return snapshot;
}
async function ready(page:Page,city='مشهد'){
 const map=dialog(page,city).locator('[data-free-map-status]');
 await expect.poll(()=>map.getAttribute('data-free-map-status'),{timeout:20000}).toMatch(/ready|unavailable/);
 if(await map.getAttribute('data-free-map-status')==='unavailable'){
  const key='map-retry-'+test.info().title.slice(0,55).replace(/\W/g,'-');record(key,{city,before:'unavailable',method:'One explicit visible retry; actual OSM network, no intercepted replacement.'});
  await map.getByRole('button',{name:'تلاش دوباره برای نقشه شهری',exact:true}).click();await expect(map).toHaveAttribute('data-free-map-status','ready',{timeout:25000});record(key,{city,before:'unavailable',after:'ready',method:'One explicit visible retry; actual OSM network, no intercepted replacement.'});
 }
 await expect(map).toHaveAttribute('data-free-map-status','ready');
}
async function geometry(page:Page,city='مشهد'){
 return dialog(page,city).evaluate(node=>({viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,scrollX,visualViewport:visualViewport?{offsetLeft:visualViewport.offsetLeft,pageLeft:visualViewport.pageLeft,width:visualViewport.width}:null,ancestors:Array.from(document.querySelectorAll<HTMLElement>('[data-modal-motion],[data-dialog-scroll]')).map(item=>({tag:item.tagName,role:item.getAttribute('role'),className:item.className,rect:item.getBoundingClientRect().toJSON(),width:getComputedStyle(item).width,minWidth:getComputedStyle(item).minWidth,position:getComputedStyle(item).position,grid:getComputedStyle(item).gridTemplateColumns})),dialog:node.getBoundingClientRect().toJSON(),map:node.querySelector('[data-hotel-map-frame]')!.getBoundingClientRect().toJSON(),cards:Array.from(node.querySelectorAll<HTMLElement>('[data-hotel-id]')).map(card=>({id:card.dataset['hotelId'],width:card.getBoundingClientRect().width,height:card.getBoundingClientRect().height,identityBottom:card.querySelector('[data-hotel-card-identity]')!.getBoundingClientRect().bottom,metaTop:card.querySelector('[data-hotel-card-meta]')!.getBoundingClientRect().top,metaBottom:card.querySelector('[data-hotel-card-meta]')!.getBoundingClientRect().bottom,bottom:card.getBoundingClientRect().bottom,font:getComputedStyle(card.querySelector('h3')!).fontSize})),inputs:node.querySelectorAll('form,input:not([type=radio]),select').length}));
}

test.describe('@hotels arrival-based one-night discovery',()=>{
 test('desktop binds real named pins and square cards, preserves the map and applies all four orders',async({page,context,browser})=>{
  test.setTimeout(90000);await page.setViewportSize({width:1366,height:900});const errors:string[]=[],posts:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(new URL(r.url()).pathname);});
  const trip=await setup(page,context);const snapshot=await open(page);await ready(page);const d=dialog(page),map=d.locator('[data-hotel-map]');
  expect(snapshot.query).toMatchObject({checkIn:localDate(trip.arrival.arrivalAt,trip.zone),checkOut:nextDay(localDate(trip.arrival.arrivalAt,trip.zone)),rooms:1,arrivalPlaceId:trip.arrival.destinationPlaceId,sort:'cheapest'});
  expect(snapshot.hotels).toHaveLength(14);await expect(map.locator('[data-map-hotel-id]')).toHaveCount(14);await expect(map.locator('[data-map-arrival-id]')).toHaveCount(1);
  const actualPlace=trip.catalog.places.find(place=>place.id===trip.arrival.destinationPlaceId)!;expect(actualPlace.kind).toBe('airport');await expect(map.locator('[data-map-arrival-id]')).toHaveAttribute('data-map-arrival-id','arrival:'+actualPlace.id);
  const before=await geometry(page);expect(before.inputs).toBe(0);for(const card of before.cards){expect(Math.abs(card.width-card.height)).toBeLessThan(1);expect(parseFloat(card.font)).toBeGreaterThanOrEqual(14);}
  const canvas=await map.locator('canvas').elementHandle();const priced=snapshot.results!.filter(result=>result.status==='priced'),id=priced[1]!.hotelId,pin=map.locator(`[data-map-hotel-id="${id}"]`),pinHandle=await pin.elementHandle();
  await pin.click();await expect(d.locator(`[data-hotel-id="${id}"]`)).toHaveAttribute('data-selected','true');await expect(pin).toBeFocused();await expect(d.locator('aside[data-selected-hotel-quote]')).toHaveAttribute('data-selected-hotel-id',id);
  const cardId=priced[0]!.hotelId,card=d.locator(`[data-hotel-id="${cardId}"] [data-hotel-card-select]`);await card.click();await expect(map.locator(`[data-map-hotel-id="${cardId}"]`)).toHaveAttribute('aria-pressed','true');await expect(card).toBeFocused();
  const variants:HotelSearchSnapshot[]=[];
  for(const [name,sort]of [['ستاره بیشتر','stars'],['نزدیک به فرودگاه','arrival-distance']] as const){const pending=page.waitForResponse(isHotel);const radio=d.getByRole('radio',{name,exact:true});await radio.focus();await page.keyboard.press('Space');const next=await (await pending).json() as HotelSearchSnapshot;variants.push(next);expect(next.query.sort).toBe(sort);await expect(hotelResult(page)).toHaveAttribute('data-hotel-search-id',next.hotelSearchId);await expect(d.locator(`[data-hotel-id="${cardId}"]`)).toHaveAttribute('data-selected','true');}
  expect(await map.locator('canvas').evaluate((node,original)=>node===original,canvas)).toBe(true);expect(await pin.evaluate((node,original)=>node===original,pinHandle)).toBe(true);
  const count=posts.filter(path=>path==='/api/v1/hotel-searches').length;await d.getByRole('radio',{name:'نزدیک به نقطه دلخواه',exact:true}).focus();await page.keyboard.press('Space');await expect(d.getByText('نقطه دلخواه را روی نقشه انتخاب کنید',{exact:true})).toBeVisible();expect(posts.filter(path=>path==='/api/v1/hotel-searches')).toHaveLength(count);
  const pending=page.waitForResponse(isHotel);await map.locator(`[data-map-hotel-id="${id}"]`).click();const location=await (await pending).json() as HotelSearchSnapshot;expect(location.query.sort).toBe('location-distance');expect(location.query.customPoint).toEqual(snapshot.hotels.find(hotel=>hotel.hotelId===id)!.point);await expect(hotelResult(page)).toHaveAttribute('data-hotel-search-id',location.hotelSearchId);
  await d.getByRole('button',{name:'تغییر نقطه مرجع',exact:true}).click();await d.getByRole('button',{name:'انصراف',exact:true}).click();expect(posts.filter(path=>path==='/api/v1/hotel-searches')).toHaveLength(count+1);
  await expect(d.locator('aside[data-selected-hotel-quote]')).toBeVisible();await capture(page,'desktop-arrival-hotels');
  const after=await geometry(page);expect(after.map.y).toBe(before.map.y);expect(after.map.height).toBe(before.map.height);expect(errors).toEqual([]);expect(posts.filter(path=>path==='/api/v1/searches')).toHaveLength(1);expect(posts.some(path=>path.includes('/referrals/'))).toBe(false);
  await d.getByRole('button',{name:'بستن',exact:true}).click();await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(0);await expect(page.getByRole('button',{name:'مقایسه اقامتگاه‌های مشهد',exact:true})).toBeFocused();
  record('desktop-arrival',{browser:browser.version(),arrival:trip.arrival,query:snapshot.query,sortQueries:variants.map(s=>s.query),locationQuery:location.query,before,after,posts,errors,cleanup:'Fresh empty-cookie session only; no reset/deletion, normal expiry.'});
 });
 for(const mode of ['train','bus'] as const)test(`${mode} uses the actual overnight arrival hub and arrival day`,async({page,context,browser})=>{
  test.setTimeout(60000);await page.setViewportSize({width:1280,height:900});const trip=await setup(page,context,{...base,mode,classCode:mode==='train'?'seat':'standard'},true);const snapshot=await open(page);await ready(page);const place=trip.catalog.places.find(place=>place.id===trip.arrival.destinationPlaceId)!;
  expect(place.kind).toBe(mode==='train'?'station':'terminal');expect(snapshot.query.checkIn).toBe(localDate(trip.arrival.arrivalAt,trip.zone));expect(snapshot.query.checkIn).not.toBe(trip.query.departureDate);expect(snapshot.query.checkOut).toBe(nextDay(snapshot.query.checkIn));expect(snapshot.query.arrivalPlaceId).toBe(place.id);
  await expect(dialog(page).locator('[data-map-arrival-id]')).toHaveAttribute('data-map-arrival-id','arrival:'+place.id);expect((await geometry(page)).inputs).toBe(0);await capture(page,mode+'-arrival');record(mode+'-arrival',{browser:browser.version(),arrival:trip.arrival,query:snapshot.query,place,cleanup:'Fresh isolated context; no reset/deletion.'});
 });
 test('mobile uses a full-page map/card view with two-way selection and stable close/reopen',async({page,context,browser})=>{
  test.setTimeout(60000);await page.setViewportSize({width:390,height:844});await setup(page,context);const snapshot=await open(page);await ready(page);const d=dialog(page);await expect(page.getByRole('complementary',{name:'نقشه سفر',exact:true})).toHaveCount(0);
  const id=snapshot.results!.find(result=>result.status==='priced')!.hotelId;const card=d.locator(`[data-hotel-id="${id}"] [data-hotel-card-select]`);await card.click();await expect(d.locator(`[data-map-hotel-id="${id}"]`)).toHaveAttribute('aria-pressed','true');await expect(d.locator('aside[data-selected-hotel-quote]')).toBeVisible();
  const sizes=[];for(const width of [390,320]){await page.setViewportSize({width,height:844});await expect.poll(async()=>{const box=await d.boundingBox();return box!.width;}).toBeLessThanOrEqual(width);const g=await geometry(page);sizes.push(g);record('mobile-geometry-progress',{width,sizes});expect(g.pageWidth).toBeLessThanOrEqual(width);for(const c of g.cards){expect(Math.abs(c.width-c.height)).toBeLessThan(1);expect(c.identityBottom).toBeLessThanOrEqual(c.metaTop+1);expect(c.metaBottom).toBeLessThanOrEqual(c.bottom-7);}await expect(d.getByRole('button',{name:'بستن',exact:true})).toBeInViewport();}
  await capture(page,'mobile-arrival-selected');await d.getByRole('button',{name:'بستن',exact:true}).click();const trigger=page.getByRole('button',{name:'مقایسه اقامتگاه‌های مشهد',exact:true});await trigger.click({force:true});await ready(page);await expect(dialog(page).locator(`[data-hotel-id="${id}"]`)).toHaveAttribute('data-selected','true');await expect(dialog(page).locator('[data-hotel-map] canvas')).toHaveCount(1);record('mobile-arrival',{browser:browser.version(),sizes,query:snapshot.query,selectedHotel:id,cleanup:'Fresh empty-cookie session only; no reset/deletion.'});
 });
 test('round trips still use exactly one arrival-local night rather than return departure',async({page,context,browser})=>{
  test.setTimeout(60000);await page.setViewportSize({width:1366,height:900});const trip=await setup(page,context,{...base,scope:'international',destinationCityId:'istanbul',tripType:'round-trip',returnDate:'2026-11-09'});const snapshot=await open(page,'استانبول');await ready(page,'استانبول');
  expect(snapshot.query.checkIn).toBe(localDate(trip.arrival.arrivalAt,trip.zone));expect(snapshot.query.checkOut).toBe(nextDay(snapshot.query.checkIn));expect(snapshot.query.checkOut).not.toBe(trip.query.returnDate);expect(snapshot.query.rooms).toBe(1);await capture(page,'international-one-night');record('international-one-night',{browser:browser.version(),arrival:trip.arrival,transport:trip.query,stay:snapshot.query});
 });
 test('unavailable WebGL keeps hotel cards and known-location reference sorting usable without a fake map',async({page,context,browser})=>{
  test.setTimeout(60000);await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:string,...args:unknown[]){return kind==='webgl2'?null:Reflect.apply(original,this,[kind,...args]);} as typeof original;});await page.setViewportSize({width:390,height:844});await setup(page,context);const snapshot=await open(page);const d=dialog(page);await expect(d.locator('[data-free-map-status]')).toHaveAttribute('data-free-map-status','unavailable',{timeout:20000});await expect(d.getByText('نقشه شهری در دسترس نیست.',{exact:true})).toBeVisible();
  const id=snapshot.results!.find(r=>r.status==='priced')!.hotelId;await d.locator(`[data-hotel-id="${id}"] [data-hotel-card-select]`).click();await expect(d.locator('aside[data-selected-hotel-quote]')).toBeVisible();await d.getByRole('radio',{name:'نزدیک به نقطه دلخواه',exact:true}).focus();await page.keyboard.press('Space');const pending=page.waitForResponse(isHotel);await d.locator('[data-hotel-map]').getByRole('button',{name:/فرودگاه/}).first().click();const next=await (await pending).json() as HotelSearchSnapshot;expect(next.query.sort).toBe('location-distance');expect(next.query.customPoint).toBeTruthy();await expect(hotelResult(page)).toHaveAttribute('data-hotel-search-id',next.hotelSearchId);await capture(page,'map-unavailable');record('map-unavailable',{browser:browser.version(),intentionalWebGL2Unavailable:true,query:next.query,cleanup:'Fresh isolated context; no reset/deletion.'});
 });
});
