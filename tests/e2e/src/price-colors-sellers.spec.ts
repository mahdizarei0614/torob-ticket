import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SearchRecovery, TransportSearchQuery } from '@torob-ticket/contracts';

const evidence=resolve(process.env.PRICE_SELLERS_EVIDENCE_DIR??'docs/evidence/adjustments/price-colors-sellers/native');
const query:TransportSearchQuery={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-10-25',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'cheapest'};
const results=(page:Page)=>page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});
const card=(page:Page,id:string)=>results(page).locator('article[data-quote-id="'+id+'"]');
const seller=(page:Page)=>page.locator('button[data-referral-source="transport"][role="link"]').first();
const save=(name:string,value:unknown)=>writeFileSync(resolve(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');
async function capture(page:Page,name:string){await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.race([Promise.allSettled(document.getAnimations().filter(animation=>animation.playState==='running'&&Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation=>animation.finished)),new Promise<void>(done=>setTimeout(done,600))]));await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));await page.screenshot({path:resolve(evidence,name+'.png')});}
async function open(page:Page,scenario='normal',input=query) {
 expect((await page.request.post('/api/v1/demo/session',{data:{seed:3333,scenario,anchorInstant:'2026-10-25T06:00:00Z'}})).status()).toBe(201);
 await page.goto('/?q='+encodeURIComponent(JSON.stringify(input)));
 await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:20000});
 const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/v1/searches'));
 await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();
 const started=await(await response).json() as SearchRecovery;
 await expect(results(page)).toHaveAttribute('data-status','complete',{timeout:20000});
 const recovery=await(await page.request.get('/api/v1/searches/'+started.snapshot.searchId)).json() as SearchRecovery;
 await expect(results(page).locator('article[data-selected="true"]')).toHaveCount(1);
 return recovery;
}
test.beforeEach(async({page})=>{mkdirSync(evidence,{recursive:true});await page.setViewportSize({width:1366,height:768});await page.addInitScript(()=>{
 localStorage.setItem('torobticket.appearance','dark');
 const programs:{linked:boolean;logs:string[]}[]=[];Object.assign(window,{pricePrograms:programs});const original=WebGL2RenderingContext.prototype.linkProgram;
 WebGL2RenderingContext.prototype.linkProgram=function(program){original.call(this,program);programs.push({linked:Boolean(this.getProgramParameter(program,this.LINK_STATUS)),logs:[this.getProgramInfoLog(program)??'',...(this.getAttachedShaders(program)??[]).map(shader=>this.getShaderInfoLog(shader)??'')]});};
});});
test.afterEach(async({page},info)=>{const response=await page.request.post('/api/v1/admin/reset',{data:{}});save('cleanup-'+info.title.replace(/[^a-zA-Z0-9]/g,'-').slice(0,65),{status:response.status()});expect(response.status()).toBe(201);});

test('@price-sellers compact form and coherent price bands survive time, calendar and theme changes',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const recovery=await open(page,'normal',{...query,filters:{providerIds:['demo-provider-01']}});await page.evaluate(()=>scrollTo(0,0));
 await expect(page.locator('[data-date-evidence]')).toHaveCount(0);
 for(const text of ['روزهای بدون قیمت فاصله دارند؛ قیمت حرکت است، نه تاریخچه قیمت.','مقایسه قیمت و شرایط فروشندگان'])await expect(page.getByText(text,{exact:true})).toHaveCount(0);
 const form=page.getByRole('form',{name:'جست‌وجوی سفر',exact:true}),submit=page.getByRole('button',{name:'جست‌وجوی سفر',exact:true});
 const layout=await form.evaluate(node=>{const style=getComputedStyle(node),button=node.querySelector<HTMLButtonElement>('button[type="submit"]')!,chart=node.querySelector('[aria-label="انتخاب روز از نمودار"]')!,box=node.getBoundingClientRect();return {form:box.width,inner:box.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth),button:button.getBoundingClientRect().width,bottom:button.getBoundingClientRect().bottom,chart:chart.getBoundingClientRect().height};});
 expect(Math.abs(layout.inner-layout.button)).toBeLessThan(2);expect(layout.chart).toBeGreaterThanOrEqual(145);expect(layout.bottom).toBeLessThanOrEqual(768);await expect(submit).toBeEnabled();
 const amounts=recovery.snapshot.groups.flatMap(group=>group.eligibleQuotes.map(quote=>quote.total.amountRial));const min=Math.min(...amounts),max=Math.max(...amounts);
 const painted=await results(page).locator('article[data-amount-rial]').evaluateAll(nodes=>nodes.map(node=>({amount:Number(node.getAttribute('data-amount-rial')),band:node.querySelector('[data-price-band]')?.getAttribute('data-price-band'),color:getComputedStyle(node.querySelector('[data-price-band]')!).color})));
 for(const entry of painted)expect(entry.band).toBe(min===max?'mid':entry.amount<=min+(max-min)*.25?'low':entry.amount>=min+(max-min)*.75?'high':'mid');
 const dates=page.getByRole('listbox',{name:'روزهای نزدیک',exact:true});
 await capture(page,'desktop-dark');
 await page.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ',exact:true}).click();const dialog=page.getByRole('dialog',{name:'انتخاب تاریخ سفر',exact:true});
 await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:20000});await expect(dialog.locator('[data-price-band="low"]')).not.toHaveCount(0);
 const calendarBands=await dialog.locator('[data-date]').evaluateAll(nodes=>nodes.map(node=>({date:node.getAttribute('data-date'),band:node.querySelector('small')?.getAttribute('data-price-band'),color:getComputedStyle(node.querySelector('small')!).color})));
 const wheelBands=await dates.locator('[role="option"]').evaluateAll(nodes=>nodes.map(node=>({date:node.querySelector('span')?.textContent,band:node.querySelector('small')?.getAttribute('data-price-band'),color:getComputedStyle(node.querySelector('small')!).color})));
 for(const band of ['low','mid','high']){const cal=calendarBands.find(item=>item.band===band),wheel=wheelBands.find(item=>item.band===band);if(cal&&wheel)expect(cal.color).toBe(wheel.color);}
 await capture(page,'calendar-dark');await dialog.getByRole('button',{name:'انصراف',exact:true}).click();
 await page.getByRole('button',{name:'نمای روشن',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-appearance','light');await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:20000});await capture(page,'desktop-light');
 const programs=await page.evaluate(()=>(window as unknown as {pricePrograms:{linked:boolean;logs:string[]}[]}).pricePrograms);expect(programs.length).toBeGreaterThan(0);expect(programs.every(program=>program.linked&&program.logs.every(log=>!log))).toBe(true);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await capture(page,'mobile-light');
 const before=await dates.locator('[data-price-band]:not([data-price-band="unknown"])').allTextContents();expect(before.length).toBeGreaterThan(1);
 await page.clock.install();await page.clock.fastForward(70000);
 expect(await dates.locator('[data-price-band]:not([data-price-band="unknown"])').allTextContents()).toEqual(before);
 await expect(page.getByText(/قیمت‌های مشاهده‌شده دیگر تازه نیستند/)).toHaveCount(0);await expect(page.getByRole('button',{name:'تلاش دوباره برای قیمت روزها',exact:true})).toHaveCount(0);
 save('price-presentation',{query:recovery.snapshot.query,reducedMotion:true,layout,painted,calendarBands,wheelBands,retainedDatePrices:before,programs});
});

