import {test,expect,type Locator,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
 AdminReferralListSchema,CatalogSnapshotSchema,SearchRecoverySchema,SessionInfoSchema,
 type ComparisonGroup,type TransportSearchQuery,
} from '@torob-ticket/contracts';
import {contractResponse} from './acceptance/journey-helpers';

// Every browser context is a fresh Playwright-owned namespace. Never record cookies or session-bearing traces.
test.use({trace:'off'});
const evidence=process.env.T18_EVIDENCE_DIR;
function record(name:string,value:unknown){if(evidence){mkdirSync(evidence,{recursive:true});writeFileSync(resolve(evidence,name),JSON.stringify(value,null,2)+'\n');}}
const base:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'round-trip',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-10-25',returnDate:'2026-10-28',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const map=(page:Page)=>page.getByRole('complementary',{name:'نقشه سفر',exact:true});
const scene=(page:Page)=>map(page).locator('[data-route-scene]');
const labels=(page:Page)=>page.getByRole('region',{name:'نقاط نقشه مسیر',exact:true});
const results=(page:Page)=>page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});
const cards=(page:Page)=>results(page).locator('article[data-price-card-id][data-quote-id]');
const selectedCard=(page:Page)=>results(page).locator('article[data-selected="true"]');
const heading=(page:Page)=>results(page).getByRole('heading',{name:/^مقایسه /});
const camera=async(page:Page)=>JSON.parse((await map(page).locator('[data-camera]').getAttribute('data-camera'))!) as {x:number;y:number;width:number;height:number;zoom:number};
const cameraIntent=async(page:Page)=>JSON.parse((await map(page).locator('[data-camera-intent]').getAttribute('data-camera-intent'))!) as {x:number;y:number;width:number;height:number;zoom:number};
const exactCard=(page:Page,group:ComparisonGroup)=>results(page).locator(`article[data-group-id="${group.groupId}"][data-quote-id="${group.representativeQuoteId}"]`);
const selection=(card:Locator)=>card.getByRole('button',{name:'انتخاب پیشنهاد',exact:true});
const details=(card:Locator)=>card.getByRole('button',{name:'جزئیات سفر',exact:true});
async function choosePriceCard(card:Locator){const control=selection(card);await expect(control).toBeEnabled();await control.focus();await control.press('Space');await expect(card).toHaveAttribute('data-selected','true');}

