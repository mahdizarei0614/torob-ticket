import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {SearchRecovery,TransportSearchQuery} from '@torob-ticket/contracts';

const evidence=process.env.ROUTE_HALO_EVIDENCE_DIR??'.local/evidence/adjustments/route-direction-halo/native/halo';
const base:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-02',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
interface HaloSample {at:number;values:Record<string,number|number[]>}
interface HaloProof {programs:{linked:boolean;compiled:boolean;logs:string[];attributes:string[]}[];latest:Record<string,number|number[]>;draws:number;samples:HaloSample[]}
function save(name:string,value:unknown){mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');}
const map=(page:Page)=>page.getByRole('complementary',{name:'نقشه سفر',exact:true});
const presentation=(page:Page)=>page.locator('[data-route-presentation]');
const results=(page:Page)=>page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});
async function proof(page:Page){return page.evaluate(()=>(window as unknown as {routeHaloProof:HaloProof}).routeHaloProof);}
function vector(value:HaloProof,name:string){const found=value.latest[name];if(!Array.isArray(found)||found.length!==2)throw new Error('Missing actual shader vector '+name);return found;}
function strength(value:HaloProof){return Math.max(...vector(value,'directionOpacity'));}
function scalar(value:HaloProof,name:string){const found=value.latest[name];if(typeof found!=='number')throw new Error('Missing actual shader uniform '+name);return found;}
async function screenshot(page:Page,name:string){await page.evaluate(()=>document.fonts.ready);mkdirSync(evidence,{recursive:true});await page.screenshot({path:join(evidence,name+'.png')});}

/** Observe real driver uploads and draws without changing their values or clock. */
async function observe(page:Page,appearance:'light'|'dark'='dark',unavailable=false){
 await page.addInitScript(({appearance,unavailable})=>{
  localStorage.setItem('torobticket.appearance',appearance);
  const state:HaloProof={programs:[],latest:{},draws:0,samples:[]};
  Object.assign(window,{routeHaloProof:state});
  if(unavailable){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:string,...args:unknown[]){return kind==='webgl2'?null:Reflect.apply(original,this,[kind,...args]);} as typeof original;return;}
  const proto=WebGL2RenderingContext.prototype,programs=new WeakSet<WebGLProgram>(),names=new WeakMap<WebGLUniformLocation,string>(),current=new WeakMap<WebGL2RenderingContext,WebGLProgram|null>();
  const link=proto.linkProgram,location=proto.getUniformLocation,upload=proto.uniform1f,upload2=proto.uniform2f,upload2v=proto.uniform2fv,use=proto.useProgram,arrays=proto.drawArrays,elements=proto.drawElements;
  proto.linkProgram=function(program){link.call(this,program);const shaders=this.getAttachedShaders(program)??[],source=shaders.map(shader=>this.getShaderSource(shader)??'').join('\n');if(source.includes('directionPhase')&&source.includes('routeSide')){programs.add(program);state.programs.push({linked:Boolean(this.getProgramParameter(program,this.LINK_STATUS)),compiled:shaders.every(shader=>Boolean(this.getShaderParameter(shader,this.COMPILE_STATUS))),logs:[this.getProgramInfoLog(program)??'',...shaders.map(shader=>this.getShaderInfoLog(shader)??'')],attributes:Array.from({length:Number(this.getProgramParameter(program,this.ACTIVE_ATTRIBUTES))},(_,index)=>this.getActiveAttrib(program,index)?.name??'')});}};
  proto.getUniformLocation=function(program,name){const found=location.call(this,program,name);if(found&&programs.has(program))names.set(found,name);return found;};
  proto.uniform1f=function(at,value){const name=at&&names.get(at);if(name)state.latest[name]=value;return upload.call(this,at,value);};
  proto.uniform2f=function(at,x,y){const name=at&&names.get(at);if(name)state.latest[name]=[x,y];return upload2.call(this,at,x,y);};
  proto.uniform2fv=function(...args:Parameters<typeof upload2v>){const name=args[0]&&names.get(args[0]);if(name)state.latest[name]=Array.from(args[1]).slice(args[2]??0,(args[2]??0)+2);return Reflect.apply(upload2v,this,args);};
  proto.useProgram=function(program){current.set(this,program);return use.call(this,program);};
  const drawn=(gl:WebGL2RenderingContext)=>{const program=current.get(gl);if(!program||!programs.has(program))return;state.draws++;state.samples.push({at:performance.now(),values:{...state.latest}});if(state.samples.length>240)state.samples.shift();};
  proto.drawArrays=function(...args:Parameters<typeof arrays>){arrays.apply(this,args);drawn(this);};
  proto.drawElements=function(...args:Parameters<typeof elements>){elements.apply(this,args);drawn(this);};
 },{appearance,unavailable});
}
async function search(page:Page,context:BrowserContext,query=base){
 expect((await context.cookies()).length).toBe(0);
 expect((await context.request.post('/api/v1/demo/session',{data:{seed:6161,scenario:'normal',anchorInstant:'2026-10-29T06:00:00Z'}})).status()).toBe(201);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/?q='+encodeURIComponent(JSON.stringify(query)));
 await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();
 await expect(results(page)).toHaveAttribute('data-status','complete',{timeout:30000});
 const id=await results(page).getAttribute('data-search-id');
 const recovery=await (await context.request.get('/api/v1/searches/'+id)).json() as SearchRecovery;
 await expect(presentation(page)).toHaveAttribute('data-route-reveal',/.+/);
 return recovery;
}
async function lit(page:Page){
 await expect.poll(async()=>strength(await proof(page)),{timeout:10000}).toBeGreaterThan(.1);
 const state=await proof(page);expect(state.draws).toBeGreaterThan(0);expect(state.programs.length).toBeGreaterThan(0);
 for(const program of state.programs){expect(program.linked).toBe(true);expect(program.compiled).toBe(true);expect(program.logs.every(log=>!log.trim())).toBe(true);}
 return state;
}
async function advances(page:Page){
 const before=await proof(page),phase=scalar(before,'directionPhase');
 await expect.poll(async()=>{const after=scalar(await proof(page),'directionPhase');return (after-phase+1)%1;},{timeout:5000}).toBeGreaterThan(.06);
 return{before,after:await proof(page)};
}