test('@price-sellers exact nonrepresentative seller receives the displayed price and restores without another write',async({page})=>{
 const recovery=await open(page);const group=recovery.snapshot.groups.find(group=>group.eligibleQuotes.length>1)!;const quote=group.eligibleQuotes.find(quote=>quote.quoteId!==group.representativeQuoteId)!;
 await card(page,quote.quoteId).getByRole('button',{name:'انتخاب پیشنهاد',exact:true}).click();await expect(seller(page)).toBeFocused();await expect(seller(page)).toHaveAttribute('data-provider-id',quote.providerId);
 const row=card(page,quote.quoteId).locator('[data-seller-amount-rial]');for(const amount of await row.evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('data-seller-amount-rial')))))expect(amount).toBe(quote.total.amountRial);
 await expect(page.getByRole('button',{name:/^رفتن به /})).toHaveCount(0);await capture(page,'selected-seller');
 const confirm=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/referrals/confirm'));await seller(page).press('Enter');const response=await confirm;expect(response.status()).toBe(201);const receipt=await response.json();
 expect(receipt.payload.quote.quoteId).toBe(quote.quoteId);expect(receipt.payload.quote.providerId).toBe(quote.providerId);expect(receipt.payload.quote.total).toEqual(quote.total);await expect(page.getByText('ارجاع به فروشنده ثبت شد',{exact:true})).toBeVisible();
 const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&/searches|referrals/.test(r.url()))writes.push(r.url());});await page.getByRole('button',{name:'بازگشت به مقایسه سفر',exact:true}).click();await expect(card(page,quote.quoteId)).toHaveAttribute('data-selected','true');expect(writes).toEqual([]);save('exact-seller-handoff',{quote,receipt,writes});
});

test('@price-sellers changed seller price still requires explicit consent',async({page})=>{
 const recovery=await open(page,'price-change');const group=recovery.snapshot.groups.find(group=>group.connectionCount===0)!;const quote=group.eligibleQuotes.find(quote=>quote.providerId==='demo-provider-04')!;expect(quote).toBeTruthy();
 await card(page,quote.quoteId).getByRole('button',{name:'انتخاب پیشنهاد',exact:true}).click();let confirmations=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/referrals/confirm'))confirmations++;});await seller(page).click();
 await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase','changed');expect(confirmations).toBe(0);await capture(page,'changed-price');
 const confirm=page.waitForResponse(r=>r.url().endsWith('/referrals/confirm'));await page.getByRole('button',{name:'پذیرش نسخه تازه و ادامه',exact:true}).click();const receipt=await(await confirm).json();expect(receipt.payload.quote.quoteId).toBe(quote.quoteId);expect(receipt.payload.quote.version).toBeGreaterThan(quote.version);expect(receipt.payload.quote.total.amountRial).toBeGreaterThan(quote.total.amountRial);await expect(page.getByText('ارجاع به فروشنده ثبت شد',{exact:true})).toBeVisible();save('changed-seller',{original:quote,receipt,confirmations});
});

test('@price-sellers SVG fallback retains the same colored chart and usable form',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<typeof original>){return args[0]==='webgl2'?null:original.apply(this,args);} as typeof original;});
 await open(page);await page.evaluate(()=>scrollTo(0,0));
 const chart=page.getByRole('region',{name:'کاوش تاریخ سفر',exact:true});
 await expect(chart.locator('svg circle[data-price-band="low"]').first()).toBeVisible();await expect(chart.locator('svg circle[data-price-band="high"]').first()).toBeVisible();
 const bands=await chart.locator('svg circle[data-price-band]').evaluateAll(nodes=>nodes.map(node=>({band:node.getAttribute('data-price-band'),color:getComputedStyle(node).fill})));
 await expect(page.getByRole('button',{name:'جست‌وجوی سفر',exact:true})).toBeEnabled();await capture(page,'svg-fallback');save('svg-fallback',{bands});
});
