import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AdminControlConfigSchema, SearchRecoverySchema,
  type DatePriceCell, type DemoScenario, type SearchRecovery,
} from '@torob-ticket/contracts';
const out=resolve(process.env.REFINEMENTS_EVIDENCE_DIR??'docs/evidence/adjustments/chart-controls-results/native');
const query={mode:'flight',scope:'domestic',tripType:'one-way',originCityId:'tehran',destinationCityId:'mashhad',departureDate:'2026-11-01',party:{adults:1,children:0,infants:0},classCode:'economy',filters:{},sort:'fastest'};
const results=(page:Page)=>page.getByRole('region',{name:'نتایج مقایسه سفر',exact:true});
const record=(name:string,data:unknown)=>writeFileSync(resolve(out,name+'.json'),JSON.stringify(data,null,2));
async function open(page:Page,value:unknown=query){await page.goto('/?q='+encodeURIComponent(JSON.stringify(value)));await expect(page.getByRole('button',{name:'جست‌وجوی سفر',exact:true})).toBeEnabled();await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:20000});await page.evaluate(()=>document.fonts.ready);}
async function search(page:Page){await page.getByRole('button',{name:'جست‌وجوی سفر',exact:true}).click();await expect(results(page)).toHaveAttribute('data-status',/^(complete|empty)$/,{timeout:20000});}
async function setScenario(page: Page, scenario: DemoScenario) {
  const current = await page.request.get('/api/v1/admin/config');
  expect(current.status()).toBe(200);
  const before = AdminControlConfigSchema.parse(await current.json());
  const changed = await page.request.post('/api/v1/admin/scenario', {
    data: { baseRevision: before.revision, scenario },
  });
  expect(changed.status()).toBe(201);
  const after = AdminControlConfigSchema.parse(await changed.json());
  expect(after.session.scenario).toBe(scenario);
  expect(after.session.seed).toBe(before.session.seed);
  expect(after.session.anchorInstant).toBe(before.session.anchorInstant);
  return { beforeRevision: before.revision, afterRevision: after.revision, scenario };
}

