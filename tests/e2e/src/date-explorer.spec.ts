import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DatePriceSnapshot } from '@torob-ticket/contracts';
// Node parity imports only the chart implementation/math, avoiding the UI barrel's browser asset URLs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { priceChartGeometry, priceChartPresentation } from '../../../libs/ui/src/components/price-chart-fallback';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { priceBand, priceRange } from '../../../libs/ui/src/components/price-band';
// Test-only parity import: avoid the graphics barrel's scene/raw-shader modules in the Node runner.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { priceChartRibbon } from '../../../libs/graphics/src/scenes/price-chart-ribbon';
const evidence = process.env.T16_EVIDENCE_DIR;
function record(name: string, data: unknown) { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence,name), JSON.stringify(data,null,2)); } }
const addDays = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate()+days); return value.toISOString().slice(0,10); };
async function ready(page: Page) { await expect(page.getByRole('region', { name: 'کاوش تاریخ سفر' })).toHaveAttribute('data-date-price-status','complete'); }
async function resetOwn(page: Page) { await page.request.post('/api/v1/demo/reset'); }
async function transitionProbe(page: Page) { await page.addInitScript(() => { const original = document.startViewTransition?.bind(document); const transitions: Promise<void>[] = []; (window as unknown as { dateTransitions: Promise<void>[] }).dateTransitions = transitions; if (original) document.startViewTransition = ((update: Parameters<Document['startViewTransition']>[0]) => { const transition = original(update); transitions.push(transition.finished.catch(() => undefined)); return transition; }) as Document['startViewTransition']; }); }
async function settledTheme(page: Page) { await page.evaluate(async () => { await Promise.all((window as unknown as { dateTransitions: Promise<void>[] }).dateTransitions); }); }

interface NativeChartDraw {
  kind: number; mode: number; count: number; positions: number[]; directions: number[]; sides: number[]; bands: number[];
  viewportCss: number[]; viewportPixels: number[]; pixelRatio: number; rendererDpr: number; lineWidth: number; strokeCss?: number;
}
interface NativeChartProof { draws: NativeChartDraw[]; uploads: number; chartPrograms: number; compiled: boolean; linked: boolean }

