import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DatePriceCell } from '@torob-ticket/contracts';
const out=resolve(process.env.REFINEMENTS_EVIDENCE_DIR??'docs/evidence/adjustments/chart-controls-results/native');
const query={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-01',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'fastest'};
const results=(page:Page)=>page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});
const record=(name:string,data:unknown)=>writeFileSync(resolve(out,name+'.json'),JSON.stringify(data,null,2));
async function open(page:Page,value:unknown=query){await page.goto('/?q='+encodeURIComponent(JSON.stringify(value)));await expect(page.getByRole('button',{name:'جست‌وجوی سفر',exact:true})).toBeEnabled();await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:20000});await page.evaluate(()=>document.fonts.ready);}
async function search(page:Page){await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();await expect(results(page)).toHaveAttribute('data-status',/^(complete|empty)$/,{timeout:20000});}
test.beforeEach(async({page})=>{mkdirSync(out,{recursive:true});await page.setViewportSize({width:1366,height:768});await page.addInitScript(()=>localStorage.setItem('torobticket.appearance','dark'));expect((await page.request.post('/api/v1/demo/session',{data:{seed:3333,anchorInstant:'2026-10-25T06:00:00Z',scenario:'normal'}})).status()).toBe(201);});
test.afterEach(async({page},info)=>{if(page.isClosed())return;const response=await page.request.post('/api/v1/admin/reset',{data:{}});record('cleanup-'+info.title.replace(/[^a-zA-Z0-9]/g,'-').slice(0,60),{status:response.status()});expect(response.status()).toBe(201);});

test('@refinements exact chart tooltip, selected state and sliding indicators stay coherent',async({page})=>{
  await open(page);await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status','ready');
  let starts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/v1/searches'))starts++;});
  const priceId=await page.locator('[data-date-price-id]').getAttribute('data-date-price-id');
  const payload=await(await page.request.get(`/api/v1/date-prices/${priceId}?clientGeneration=refinements-native`)).json() as {cells:DatePriceCell[]};
  const cells=payload.cells,hover=cells.find(c=>c.status==='priced'&&c.date!==query.departureDate)!;expect(hover.status).toBe('priced');
  const slider=page.getByRole('slider',{name:'انتخاب روز از نمودار',exact:true}),box=await slider.boundingBox();
  const fraction=(Date.parse(hover.date)-Date.parse(cells[0]!.date))/(Date.parse(cells.at(-1)!.date)-Date.parse(cells[0]!.date));
  await page.evaluate(()=>{const start=performance.now(),frames:number[]=[];Object.assign(window,{tooltipNativeFrames:frames,tooltipNativeDone:false});const tick=()=>{const node=document.querySelector('[role="tooltip"]');if(node)frames.push(Number(getComputedStyle(node).opacity));if(performance.now()-start<500)requestAnimationFrame(tick);else Object.assign(window,{tooltipNativeDone:true});};tick();});
  await page.mouse.move(box!.x+box!.width*(.05+.9*fraction),box!.y+box!.height*.55);
  const tooltip=page.getByRole('tooltip');await expect(tooltip).toBeVisible();
  if(hover.status==='priced')await expect(tooltip).toContainText(new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1}).format(hover.minimum.amountRial/10));
  expect(starts).toBe(0);await expect(page.locator('[data-chart-selected]')).toHaveAttribute('data-chart-selected',query.departureDate);
  await expect.poll(()=>tooltip.evaluate(node=>Number(getComputedStyle(node).opacity))).toBeGreaterThan(.98);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {tooltipNativeDone:boolean}).tooltipNativeDone)).toBe(true);
  const tooltipFrames=await page.evaluate(()=>(window as unknown as {tooltipNativeFrames:number[]}).tooltipNativeFrames);expect(tooltipFrames.some(value=>value>0&&value<.98)).toBe(true);
  await page.screenshot({path:resolve(out,'chart-tooltip-dark.png')});
  await slider.focus();await slider.press('Escape');await expect(tooltip).toHaveCount(0);
  const controls=page.getByRole('radiogroup',{name:'نوع سفر',exact:true}),track=controls.locator('[data-segment-track]'),indicator=track.locator('[data-segment-indicator]');
  await expect(track).toHaveAttribute('data-indicator-ready','true');
  const before=await indicator.boundingBox();
  await page.evaluate(()=>{const node=document.querySelector('[data-segment-track][data-segment-value="one-way"] [data-segment-indicator]')!;const start=performance.now();const frames:{time:number;x:number;width:number}[]=[];Object.assign(window,{segmentNativeFrames:frames,segmentNativeDone:false});const tick=()=>{const box=node.getBoundingClientRect();frames.push({time:performance.now()-start,x:box.x,width:box.width});if(performance.now()-start<650)requestAnimationFrame(tick);else Object.assign(window,{segmentNativeDone:true});};tick();});
  await controls.getByText('رفت‌وبرگشت',{exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {segmentNativeDone:boolean}).segmentNativeDone)).toBe(true);
  const after=await indicator.boundingBox(),selected=await track.locator('[data-segment-option="round-trip"]').boundingBox();
  expect(Math.abs(after!.x-selected!.x)).toBeLessThan(1);expect(Math.abs(after!.width-selected!.width)).toBeLessThan(1);
  const frames=await page.evaluate(()=>(window as unknown as {segmentNativeFrames:{time:number;x:number;width:number}[]}).segmentNativeFrames);
  expect(frames.some(f=>Math.abs(f.x-before!.x)>.5&&Math.abs(f.x-after!.x)>.5)).toBe(true);
  expect(frames.some(f=>Math.abs(f.width-before!.width)>.3&&Math.abs(f.width-after!.width)>.3)).toBe(true);
  await controls.getByText('یک‌طرفه',{exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await controls.getByText('رفت‌وبرگشت',{exact:true}).click();
  await expect.poll(async()=>{const a=await indicator.boundingBox(),b=await track.locator('[data-segment-option="round-trip"]').boundingBox();return Math.abs(a!.x-b!.x)+Math.abs(a!.width-b!.width);}).toBeLessThan(1);
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('complementary',{name:'نقشه سفر',exact:true})).toBeHidden();
  const geometry=await page.locator('[data-segment-track][data-indicator-ready]').evaluateAll(nodes=>nodes.map(node=>{const selected=node.querySelector('[data-selected]')!,indicator=node.querySelector('[data-segment-indicator]')!;const a=selected.getBoundingClientRect(),b=indicator.getBoundingClientRect();return{value:node.getAttribute('data-segment-value'),dx:a.x-b.x,dw:a.width-b.width};}));
  expect(geometry.every(g=>Math.abs(g.dx)<1&&Math.abs(g.dw)<1)).toBe(true);
  record('chart-and-segments',{date:hover.date,price:hover.status==='priced'?hover.minimum:undefined,startsBeforeInspection:0,tooltipFrames,before,after,selected,frames,mobile:geometry});
});

