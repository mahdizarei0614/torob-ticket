import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {CatalogSnapshot,DatePriceSnapshot,SearchRecovery,TransportSearchQuery} from '@torob-ticket/contracts';

const evidence=process.env.ROUNDTRIP_FIX_EVIDENCE_DIR??'docs/evidence/adjustments/roundtrip-pricing-and-filter/native';
const base:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'round-trip',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-02',returnDate:'2026-11-06',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const sourceRevision='source-v5-schedule-tradeoffs-2026-10-30';
const region=(page:Page)=>page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});
const explorer=(page:Page)=>page.getByRole('region',{name:'کاوش تاریخ سفر',exact:true});
const money=(rial:number)=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1}).format(rial/10)+' تومان';
const dateLabel=(date:string)=>new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
function record(name:string,value:unknown){mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');}
async function capture(page:Page,name:string){
 await expect.poll(()=>page.evaluate(()=>Array.from(document.querySelectorAll('[data-content-presence="present"]')).every(node=>Number(getComputedStyle(node).opacity)>=.999)&&!document.querySelector('[data-content-presence="exiting"]'))).toBe(true);
 await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished));});
 mkdirSync(evidence,{recursive:true});await page.screenshot({path:join(evidence,name+'.png')});
}
async function setup(page:Page,context:BrowserContext,query=base){
 expect(await context.cookies()).toEqual([]);
 expect((await context.request.post('/api/v1/demo/session',{data:{seed:6161,scenario:'normal',anchorInstant:'2026-10-29T06:00:00Z'}})).status()).toBe(201);
 await page.goto('/?q='+encodeURIComponent(JSON.stringify(query)));
}
async function search(page:Page,context:BrowserContext,action:()=>Promise<void>=()=>page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click()){
 const started=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/api/v1/searches'));
 await action();
 const response=await started;expect(response.status()).toBe(201);const initial=await response.json() as SearchRecovery;
 await expect(region(page)).toHaveAttribute('data-search-id',initial.snapshot.searchId);
 await expect(region(page)).toHaveAttribute('data-status','complete',{timeout:25000});
 const recovery=await (await context.request.get('/api/v1/searches/'+initial.snapshot.searchId)).json() as SearchRecovery;
 return recovery;
}
async function returnPrices(page:Page,context:BrowserContext){
 const pending=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/api/v1/date-prices')&&response.request().postDataJSON().leg==='return');
 await page.getByRole('radiogroup',{name:'جستجو بر اساس',exact:true}).getByRole('radio',{name:'تاریخ برگشت',exact:true}).focus();await page.keyboard.press('Space');
 const initial=await (await pending).json() as DatePriceSnapshot;
 await expect(explorer(page)).toHaveAttribute('data-date-leg','return');
 await expect(explorer(page)).toHaveAttribute('data-date-price-id',initial.datePriceId);
 await expect(explorer(page)).toHaveAttribute('data-date-price-status','complete',{timeout:25000});
 return await (await context.request.get('/api/v1/date-prices/'+initial.datePriceId,{params:{clientGeneration:initial.clientGeneration}})).json() as DatePriceSnapshot;
}