async function themeFinished(page:Page){
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {mapFlowThemePending?:number}).mapFlowThemePending??0),{timeout:5000}).toBe(0);
}
async function capture(page:Page,name:string){if(evidence){await themeFinished(page);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:resolve(evidence,name+'.png')});}}
/** Observe the actual displayed frame reaching the camera intent, rather than waiting every page animation or sleeping. */
async function settleCamera(page:Page){
 await expect.poll(()=>map(page).locator('[data-camera]').evaluate(node=>{
  const intent=JSON.parse(node.getAttribute('data-camera-intent')!) as {x:number;y:number;width:number;height:number;zoom:number};
  const actual=JSON.parse(node.getAttribute('data-camera')!) as typeof intent;
  const box=node.getBoundingClientRect(),aspect=box.width/box.height;
  const width=Math.max(intent.width,intent.height*aspect)/intent.zoom;
  return Math.max(Math.abs(actual.x-intent.x),Math.abs(actual.y-intent.y),Math.abs(actual.width-width),Math.abs(actual.height-width/aspect),Math.abs(actual.zoom-intent.zoom));
 }),{timeout:10_000,intervals:[50,100,200]}).toBeLessThan(.00001);
}
async function settledRoute(page:Page){await settleCamera(page);await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete','true',{timeout:20_000});}
async function noMapControls(page:Page){
 await expect(labels(page)).toHaveCount(0);
 // The independent hotel discovery entry is intentionally a button inside the aside.
 await expect(scene(page).getByRole('button')).toHaveCount(0);
 await expect(map(page).getByRole('combobox')).toHaveCount(0);
 await expect(map(page).getByRole('button',{name:/بزرگ‌نمایی|کوچک‌نمایی|مقیاس اولیه/})).toHaveCount(0);
}
async function session(page:Page){return contractResponse(await page.request.post('/api/v1/demo/session',{data:{seed:1818,anchorInstant:'2026-10-25T06:00:00Z',scenario:'normal'}}),SessionInfoSchema,201);}
async function load(page:Page,query=base){
 await page.goto('/?'+new URLSearchParams({q:JSON.stringify(query)}));
 await expect(page.getByRole('button',{name:'جست‌وجوی سفر',exact:true})).toBeEnabled();
 await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:30_000});
}
async function readSearch(page:Page,id:string){return contractResponse(await page.request.get('/api/v1/searches/'+id),SearchRecoverySchema);}
async function search(page:Page){
 const pending=page.waitForResponse(response=>response.url().endsWith('/api/v1/searches')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();
 const response=await pending;expect(response.status()).toBe(201);const initial=SearchRecoverySchema.parse(await response.json());
 await expect(results(page)).toHaveAttribute('data-search-id',initial.snapshot.searchId);
 await expect(results(page)).toHaveAttribute('data-status','complete',{timeout:30_000});
 const completed=await readSearch(page,initial.snapshot.searchId);
 await expect(selectedCard(page)).toHaveCount(1);
 const quoteId=await selectedCard(page).getAttribute('data-quote-id');
 const quote=completed.snapshot.groups.flatMap(group=>group.eligibleQuotes).find(quote=>quote.quoteId===quoteId)!;
 expect(quote).toBeDefined();
 expect(quote.total.amountRial).toBe(Math.min(...completed.snapshot.groups.flatMap(group=>group.eligibleQuotes.map(quote=>quote.total.amountRial))));
 await expect(map(page)).toHaveAttribute('data-map-itinerary',quote.itineraryId);
 await expect(map(page)).toHaveAttribute('data-map-progress','0.7');
 return completed;
}
async function timeline(card:Locator,group:ComparisonGroup){
 await details(card).click();
 for(const [label,leg]of [['رفت',group.itinerary.outbound],['برگشت',group.itinerary.return!]] as const){
  const view=card.getByRole('region',{name:'جزئیات مسیر '+label,exact:true});
  await expect(view).toBeVisible();
  expect(await view.locator('[data-segment-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-segment-id')))).toEqual(leg.segments.map(segment=>segment.segmentId));
  expect(await view.locator('[data-stop-place]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-stop-place')))).toEqual(leg.stops.map(stop=>stop.placeId));
 }
}
async function observeGPU(page:Page){
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  const stats={contexts:0,draws:0,maxColors:0,programs:[] as {linked:boolean;vertexCompiled:boolean;fragmentCompiled:boolean;logs:string[]}[],buffersCreated:0,buffersDeleted:0,uploadedBytes:0,hashes:[] as number[]};
  const contexts:WebGL2RenderingContext[]=[];
  Object.assign(window,{mapGPU:stats,mapContexts:contexts});
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<typeof original>){
   const value=original.apply(this,args);
   if(args[0]==='webgl2'&&value&&!contexts.includes(value as WebGL2RenderingContext)){
    const gl=value as WebGL2RenderingContext;contexts.push(gl);stats.contexts++;
    const link=gl.linkProgram.bind(gl);gl.linkProgram=program=>{link(program);const shaders=gl.getAttachedShaders(program)??[];stats.programs.push({linked:gl.getProgramParameter(program,gl.LINK_STATUS),vertexCompiled:shaders.filter(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.VERTEX_SHADER).every(s=>gl.getShaderParameter(s,gl.COMPILE_STATUS)),fragmentCompiled:shaders.filter(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER).every(s=>gl.getShaderParameter(s,gl.COMPILE_STATUS)),logs:[gl.getProgramInfoLog(program)??'',...shaders.map(s=>gl.getShaderInfoLog(s)??'')]});};
    const create=gl.createBuffer.bind(gl),remove=gl.deleteBuffer.bind(gl),data=gl.bufferData.bind(gl);gl.createBuffer=()=>{stats.buffersCreated++;return create();};gl.deleteBuffer=buffer=>{stats.buffersDeleted++;remove(buffer);};gl.bufferData=((...args:Parameters<typeof data>)=>{const source=args[1];stats.uploadedBytes+=typeof source==='number'?source:source?.byteLength??0;return data(...args);}) as typeof gl.bufferData;
    let lastRead=-Infinity;
    const observe=()=>{stats.draws++;if(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)!==null||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null)return;const now=performance.now();if(now-lastRead<100)return;lastRead=now;const element=document.querySelector('[data-map-fit] [data-camera]');if(!element)return;const box=element.getBoundingClientRect();if(box.top<0||box.bottom>innerHeight)return;const ratio=gl.drawingBufferWidth/innerWidth,width=Math.floor(box.width*ratio),height=Math.floor(box.height*ratio);const pixels=new Uint8Array(width*height*4);gl.readPixels(Math.floor(box.left*ratio),Math.floor((innerHeight-box.bottom)*ratio),width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let hash=0;const colors=new Set<number>();for(let i=0;i<pixels.length;i+=4){const rgb=pixels[i]!+pixels[i+1]!*256+pixels[i+2]!*65536;colors.add(rgb);hash=(hash*31+rgb)>>>0;}stats.maxColors=Math.max(stats.maxColors,colors.size);stats.hashes.push(hash);stats.hashes=stats.hashes.slice(-100);};
    const arrays=gl.drawArrays.bind(gl),elements=gl.drawElements.bind(gl);gl.drawArrays=(...args)=>{arrays(...args);observe();};gl.drawElements=(...args)=>{elements(...args);observe();};
   }return value;
  } as typeof original;
 });
}