test('@refinements sorting keeps evidence and form segments clear old cards; PNG airline identities load',async({page})=>{
  await open(page);await search(page);await expect(results(page).locator('article')).not.toHaveCount(0);
  const id=await results(page).getAttribute('data-search-id');let starts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/v1/searches'))starts++;});
  const brands=page.locator('article img[data-airline-brand]');await expect(brands.first()).toBeVisible();
  await expect.poll(()=>brands.evaluateAll(nodes=>nodes.every(node=>{const image=node as HTMLImageElement;return image.complete&&image.naturalWidth>0;}))).toBe(true);
  const images=await brands.evaluateAll(nodes=>nodes.map(node=>{const image=node as HTMLImageElement;return{brand:image.dataset['airlineBrand'],src:image.currentSrc,loaded:image.complete&&image.naturalWidth>0,width:image.width};}));expect(images.every(image=>image.loaded)).toBe(true);expect(images.every(image=>image.src.includes('/airlines/')&&image.src.endsWith('.png'))).toBe(true);
  const sort=page.getByRole('radiogroup',{name:'مرتب‌سازی پیشنهادها',exact:true});await sort.getByText('ارزان‌ترین',{exact:true}).click();await expect(results(page)).toHaveAttribute('data-search-id',id!);expect(starts).toBe(0);
  const snapshot=await(await page.request.get('/api/v1/searches/'+id)).json();expect(snapshot.snapshot.query.sort).toBe('fastest');
  await page.getByRole('radiogroup',{name:'وسیله سفر',exact:true}).getByText('قطار',{exact:true}).click();await expect(results(page)).toHaveCount(0);await expect(page.getByRole('button',{name:'جست‌وجوی سفر',exact:true})).toBeEnabled();expect(starts).toBe(0);
  await expect(page.getByRole('heading',{name:'دریافت پیشنهاد کامل نشد',exact:true})).toHaveCount(0);await expect(page.locator('main[data-authority-current]')).not.toHaveAttribute('data-pinned-itinerary',/.+/);
  await search(page);await expect(results(page)).toBeVisible();record('result-ownership-and-logos',{originalSearchId:id,immutableSort:snapshot.snapshot.query.sort,images,startsAfterNewFormSearch:starts});
});