test('@roundtrip-fix filters flip and scroll within desktop, mobile and short viewports; exits reject stale form actions',async({page,context,browser})=>{
 test.setTimeout(90000);await page.setViewportSize({width:1366,height:768});await setup(page,context);await search(page,context);
 let starts=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/v1/searches'))starts++;});
 const trigger=page.getByRole('button',{name:/^فیلتر نتایج/});const sizes=[];
 for(const [width,height] of [[1366,768],[390,650],[320,480]] as const){
  await page.setViewportSize({width,height});await trigger.scrollIntoViewIfNeeded();
  await trigger.evaluate((node,height)=>{const y=node.getBoundingClientRect().top+scrollY;window.scrollTo(0,Math.max(0,y-height+100));},height);
  await trigger.click();const panel=page.locator('[data-result-filter-panel]:not([data-exiting])');
  await expect(panel).toBeVisible();
  record('filter-before-'+width,await panel.evaluate(node=>({viewport:{width:innerWidth,height:innerHeight},panel:{rect:node.getBoundingClientRect().toJSON(),style:node.getAttribute('style')},children:Array.from(node.querySelectorAll<HTMLElement>('[role=dialog],form,[class*=filterBody],[class*=filterHeader],[class*=filterActions],input[type=checkbox]')).map(item=>({tag:item.tagName,cls:item.className,rect:item.getBoundingClientRect().toJSON(),client:item.clientHeight,scroll:item.scrollHeight,maxHeight:getComputedStyle(item).maxHeight,overflow:getComputedStyle(item).overflowY,position:getComputedStyle(item).position}))})));
  await page.screenshot({path:join(evidence,'filter-before-'+width+'.png')});
  await panel.getByLabel('محدود کردن بازه حرکت').check({timeout:8000});
  await expect.poll(()=>panel.evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=11&&r.left>=11&&r.right<=innerWidth-11&&r.bottom<=innerHeight-11;})).toBe(true);
  const geometry=await panel.evaluate(node=>({viewport:{width:innerWidth,height:innerHeight},rect:node.getBoundingClientRect().toJSON(),placement:node.getAttribute('data-placement'),pageWidth:document.documentElement.scrollWidth,scrollers:Array.from(node.querySelectorAll<HTMLElement>('*')).filter(item=>item.scrollHeight>item.clientHeight+1&&getComputedStyle(item).overflowY==='auto').map(item=>({client:item.clientHeight,scroll:item.scrollHeight}))}));
  expect(geometry.pageWidth).toBeLessThanOrEqual(width);sizes.push(geometry);expect(geometry.scrollers.length).toBeGreaterThan(0);
  await panel.getByRole('button',{name:'اعمال فیلترها',exact:true}).scrollIntoViewIfNeeded();await expect(panel.getByRole('button',{name:'اعمال فیلترها',exact:true})).toBeInViewport();
  await capture(page,'filters-'+width);
  if(width===1366){
   const old=await panel.getByRole('form',{name:'فیلتر پیشنهادهای سفر'}).elementHandle();
   await panel.getByRole('button',{name:'انصراف از فیلتر',exact:true}).click();expect(await old!.evaluate(node=>node.isConnected)).toBe(true);
   await trigger.click();const current=page.getByRole('form',{name:'فیلتر پیشنهادهای سفر'});await current.getByLabel('سقف مبلغ کل (تومان)').fill('222');
   const stale=await old!.evaluate(node=>({connected:node.isConnected,inert:Boolean(node.closest('[inert]')),hidden:Boolean(node.closest('[aria-hidden="true"]'))}));expect(stale).toEqual({connected:true,inert:true,hidden:true});
   await old!.evaluate(node=>node.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(starts).toBe(0);await expect(current.getByLabel('سقف مبلغ کل (تومان)')).toHaveValue('222');
  }
  await page.getByRole('form',{name:'فیلتر پیشنهادهای سفر'}).getByLabel('سقف مبلغ کل (تومان)').press('Escape');await expect(trigger).toBeFocused();await expect(page.getByRole('form',{name:'فیلتر پیشنهادهای سفر'})).toHaveCount(0);
 }
 expect(starts).toBe(0);record('filter-viewports',{browser:browser.version(),sizes,starts,cleanup:'Isolated session; no resets or deletion.'});
});

