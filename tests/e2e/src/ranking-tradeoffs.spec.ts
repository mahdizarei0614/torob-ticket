import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {SearchRecovery,TransportSearchQuery} from '@torob-ticket/contracts';

const evidence=process.env.RANKING_TRADEOFF_EVIDENCE_DIR??'docs/evidence/adjustments/ranking-tradeoffs/native';
const base:TransportSearchQuery={mode:'flight',scope:'international',tripType:'one-way',originCityId:'tehran',destinationCityId:'london',departureDate:'2026-11-02',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const region=(page:Page)=>page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});
function record(name:string,value:unknown){mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');}
async function capture(page:Page,name:string){
 await expect.poll(()=>region(page).evaluate(node=>!node.querySelector('[data-result-presence="exiting"]'))).toBe(true);
 await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished));});
 mkdirSync(evidence,{recursive:true});await page.screenshot({path:join(evidence,name+'.png')});
}
async function setup(page:Page,context:BrowserContext,query:TransportSearchQuery){
 expect(await context.cookies()).toEqual([]);
 expect((await context.request.post('/api/v1/demo/session',{data:{seed:6161,scenario:'normal',anchorInstant:'2026-10-29T06:00:00Z'}})).status()).toBe(201);
 await page.goto('/?q='+encodeURIComponent(JSON.stringify(query)));
 const pending=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/api/v1/searches'));
 await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();
 const response=await pending;expect(response.status()).toBe(201);const initial=await response.json() as SearchRecovery;
 await expect(region(page)).toHaveAttribute('data-search-id',initial.snapshot.searchId);
 await expect(region(page)).toHaveAttribute('data-status','complete',{timeout:25000});
 await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:25000});
 const recovery=await (await context.request.get('/api/v1/searches/'+initial.snapshot.searchId)).json() as SearchRecovery;
 return recovery;
}
async function cards(page:Page,recovery:SearchRecovery){
 const rows=await region(page).locator('article[data-price-card-id][data-quote-id]').evaluateAll(nodes=>nodes.map(node=>({id:node.getAttribute('data-price-card-id')!,quoteId:node.getAttribute('data-quote-id')!,amount:Number(node.getAttribute('data-amount-rial'))})));
 return rows.map(row=>{const group=recovery.snapshot.groups.find(group=>group.eligibleQuotes.some(quote=>quote.quoteId===row.quoteId))!;expect(group).toBeTruthy();return{...row,groupId:group.groupId,duration:group.durationMinutes,connections:group.connectionCount};});
}
async function sort(page:Page,name:string){
 const radio=region(page).getByRole('radiogroup',{name:'مرتب‌سازی پیشنهادها',exact:true}).getByRole('radio',{name,exact:true});await radio.focus();await page.keyboard.press('Space');await expect(radio).toBeChecked();return radio;
}
function ordered(rows:Awaited<ReturnType<typeof cards>>,kind:'duration'|'connections'){
 for(let i=1;i<rows.length;i++){const before=rows[i-1]!,after=rows[i]!;expect(before[kind]).toBeLessThanOrEqual(after[kind]);}
}

for(const tripType of ['one-way','round-trip'] as const)test(`@ranking-tradeoffs ${tripType} actual fewest and fastest cards differ by supplied waits without extra searches or selection changes`,async({page,context,browser})=>{
 test.setTimeout(60000);await page.setViewportSize({width:1366,height:900});const query={...base,tripType,...tripType==='round-trip'?{returnDate:'2026-11-09'}:{}};const recovery=await setup(page,context,query);
 const posts:string[]=[];page.on('request',request=>{if(request.method()==='POST')posts.push(new URL(request.url()).pathname);});
 const initial=await cards(page,recovery);expect(initial.length).toBeGreaterThan(24);
 expect(recovery.snapshot.groups.flatMap(group=>group.eligibleQuotes).every(quote=>quote.sourceRevision==='source-v5-schedule-tradeoffs-2026-10-30')).toBe(true);
 const selection=await region(page).locator('article[data-selected="true"]').getAttribute('data-quote-id');expect(selection).toBeTruthy();const map=page.getByRole('complementary',{name:'نقشه سفر',exact:true});const itinerary=await map.getAttribute('data-map-itinerary');const searchId=await region(page).getAttribute('data-search-id');const url=page.url();
 const fastControl=await sort(page,'سریع‌ترین');const fastest=await cards(page,recovery);ordered(fastest,'duration');await expect(fastControl).toBeFocused();await capture(page,tripType+'-fastest');
 const stopsControl=await sort(page,'کم‌توقف‌ترین');const fewest=await cards(page,recovery);ordered(fewest,'connections');await expect(stopsControl).toBeFocused();await capture(page,tripType+'-fewest');
 expect(fastest.map(row=>row.id)).not.toEqual(fewest.map(row=>row.id));expect(fastest[0]!.connections).toBeGreaterThan(fewest[0]!.connections);expect(fastest[0]!.duration).toBeLessThan(fewest[0]!.duration);
 expect([...initial.map(row=>row.id)].sort()).toEqual([...fewest.map(row=>row.id)].sort());expect([...fastest.map(row=>[row.id,row.amount])].sort()).toEqual([...fewest.map(row=>[row.id,row.amount])].sort());
 for(const name of ['سریع‌ترین','کم‌توقف‌ترین','سریع‌ترین'])await sort(page,name);
 expect((await cards(page,recovery)).map(row=>row.id)).toEqual(fastest.map(row=>row.id));
 await expect(region(page).locator('article[data-selected="true"]')).toHaveAttribute('data-quote-id',selection!);await expect(map).toHaveAttribute('data-map-itinerary',itinerary!);await expect(region(page)).toHaveAttribute('data-search-id',searchId!);expect(page.url()).toBe(url);expect(posts).toEqual([]);
 const reread=await (await context.request.get('/api/v1/searches/'+searchId)).json() as SearchRecovery;expect(reread.snapshot.query).toEqual(recovery.snapshot.query);
 const groups=recovery.snapshot.groups.filter(group=>group.eligibleQuotes.length).map(group=>({id:group.groupId,duration:group.durationMinutes,connections:group.connectionCount,source:group.eligibleQuotes[0]!.sourceRevision,outbound:group.itinerary.outbound,return:group.itinerary.return}));
 record(tripType+'-ranking',{browser:browser.version(),query,searchId,selection,itinerary,groups,fastest,fewest,posts,cleanup:'Fresh isolated context; no normal session reset/deletion.'});
});

test('@ranking-tradeoffs direct same-transfer trains retain honest identical ordering',async({page,context,browser})=>{
 test.setTimeout(60000);await page.setViewportSize({width:390,height:844});const query={...base,mode:'train' as const,scope:'domestic' as const,destinationCityId:'mashhad',classCode:'seat'};const recovery=await setup(page,context,query);const posts:string[]=[];page.on('request',request=>{if(request.method()==='POST')posts.push(new URL(request.url()).pathname);});
 await sort(page,'سریع‌ترین');const fastest=await cards(page,recovery);ordered(fastest,'duration');expect(new Set(fastest.map(row=>row.connections)).size).toBe(1);
 await sort(page,'کمترین تعویض');const fewest=await cards(page,recovery);expect(fewest.map(row=>row.id)).toEqual(fastest.map(row=>row.id));expect(posts).toEqual([]);await capture(page,'same-transfer-train');record('same-transfer-train',{browser:browser.version(),query,fastest,fewest,posts,explanation:'All supplied trains have the same actual vehicle-change count; duration tie-break retains the same truthful order.'});
});