async function completedEmpty(page: Page): Promise<SearchRecovery> {
  const id = await results(page).getAttribute('data-search-id');
  expect(id).toBeTruthy();
  const response = await page.request.get('/api/v1/searches/' + encodeURIComponent(id!));
  expect(response.status()).toBe(200);
  const recovery = SearchRecoverySchema.parse(await response.json());
  expect(recovery.snapshot.searchId).toBe(id);
  expect(recovery.snapshot.status).toBe('empty');
  expect(recovery.snapshot.groups).toEqual([]);
  const coverage = recovery.snapshot.coverage;
  expect(coverage.complete).toBe(true);
  expect(coverage.expectedProviderIds.length).toBeGreaterThan(0);
  expect(new Set(coverage.successfulProviderIds)).toEqual(new Set(coverage.expectedProviderIds));
  expect(coverage.failedProviderIds).toEqual([]);
  expect(coverage.pendingProviderIds).toEqual([]);
  return recovery;
}

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
  const expectedGroups=['وسیله سفر','محدوده سفر','نوع سفر','کلاس سفر','جستجو بر اساس'];
  const expectedValues:Record<string,string>={'وسیله سفر':'flight','محدوده سفر':'domestic','نوع سفر':'round-trip','کلاس سفر':'economy','جستجو بر اساس':'outbound'};
  const form=page.getByRole('form',{name:'جست‌وجوی سفر',exact:true});
  const readMobileGeometry=()=>form.evaluate((root,names)=>{
    const groups=Array.from(root.querySelectorAll<HTMLElement>('[role="radiogroup"]'));
    const label=(group:HTMLElement)=>group.getAttribute('aria-label')??(group.getAttribute('aria-labelledby')??'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)?.textContent??'').join(' ').replace(/\s+/g,' ').trim();
    const rectangle=(node:Element|undefined|null)=>{if(!node)return null;const box=node.getBoundingClientRect();return{x:box.x,y:box.y,width:box.width,height:box.height,left:box.left,right:box.right,top:box.top,bottom:box.bottom};};
    const positive=(box:ReturnType<typeof rectangle>)=>Boolean(box&&Object.values(box).every(Number.isFinite)&&box.width>0&&box.height>0);
    const retired=(scope:ParentNode|undefined)=>Array.from(scope?.querySelectorAll<HTMLElement>('[data-segment-slot="outgoing"], [data-segment-retired-option]')??[]).map(slot=>{const natives=Array.from(slot.querySelectorAll<HTMLInputElement>('input'));return{value:slot.getAttribute('data-segment-retired-option'),state:slot.getAttribute('data-segment-slot'),inert:slot.inert,ariaHidden:slot.getAttribute('aria-hidden'),ownsCurrent:slot.hasAttribute('data-segment-option')||slot.querySelectorAll('[data-segment-option]').length>0,nativeCount:natives.length,nativeDisabledCount:natives.filter(input=>input.disabled).length,nativeCheckedCount:natives.filter(input=>input.checked).length,rectangle:rectangle(slot)};});
    const rows=names.map(name=>{
      const matching=groups.filter(group=>label(group)===name);
      const tracks=matching.flatMap(group=>Array.from(group.querySelectorAll<HTMLElement>('[data-segment-track]'))),track=tracks.length===1?tracks[0]:undefined;
      const value=track?.getAttribute('data-segment-value')??null;
      const options=Array.from(track?.querySelectorAll<HTMLElement>('[data-segment-option]')??[]),selected=options.filter(option=>option.hasAttribute('data-selected'));
      const checked=options.flatMap(option=>Array.from(option.querySelectorAll<HTMLInputElement>('input[type="radio"]'))).filter(input=>input.checked);
      const indicators=Array.from(track?.querySelectorAll<HTMLElement>('[data-segment-indicator]')??[]),indicator=indicators.length===1?indicators[0]:undefined,option=selected.length===1?selected[0]:undefined;
      const a=rectangle(option),b=rectangle(indicator),slot=option?.closest<HTMLElement>('[data-segment-slot]'),slotBox=rectangle(slot),clip=rectangle(track?.closest('[data-search-controls]'));
      const selectedValue=option?.getAttribute('data-segment-option')??null,checkedOwner=checked.length===1?checked[0]!.closest('[data-segment-option]')?.getAttribute('data-segment-option')??null:null;
      const dx=a&&b?a.x-b.x:Number.NaN,dw=a&&b?a.width-b.width:Number.NaN;
      const indicatorStyle=indicator?getComputedStyle(indicator):undefined;
      let effectiveIndicatorOpacity=1,cssVisible=Boolean(indicator);
      for(let ancestor:HTMLElement|null=indicator??null;ancestor;ancestor=ancestor.parentElement){const style=getComputedStyle(ancestor);effectiveIndicatorOpacity*=Number(style.opacity);if(style.display==='none'||style.visibility!=='visible')cssVisible=false;}
      const indicatorVisible=cssVisible&&Number.isFinite(effectiveIndicatorOpacity)&&effectiveIndicatorOpacity>0;
      return{name,groupCount:matching.length,trackCount:tracks.length,value,ready:track?.getAttribute('data-indicator-ready')==='true',optionCount:options.length,selectedCurrentCount:selected.length,selectedValue,nativeCheckedCount:checked.length,checkedOwner,indicatorCount:indicators.length,indicatorVisible,effectiveIndicatorOpacity,retiredSlots:retired(track),currentSlot:slot?.getAttribute('data-segment-slot')??null,positiveRects:positive(a)&&positive(b),errorsFinite:Number.isFinite(dx)&&Number.isFinite(dw),dx,dw,track:rectangle(track),selected:a,indicator:b,slot:slotBox,slotClippedSelected:a&&slotBox?{left:Math.max(a.left,slotBox.left),right:Math.min(a.right,slotBox.right),width:Math.min(a.right,slotBox.right)-Math.max(a.left,slotBox.left)}:null,clip,scrollLeft:track?.scrollLeft??null,scrollTop:track?.scrollTop??null,direction:track?getComputedStyle(track).direction:null,indicatorTransform:indicator?getComputedStyle(indicator).transform:null,indicatorOpacity:indicatorStyle?.opacity??null,indicatorDisplay:indicatorStyle?.display??null,indicatorVisibility:indicatorStyle?.visibility??null};
    });
    return{at:performance.now(),viewport:{width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,scrollX,scrollY},groupCount:groups.length,trackCount:root.querySelectorAll('[data-segment-track]').length,retiredSlots:retired(root),rows};
  },expectedGroups);
  type MobileSample=Awaited<ReturnType<typeof readMobileGeometry>>;
  const samples:{stage:'first'|'poll'|'final-before-assert';sample:MobileSample}[]=[];
  const retiredIsFenced=(slot:MobileSample['retiredSlots'][number])=>slot.state==='outgoing'&&slot.inert&&slot.ariaHidden==='true'&&!slot.ownsCurrent&&slot.nativeCount>0&&slot.nativeDisabledCount===slot.nativeCount;
  const validMobileGeometry=(sample:MobileSample)=>sample.groupCount===5&&sample.trackCount===5&&sample.rows.length===5&&sample.retiredSlots.every(retiredIsFenced)&&sample.rows.every(row=>row.groupCount===1&&row.trackCount===1&&row.value===expectedValues[row.name]&&row.ready&&row.optionCount>0&&row.selectedCurrentCount===1&&row.selectedValue===row.value&&row.nativeCheckedCount===1&&row.checkedOwner===row.value&&row.indicatorCount===1&&row.indicatorVisible&&row.currentSlot==='current'&&row.retiredSlots.every(retiredIsFenced)&&row.positiveRects&&row.errorsFinite);
  const captureMobile=async(stage:'first'|'poll'|'final-before-assert')=>{const sample=await readMobileGeometry();samples.push({stage,sample});record('mobile-segment-resize',{expectedGroups,expectedValues,starts,samples});return sample;};
  let mobileFailure:unknown,finalMobile:MobileSample|undefined;
  try{
    await captureMobile('first');
    await expect(form.getByRole('radiogroup')).toHaveCount(5);
    await expect(form.locator('[data-segment-track]')).toHaveCount(5);
    for(const name of expectedGroups)await expect(form.getByRole('radiogroup',{name,exact:true}).locator('[data-segment-track]')).toHaveCount(1);
    await expect.poll(async()=>{const sample=await captureMobile('poll');return validMobileGeometry(sample)?Math.max(...sample.rows.flatMap(row=>[Math.abs(row.dx),Math.abs(row.dw)])):Number.POSITIVE_INFINITY;},{timeout:5000,intervals:[50,100,200]}).toBeLessThan(1);
  }catch(error){mobileFailure=error;}
  finally{
    try{finalMobile=await captureMobile('final-before-assert');}catch{record('mobile-segment-resize',{expectedGroups,expectedValues,starts,samples,finalCapture:'public-geometry-unavailable'});}
  }
  if(mobileFailure)throw mobileFailure;
  expect(finalMobile).toBeDefined();expect(validMobileGeometry(finalMobile!)).toBe(true);
  const geometry=finalMobile!.rows;
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

test('@refinements opening first, middle and last trip details keeps each trigger and scroll stable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page); await search(page);
  const cards = results(page).locator('article[data-price-card-id]');
  const count = await cards.count(); expect(count).toBeGreaterThan(2);
  await expect(results(page).locator('article[data-selected="true"]')).toHaveCount(1);
  await page.bringToFront();
  const environment = await page.evaluate(() => ({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    visibility: document.visibilityState,
  }));
  expect(environment).toEqual({ reduced: false, visibility: 'visible' });
  type Frame = {
    time: number; top: number; cardTop: number; height: number; scroll: number;
    policy: string | null; expanded: string | null;
  };
  const runs: {
    index: number; key: string; open: boolean; frames: Frame[]; intermediate: number;
    spread: { top: number; cardTop: number; scroll: number };
  }[] = [];
  try {
    for (const index of [...new Set([0, Math.floor(count / 2), count - 1])]) {
      const card = cards.nth(index);
      const button = card.getByRole('button', { name: 'جزئیات سفر', exact: true });
      await button.scrollIntoViewIfNeeded(); await button.focus();
      const key = await card.getAttribute('data-price-card-id'); expect(key).toBeTruthy();
      for (const open of [true, false]) {
        await button.evaluate(node => {
          const button = node as HTMLButtonElement;
          const card = button.closest<HTMLElement>('article[data-price-card-id]')!;
          const state = { started: false, done: false, frames: [] as {
            time: number; top: number; cardTop: number; height: number; scroll: number;
            policy: string | null; expanded: string | null;
          }[] };
          Object.assign(window, { chartPointerDisclosureTrace: state });
          button.addEventListener('pointerdown', () => {
            state.started = true;
            const start = performance.now();
            const sample = () => {
              const details = document.getElementById(button.getAttribute('aria-controls')!);
              const wrapper = details?.parentElement;
              state.frames.push({
                time: performance.now() - start,
                top: button.getBoundingClientRect().top,
                cardTop: card.getBoundingClientRect().top,
                height: wrapper?.getBoundingClientRect().height ?? 0,
                scroll: scrollY,
                policy: wrapper?.getAttribute('data-result-motion') ?? null,
                expanded: button.getAttribute('aria-expanded'),
              });
              if (performance.now() - start < 900) requestAnimationFrame(sample);
              else state.done = true;
            };
            sample();
          }, { once: true, capture: true });
        });
        await button.click();
        await expect(button).toHaveAttribute('aria-expanded', String(open));
        await expect.poll(() => page.evaluate(() =>
          (window as unknown as { chartPointerDisclosureTrace: { done: boolean } })
            .chartPointerDisclosureTrace.done)).toBe(true);
        const frames = await page.evaluate(() =>
          (window as unknown as { chartPointerDisclosureTrace: { frames: Frame[] } })
            .chartPointerDisclosureTrace.frames);
        const spread = {
          top: Math.max(...frames.map(f => f.top)) - Math.min(...frames.map(f => f.top)),
          cardTop: Math.max(...frames.map(f => f.cardTop)) - Math.min(...frames.map(f => f.cardTop)),
          scroll: Math.max(...frames.map(f => f.scroll)) - Math.min(...frames.map(f => f.scroll)),
        };
        const maxHeight = Math.max(...frames.map(f => f.height));
        const intermediate = frames.filter(f => f.height > 1 && f.height < maxHeight - 1).length;
        runs.push({ index, key: key!, open, frames, intermediate, spread });
        record('stable-disclosures', {
          count, environment, runs,
          method: '900ms rAF trace starts at actual native capture pointerdown before React Aria onPress; partial receipts persist before geometry assertions.',
        });
        expect(spread.top).toBeLessThan(2);
        expect(spread.cardTop).toBeLessThan(2);
        expect(spread.scroll).toBeLessThan(2);
        expect(maxHeight).toBeGreaterThan(30);
        expect(intermediate).toBeGreaterThan(0);
        expect(frames.some(f => f.policy === 'finite')).toBe(true);
        expect(frames.at(-1)!.height).toBe(open ? maxHeight : 0);
        await expect(button).toBeFocused();
      }
    }
  } finally {
    await page.screenshot({ path: resolve(out, 'compact-results-logos.png') });
  }
});