for(const mode of ['flight','train','bus'] as const)test(`@roundtrip-fix ${mode} return dates vary and share exact complete totals across chart, wheel, calendar and tickets`,async({page,context,browser})=>{
 test.setTimeout(90000);await page.setViewportSize({width:mode==='bus'?390:1366,height:900});const query={...base,mode,classCode:mode==='flight'?'economy':mode==='train'?'seat':'standard'};
 await setup(page,context,query);const prices=await returnPrices(page,context);const priced=prices.cells.filter(cell=>cell.status==='priced');expect(priced.length).toBeGreaterThan(3);expect(new Set(priced.map(cell=>cell.minimum.amountRial)).size).toBeGreaterThan(1);
 expect(prices.query.query.departureDate).toBe(query.departureDate);expect(prices.query.leg).toBe('return');
 const comparisons=[];
 for(const date of [query.returnDate!,'2026-11-07']){
  const result=await search(page,context,date===query.returnDate?undefined:async()=>{await page.getByRole('listbox',{name:'روزهای نزدیک',exact:true}).focus();await page.keyboard.press('ArrowDown');await expect(explorer(page)).toHaveAttribute('data-selected-return',date);});
  const cell=priced.find(cell=>cell.date===date);expect(cell?.status).toBe('priced');if(!cell||cell.status!=='priced')throw new Error('Expected a complete return-date total');
  const exact=money(cell.minimum.amountRial);await expect(page.getByRole('option',{name:dateLabel(date)+'، '+exact,exact:true})).toHaveAttribute('aria-selected','true');
  const slider=page.getByRole('slider',{name:'انتخاب روز از نمودار',exact:true});await expect(slider).toHaveAttribute('aria-valuetext',dateLabel(date)+'، '+exact);await slider.focus();await expect(page.getByRole('tooltip')).toContainText(new Intl.NumberFormat('fa-IR').format(cell.minimum.amountRial/10));
  const quotes=result.snapshot.groups.flatMap(group=>group.eligibleQuotes),minimum=Math.min(...quotes.map(quote=>quote.total.amountRial));expect(minimum).toBe(cell.minimum.amountRial);expect(result.snapshot.query).toMatchObject({departureDate:query.departureDate,returnDate:date,tripType:'round-trip'});expect(quotes.every(quote=>quote.sourceRevision===sourceRevision)).toBe(true);
  await expect(region(page).locator(`article[data-amount-rial="${minimum}"]`).first()).toBeVisible();comparisons.push({date,expected:cell.minimum.amountRial,actual:minimum,searchId:result.snapshot.searchId,quoteSources:[...new Set(quotes.map(quote=>quote.sourceRevision))]});
 }
 const pending=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/api/v1/date-prices')&&response.request().postDataJSON().leg==='return');await page.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ',exact:true}).click();const calendarInitial=await (await pending).json() as DatePriceSnapshot;await expect(explorer(page)).toHaveAttribute('data-date-price-id',calendarInitial.datePriceId);await expect(explorer(page)).toHaveAttribute('data-date-price-status','complete',{timeout:25000});
 const calendar=page.getByRole('dialog',{name:'انتخاب تاریخ سفر',exact:true});const expected=priced.find(cell=>cell.date==='2026-11-07')!;if(expected.status!=='priced')throw new Error('Missing selected calendar amount');await expect(calendar.locator('[data-date="2026-11-07"]')).toContainText(money(expected.minimum.amountRial));await expect(calendar.getByText('قیمت‌ها به هزار تومان',{exact:true})).toBeVisible();await calendar.getByRole('button',{name:'انصراف',exact:true}).click();
 await expect(explorer(page)).toHaveAttribute('data-selected-outbound',query.departureDate);await expect(explorer(page)).toHaveAttribute('data-selected-return','2026-11-07');await capture(page,mode+'-return-prices');record(mode+'-return-prices',{browser:browser.version(),query,datePriceId:prices.datePriceId,cells:priced,comparisons,calendarDatePriceId:calendarInitial.datePriceId,cleanup:'Separate empty-cookie session; no reset/deletion.'});
});

test('@roundtrip-fix distant round trip preserves and animates its different outbound and return hub sequences',async({page,context,browser})=>{
 test.setTimeout(90000);await page.setViewportSize({width:1440,height:900});await setup(page,context,{...base,scope:'international',destinationCityId:'los-angeles',returnDate:'2026-11-09'});const recovery=await search(page,context);const catalog=await (await context.request.get('/api/v1/catalog')).json() as CatalogSnapshot;
 const candidate=recovery.snapshot.groups.find(group=>group.eligibleQuotes.length&&group.itinerary.outbound.segments.length===3&&group.itinerary.return?.segments.length===4);expect(candidate).toBeTruthy();if(!candidate)throw new Error('Expected supplied two-stop outbound and three-stop return');const ids=await region(page).locator('article[data-quote-id]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-quote-id')));const quote=candidate.eligibleQuotes.find(item=>ids.includes(item.quoteId))!;expect(quote.sourceRevision).toBe(sourceRevision);
 await region(page).locator(`article[data-quote-id="${quote.quoteId}"] [data-card-select]`).click();
 const chain=(direction:'outbound'|'return')=>{const leg=candidate.itinerary[direction]!;return [leg.segments[0]!.originPlaceId,...leg.segments.map(segment=>segment.destinationPlaceId)].map(id=>catalog.places.find(place=>place.id===id)!.code).join(' → ');};
 const outbound=chain('outbound'),inbound=chain('return');expect(outbound).not.toBe(inbound.split(' → ').reverse().join(' → '));
 await expect(page.getByRole('group',{name:'مسیر رفت',exact:true})).toContainText(outbound);await expect(page.getByRole('group',{name:'مسیر برگشت',exact:true})).toContainText(inbound);
 const card=region(page).locator(`article[data-quote-id="${quote.quoteId}"]`);await expect(card.locator('[data-card-route-leg="outbound"]')).toContainText('FRA');await expect(card.locator('[data-card-route-leg="return"]')).toContainText('SIN');
 const motion=page.locator('[data-route-presentation]');await expect(motion).toHaveAttribute('data-route-round-trip','true');await expect(motion).toHaveAttribute('data-route-animation-direction','return',{timeout:35000});await capture(page,'asymmetric-roundtrip');record('asymmetric-roundtrip',{browser:browser.version(),query:recovery.snapshot.query,itinerary:candidate.itinerary,quote:{quoteId:quote.quoteId,amount:quote.total.amountRial,source:quote.sourceRevision},outbound,inbound,actualAnimationDirection:await motion.getAttribute('data-route-animation-direction'),cleanup:'Isolated session; no reset/deletion.'});
});