test.describe('@route-halo directional route light',()=>{
 for(const mode of ['flight','train','bus'] as const)test(`${mode} renders a moving soft direction cue on its canonical route`,async({page,context,browser})=>{
  test.setTimeout(60000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await observe(page,mode==='train'?'light':'dark');
  const recovery=await search(page,context,{...base,mode,classCode:mode==='train'?'seat':mode==='bus'?'standard':'economy',...(mode!=='flight'?{tripType:'round-trip' as const,returnDate:'2026-11-06'}:{})});
  const initial=await lit(page);expect(scalar(initial,'directionRoundTrip')).toBe(mode==='flight'?0:1);expect(vector(initial,'directionCount')[0]).toBeGreaterThanOrEqual(1);expect(vector(initial,'directionCount')[0]).toBeLessThanOrEqual(6);
  if(mode!=='flight'){await expect(presentation(page)).toHaveAttribute('data-route-complete','true',{timeout:30000});await expect.poll(async()=>vector(await proof(page),'directionOpacity').every(value=>value>.1)).toBe(true);for(const program of (await proof(page)).programs){expect(program.attributes).toContain('routeLeg');expect(program.attributes).toContain('routeOverlap');}expect(scalar(await proof(page),'routeLaneWidth')).toBeGreaterThan(0);}
  await expect.poll(async()=>Number(await presentation(page).getAttribute('data-route-reveal')),{timeout:12000}).toBeGreaterThan(.98);const motion=await advances(page);await screenshot(page,mode+'-direction');
  if(mode==='flight'){
   await page.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ',exact:true}).click();await expect(page.getByRole('dialog',{name:'انتخاب تاریخ سفر',exact:true})).toBeVisible();await expect(presentation(page)).toHaveAttribute('data-motion-active','false');
   await page.waitForTimeout(200);const paused=scalar(await proof(page),'directionPhase');await page.waitForTimeout(400);expect(scalar(await proof(page),'directionPhase')).toBe(paused);
   await page.getByRole('button',{name:'انصراف',exact:true}).click();await expect(presentation(page)).toHaveAttribute('data-motion-active','true');await advances(page);
   save('pause-policy',{coveredPhase:paused,resumed:await proof(page),verification:'Native dialog coverage/resume; hidden-window policy reuses the same existing host clock and is reviewed separately.'});
  }
  expect(errors).toEqual([]);await expect(page.locator('canvas')).toHaveCount(1);
  save(mode,{browser:browser.version(),query:recovery.snapshot.query,selectedItinerary:await map(page).getAttribute('data-map-itinerary'),initial,motion,errors,cleanup:'Fresh isolated owner only; no session reset/deletion.'});
 });
 test('asymmetric round-trip keeps both supplied directions illuminated',async({page,context,browser})=>{
  test.setTimeout(90000);await observe(page);const recovery=await search(page,context,{...base,scope:'international',destinationCityId:'los-angeles',tripType:'round-trip',returnDate:'2026-11-12'});
  const ids=new Set(await results(page).locator('article[data-quote-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-quote-id'))));
  const group=recovery.snapshot.groups.find(group=>group.itinerary.return&&group.itinerary.outbound.stops.length>=1&&group.itinerary.return.stops.length>group.itinerary.outbound.stops.length&&group.eligibleQuotes.some(quote=>ids.has(quote.quoteId)));expect(group).toBeTruthy();
  const quote=group!.eligibleQuotes.find(quote=>ids.has(quote.quoteId))!;await results(page).locator(`article[data-quote-id="${quote.quoteId}"] [data-card-select]`).click();
  await expect(presentation(page)).toHaveAttribute('data-route-animation-direction','outbound');const outbound=await lit(page);const split=scalar(outbound,'directionSplit');expect(split).toBeGreaterThan(0);expect(split).toBeLessThan(1);expect(scalar(outbound,'directionRoundTrip')).toBe(1);await screenshot(page,'roundtrip-outbound');
  await expect(presentation(page)).toHaveAttribute('data-route-animation-direction','return',{timeout:55000});await expect.poll(async()=>strength(await proof(page))).toBeGreaterThan(.1);
  await expect(presentation(page)).toHaveAttribute('data-route-complete','true',{timeout:35000});const returning=await proof(page);expect(scalar(returning,'directionSplit')).toBe(split);expect(vector(returning,'directionOpacity').every(value=>value>.1)).toBe(true);expect(vector(returning,'directionCount').every(value=>value>=1&&value<=6)).toBe(true);await advances(page);await screenshot(page,'roundtrip-both-directions');
  save('roundtrip',{browser:browser.version(),outboundSegments:group!.itinerary.outbound.segments,returnSegments:group!.itinerary.return!.segments,outbound,returning,actualSplit:split,cleanup:'Fresh isolated owner only; no reset/deletion.'});
 });
 test('reduced motion retains a settled directional cue without moving phase',async({page,context,browser})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await observe(page);await search(page,context,{...base,tripType:'round-trip',returnDate:'2026-11-06'});const initial=await lit(page);await expect(presentation(page)).toHaveAttribute('data-reduced-motion','true');
  await page.waitForTimeout(500);const settled=await proof(page);expect(scalar(settled,'directionPhase')).toBe(scalar(initial,'directionPhase'));expect(vector(settled,'directionOpacity').every(value=>value>0)).toBe(true);expect(scalar(settled,'directionRoundTrip')).toBe(1);await screenshot(page,'reduced-direction');save('reduced',{browser:browser.version(),initial,settled});
 });
 test('unavailable WebGL keeps static true-tangent directional cues',async({page,context,browser})=>{
  await observe(page,'dark',true);await search(page,context,{...base,mode:'bus',classCode:'standard',tripType:'round-trip',returnDate:'2026-11-06'});
  await expect(map(page).locator('[data-static-route-direction="both"]').first()).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);expect((await proof(page)).programs).toHaveLength(0);
  const cues=await map(page).locator('[data-direction-arrow]').evaluateAll(nodes=>nodes.map(node=>({direction:node.getAttribute('data-direction-leg'),mode:node.getAttribute('data-direction-mode'),transform:node.getAttribute('transform')})));expect(cues.length).toBeGreaterThan(0);expect(new Set(cues.map(cue=>cue.direction))).toEqual(new Set(['outbound','return']));await screenshot(page,'fallback-direction');save('fallback',{browser:browser.version(),cues,webglUnavailable:true});
 });
});