test('@refinements completed no-match and filtered empty lists show intentional states', async ({ page }) => {
  const noMatchProfile = await setScenario(page, 'no-eligible-results');
  await open(page); await search(page);
  const noMatch = await completedEmpty(page);
  expect(noMatch.snapshot.query.filters).toEqual({});
  await expect(page.locator('[data-results-empty]')).toHaveAttribute('data-results-empty', 'no-match');
  await expect(results(page).locator('article')).toHaveCount(0);
  await page.screenshot({ path: resolve(out, 'no-matching-results.png') });

  const normalProfile = await setScenario(page, 'normal');
  const originalRead = await page.request.get('/api/v1/searches/' + noMatch.snapshot.searchId);
  expect(originalRead.status()).toBe(200);
  expect(SearchRecoverySchema.parse(await originalRead.json()).snapshot).toEqual(noMatch.snapshot);
  await open(page, { ...query, filters: { budgetMaxRial: 10 } }); await search(page);
  const filterEmpty = await completedEmpty(page);
  expect(filterEmpty.snapshot.query.filters).toEqual({ budgetMaxRial: 10 });
  await expect(page.locator('[data-results-empty]')).toHaveAttribute('data-results-empty', 'filter-empty');
  await expect(page.getByRole('button', { name: 'حذف سقف قیمت', exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(out, 'filtered-empty-results.png') });
  record('empty-states', {
    noMatchProfile, noMatch, normalProfile, filterEmpty,
    proof: 'Actual complete successful provider coverage. Explicit no-service scenario and separate normal inventory constrained by a budget filter; no fabricated empty date or intercepted response.',
  });
});