test.describe('@map-flow real consumer route map',()=>{
 test.beforeEach(async({page})=>{
  page.setDefaultTimeout(10_000);
  // Track only actual native theme transitions, preserving their callback and result.
  await page.addInitScript(()=>{
   const original=document.startViewTransition?.bind(document);
   const state={mapFlowThemePending:0};Object.assign(window,state);
   if(original)document.startViewTransition=((update:Parameters<Document['startViewTransition']>[0])=>{
    const runtime=window as unknown as typeof state;runtime.mapFlowThemePending++;
    const transition=original(update);void transition.finished.then(()=>runtime.mapFlowThemePending--,()=>runtime.mapFlowThemePending--);return transition;
   }) as Document['startViewTransition'];
  });
 });
 test.afterEach(async({page})=>{const response=await page.request.post('/api/v1/demo/reset',{data:{}});expect(response.status()).toBe(201);record('last-owned-reset.json',{status:response.status(),explicitBody:{}});});

 test('real round trip owns selected presentation, canonical localized timeline, camera and one GPU owner',async({page,browser})=>{
  test.setTimeout(120_000);await page.setViewportSize({width:1440,height:1080});await observeGPU(page);
  const metadata=await session(page),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await load(page);
  await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible();await noMapControls(page);
  const title=map(page).locator('[data-map-heading-key]:not([aria-hidden="true"]) h2');
  await expect(title).toContainText('تهران');await expect(title).toContainText('مشهد');await expect(title.locator('svg[data-map-heading-arrow]')).toHaveAttribute('data-map-heading-arrow','round-trip');
  const catalog=await contractResponse(await page.request.get('/api/v1/catalog'),CatalogSnapshotSchema);
  const cityClicks:number[][]=[];let mapWrites=0;
  page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/v1/searches'))mapWrites++;});
  const originalUrl=page.url(),mapBox=(await map(page).locator('[data-camera]').boundingBox())!;
  for(const point of [[.3,.4],[.7,.6]]){await page.mouse.click(mapBox.x+mapBox.width*point[0]!,mapBox.y+mapBox.height*point[1]!);cityClicks.push(point);}
  await expect(page.getByRole('combobox',{name:'مبدا',exact:true})).toHaveValue('تهران');await expect(page.getByRole('combobox',{name:'مقصد',exact:true})).toHaveValue('مشهد');
  expect(page.url()).toBe(originalUrl);expect(mapWrites).toBe(0);await expect(map(page)).not.toHaveAttribute('data-map-itinerary',/.+/);
  await capture(page,'initial-iran');record('read-only-map-clicks.json',{metadata,cityClicks,mapWrites});

  const final=await search(page),automatic=(await selectedCard(page).getAttribute('data-quote-id'))!;
  const pinGroup=final.snapshot.groups.find(group=>group.itinerary.outbound.stops.some(stop=>stop.vehicleChange)&&!group.eligibleQuotes.some(quote=>quote.quoteId===automatic))??final.snapshot.groups.find(group=>!group.eligibleQuotes.some(quote=>quote.quoteId===automatic))!;
  expect(pinGroup).toBeDefined();const card=exactCard(page,pinGroup);await expect(card).toHaveCount(1);await choosePriceCard(card);await page.mouse.move(1435,5);
  await expect(map(page)).toHaveAttribute('data-map-itinerary',pinGroup.itinerary.itineraryId);await expect(map(page)).toHaveAttribute('data-map-progress','0.7');await settledRoute(page);
  const fitted=await camera(page),fittedIntent=await cameraIntent(page);
  const other=final.snapshot.groups.find(group=>group.groupId!==pinGroup.groupId)!,third=final.snapshot.groups.find(group=>group.groupId!==pinGroup.groupId&&group.groupId!==other.groupId)!;
  const focusCard=exactCard(page,other),thirdCard=exactCard(page,third);
  await focusCard.hover();await expect(map(page)).toHaveAttribute('data-map-itinerary',pinGroup.itinerary.itineraryId);
  await selection(focusCard).focus();await thirdCard.hover();await expect(map(page)).toHaveAttribute('data-map-itinerary',pinGroup.itinerary.itineraryId);
  await page.mouse.move(1435,5);expect(await camera(page)).toEqual(fitted);
  await focusCard.hover();expect(await focusCard.evaluate(element=>element.matches(':hover'))).toBe(true);
  await heading(page).evaluate((element:HTMLElement)=>element.focus({preventScroll:true}));expect(await focusCard.evaluate(element=>element.matches(':hover'))).toBe(true);
  await expect(map(page)).toHaveAttribute('data-map-itinerary',pinGroup.itinerary.itineraryId);expect(await cameraIntent(page)).toEqual(fittedIntent);
  await timeline(card,pinGroup);await details(card).click();expect(await cameraIntent(page)).toEqual(fittedIntent);
  const expectedStops=[...pinGroup.itinerary.outbound.stops.map(stop=>({placeId:stop.placeId,direction:'outbound',wait:stop.waitMinutes})),...pinGroup.itinerary.return!.stops.map(stop=>({placeId:stop.placeId,direction:'return',wait:stop.waitMinutes}))];
  expect(await page.locator('[data-route-presentation] [data-route-stop]').evaluateAll(nodes=>nodes.map(node=>({placeId:node.getAttribute('data-route-stop'),direction:node.getAttribute('data-stop-direction'),wait:Number(node.getAttribute('data-wait-minutes'))})))).toEqual(expectedStops);
  await capture(page,'real-flight-route');await noMapControls(page);expect((await camera(page)).zoom).toBe(1);

  // Native two-finger input is explicitly Chromium-owned; no cross-browser pinch proof is implied.
  expect(browser.browserType().name()).toBe('chromium');const client=await page.context().newCDPSession(page);
  // Decision0061's independent hotel dock overlays the bottom of the aside.
  // Send the unchanged native gesture through an actually exposed scene area.
  const box=(await map(page).locator('[data-camera]').boundingBox())!,x=box.x+box.width/2,y=box.y+box.height*.55;
  const touchHits=await map(page).locator('[data-camera]').evaluate((viewport,points)=>points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return{...point,insideScene:Boolean(hit&&viewport.contains(hit)),button:Boolean(hit?.closest('button')),hotelDock:Boolean(hit?.closest('[data-map-hotel-dock]'))};}),[-60,-30,30,60].map(offset=>({x:x+offset,y})));
  record('native-touch-hit-targets.json',touchHits);expect(touchHits.every(hit=>hit.insideScene&&!hit.button&&!hit.hotelDock)).toBe(true);
  try{await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:x-30,y},{id:2,x:x+30,y}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:x-60,y},{id:2,x:x+60,y}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await client.detach();}
  await expect.poll(async()=>(await camera(page)).zoom).toBeGreaterThan(1);await settleCamera(page);const pinched=await camera(page);
  await page.mouse.move(x,y);await page.mouse.wheel(0,400);expect((await camera(page)).zoom).toBe(pinched.zoom);
  const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST')writes.push(new URL(request.url()).pathname);});const sourceUrl=page.url(),selectedId=await card.getAttribute('data-quote-id');
  const fastest=results(page).getByRole('radio',{name:'سریع‌ترین',exact:true});await fastest.focus();await page.keyboard.press('Space');await expect(fastest).toBeChecked();
  await expect(map(page)).toHaveAttribute('data-map-itinerary',pinGroup.itinerary.itineraryId);await expect(map(page)).toHaveAttribute('data-map-progress','0.7');await expect(map(page)).toHaveAttribute('data-map-historical','false');
  expect(await camera(page)).toEqual(pinched);expect(page.url()).toBe(sourceUrl);await expect(card).toHaveAttribute('data-selected','true');expect(await card.getAttribute('data-quote-id')).toBe(selectedId);
  expect((await readSearch(page,final.snapshot.searchId)).snapshot).toEqual(final.snapshot);expect(writes).toEqual([]);

  await page.setViewportSize({width:800,height:1080});await expect(map(page)).toHaveCount(0);await expect(page.locator('[data-route-scene]')).toHaveCount(0);await expect(page.getByRole('region',{name:'جزئیات مسیر سفر',exact:true,includeHidden:true})).toBeHidden();
  await page.setViewportSize({width:390,height:1000});const mobile=page.getByRole('region',{name:'جزئیات مسیر سفر',exact:true});await expect(mobile).toHaveAttribute('data-mobile-itinerary',pinGroup.itinerary.itineraryId);
  await mobile.getByText('نمایش توقف‌ها و زمان‌های مسیر رفت',{exact:true}).click();await expect(mobile.locator('[data-segment-id]')).toHaveCount(pinGroup.itinerary.outbound.segments.length);await mobile.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await capture(page,'mobile-390-timeline');await expect(labels(page)).toHaveCount(0);
  await page.setViewportSize({width:1440,height:1080});await expect(map(page)).toBeVisible();await settledRoute(page);expect(await camera(page)).toEqual(pinched);
  const before=await page.evaluate(()=>(window as unknown as {mapGPU:{draws:number}}).mapGPU.draws);await expect.poll(()=>page.evaluate(()=>(window as unknown as {mapGPU:{draws:number}}).mapGPU.draws)).toBeGreaterThan(before);
  record('native-pre-recovery.json',{metadata,query:base,final,pinGroup,cityClicks,fitted,pinched,writes});const beforeRestore=await camera(page);
  await page.evaluate(()=>{const extension=(window as unknown as {mapContexts:WebGL2RenderingContext[]}).mapContexts[0]!.getExtension('WEBGL_lose_context')!;Object.assign(window,{mapLoss:extension});extension.loseContext();});
  await expect(page.locator('[data-graphics-status="context-lost"]')).toBeVisible();await expect(map(page).locator('svg[role="presentation"]')).toBeVisible();
  await page.evaluate(()=>(window as unknown as {mapLoss:WEBGL_lose_context}).mapLoss.restoreContext());await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible({timeout:20_000});await settledRoute(page);expect(await camera(page)).toEqual(beforeRestore);await capture(page,'restored-map');
  const gpu=await page.evaluate(()=>(window as unknown as {mapGPU:{contexts:number;programs:{linked:boolean;vertexCompiled:boolean;fragmentCompiled:boolean;logs:string[]}[];maxColors:number;buffersCreated:number;buffersDeleted:number;uploadedBytes:number;draws:number}}).mapGPU);
  expect(gpu.contexts).toBe(1);expect(gpu.programs.length).toBeGreaterThanOrEqual(3);expect(gpu.programs.every(program=>program.linked&&program.vertexCompiled&&program.fragmentCompiled&&program.logs.every(log=>!log))).toBe(true);expect(gpu.maxColors).toBeGreaterThan(4);expect(gpu.buffersDeleted).toBeGreaterThan(0);expect(gpu.uploadedBytes).toBeGreaterThan(10000);expect(errors).toEqual([]);
  record('real-flight-map.json',{metadata,browser:browser.version(),query:base,final,pinGroup,cityClicks,catalogRevision:catalog.catalogRevision,fitted,pinched,gpu,errors,native:'Actual API, original WebGL2 compile/link/draw/readPixels/resource calls, Chromium CDP touch and context-loss extension. Pixel observation only reads the default framebuffer. No substituted context results or performance claim.'});
 });

 test('all real mode/scope maps omit network labels with authored paths and compact responsive palettes',async({page})=>{
  test.setTimeout(150_000);await page.setViewportSize({width:1440,height:1000});const metadata=await session(page),checks=[];
  for(const mode of ['flight','train','bus'] as const)for(const scope of ['domestic','international'] as const){
   const query:TransportSearchQuery={...base,mode,scope,destinationCityId:scope==='domestic'?mode==='bus'?'isfahan':'mashhad':mode==='flight'?'istanbul':mode==='train'?'van':'yerevan',classCode:mode==='flight'?'economy':mode==='train'?'seat':'standard'};
   await load(page,query);await settleCamera(page);if(scope==='international')await capture(page,mode+'-world-overview');const final=await search(page);await page.mouse.move(1435,5);await settledRoute(page);await noMapControls(page);
   const selected=await selectedCard(page).getAttribute('data-quote-id'),itinerary=await map(page).getAttribute('data-map-itinerary'),intent=await cameraIntent(page);
   for(const appearance of ['light','dark']){
    if(await page.locator('html').getAttribute('data-appearance')!==appearance)await page.getByRole('button',{name:appearance==='light'?'نمای روشن':'نمای تیره',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-appearance',appearance);await themeFinished(page);await settleCamera(page);await capture(page,mode+'-'+scope+'-'+appearance);
    await expect(map(page)).toHaveAttribute('data-map-itinerary',itinerary!);expect(await selectedCard(page).getAttribute('data-quote-id')).toBe(selected);expect(await cameraIntent(page)).toEqual(intent);
   }
   checks.push({query,final,selected,itinerary,labels:0,sceneCityControls:0});
  }
  record('all-modes-networks.json',{metadata,checks});
 });

 test('actual quote deadline revokes selection and seller authority while preserving read-only inspection',async({page})=>{
  test.setTimeout(60_000);await page.setViewportSize({width:1440,height:1000});await page.clock.install();const metadata=await session(page);await load(page);const final=await search(page),card=selectedCard(page);
  const selected=(await card.getAttribute('data-quote-id'))!,original=final.snapshot.groups.flatMap(group=>group.eligibleQuotes).find(quote=>quote.quoteId===selected)!;const itinerary=await map(page).getAttribute('data-map-itinerary');
  await expect(selection(card)).toBeEnabled();expect(await card.locator('[data-seller-link-quote-id]').count()).toBeGreaterThan(0);
  const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&/\/api\/v1\/(?:searches|referrals)/.test(new URL(request.url()).pathname))writes.push(new URL(request.url()).pathname);});
  const now=await page.evaluate(()=>Date.now()),advance=Math.max(1,Date.parse(original.expiresAt)-now+1000);await page.clock.fastForward(advance);
  await expect(map(page)).toHaveAttribute('data-map-progress','0.35');await expect(map(page)).toHaveAttribute('data-map-itinerary',itinerary!);await expect(card.locator('[data-invalid-price]')).toHaveAttribute('data-invalid-price','expired');
  await expect(selection(card)).toBeDisabled();await expect(card.locator('[data-seller-link-quote-id]')).toHaveCount(0);expect(await card.getAttribute('data-quote-id')).toBe(selected);
  await details(card).click();await expect(card.getByRole('region',{name:'جزئیات مسیر رفت',exact:true})).toBeVisible();await expect(card.getByRole('region',{name:'جزئیات مسیر برگشت',exact:true})).toBeVisible();
  expect(writes).toEqual([]);expect((await contractResponse(await page.request.get('/api/v1/admin/referrals'),AdminReferralListSchema)).metrics.confirmed).toBe(0);expect((await readSearch(page,final.snapshot.searchId)).snapshot).toEqual(final.snapshot);
  await capture(page,'real-expired-inspection');record('real-expiry.json',{metadata,query:base,final,selected,itinerary,deadline:original.expiresAt,advance,writes,clock:'Browser virtual clock crossed the original server quote deadline. No claim of wall-clock expiry or server clock advancement.'});
 });

 test('injected unavailable graphics preserves selected route and ticket timeline without claiming native GPU proof',async({page})=>{
  test.setTimeout(60_000);await page.setViewportSize({width:1440,height:1000});await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<typeof original>){return args[0]==='webgl2'?null:original.apply(this,args);} as typeof original;});
  const metadata=await session(page);await load(page);const final=await search(page),card=selectedCard(page),quoteId=await card.getAttribute('data-quote-id');const group=final.snapshot.groups.find(group=>group.eligibleQuotes.some(quote=>quote.quoteId===quoteId))!;
  await expect(page.locator('[data-graphics-status="unavailable"]')).toBeVisible();await expect(map(page).locator('svg[role="presentation"]')).toBeVisible();await noMapControls(page);await timeline(card,group);await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete','true');
  await capture(page,'injected-unavailable-static-map');record('injected-unavailable.json',{metadata,final,quoteId,injection:'getContext(webgl2) returns null to verify application fallback only. No native GPU capability proof.'});
 });

 test('keyboard focus preserves the pin and a retired flight control cannot authorize the changed train draft',async({page})=>{
  test.setTimeout(90_000);await page.setViewportSize({width:1440,height:1000});const metadata=await session(page);await load(page);const final=await search(page),first=selectedCard(page),selected=(await first.getAttribute('data-quote-id'))!;
  const chosen=final.snapshot.groups.find(group=>group.eligibleQuotes.some(quote=>quote.quoteId===selected))!,other=final.snapshot.groups.find(group=>group.groupId!==chosen.groupId)!;
  const intent=await cameraIntent(page);await selection(exactCard(page,other)).focus();await expect(map(page)).toHaveAttribute('data-map-itinerary',chosen.itinerary.itineraryId);expect(await cameraIntent(page)).toEqual(intent);
  await heading(page).focus();await expect(map(page)).toHaveAttribute('data-map-progress','0.7');const retired=await selection(first).elementHandle();expect(retired).not.toBeNull();
  const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&(request.url().endsWith('/api/v1/searches')||request.url().includes('/api/v1/referrals/')))writes.push(new URL(request.url()).pathname);});
  const train=page.getByRole('radiogroup',{name:'وسیله سفر',exact:true}).getByRole('radio',{name:'قطار',exact:true});await train.focus();await page.keyboard.press('Space');await expect(train).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-mode','train');await expect(cards(page)).toHaveCount(0);await expect(map(page)).not.toHaveAttribute('data-map-itinerary',/.+/);await expect(map(page)).toHaveAttribute('data-map-progress','0');
  const retirement=await retired!.evaluate(node=>({connected:node.isConnected,inert:Boolean(node.closest('[inert]')),hidden:Boolean(node.closest('[aria-hidden="true"]'))}));expect(!retirement.connected||retirement.inert||retirement.hidden).toBe(true);
  // Hostile invocation of the retired DOM reference; this does not claim direct invocation of a retained React callback.
  await retired!.evaluate(node=>(node as HTMLButtonElement).click());await expect(map(page)).not.toHaveAttribute('data-map-itinerary',/.+/);expect(writes).toEqual([]);expect((await readSearch(page,final.snapshot.searchId)).snapshot).toEqual(final.snapshot);
  const fresh=await search(page);expect(fresh.snapshot.query.mode).toBe('train');expect(fresh.snapshot.query.classCode).toBe('seat');expect(fresh.snapshot.searchId).not.toBe(final.snapshot.searchId);
  await retired!.evaluate(node=>(node as HTMLButtonElement).click());await expect(page.locator('html')).toHaveAttribute('data-mode','train');await expect(map(page)).toHaveAttribute('data-map-progress','0.7');
  const freshSelected=await selectedCard(page).getAttribute('data-quote-id');expect(fresh.snapshot.groups.some(group=>group.itinerary.mode==='train'&&group.eligibleQuotes.some(quote=>quote.quoteId===freshSelected))).toBe(true);
  expect(writes).toEqual(['/api/v1/searches']);expect((await readSearch(page,final.snapshot.searchId)).snapshot).toEqual(final.snapshot);await noMapControls(page);await capture(page,'train-after-retired-flight');
  record('committed-inspection.json',{metadata,original:final,selected,retirement,fresh,writes,proof:'Retired DOM control inertness/late DOM-event fence and immutable original server evidence; stale React closure execution remains controller-unit coverage.'});
 });
});