test('@refinements opening first, middle and last trip details keeps each trigger and scroll stable',async({page})=>{
  await open(page);await search(page);await page.waitForTimeout(450);
  const cards=results(page).locator('article[data-price-card-id]'),count=await cards.count();expect(count).toBeGreaterThan(2);const runs:unknown[]=[];
  for(const index of [...new Set([0,Math.floor(count/2),count-1])]) {
    const card=cards.nth(index),button=card.getByRole('button',{name:'جزئیات سفر',exact:true});await button.scrollIntoViewIfNeeded();
    const key=await card.getAttribute('data-price-card-id');
    const trace=async(open:boolean)=>{
      await page.evaluate(({key})=>{const card=Array.from(document.querySelectorAll<HTMLElement>('[data-price-card-id]')).find(node=>node.dataset['priceCardId']===key)!;const button=card.querySelector<HTMLButtonElement>('button[aria-label="جزئیات سفر"]')!;const start=performance.now(),frames:{time:number;top:number;cardTop:number;height:number;scroll:number}[]=[];Object.assign(window,{disclosureFrames:frames,disclosureDone:false});const tick=()=>{const details=document.getElementById(button.getAttribute('aria-controls')!);frames.push({time:performance.now()-start,top:button.getBoundingClientRect().top,cardTop:card.getBoundingClientRect().top,height:details?.parentElement?.getBoundingClientRect().height??0,scroll:scrollY});if(performance.now()-start<650)requestAnimationFrame(tick);else Object.assign(window,{disclosureDone:true});};tick();},{key});
      await button.click();await expect(button).toHaveAttribute('aria-expanded',String(open));await expect.poll(()=>page.evaluate(()=>(window as unknown as {disclosureDone:boolean}).disclosureDone)).toBe(true);
      const frames=await page.evaluate(()=>(window as unknown as {disclosureFrames:{time:number;top:number;cardTop:number;height:number;scroll:number}[]}).disclosureFrames);
      const spread=(key:'top'|'cardTop'|'scroll')=>Math.max(...frames.map(f=>f[key]))-Math.min(...frames.map(f=>f[key]));
      expect(spread('top')).toBeLessThan(2);expect(spread('cardTop')).toBeLessThan(2);expect(spread('scroll')).toBeLessThan(2);await expect(button).toBeFocused();
      const maxHeight=Math.max(...frames.map(f=>f.height));expect(maxHeight).toBeGreaterThan(30);expect(frames.some(f=>f.height>1&&f.height<maxHeight-1)).toBe(true);return frames;
    };
    const opened=await trace(true),closed=await trace(false);runs.push({index,key,opened,closed});
  }
  record('stable-disclosures',{count,runs});await page.screenshot({path:resolve(out,'compact-results-logos.png')});
});

test('@refinements completed no-match and filtered empty lists show intentional states',async({page})=>{
  await open(page,{...query,departureDate:'2026-10-31'});await search(page);await expect(page.locator('[data-results-empty]')).toHaveAttribute('data-results-empty','no-match');await expect(results(page).locator('article')).toHaveCount(0);await page.screenshot({path:resolve(out,'no-matching-results.png')});
  await open(page,{...query,filters:{budgetMaxRial:10}});await search(page);await expect(page.locator('[data-results-empty]')).toHaveAttribute('data-results-empty','filter-empty');await expect(page.getByRole('button',{name:'حذف سقف قیمت',exact:true})).toBeVisible();await page.screenshot({path:resolve(out,'filtered-empty-results.png')});record('empty-states',{noMatchDate:'2026-10-31',filter:{budgetMaxRial:10}});
});