/** Capture the actual buffers bound to each chart draw, rather than any coincidentally similar upload. */
async function observeNativeChartBuffers(page: Page) {
  await page.addInitScript(() => {
    const proof: NativeChartProof = { draws: [], uploads: 0, chartPrograms: 0, compiled: true, linked: true };
    const contents = new WeakMap<WebGLBuffer, Float32Array>(), programs = new WeakSet<WebGLProgram>();
    (window as unknown as { nativeChartProof: NativeChartProof }).nativeChartProof = proof;
    const proto = WebGL2RenderingContext.prototype, upload = proto.bufferData, update = proto.bufferSubData, link = proto.linkProgram, draw = proto.drawArrays;
    proto.bufferData = function (this: WebGL2RenderingContext, ...args: Parameters<WebGL2RenderingContext['bufferData']>) {
      upload.apply(this, args);
      const source = args[1], buffer = this.getParameter(this.ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
      if (args[0] === this.ARRAY_BUFFER && buffer && source instanceof Float32Array) {
        const offset = args[3] ?? 0, length = args[4] ?? source.length - offset;
        contents.set(buffer, source.slice(offset, offset + length)); proof.uploads++;
      }
    } as WebGL2RenderingContext['bufferData'];
    proto.bufferSubData = function (this: WebGL2RenderingContext, ...args: Parameters<WebGL2RenderingContext['bufferSubData']>) {
      update.apply(this, args);
      const source = args[2], buffer = this.getParameter(this.ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
      if (args[0] === this.ARRAY_BUFFER && buffer && source instanceof Float32Array) {
        const offset = args[3] ?? 0, length = args[4] ?? source.length - offset, destination = args[1] / 4;
        const previous = contents.get(buffer);
        const next = previous && previous.length >= destination + length ? previous : new Float32Array(Math.max(previous?.length ?? 0, destination + length));
        if (previous && next !== previous) next.set(previous);
        next.set(source.subarray(offset, offset + length), destination); contents.set(buffer, next); proof.uploads++;
      }
    } as WebGL2RenderingContext['bufferSubData'];
    proto.linkProgram = function (program) {
      link.call(this, program);
      const shaders = this.getAttachedShaders(program) ?? [], source = shaders.map(shader => this.getShaderSource(shader) ?? '').join('\n');
      if (source.includes('strokeDirection') && source.includes('vMarkerRadius') && source.includes('vPricePosition')) {
        programs.add(program); proof.chartPrograms++;
        proof.compiled &&= shaders.every(shader => Boolean(this.getShaderParameter(shader, this.COMPILE_STATUS)));
        proof.linked &&= Boolean(this.getProgramParameter(program, this.LINK_STATUS));
      }
    };
    proto.drawArrays = function (mode, first, count) {
      const program = this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram | null;
      if (!program || !programs.has(program)) { draw.call(this, mode, first, count); return; }
      const uniform = (name: string) => { const location = this.getUniformLocation(program, name); return location ? this.getUniform(program, location) : undefined; };
      const kind = Number(uniform('kind'));
      if (kind !== 0 && kind !== 1) { draw.call(this, mode, first, count); return; }
      const attribute = (name: string) => {
        const index = this.getAttribLocation(program, name);
        if (index < 0) return [];
        const buffer = this.getVertexAttrib(index, this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer | null, values = buffer && contents.get(buffer);
        if (!values) return [];
        const size = Number(this.getVertexAttrib(index, this.VERTEX_ATTRIB_ARRAY_SIZE));
        const stride = Number(this.getVertexAttrib(index, this.VERTEX_ATTRIB_ARRAY_STRIDE)) / 4 || size;
        const offset = this.getVertexAttribOffset(index, this.VERTEX_ATTRIB_ARRAY_POINTER) / 4;
        return Array.from({ length: count }, (_, vertex) => Array.from(values.slice(offset + (first + vertex) * stride, offset + (first + vertex) * stride + size))).flat();
      };
      const canvas = this.canvas as HTMLCanvasElement, canvasBox = canvas.getBoundingClientRect();
      const frame: NativeChartDraw = {
        kind, mode, count, positions: attribute('position'), directions: attribute('strokeDirection'), sides: attribute('strokeSide'), bands: attribute('pointBand'),
        viewportCss: Array.from(uniform('viewport') as Float32Array ?? []), viewportPixels: Array.from(this.getParameter(this.VIEWPORT) as Int32Array),
        pixelRatio: Number(uniform('pixelRatio')), rendererDpr: this.drawingBufferWidth / canvasBox.width, lineWidth: Number(uniform('lineWidth')),
      };
      // A before/after pixel difference isolates the ribbon from the grid/selection guide.
      // Pick its flattest visible segment, then measure coverage along a native pixel column.
      let sample: { x: number; y: number; height: number; slope: number; before: Uint8Array } | undefined;
      if (kind === 0 && frame.positions.length && frame.viewportCss.length === 2) {
        let best = Number.POSITIVE_INFINITY;
        // Pixel coverage must use the actual native viewport, independently of the uniform under test.
        const viewport = frame.viewportPixels, width = viewport[2]! / frame.rendererDpr, height = viewport[3]! / frame.rendererDpr, selectedX = Number(uniform('selectedX'));
        for (let vertex = 0; vertex + 5 < count; vertex += 6) {
          const at = vertex * 3, ax = frame.positions[at]!, ay = frame.positions[at + 1]!, bx = frame.positions[at + 3]!, by = frame.positions[at + 4]!;
          const dx = (bx - ax) * width / 2, dy = (by - ay) * height / 2, slope = dy / dx, x = (ax + bx) / 2, y = (ay + by) / 2;
          if (!dx || Math.abs(slope) >= best || Math.abs(x - selectedX) * width / 2 < 6) continue;
          const pixelX = viewport[0]! + (x + 1) * viewport[2]! / 2, pixelY = viewport[1]! + (y + 1) * viewport[3]! / 2;
          const radius = Math.ceil((frame.lineWidth + 3) * frame.rendererDpr * Math.sqrt(1 + slope ** 2)), sampleX = Math.floor(pixelX), sampleY = Math.floor(pixelY + (sampleX + .5 - pixelX) * slope) - radius;
          const sampleHeight = radius * 2 + 1;
          if (sampleX < 0 || sampleX >= this.drawingBufferWidth || sampleY < 0 || sampleY + sampleHeight > this.drawingBufferHeight) continue;
          best = Math.abs(slope); sample = { x: sampleX, y: sampleY, height: sampleHeight, slope, before: new Uint8Array(sampleHeight * 4) };
        }
        if (sample) this.readPixels(sample.x, sample.y, 1, sample.height, this.RGBA, this.UNSIGNED_BYTE, sample.before);
      }
      draw.call(this, mode, first, count);
      if (sample) {
        const after = new Uint8Array(sample.height * 4); this.readPixels(sample.x, sample.y, 1, sample.height, this.RGBA, this.UNSIGNED_BYTE, after);
        const changes = Array.from({ length: sample.height }, (_, pixel) => Math.max(...Array.from({ length: 4 }, (_, channel) => Math.abs(after[pixel * 4 + channel]! - sample!.before[pixel * 4 + channel]!))));
        const peak = Math.max(...changes);
        frame.strokeCss = peak ? changes.reduce((total, value) => total + value / peak, 0) / frame.rendererDpr / Math.sqrt(1 + sample.slope ** 2) : 0;
      }
      proof.draws.push(frame); if (proof.draws.length > 24) proof.draws.shift();
    };
  });
}

async function assertNativeChartBuffers(page: Page, snapshot: DatePriceSnapshot, filename: string) {
  const cells = snapshot.cells, range = priceRange(cells.flatMap(cell => cell.status === 'priced' ? [cell.minimum.amountRial] : []));
  expect(range).toBeDefined();
  const geometry = priceChartGeometry(cells, range), ribbon = priceChartRibbon(geometry.paths), markerPositions = geometry.points.flatMap(point => [point.x, point.y, 0]);
  expect(ribbon.positions.length).toBeGreaterThan(0);
  // Exact observations use calendar-day spacing and the same resolved range as the mounted date model.
  for (const point of geometry.points) {
    const cell = cells.find(cell => cell.date === point.date)!;
    expect(cell.status).toBe('priced'); if (cell.status !== 'priced') throw Error('priced point lost its source cell');
    const span = Date.parse(cells.at(-1)!.date) - Date.parse(cells[0]!.date);
    expect(point.x).toBeCloseTo(span ? -.9 + (Date.parse(cell.date) - Date.parse(cells[0]!.date)) / span * 1.8 : 0, 12);
    expect(point.amountRial).toBe(cell.minimum.amountRial);
    expect(point.y).toBeCloseTo(range!.max === range!.min ? 0 : -.65 + (cell.minimum.amountRial - range!.min) / (range!.max - range!.min) * 1.3, 12);
  }
  const runs: (typeof geometry.points)[] = [];
  cells.forEach((cell, index) => {
    if (cell.status !== 'priced') return;
    const point = geometry.points.find(point => point.date === cell.date)!, previous = cells[index - 1];
    if (previous?.status === 'priced' && addDays(previous.date, 1) === cell.date) runs.at(-1)!.push(point); else runs.push([point]);
  });
  expect(geometry.paths).toHaveLength(runs.length);
  runs.forEach((run, index) => {
    const path = geometry.paths[index]!; expect(path).toHaveLength((run.length - 1) * 12 + 1);
    run.forEach((point, offset) => expect(path[offset * 12]).toEqual({ x: point.x, y: point.y }));
  });
  const chart = page.getByLabel('نمودار کمترین قیمت واجد شرایط به تاریخ حرکت', { exact: true });
  await chart.scrollIntoViewIfNeeded(); const viewport = (await chart.boundingBox())!;
  const expected = { ...ribbon, markerPositions, bands: geometry.points.map(point => { const band = priceBand(point.amountRial, range); return band === 'low' ? 0 : band === 'high' ? 2 : 1; }), viewport: [viewport.width, viewport.height] };
  const read = () => page.evaluate(expected => {
    const proof = (window as unknown as { nativeChartProof: NativeChartProof }).nativeChartProof;
    const same = (actual: number[], wanted: number[]) => actual.length === wanted.length && actual.every((value, index) => Math.abs(value - Math.fround(wanted[index]!)) < 1e-6);
    const currentViewport = (frame: NativeChartDraw) => frame.viewportCss.length === 2 && frame.viewportCss.every((value, index) => Math.abs(value - expected.viewport[index]!) < .1);
    const line = [...proof.draws].reverse().find(frame => frame.kind === 0 && currentViewport(frame) && same(frame.positions, expected.positions) && same(frame.directions, expected.directions) && same(frame.sides, expected.sides));
    const markers = [...proof.draws].reverse().find(frame => frame.kind === 1 && currentViewport(frame) && same(frame.positions, expected.markerPositions) && same(frame.bands, expected.bands));
    const dom = document.querySelector('[data-graphics-view][aria-label="نمودار کمترین قیمت واجد شرایط به تاریخ حرکت"]')?.getBoundingClientRect();
    const recent = proof.draws.slice(-8).map(frame => ({ kind: frame.kind, count: frame.count, viewportCss: frame.viewportCss, viewportPixels: frame.viewportPixels, pixelRatio: frame.pixelRatio, rendererDpr: frame.rendererDpr, strokeCss: frame.strokeCss, positionMatch: same(frame.positions, frame.kind === 0 ? expected.positions : expected.markerPositions), directionMatch: same(frame.directions, expected.directions), sideMatch: same(frame.sides, expected.sides), bandsMatch: same(frame.bands, expected.bands) }));
    return { matched: Boolean(line && markers), uploads: proof.uploads, chartPrograms: proof.chartPrograms, compiled: proof.compiled, linked: proof.linked, line, markers, domViewport: dom && { width: dom.width, height: dom.height, x: dom.x, y: dom.y }, recent };
  }, expected);
  try { await expect.poll(async () => (await read()).matched).toBe(true); }
  catch (error) { record(filename.replace('.json', '-failed.json'), { snapshot, range, expectedViewport: expected.viewport, native: await read() }); throw error; }
  const native = await read(); expect(native.compiled).toBe(true); expect(native.linked).toBe(true); expect(native.chartPrograms).toBeGreaterThan(0); expect(native.uploads).toBeGreaterThan(0);
  const line = native.line!; expect(line.mode).toBe(4); expect(line.count).toBe(ribbon.positions.length / 3); expect(native.markers!.mode).toBe(0);
  expect(line.lineWidth).toBeCloseTo(priceChartPresentation.lineWidth, 5);
  expect(line.pixelRatio).toBeCloseTo(line.rendererDpr, 2);
  line.viewportCss.forEach((size, index) => expect(Math.abs(line.viewportPixels[index + 2]! - size * line.pixelRatio)).toBeLessThanOrEqual(2));
  // The shader adds a .65px antialias fringe outside each solid edge; allow native pixel rounding.
  expect(line.strokeCss).toBeDefined(); expect(Math.abs(line.strokeCss! - (priceChartPresentation.lineWidth + .65))).toBeLessThan(1.1);
  record(filename, { snapshot, range, runs: runs.map(run => run.map(point => point.date)), curveSamples: geometry.paths, ribbon, native, viewport, proof: 'Actual bound native WebGL bufferData attributes/draws, exact source markers and price bands, separate date runs, resolved range, CSS viewport/DPR uniforms and measured ribbon pixel coverage' });
  return { viewport, strokeCss: line.strokeCss! };
}
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
  test('mobile physical touch drag keeps the chart and calendar usable', async ({ browser, browserName, baseURL }) => {
    test.skip(browserName !== 'chromium', 'Physical CDP touch injection is Chromium-specific; portable keyboard/date coverage runs separately.');
    const context=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,isMobile:true}); const page=await context.newPage(); const cdp=await context.newCDPSession(page);
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
  test('actual native chart ribbon buffers preserve source prices, unavailable gaps and CSS-pixel width after resize', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await observeNativeChartBuffers(page);
    let source: DatePriceSnapshot | undefined, rendered: DatePriceSnapshot | undefined;
    await page.route('**/api/v1/date-prices**', async route => {
      if (!['GET', 'POST'].includes(route.request().method())) { await route.continue(); return; }
      const response = await route.fetch();
      if (!response.ok()) { await route.fulfill({ response }); return; }
      const snapshot = await response.json() as DatePriceSnapshot;
      if (snapshot.status !== 'complete') { await route.fulfill({ response }); return; }
      source = snapshot;
      const gapIndices = new Set([Math.floor(snapshot.cells.length / 3), Math.floor(snapshot.cells.length * 2 / 3)]);
      // An explicit transport fixture removes two prices; every remaining value/provenance is the real local API response.
      // This tests unknown-price gaps, without asserting these injected gaps are actual provider inventory.
      rendered = { ...snapshot, cells: snapshot.cells.map((cell, index) => gapIndices.has(index) && cell.status === 'priced' ? { date: cell.date, status: 'unavailable', reason: 'incomplete-price', retryable: false, coverage: cell.coverage } : cell) };
      await route.fulfill({ response, json: rendered });
    });
    try {
      await page.goto('/'); await ready(page); await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready');
      await expect.poll(() => rendered?.status).toBe('complete');
      const snapshot = rendered!;
      expect(snapshot.cells.filter(cell => cell.status === 'unavailable').length).toBeGreaterThanOrEqual(2);
      expect(priceChartGeometry(snapshot.cells).paths.length).toBeGreaterThan(1);
      const wide = await assertNativeChartBuffers(page, snapshot, 'native-chart-ribbon-wide.json');
      await page.setViewportSize({ width: 390, height: 844 });
      const narrow = await assertNativeChartBuffers(page, snapshot, 'native-chart-ribbon-narrow.json');
      expect(narrow.viewport.width).toBeLessThan(wide.viewport.width); expect(Math.abs(narrow.strokeCss - wide.strokeCss)).toBeLessThan(1.25);
      record('native-chart-ribbon-source.json', { source, rendered: snapshot, wide, narrow, fixture: 'Playwright response fixture replaces two priced cells with explicit incomplete-price gaps; it never adds or changes a numerical price' });
    } finally { await resetOwn(page); }
  });
  test('actual GLSL compile/draw across six routes and themes, context loss fallback and restoration', async ({ page }) => {
    test.setTimeout(90000); await transitionProbe(page); await observeNativeChartBuffers(page); await page.setViewportSize({width:1440,height:1100});
    await page.addInitScript(()=>{
      const contexts: WebGL2RenderingContext[]=[]; const draws:{pixels:number[];scissor:number[];line:number[]}[]=[];const shaders:boolean[]=[];const programs:boolean[]=[];
      const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<HTMLCanvasElement['getContext']>){const result=original.apply(this,args);if(args[0]==='webgl2'&&result&&!contexts.includes(result as WebGL2RenderingContext))contexts.push(result as WebGL2RenderingContext);return result;} as HTMLCanvasElement['getContext'];
      const compile=WebGL2RenderingContext.prototype.compileShader;WebGL2RenderingContext.prototype.compileShader=function(shader){compile.call(this,shader);shaders.push(this.getShaderParameter(shader,this.COMPILE_STATUS) as boolean);};const link=WebGL2RenderingContext.prototype.linkProgram;WebGL2RenderingContext.prototype.linkProgram=function(program){link.call(this,program);programs.push(this.getProgramParameter(program,this.LINK_STATUS) as boolean);};
      const draw=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(...args){draw.apply(this,args);const scissor=Array.from(this.getParameter(this.SCISSOR_BOX) as Int32Array);const width=Math.min(512,Math.max(1,scissor[2]!)),height=Math.min(512,Math.max(1,scissor[3]!));const buffer=new Uint8Array(width*height*4);this.readPixels(Math.max(0,scissor[0]!),Math.max(0,scissor[1]!),width,height,this.RGBA,this.UNSIGNED_BYTE,buffer);const hit=buffer.findIndex((value,index)=>index%4===3&&value>0);const pixel=hit>=3?buffer.slice(hit-3,hit+1):new Uint8Array(4);if(draws.length<500)draws.push({pixels:Array.from(pixel),scissor,line:Array.from(this.getUniform(this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram,this.getUniformLocation(this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram,'chartLine')!) as Float32Array??[])});};
      (window as unknown as {gpu:unknown}).gpu={contexts,draws,shaders,programs};
    });
    try {
      await page.goto('/');await ready(page); await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status','ready');
      const palettes=[];
      for(const mode of ['پرواز','قطار','اتوبوس'])for(const scope of ['داخلی','بین‌المللی']){
        await page.getByRole('button',{name:'سفرهای پیشنهادی',exact:true}).click();await page.getByRole('button',{name:new RegExp(`^${mode} ${scope} ·`)}).click();await ready(page);
        for(const appearance of ['dark','light']){
          if(await page.locator('html').getAttribute('data-appearance')!==appearance)await page.getByRole('button',{name:appearance==='dark'?'نمای تیره':'نمای روشن',exact:true}).click();await settledTheme(page);
          await page.getByRole('region',{name:'کاوش تاریخ سفر'}).scrollIntoViewIfNeeded();await page.waitForTimeout(80);
          const state=await page.evaluate(()=>{const {contexts,draws,shaders,programs}=(window as unknown as {gpu:{contexts:WebGL2RenderingContext[];draws:{pixels:number[];line:number[]}[];shaders:boolean[];programs:boolean[]}}).gpu;const gl=contexts[0]!;return{contexts:contexts.length,draws:draws.slice(-6),compiled:shaders,linked:programs,cssChartLine:getComputedStyle(document.documentElement).getPropertyValue('--chart-line').trim(),renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),mode:document.documentElement.dataset['mode'],appearance:document.documentElement.dataset['appearance']};});
          expect(state.contexts).toBe(1);expect(state.draws.length).toBeGreaterThan(0);expect(state.draws.some(draw=>draw.pixels[3]!>0)).toBe(true);expect(state.compiled.length).toBeGreaterThan(0);expect(state.compiled.every(Boolean)).toBe(true);expect(state.linked.every(Boolean)).toBe(true);palettes.push({labelMode:mode,scope,...state});if(evidence)await page.screenshot({path:resolve(evidence,`chart-${state.mode}-${scope==='داخلی'?'domestic':'international'}-${appearance}.png`)});
        }
      }
      record('gpu-palettes-progress.json',{palettes});
      const id=await page.getByRole('region',{name:'کاوش تاریخ سفر'}).getAttribute('data-date-price-id'); const nativeSnapshot=await (await page.request.get(`/api/v1/date-prices/${id}?clientGeneration=native-buffer-probe`)).json() as DatePriceSnapshot;
      await assertNativeChartBuffers(page, nativeSnapshot, 'native-chart-buffer.json');
      const compiledBefore=palettes.at(-1)!.compiled.length;expect(compiledBefore).toBeGreaterThan(0);
      await page.evaluate(()=>{const gl=(window as unknown as {gpu:{contexts:WebGL2RenderingContext[]}}).gpu.contexts[0]!;const extension=gl.getExtension('WEBGL_lose_context')!;(window as unknown as {dateRestore:()=>void}).dateRestore=()=>extension.restoreContext();extension.loseContext();});await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status','context-lost');await expect(page.getByLabel('نمودار کمترین قیمت واجد شرایط به تاریخ حرکت').locator('svg')).toBeVisible();
      await page.getByRole('button',{name:'روز بعد',exact:true}).click();await expect(page.getByText('درخواست جست‌وجو برای',{exact:false})).toBeVisible();await page.evaluate(()=>{(window as unknown as {dateRestore:()=>void}).dateRestore();});await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status','ready');record('gpu-palettes.json',{palettes,actualContextLoss:true,selectionDuringFallback:true,restored:true,userAgent:await page.evaluate(()=>navigator.userAgent)});
    }finally{await resetOwn(page);}
  });
});
