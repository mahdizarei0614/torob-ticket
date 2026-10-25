import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const evidence = process.env.T16_EVIDENCE_DIR;
function record(name: string, data: unknown) { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence,name), JSON.stringify(data,null,2)); } }
const addDays = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate()+days); return value.toISOString().slice(0,10); };
async function ready(page: Page) { await expect(page.getByRole('region', { name: 'کاوش تاریخ سفر' })).toHaveAttribute('data-date-price-status','complete'); }
async function resetOwn(page: Page) { await page.request.post('/api/v1/demo/reset'); }
async function transitionProbe(page: Page) { await page.addInitScript(() => { const original = document.startViewTransition?.bind(document); const transitions: Promise<void>[] = []; (window as unknown as { dateTransitions: Promise<void>[] }).dateTransitions = transitions; if (original) document.startViewTransition = ((update: Parameters<Document['startViewTransition']>[0]) => { const transition = original(update); transitions.push(transition.finished.catch(() => undefined)); return transition; }) as Document['startViewTransition']; }); }
async function settledTheme(page: Page) { await page.evaluate(async () => { await Promise.all((window as unknown as { dateTransitions: Promise<void>[] }).dateTransitions); }); }
test.describe('@dates real date exploration', () => {
  test.beforeEach(async ({page}, info) => { page.on('response', async response => { if (response.url().endsWith('/api/v1/demo/session')) record(info.title.replace(/[^a-z0-9]+/gi,'-').slice(0,80)+'-session.json',{session:await response.json(),viewport:page.viewportSize(),userAgent:await page.evaluate(()=>navigator.userAgent).catch(()=>undefined)}); }); });
  test('actual batch prices, physical drag preview/single settle, cancel, chart sync and native scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1440,height:960 });
    let searches = 0; const datePosts: unknown[] = []; let session: unknown;
    page.on('request', request => { if (request.method()==='POST' && request.url().endsWith('/api/v1/searches')) searches++; if (request.method()==='POST' && request.url().endsWith('/api/v1/date-prices')) datePosts.push(request.postDataJSON()); });
    page.on('response', async response => { if (response.url().endsWith('/api/v1/demo/session')) session = await response.json(); });
    try {
      await page.goto('/'); await ready(page); expect(searches).toBe(0);
      const date = (await page.getByRole('region',{name:'کاوش تاریخ سفر'}).getAttribute('data-selected-outbound'))!;
      const wheel = page.getByRole('listbox',{name:'روزهای نزدیک'}); await wheel.scrollIntoViewIfNeeded(); const box = (await wheel.boundingBox())!;
      await page.mouse.move(box.x+box.width/2,box.y+140); await page.mouse.down(); await page.mouse.move(box.x+box.width/2,box.y+86,{steps:6});
      await expect(wheel).toHaveAttribute('data-preview-date',addDays(date,1)); expect(searches).toBe(0);
      await expect(page.getByRole('button',{name:'جست‌وجوی سفر',exact:true})).toBeDisabled();
      const batchesBeforeSettle=datePosts.length; const stableId=await page.getByRole('region',{name:'کاوش تاریخ سفر'}).getAttribute('data-date-price-id'); const releaseAt=Date.now(); await page.mouse.up();
      await expect.poll(()=>searches).toBe(1); const elapsed=Date.now()-releaseAt;
      await expect(page.getByRole('region',{name:'کاوش تاریخ سفر'})).toHaveAttribute('data-selected-outbound',addDays(date,1));
      await ready(page);
      expect(datePosts.length).toBe(batchesBeforeSettle); await expect(page.getByRole('region',{name:'کاوش تاریخ سفر'})).toHaveAttribute('data-date-price-id',stableId!); const postsBeforeCancel=searches; const updated=(await wheel.boundingBox())!;
      await page.mouse.move(updated.x+updated.width/2,updated.y+140); await page.mouse.down(); await page.mouse.move(updated.x+updated.width/2,updated.y+30,{steps:4});
      await wheel.dispatchEvent('pointercancel',{pointerId:1}); await page.mouse.up(); await page.waitForTimeout(350); expect(searches).toBe(postsBeforeCancel);
      await expect(wheel).toHaveAttribute('data-preview-date',addDays(date,1));
      const slider=page.getByRole('slider',{name:'انتخاب روز از نمودار'}); await slider.focus(); await slider.press('ArrowRight');
      await expect.poll(()=>searches).toBe(2); await expect(wheel).toHaveAttribute('data-preview-date',addDays(date,2));
      await ready(page); await wheel.focus(); await page.keyboard.press('ArrowDown'); await expect.poll(()=>searches).toBe(3);
      await wheel.scrollIntoViewIfNeeded(); const before=await page.evaluate(()=>scrollY); const mapBefore=await page.getByRole('complementary',{name:'نمای مسیر'}).boundingBox(); await page.mouse.move(updated.x+updated.width/2,updated.y+140); await page.mouse.wheel(0,54); await expect.poll(()=>searches).toBe(4); await expect(wheel).toHaveAttribute('data-preview-date',addDays(date,4)); await wheel.press('End'); await expect.poll(()=>searches).toBe(5); await ready(page); await page.mouse.move(updated.x+updated.width/2,updated.y+140); await page.mouse.wheel(0,250); await page.waitForTimeout(250); const after=await page.evaluate(()=>scrollY); expect(after).toBeGreaterThan(before); const mapAfter=await page.getByRole('complementary',{name:'نمای مسیر'}).boundingBox(); expect(mapAfter).toEqual(mapBefore); if(evidence)await page.screenshot({path:resolve(evidence,'dates-viewport.png')});
      await ready(page); if(evidence) await page.screenshot({path:resolve(evidence,'dates-desktop.png'),fullPage:true});
      record('actual-drag.json',{session, viewport:{width:1440,height:960},searches,datePosts,settleObservedMs:elapsed,nativeScroll:{before,after,mapBefore,mapAfter}, datePriceId:await page.getByRole('region',{name:'کاوش تاریخ سفر'}).getAttribute('data-date-price-id')});
    } finally { await resetOwn(page); }
  });
  test('provisional Jalali month jump/cancel/focus, same-day return, invalidated return reselection', async ({ page }) => {
    let searches=0; page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/v1/searches'))searches++;});
    try {
      await page.goto('/'); await ready(page); const original=(await page.getByRole('region',{name:'کاوش تاریخ سفر'}).getAttribute('data-selected-outbound'))!; const url=page.url();
      const trigger=page.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ',exact:true}); await trigger.click();
      const dialog=page.getByRole('dialog',{name:'انتخاب تاریخ سفر'}); await expect(dialog).toBeVisible();
      const months=dialog.getByLabel('رفتن به ماه جلالی'); const options=await months.locator('option').all(); expect(options.length).toBeGreaterThan(2); await months.selectOption(await options[1]!.getAttribute('value')??''); await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:12000}); if(evidence)await page.screenshot({path:resolve(evidence,'calendar-desktop.png')});
      await expect(dialog.getByRole('grid')).toBeVisible(); await dialog.getByLabel('تاریخ رفت میلادی در تقویم',{exact:true}).fill(addDays(original,3));
      expect(searches).toBe(0); expect(page.url()).toBe(url); await dialog.getByRole('button',{name:'انصراف',exact:true}).click(); await expect(trigger).toBeFocused(); await expect(page.getByRole('region',{name:'کاوش تاریخ سفر'})).toHaveAttribute('data-selected-outbound',original);
      await page.getByRole('radio',{name:'رفت‌وبرگشت',exact:true}).focus(); await page.keyboard.press('Space'); await expect(page.getByText('برای قیمت کامل رفت، ابتدا تاریخ برگشت را انتخاب کنید.',{exact:false})).toBeVisible();
      await trigger.click(); await dialog.getByLabel('بخش سفر در تقویم').selectOption('return');
      await dialog.getByLabel('تاریخ برگشت میلادی در تقویم',{exact:true}).fill(original);
      await dialog.getByRole('button',{name:'اعمال تاریخ‌ها',exact:true}).click(); await expect.poll(()=>searches).toBe(1); await expect(page.getByRole('region',{name:'کاوش تاریخ سفر'})).toHaveAttribute('data-selected-return',original);
      const committed=page.url(); await page.getByLabel('بخش سفر برای قیمت روزها').selectOption('outbound'); await ready(page); await page.getByRole('button',{name:'روز بعد',exact:true}).click();
      await expect(page.getByRole('region',{name:'کاوش تاریخ سفر'})).toHaveAttribute('data-selected-return',''); await page.waitForTimeout(300); expect(searches).toBe(1); expect(page.url()).toBe(committed);
      await trigger.click(); await dialog.getByLabel('بخش سفر در تقویم').selectOption('return'); await dialog.getByLabel('تاریخ برگشت میلادی در تقویم',{exact:true}).fill(addDays(original,2)); await dialog.getByRole('button',{name:'اعمال تاریخ‌ها',exact:true}).click(); await expect.poll(()=>searches).toBe(2); await expect(trigger).toBeFocused();
      record('calendar-roundtrip.json',{original,searches,sameDayAllowed:true,cancelPreservedUrl:true,invalidPairDidNotSearch:true});
    } finally { await resetOwn(page); }
  });
  test('actual no-match remains selectable and transport failure has recovery without a false no-match', async ({ page }) => {
    try {
      await page.request.post('/api/v1/demo/session',{data:{seed:1616,anchorInstant:'2026-10-25T00:00:00Z',scenario:'no-eligible-results'}});
      await page.goto('/'); await ready(page); await expect(page.getByText('پیشنهاد مطابق نیست',{exact:true}).first()).toBeVisible();
      const actual=await page.request.get('/api/v1/date-prices/'+await page.getByRole('region',{name:'کاوش تاریخ سفر'}).getAttribute('data-date-price-id')+'?clientGeneration=probe'); expect(actual.ok()).toBe(true); const actualSnapshot=await actual.json(); expect(actualSnapshot.cells.every((cell:{status:string})=>cell.status==='no-match')).toBe(true);
      await page.getByRole('button',{name:'روز بعد',exact:true}).click(); await expect(page.getByText('درخواست جست‌وجو برای',{exact:false})).toBeVisible();
      await resetOwn(page); let fail=true; await page.route('**/api/v1/date-prices',async route=>{if(fail)await route.abort('internetdisconnected');else await route.continue();}); await page.goto('/');
      await expect(page.getByRole('alert').filter({hasText:'قیمت روزها دریافت نشد'})).toBeVisible(); await expect(page.getByRole('button',{name:'تلاش دوباره برای قیمت روزها'})).toBeVisible(); expect(await page.getByText('پیشنهاد مطابق نیست',{exact:true}).count()).toBe(0);
      fail=false; await page.evaluate(()=>window.dispatchEvent(new Event('online'))); await ready(page);
      record('no-match-recovery.json',{actualScenario:'no-eligible-results',actualSnapshot,networkFailure:'Playwright transport abort; not provider evidence',onlineRecovery:true});
    } finally { await resetOwn(page); }
  });
  test('mobile physical touch drag keeps the chart and calendar usable', async ({ browser }) => {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}); const page=await context.newPage(); const cdp=await context.newCDPSession(page);
    let searches=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/v1/searches'))searches++;});
    try {
      await page.goto('/');await ready(page);const date=(await page.getByRole('region',{name:'کاوش تاریخ سفر'}).getAttribute('data-selected-outbound'))!;const wheel=page.getByRole('listbox',{name:'روزهای نزدیک'});await wheel.scrollIntoViewIfNeeded();const box=(await wheel.boundingBox())!;const x=box.x+box.width/2,y=box.y+140;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-60}]});expect(searches).toBe(0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>searches).toBe(1);await expect(wheel).toHaveAttribute('data-preview-date',addDays(date,1));
      await expect(page.getByLabel('نمودار کمترین قیمت واجد شرایط به تاریخ حرکت')).toBeVisible();await expect(page.getByRole('complementary',{name:'نمای مسیر'})).toBeHidden();await page.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'}).click();await expect(page.getByRole('dialog',{name:'انتخاب تاریخ سفر'})).toBeVisible(); await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:12000}); const targets=await page.getByRole('dialog',{name:'انتخاب تاریخ سفر'}).locator('[data-date]:not([data-outside-month])').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));expect(targets.every(target=>target.width>=44&&target.height>=44)).toBe(true);const apply=await page.getByRole('button',{name:'اعمال تاریخ‌ها',exact:true}).boundingBox();expect(apply!.y+apply!.height).toBeLessThanOrEqual(844);record('calendar-mobile-targets.json',{targets,apply}); if(evidence)await page.screenshot({path:resolve(evidence,'calendar-mobile.png')}); await page.getByRole('button',{name:'انصراف',exact:true}).click();
      await ready(page); expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);if(evidence)await page.screenshot({path:resolve(evidence,'dates-mobile.png'),fullPage:true});record('touch.json',{viewport:{width:390,height:844},actualCdpTouch:true,searches,date});
    }finally{await resetOwn(page);await context.close();}
  });
  test('physical wheel row click commits the clicked noncenter day exactly once', async ({page})=>{
    let searches=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/v1/searches'))searches++;});try{await page.goto('/');await ready(page);const wheel=page.getByRole('listbox',{name:'روزهای نزدیک'});await wheel.getByRole('option').nth(1).click();await expect.poll(()=>searches).toBe(1);await page.waitForTimeout(350);expect(searches).toBe(1);}finally{await resetOwn(page);}
  });
  test('fast native Back fences a late actual start while a new explicit date intent survives', async ({page})=>{
    let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});const requests:{id:string;date:string}[]=[];
    await page.route('**/api/v1/searches',async route=>{const response=await route.fetch();expect(response.status()).toBe(201);const body=await response.json();requests.push({id:body.snapshot.searchId,date:body.snapshot.query.departureDate});if(requests.length===1)await held;await route.fulfill({response}).catch(()=>undefined);});
    try{await page.goto('/');const search=page.getByRole('button',{name:'جست‌وجوی سفر',exact:true});await expect(search).toBeEnabled();await search.click();await expect.poll(()=>requests.length).toBe(1);await page.goBack();await page.getByRole('button',{name:'روز بعد',exact:true}).click();await expect.poll(()=>requests.length).toBe(2);await expect(page.getByText('درخواست جست‌وجو برای',{exact:false})).toBeVisible();const latest=page.url();const cancelled=page.waitForResponse(response=>response.url().endsWith(`/searches/${requests[0]!.id}/cancel`));release();expect((await cancelled).status()).toBe(201);expect(page.url()).toBe(latest);expect(requests[1]!.date).not.toBe(requests[0]!.date);record('fast-pop-new-intent.json',{requests,latest,lateIdCancelled:true});}finally{release();await resetOwn(page);}
  });
  test('Jalali leap-day keyboard navigation converts local dates without a UTC shift', async ({page})=>{
    try {
      await page.request.post('/api/v1/demo/session',{data:{seed:1617,anchorInstant:'2025-03-19T00:00:00Z',scenario:'normal'}});await page.goto('/');await ready(page);await page.getByRole('button',{name:'تقویم جلالی و انتخاب تاریخ'}).click();const dialog=page.getByRole('dialog',{name:'انتخاب تاریخ سفر'});
      const leap=dialog.locator('[data-date="2025-03-20"]');await expect(leap).toBeVisible();await leap.focus();await page.keyboard.press('Enter');await expect(dialog.getByLabel('تاریخ رفت میلادی در تقویم',{exact:true})).toHaveValue('2025-03-20');await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');await expect(dialog.getByLabel('تاریخ رفت میلادی در تقویم',{exact:true})).toHaveValue('2025-03-21');
      if(evidence)await page.screenshot({path:resolve(evidence,'calendar-leap-desktop.png')});await dialog.getByRole('button',{name:'اعمال تاریخ‌ها',exact:true}).click();await expect(page.getByRole('region',{name:'کاوش تاریخ سفر'})).toHaveAttribute('data-selected-outbound','2025-03-21');record('jalali-leap.json',{anchor:'2025-03-19T00:00:00Z',leap:'1403-12-30',wireLeap:'2025-03-20',next:'1404-01-01',wireNext:'2025-03-21',keyboard:'Enter,ArrowLeft RTL,Enter'});
    } finally {await resetOwn(page);}
  });
  test('actual GLSL compile/draw across six routes and themes, context loss fallback and restoration', async ({ page }) => {
    test.setTimeout(90000); await transitionProbe(page); await page.setViewportSize({width:1440,height:1100});
    await page.addInitScript(()=>{
      const contexts: WebGL2RenderingContext[]=[]; const draws:{pixels:number[];scissor:number[];line:number[]}[]=[];const shaders:boolean[]=[];const programs:boolean[]=[];const buffers:number[][]=[];
      const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<HTMLCanvasElement['getContext']>){const result=original.apply(this,args);if(args[0]==='webgl2'&&result&&!contexts.includes(result as WebGL2RenderingContext))contexts.push(result as WebGL2RenderingContext);return result;} as HTMLCanvasElement['getContext'];
      const compile=WebGL2RenderingContext.prototype.compileShader;WebGL2RenderingContext.prototype.compileShader=function(shader){compile.call(this,shader);shaders.push(this.getShaderParameter(shader,this.COMPILE_STATUS) as boolean);};const link=WebGL2RenderingContext.prototype.linkProgram;WebGL2RenderingContext.prototype.linkProgram=function(program){link.call(this,program);programs.push(this.getProgramParameter(program,this.LINK_STATUS) as boolean);};
      const upload=WebGL2RenderingContext.prototype.bufferData;WebGL2RenderingContext.prototype.bufferData=function(this:WebGL2RenderingContext,...args:Parameters<WebGL2RenderingContext['bufferData']>){upload.apply(this,args);if(args[1] instanceof Float32Array&&buffers.length<500)buffers.push(Array.from(args[1]));} as WebGL2RenderingContext['bufferData'];
      const draw=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(...args){draw.apply(this,args);const scissor=Array.from(this.getParameter(this.SCISSOR_BOX) as Int32Array);const width=Math.min(512,Math.max(1,scissor[2]!)),height=Math.min(512,Math.max(1,scissor[3]!));const buffer=new Uint8Array(width*height*4);this.readPixels(Math.max(0,scissor[0]!),Math.max(0,scissor[1]!),width,height,this.RGBA,this.UNSIGNED_BYTE,buffer);const hit=buffer.findIndex((value,index)=>index%4===3&&value>0);const pixel=hit>=3?buffer.slice(hit-3,hit+1):new Uint8Array(4);if(draws.length<500)draws.push({pixels:Array.from(pixel),scissor,line:Array.from(this.getUniform(this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram,this.getUniformLocation(this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram,'chartLine')!) as Float32Array??[])});};
      (window as unknown as {gpu:unknown}).gpu={contexts,draws,shaders,programs,buffers};
    });
    try {
      await page.goto('/');await ready(page); await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status','ready');
      const palettes=[];
      for(const mode of ['پرواز','قطار','اتوبوس'])for(const scope of ['داخلی','بین‌المللی']){
        await page.getByRole('button',{name:'کاوش نسخه نمایشی',exact:true}).click();await page.getByRole('button',{name:new RegExp(`^${mode} ${scope} ·`)}).click();await ready(page);
        for(const appearance of ['dark','light']){
          if(await page.locator('html').getAttribute('data-appearance')!==appearance)await page.getByRole('button',{name:appearance==='dark'?'نمای تیره':'نمای روشن',exact:true}).click();await settledTheme(page);
          await page.getByRole('region',{name:'کاوش تاریخ سفر'}).scrollIntoViewIfNeeded();await page.waitForTimeout(80);
          const state=await page.evaluate(()=>{const {contexts,draws,shaders,programs}=(window as unknown as {gpu:{contexts:WebGL2RenderingContext[];draws:{pixels:number[];line:number[]}[];shaders:boolean[];programs:boolean[]}}).gpu;const gl=contexts[0]!;return{contexts:contexts.length,draws:draws.slice(-6),compiled:shaders,linked:programs,cssChartLine:getComputedStyle(document.documentElement).getPropertyValue('--chart-line').trim(),renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),mode:document.documentElement.dataset['mode'],appearance:document.documentElement.dataset['appearance']};});
          expect(state.contexts).toBe(1);expect(state.draws.length).toBeGreaterThan(0);expect(state.draws.some(draw=>draw.pixels[3]!>0)).toBe(true);expect(state.compiled.length).toBeGreaterThan(0);expect(state.compiled.every(Boolean)).toBe(true);expect(state.linked.every(Boolean)).toBe(true);palettes.push({labelMode:mode,scope,...state});if(evidence)await page.screenshot({path:resolve(evidence,`chart-${state.mode}-${scope==='داخلی'?'domestic':'international'}-${appearance}.png`)});
        }
      }
      record('gpu-palettes-progress.json',{palettes});
      const id=await page.getByRole('region',{name:'کاوش تاریخ سفر'}).getAttribute('data-date-price-id'); const nativeSnapshot=await (await page.request.get(`/api/v1/date-prices/${id}?clientGeneration=native-buffer-probe`)).json();
      const cells=nativeSnapshot.cells as {date:string;status:string;minimum?:{amountRial:number}}[];const amounts=cells.filter(cell=>cell.status==='priced').map(cell=>cell.minimum!.amountRial);const min=Math.min(...amounts),max=Math.max(...amounts);const edges:number[]=[];let previous:number[]|undefined;cells.forEach((cell,index)=>{if(cell.status!=='priced'){previous=undefined;return;}const point=[-.9+index/Math.max(1,cells.length-1)*1.8,max===min?0:-.65+(cell.minimum!.amountRial-min)/(max-min)*1.3,0];if(previous)edges.push(...previous,...point);previous=point;});
      const uploaded=await page.evaluate(expected=>{const buffers=(window as unknown as {gpu:{buffers:number[][]}}).gpu.buffers;return{matched:buffers.some(buffer=>buffer.length===expected.length&&buffer.every((value,index)=>Math.abs(value-expected[index]!)<.00001)),bufferCount:buffers.length};},edges);expect(edges.length).toBeGreaterThan(0);expect(uploaded.matched).toBe(true);record('native-chart-buffer.json',{nativeSnapshot,edges,uploaded,proof:'actual native WebGL bufferData values; separate edges only across adjacent priced cells'});
      const compiledBefore=palettes.at(-1)!.compiled.length;expect(compiledBefore).toBeGreaterThan(0);
      await page.evaluate(()=>{const gl=(window as unknown as {gpu:{contexts:WebGL2RenderingContext[]}}).gpu.contexts[0]!;const extension=gl.getExtension('WEBGL_lose_context')!;(window as unknown as {dateRestore:()=>void}).dateRestore=()=>extension.restoreContext();extension.loseContext();});await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status','context-lost');await expect(page.getByLabel('نمودار کمترین قیمت واجد شرایط به تاریخ حرکت').locator('svg')).toBeVisible();
      await page.getByRole('button',{name:'روز بعد',exact:true}).click();await expect(page.getByText('درخواست جست‌وجو برای',{exact:false})).toBeVisible();await page.evaluate(()=>{(window as unknown as {dateRestore:()=>void}).dateRestore();});await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status','ready');record('gpu-palettes.json',{palettes,actualContextLoss:true,selectionDuringFallback:true,restored:true,userAgent:await page.evaluate(()=>navigator.userAgent)});
    }finally{await resetOwn(page);}
  });
});
