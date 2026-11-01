import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {SearchRecoverySchema,type HotelSearchSnapshot,type ReferralReceipt,type TransportSearchQuery} from '@torob-ticket/contracts';
import {expectPlaceholder,scenarioQuote} from './acceptance/journey-helpers';
test.use({trace:'off'});
const evidence=process.env.REFERRAL_E2E_EVIDENCE_DIR;
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-10-25',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const results=(page:Page)=>page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});
const map=(page:Page)=>page.getByRole('complementary',{name:'نقشه سفر',exact:true});
const selectedSeller=new WeakMap<Page,string>();
const action=(page:Page,kind='transport')=>kind==='hotel'?page.locator('[data-referral-source="hotel"]').getByRole('button',{name:/^رفتن به /}):results(page).locator(`article[data-selected="true"] [data-seller-link-quote-id="${selectedSeller.get(page)}"]`);
function record(name:string,value:unknown){if(evidence){mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');}}
async function capture(page:Page,name:string){if(evidence){await page.screenshot({path:join(evidence,name+'.png')});}}
async function setup(page:Page,scenario='normal',q=query){const session=await page.request.post('/api/v1/demo/session',{data:{seed:2222,scenario,anchorInstant:'2026-10-25T06:00:00Z'}});expect(session.status()).toBe(201);await page.context().route(/^https:\/\/zarei\.xyz(?:\/|$)/,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Approved placeholder intercepted</title>'}));await page.goto('/?'+new URLSearchParams({q:JSON.stringify(q)}));await expect(page.getByRole('button',{name:'جست‌وجوی سفر',exact:true})).toBeEnabled();await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();await expect(results(page)).toHaveAttribute('data-status','complete',{timeout:15000});return session.json();}
async function select(page:Page,provider04=false){
 const id=await results(page).getAttribute('data-search-id');
 const snapshot=SearchRecoverySchema.parse(await(await page.request.get('/api/v1/searches/'+id)).json()).snapshot;
 const quote=provider04?scenarioQuote(snapshot):undefined;
 const card=quote?results(page).locator(`article[data-quote-id="${quote.quoteId}"]`):results(page).locator('article[data-group-id]').first();
 selectedSeller.set(page,quote?.quoteId??(await card.getAttribute('data-quote-id'))!);
 const control=card.getByRole('button',{name:'انتخاب پیشنهاد',exact:true});await control.focus();await control.press('Space');
 await page.mouse.move(1438,1);await expect(card).toHaveAttribute('data-selected','true');await expect(action(page)).toHaveAttribute('data-seller-link-quote-id',selectedSeller.get(page)!);await expect(action(page)).toBeEnabled();await expect(action(page)).toBeFocused();
}
async function legacyReceipt(page:Page,trigger:()=>Promise<unknown>,legacyHotel?:{snapshot:HotelSearchSnapshot;originScroll:number;scrollTop:number}){
 const comparisonUrl=page.url(),comparisonHistoryLength=await page.evaluate(()=>history.length);
 const region=page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true,includeHidden:true});
 const searchId=(await region.getAttribute('data-search-id'))!;
 const recovery=SearchRecoverySchema.parse(await(await page.request.get('/api/v1/searches/'+searchId)).json());
 const selected=page.locator('article[data-group-id][data-selected="true"]');
 const selection={groupId:(await selected.getAttribute('data-group-id'))!,quoteId:(await selected.getAttribute('data-quote-id'))!,version:Number(await selected.getAttribute('data-quote-version'))};
 const identity=await page.evaluate(()=>{const map=document.querySelector<HTMLElement>('[aria-label="نقشه سفر"]');const raw=document.querySelector<HTMLElement>('[data-camera-intent]')?.dataset['cameraIntent'];return {pin:document.querySelector<HTMLElement>('main[data-pinned-itinerary]')?.dataset['pinnedItinerary'],direction:map?.dataset['mapDirection']??'outbound',camera:raw?JSON.parse(raw):undefined,scrollY};});
 const checkpoint={version:1,referralId:'pending',returnSearch:new URL(page.url()).search,searchId,generation:recovery.snapshot.clientGeneration,draft:recovery.snapshot.query,adoptedSequence:recovery.sequence,frozen:(await region.getAttribute('data-frozen'))==='true',dismissedSuggestion:false,selected:selection,pinItineraryId:identity.pin,direction:identity.direction,...(identity.camera?{camera:identity.camera}:{}),scrollY:legacyHotel?.originScroll??identity.scrollY};
 const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/referrals/confirm')&&r.request().method()==='POST');
 const popup=await expectPlaceholder(page,trigger);const http=await response;expect(http.status()).toBe(201);const receipt:ReferralReceipt=await http.json();
 await expect(region).toHaveAttribute('data-status','complete');expect(page.url()).toBe(comparisonUrl);expect(await page.evaluate(()=>history.length)).toBe(comparisonHistoryLength);await popup.close();await page.bringToFront();
 const hotel=legacyHotel&&receipt.payload.kind==='hotel'?{open:true,stale:false,referralId:receipt.referralId,hotelSearchId:legacyHotel.snapshot.hotelSearchId,draft:{checkIn:legacyHotel.snapshot.query.checkIn,checkOut:legacyHotel.snapshot.query.checkOut,rooms:legacyHotel.snapshot.query.rooms,capacity:legacyHotel.snapshot.query.party.adults,childAges:(legacyHotel.snapshot.query.childAgesAtCheckIn??[]).map(String),arrivalConfirmed:true,sort:legacyHotel.snapshot.query.sort,arrivalPlaceId:legacyHotel.snapshot.query.arrivalPlaceId,customPoint:legacyHotel.snapshot.query.customPoint},selected:{quoteId:receipt.selection.quoteId,version:receipt.selection.quoteVersion},scrollTop:legacyHotel.scrollTop}:undefined;
 // Explicit legacy UI-intent setup: current new-tab handoffs deliberately do not create old same-tab checkpoints.
 // Source/search/receipt/quote facts are real; hydration must still authorize every ID through this context's server GETs.
 const seeded={...checkpoint,referralId:receipt.referralId,...(receipt.payload.kind==='transport'?{transportReferralId:receipt.referralId}:{}),...(hotel?{hotel}:{})};
 await page.evaluate(value=>sessionStorage.setItem('torob-ticket:return:v1:'+value.referralId,JSON.stringify(value)),seeded);
 record('seeded-legacy-checkpoint-'+receipt.referralId,{setup:'Explicit legacy reversible UI intent, derived from actual native selection and owned server evidence. It is not a current new-tab capture claim.',checkpoint:seeded});
 await page.goto(receipt.handoffPath);await expect(page.getByText('ارجاع به فروشنده ثبت شد',{exact:true})).toBeVisible();return receipt;
}
async function handoff(page:Page){return legacyReceipt(page,()=>action(page).click());}
test.describe('@referral guest consent and immutable provider handoff',()=>{
 test.afterEach(async({page},info)=>{const reset=await page.request.post('/api/v1/demo/reset',{data:{}});expect(reset.status()).toBe(201);record('cleanup-'+info.title.replace(/\W+/g,'-').slice(0,65),{explicitBody:{},status:reset.status()});});
 test('seeded legacy round-trip checkpoint survives GET-only receipt refresh and exact return context',async({page,browser})=>{
  test.setTimeout(90000);await page.setViewportSize({width:1440,height:1050});const metadata=await setup(page,'normal',{...query,tripType:'round-trip',returnDate:'2026-10-29'});await select(page);const original={scroll:await page.evaluate(()=>scrollY),url:page.url(),searchId:await results(page).getAttribute('data-search-id'),selected:await results(page).locator('article[data-selected="true"]').getAttribute('data-quote-id'),camera:await map(page).locator('[data-camera-intent]').getAttribute('data-camera-intent')};const receipt=await handoff(page);expect(receipt.payload.kind).toBe('transport');if(receipt.payload.kind==='transport')expect(receipt.payload.itinerary.return).toBeTruthy();expect(await page.locator('[data-hotel-dialog]').count()).toBe(0);
  // Decision0067's current handoff preserves URL/history in legacyReceipt above. This explicit legacy seed proves read-only receipt restoration; old retained-route Back/Forward stays covered by source unit tests.
  const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST')writes.push(new URL(r.url()).pathname);});await page.reload();await expect(page.getByText('ارجاع به فروشنده ثبت شد',{exact:true})).toBeVisible();expect(writes).toEqual([]);const beforeReturn=writes.length;await page.getByRole('button',{name:'بازگشت به مقایسه سفر',exact:true}).click();await expect(results(page)).toHaveAttribute('data-search-id',original.searchId!);await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete','true',{timeout:20_000});await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-reveal','1.000');expect(writes.slice(beforeReturn).filter(path=>/searches|referrals/.test(path))).toEqual([]);expect(await results(page).locator('article[data-selected="true"]').getAttribute('data-quote-id')).toBe(original.selected);expect(await map(page).locator('[data-camera-intent]').getAttribute('data-camera-intent')).toBe(original.camera);expect(page.url()).toBe(original.url);await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(original.scroll);await capture(page,'roundtrip-restored');record('roundtrip',{metadata,browser:browser.version(),original,receipt,refreshWrites:writes});
 });
 test('changed provider requires exact acceptance and Cancel cannot bypass fresh comparison',async({page})=>{
  test.setTimeout(60000);await setup(page,'price-change');await select(page,true);let confirmations=0,prepares=0;page.on('request',r=>{if(r.url().endsWith('/referrals/confirm'))confirmations++;if(r.url().endsWith('/referrals/prepare'))prepares++;});await action(page).click();await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase','changed');expect(confirmations).toBe(0);await capture(page,'changed-consent');await page.getByRole('button',{name:'انصراف و بازگشت به مقایسه',exact:true}).click();await expect(page.locator('[data-referral-phase]')).toHaveCount(0);await action(page).click();await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase','refresh-required');expect(prepares).toBe(1);expect(confirmations).toBe(0);await page.getByRole('dialog').getByRole('button',{name:'مقایسه تازه همین سفر',exact:true}).click();await expect(results(page)).toHaveAttribute('data-status','complete',{timeout:15000});await select(page,true);await action(page).click();await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase','changed');const changed=await page.locator('[data-referral-phase] [data-checked-quote-version]').last().getAttribute('data-checked-quote-version');const receipt=await legacyReceipt(page,()=>page.getByRole('button',{name:'پذیرش نسخه تازه و ادامه',exact:true}).click());expect(receipt.selection.quoteVersion).toBe(Number(changed));await expect(page.getByText('ارجاع به فروشنده ثبت شد',{exact:true})).toBeVisible();record('changed',{prepares,confirmations,receipt});
 });
 test('sold-out resolves actual same-query alternatives and rechecks explicit replacement',async({page})=>{
  test.setTimeout(60000);await setup(page,'sold-out');await select(page,true);await action(page).click();await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase','unavailable');const alternative=page.getByRole('dialog').getByRole('button').filter({hasText:/تومان برای همه مسافران/}).first();await expect(alternative).toBeVisible();const receipt=await legacyReceipt(page,()=>alternative.click());await expect(page.getByText('ارجاع به فروشنده ثبت شد',{exact:true})).toBeVisible();record('sold-out-alternative',receipt);
 });
 test('lost committed confirmation retries exactly the same idempotency payload with no prepare duplication',async({page})=>{
  test.setTimeout(60000);await setup(page);await select(page);const inputs:unknown[]=[],prepares:unknown[]=[];page.on('request',r=>{if(r.url().endsWith('/referrals/confirm'))inputs.push(r.postDataJSON());if(r.url().endsWith('/referrals/prepare'))prepares.push(r.postDataJSON());});let lost:ReferralReceipt|undefined;
  await page.route('**/api/v1/referrals/confirm',async route=>{if(!lost){const response=await route.fetch();expect(response.status()).toBe(201);lost=await response.json();await route.abort('connectionfailed');}else await route.continue();});await action(page).dblclick();await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase','retry-confirm');expect(prepares).toHaveLength(1);expect(inputs).toHaveLength(1);await legacyReceipt(page,()=>page.getByRole('button',{name:'دریافت نتیجه همان انتقال',exact:true}).click());await expect(page.getByText('ارجاع به فروشنده ثبت شد',{exact:true})).toBeVisible();expect(inputs).toHaveLength(2);expect(inputs[1]).toEqual(inputs[0]);expect(page.url()).toContain(lost!.referralId);record('uncertain-confirm',{inputs,prepareCount:prepares.length,receipt:lost});
 });
 test('mobile seeded legacy hotel checkpoint survives read-only receipt refresh and exact return',async({page,context})=>{
  test.setTimeout(90000);expect((await context.cookies()).length).toBe(0);await page.setViewportSize({width:390,height:844});await setup(page);
  const transportQuote=await results(page).locator('article[data-selected="true"]').getAttribute('data-quote-id');
  const hotelTrigger=page.getByRole('button',{name:'مقایسه اقامتگاه‌های مشهد',exact:true});await hotelTrigger.scrollIntoViewIfNeeded();const originScroll=await page.evaluate(()=>scrollY);
  const loading=page.waitForResponse(response=>response.url().endsWith('/api/v1/hotel-searches')&&response.request().method()==='POST');await hotelTrigger.click();const snapshot=await(await loading).json();
  const d=page.getByRole('dialog',{name:'هتل‌های مشهد',exact:true});const hotels=d.getByRole('region',{name:'نتایج مقایسه اقامتگاه‌ها',exact:true});await expect(hotels).toHaveAttribute('data-hotel-search-id',snapshot.hotelSearchId);
  expect(snapshot.query.rooms).toBe(1);expect(new Date(snapshot.query.checkOut+'T12:00:00Z').getTime()-new Date(snapshot.query.checkIn+'T12:00:00Z').getTime()).toBe(86400000);expect(await d.locator('input:not([type=radio])').count()).toBe(0);await expect(d.getByRole('combobox',{name:'ظرفیت اتاق',exact:true})).toHaveValue('1');
  const first=hotels.locator('article[data-hotel-status="priced"]').first();const selectedHotelId=await first.getAttribute('data-hotel-id');await first.locator('[data-hotel-card-select]').click();await expect(d.locator('aside[data-selected-hotel-quote]')).toBeVisible();await expect(action(page,'hotel')).toBeEnabled();
  const modalScroll=await d.locator('[data-hotel-scroll]').evaluate(node=>node.scrollTop);const receipt=await legacyReceipt(page,()=>action(page,'hotel').click(),{snapshot,originScroll,scrollTop:modalScroll});
  await expect(page.getByText('ارجاع به فروشنده ثبت شد',{exact:true})).toBeVisible();expect(receipt.payload.kind).toBe('hotel');if(receipt.payload.kind!=='hotel')throw Error('Expected an exact hotel receipt');expect(receipt.payload.quote.query).toEqual(snapshot.query);expect(receipt.payload.quote.hotelId).toBe(selectedHotelId);
  const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST')writes.push(new URL(request.url()).pathname);});await page.reload();await expect(page.getByText('ارجاع به فروشنده ثبت شد',{exact:true})).toBeVisible();expect(writes).toEqual([]);
  await page.getByRole('button',{name:'بازگشت به مقایسه سفر',exact:true}).click();await expect(d).toBeVisible();await expect(hotels).toHaveAttribute('data-hotel-search-id',snapshot.hotelSearchId);await expect(d.locator('[data-hotel-dialog]')).toHaveAttribute('data-selected-hotel-id',selectedHotelId!);
  await expect(d.locator('aside[data-selected-hotel-quote]')).toHaveAttribute('data-selected-hotel-quote',receipt.payload.quote.quoteId);await expect.poll(()=>d.locator('[data-hotel-scroll]').evaluate(node=>node.scrollTop)).toBe(modalScroll);
  expect(writes.filter(path=>/hotel-searches|referrals/.test(path))).toEqual([]);expect(await page.getByRole('complementary',{name:'نقشه سفر',exact:true}).count()).toBe(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await capture(page,'mobile-hotel-return');
  await d.getByRole('button',{name:'بستن',exact:true}).click();await expect(hotelTrigger).toBeFocused();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(originScroll);expect(await results(page).locator('article[data-selected="true"]').getAttribute('data-quote-id')).toBe(transportQuote);
  record('hotel-arrival-return',{receipt,hotelSearchId:snapshot.hotelSearchId,selectedHotelId,writes,originScroll,modalScroll});
 });
 test('a reset/foreign receipt is read-only and never recreates comparison evidence',async({page})=>{
  test.setTimeout(60000);await setup(page);await select(page);const receipt=await handoff(page);const reset=await page.request.post('/api/v1/demo/reset',{data:{}});expect(reset.status()).toBe(201);const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST')writes.push(new URL(r.url()).pathname);});await page.reload();await expect(page.getByText('این ارجاع در نشست فعلی پیدا نشد.',{exact:true})).toBeVisible();expect(writes).toEqual([]);expect(await results(page).count()).toBe(0);record('reset-foreign',{receiptId:receipt.referralId,writes});
 });
});

test.describe('@referral date evidence layout during asynchronous settlement',()=>{
 test.afterEach(async({page},info)=>{const reset=await page.request.post('/api/v1/demo/reset',{data:{}});expect(reset.status()).toBe(201);record('cleanup-layout-'+info.title.replace(/\W+/g,'-'),{explicitBody:{},status:reset.status()});});
 for(const width of [1440,390,320])test(`checking to priced evidence keeps its footprint at ${width}px`,async({page})=>{
  test.setTimeout(60000);await page.setViewportSize({width,height:1000});expect((await page.request.post('/api/v1/demo/session',{data:{seed:2290+width,scenario:'normal',anchorInstant:'2026-10-25T06:00:00Z'}})).status()).toBe(201);let release!:()=>void,arrived!:()=>void;const gate=new Promise<void>(r=>{release=r;}),held=new Promise<void>(r=>{arrived=r;});let starts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/v1/searches'))starts++;});
  page.once('close',release);await page.route('**/api/v1/date-prices',async route=>{const response=await route.fetch();arrived();await gate;await route.fulfill({response});});await page.goto('/?'+new URLSearchParams({q:JSON.stringify(query)}));await held;await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo(0,200));
  const geometry=()=>page.evaluate(()=>{
   const selectors={form:'form[aria-label="جست‌وجوی سفر"]',explorer:'section[aria-label="کاوش تاریخ سفر"]',wheel:'[role="listbox"][aria-label="روزهای نزدیک"]',button:'form[aria-label="جست‌وجوی سفر"] button[type="submit"]'};
   const nodes=Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,document.querySelector<HTMLElement>(selector)!])) as Record<keyof typeof selectors,HTMLElement>;
   const rect=(node:Element)=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,right:r.right,bottom:r.bottom,left:r.left};};
   const rects={form:rect(nodes.form),explorer:rect(nodes.explorer),wheel:rect(nodes.wheel),button:rect(nodes.button)};
   const metrics={form:rects.form.height,explorer:rects.explorer.height,wheel:rects.wheel.height,buttonY:rects.button.top+scrollY,scroll:scrollY};
   const ancestors=[];
   for(let node:HTMLElement|null=nodes.form;node;node=node.parentElement){
    const style=getComputedStyle(node),matrix=style.transform==='none'?null:new DOMMatrixReadOnly(style.transform);
    const animations=node.getAnimations({subtree:false}).map(animation=>{
     const effect=animation.effect,timing=effect?.getComputedTiming();
     return {playState:animation.playState,pending:animation.pending,currentTime:typeof animation.currentTime==='number'?animation.currentTime:null,iterations:timing?.iterations===Infinity?'infinite':timing?.iterations??null,progress:timing?.progress,endTime:timing?.endTime===Infinity?'infinite':typeof timing?.endTime==='number'?timing.endTime:null,duration:timing?.duration,easing:timing?.easing,ownTarget:effect instanceof KeyframeEffect&&effect.target===node};
    });
    ancestors.push({tag:node.tagName,role:node.getAttribute('role'),motionPolicy:node.dataset['motionPolicy']??null,entering:node.hasAttribute('data-entering'),exiting:node.hasAttribute('data-exiting'),ariaHidden:node.getAttribute('aria-hidden'),inert:node.inert,rect:rect(node),opacity:Number(style.opacity),transform:style.transform,translate:style.translate,scale:style.scale,rotate:style.rotate,matrix:matrix?{a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d,e:matrix.e,f:matrix.f,isIdentity:matrix.isIdentity}:null,animations,
     finiteOwnPending:animations.some(animation=>animation.ownTarget&&(animation.pending||animation.playState==='running')&&animation.iterations!=='infinite'&&animation.endTime!==null&&Number.isFinite(animation.endTime))});
   }
   const entries=ancestors.filter(node=>node.motionPolicy!==null);
   return{at:performance.now(),metrics,rounded:{form:Math.round(metrics.form*10)/10,explorer:Math.round(metrics.explorer*10)/10,wheel:Math.round(metrics.wheel*10)/10,buttonY:Math.round(metrics.buttonY*10)/10,scroll:scrollY},rects,counts:Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,document.querySelectorAll(selector).length])),ancestors,
    finitePositive:Object.values(rects).every(r=>Object.values(r).every(Number.isFinite)&&r.width>0&&r.height>0)&&Object.values(metrics).every(Number.isFinite)&&metrics.buttonY>0,
    entryFinal:entries.length>0&&entries.every(node=>(node.motionPolicy==='finite'||node.motionPolicy==='static')&&!node.entering&&!node.exiting&&!node.inert&&node.ariaHidden!=='true'&&node.opacity===1&&(node.matrix===null||node.matrix.isIdentity)&&node.translate==='none'&&node.scale==='none'&&node.rotate==='none'&&!node.finiteOwnPending),
    viewport:{width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,scrollX,scrollY}};
  });
  type Geometry=Awaited<ReturnType<typeof geometry>>;
  const samples:{stage:string;value:Geometry}[]=[];
  const sample=async(stage:string)=>{const value=await geometry();samples.push({stage,value});return value;};
  const unique=(value:Geometry)=>Object.values(value.counts).every(count=>count===1);
  const deltas=(before:Geometry,after:Geometry)=>({form:Math.abs(after.metrics.form-before.metrics.form),explorer:Math.abs(after.metrics.explorer-before.metrics.explorer),wheel:Math.abs(after.metrics.wheel-before.metrics.wheel),buttonY:Math.abs(after.metrics.buttonY-before.metrics.buttonY)});
  const contract={wheelPx:132,footprintDeltaStrictlyBelowCssPx:.5,scroll:'exactly unchanged',transportPOSTs:0,maximumPageWidth:width,entry:'Only actual form ancestor MotionSurface final opacity1/identity transform and no own finite pending WAAPI; no global animation wait'};
  let before:Geometry|undefined,after:Geometry|undefined;
  try{
   await sample('before-entry-readiness');
   // consumer-ready content enters by6px over180ms. Its actual ancestor must
   // reach the public final frame before measuring the checking footprint.
   await expect.poll(async()=>{const value=await sample('entry-readiness');return unique(value)&&value.finitePositive&&value.entryFinal;},{timeout:5000}).toBe(true);
   before=await sample('checking-baseline');expect(before.finitePositive).toBe(true);expect(unique(before)).toBe(true);expect(before.entryFinal).toBe(true);expect(before.metrics.wheel).toBe(132);
   await expect(page.getByRole('listbox',{name:'روزهای نزدیک',exact:true}).getByRole('option',{selected:true})).toContainText('در حال بررسی');
   release();await expect(page.getByRole('region',{name:'کاوش تاریخ سفر',exact:true})).toHaveAttribute('data-date-price-status','complete',{timeout:30000});
   await expect.poll(async()=>{after=await sample('priced-footprint');return unique(after)&&after.finitePositive&&after.entryFinal&&after.metrics.wheel===132&&after.metrics.scroll===before!.metrics.scroll&&after.viewport.scrollX===before!.viewport.scrollX&&Object.values(deltas(before!,after)).every(delta=>Number.isFinite(delta)&&delta<.5);},{timeout:5000}).toBe(true);
   after=await sample('final-before-assert');expect(after.finitePositive).toBe(true);expect(unique(after)).toBe(true);expect(after.entryFinal).toBe(true);
   for(const delta of Object.values(deltas(before,after)))expect(delta).toBeLessThan(.5);
   expect(after.metrics.wheel).toBe(132);expect(after.metrics.scroll).toBe(before.metrics.scroll);expect(after.viewport.scrollX).toBe(before.viewport.scrollX);
   expect(starts).toBe(0);expect(after.viewport.pageWidth).toBeLessThanOrEqual(width);
  }finally{
   release();const final=await sample('finally-before-cleanup').catch(()=>null);
   record('date-layout-'+width,{contract,before,after,final,samples,searchPosts:starts,deltas:before&&after?deltas(before,after):undefined,capture:final?'public-geometry-captured':'public-geometry-unavailable'});
  }
 });
});
