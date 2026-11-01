import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RecheckResultSchema, ReferralReceiptSchema, SearchRecoverySchema, type SearchRecovery, type TransportSearchQuery } from '@torob-ticket/contracts';
import { exactReceipt, expectPlaceholder } from './acceptance/journey-helpers';

const evidence = resolve(process.env.MAP_NAVIGATION_EVIDENCE_DIR ?? 'docs/evidence/adjustments/map-navigation/browser');
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const map = (page: Page) => page.getByRole('complementary', { name: 'نقشه سفر', exact: true });
const results = (page: Page) => page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
interface MapGPU { draws: number; vehicleModes: number[]; dotWeights: number[][]; dotSpacings: number[]; dotLattices: number[][]; trailSamples: number[]; failures: string[]; lost: number; }
const gpu = (page: Page) => page.evaluate(() => (window as unknown as { navigationGPU: MapGPU }).navigationGPU);
function record(name: string, value: unknown) { writeFileSync(resolve(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n'); }
async function observe(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('torobticket.appearance', 'dark');
    const stats = { draws: 0, vehicleModes: [] as number[], dotWeights: [] as number[][], dotSpacings: [] as number[], dotLattices: [] as number[][], trailSamples: [] as number[], failures: [] as string[], lost: 0 };
    Object.assign(window, { navigationGPU: stats });
    document.addEventListener('webglcontextlost', () => stats.lost++, true);
    const proto = WebGL2RenderingContext.prototype;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
      const original = proto[name];
      Object.defineProperty(proto, name, { configurable: true, value: function (this: WebGL2RenderingContext, ...args: unknown[]) { stats.draws++; return Reflect.apply(original, this, args); } });
    }
    const locations = new WeakMap<WebGLUniformLocation, string>();
    const find = proto.getUniformLocation, uniform = proto.uniform1f, vector = proto.uniform4fv, scalarVector = proto.uniform4f, link = proto.linkProgram;
    proto.getUniformLocation = function (program, name) { const location = find.call(this, program, name); if (location) locations.set(location, name); return location; };
    proto.uniform1f = function (location, value) {
      if (location && locations.get(location) === 'vehicleMode' && stats.vehicleModes.at(-1) !== value) stats.vehicleModes.push(value);
      if (location && locations.get(location) === 'baseSpacing' && stats.dotSpacings.at(-1) !== value) stats.dotSpacings.push(value);
      uniform.call(this, location, value);
    };
    proto.uniform4fv = function (location, value, ...offsets) {
      if (location && /^trailSamples(?:\[0\])?$/.test(locations.get(location) ?? '')) stats.trailSamples = Array.from(value);
      if (location && locations.get(location) === 'latticeSpacings') {
        const spacings = Array.from(value).slice(0, 4);
        if (String(stats.dotLattices.at(-1)) !== String(spacings)) stats.dotLattices.push(spacings);
        if (stats.dotSpacings.at(-1) !== spacings[0]) stats.dotSpacings.push(spacings[0]!);
      }
      if (location && locations.get(location) === 'levelWeights') {
        const weights = Array.from(value).slice(0, 4);
        if (String(stats.dotWeights.at(-1)) !== String(weights)) stats.dotWeights.push(weights);
        if (stats.dotWeights.length > 600) stats.dotWeights.shift();
      }
      vector.call(this, location, value, ...offsets);
    };
    proto.uniform4f = function (location, x, y, z, w) {
      if (location && locations.get(location) === 'latticeSpacings') {
        const spacings = [x, y, z, w];
        if (String(stats.dotLattices.at(-1)) !== String(spacings)) stats.dotLattices.push(spacings);
        if (stats.dotSpacings.at(-1) !== x) stats.dotSpacings.push(x);
      }
      if (location && locations.get(location) === 'levelWeights') {
        const weights = [x, y, z, w];
        if (String(stats.dotWeights.at(-1)) !== String(weights)) stats.dotWeights.push(weights);
        if (stats.dotWeights.length > 600) stats.dotWeights.shift();
      }
      scalarVector.call(this, location, x, y, z, w);
    };
    proto.linkProgram = function (program) { link.call(this, program); if (!this.getProgramParameter(program, this.LINK_STATUS)) stats.failures.push(this.getProgramInfoLog(program) ?? 'link failed'); };
  });
}
async function open(page: Page, input = query) {
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(input)));
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready');
}
async function search(page: Page) {
  const response = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'));
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  const initial = await (await response).json() as SearchRecovery;
  await expect(results(page)).toHaveAttribute('data-status', 'complete');
  return await (await page.request.get('/api/v1/searches/' + initial.snapshot.searchId)).json() as SearchRecovery;
}
async function pinFirst(page: Page) {
  const card=results(page).locator('article[data-price-card-id]').first(),control=card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true });await control.focus();await control.press('Space');await expect(card).toHaveAttribute('data-selected','true');
  await page.mouse.move(1439, 1);
  await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete', 'true', { timeout: 15000 });
}
async function assertRendering(page: Page) {
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready');
  await expect(map(page)).toBeVisible();
  const before = (await gpu(page)).draws;
  await expect.poll(async () => (await gpu(page)).draws).toBeGreaterThan(before);
  const state = await gpu(page); expect(state.failures).toEqual([]); expect(state.lost).toBe(0);
  const frame = JSON.parse((await map(page).locator('[data-camera]').getAttribute('data-camera'))!) as Record<string, number>;
  expect(Object.values(frame).every(Number.isFinite)).toBe(true); expect(frame['width']).toBeGreaterThan(0); expect(frame['height']).toBeGreaterThan(0);
  await expect(page.locator('[data-route-presentation]')).toHaveCount(1);
  await expect(page.locator('[data-journey-endpoint="origin"]')).toHaveCount(1);
  await expect(page.locator('[data-journey-endpoint="destination"]')).toHaveCount(1);
}
test.beforeEach(async ({ context, page }) => {
  mkdirSync(evidence, { recursive: true }); await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await context.request.post('/api/v1/demo/session', { data: { seed: 3333, anchorInstant: '2026-10-25T06:00:00Z' } })).status()).toBe(201);
  await observe(page);
});
test.afterEach(async ({ context }, info) => {
  const reset = await context.request.post('/api/v1/admin/reset', { data: {} });
  record('cleanup-' + info.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 80), { status: reset.status() }); expect(reset.status()).toBe(201);
});

test('@map-navigation canvas and endpoint overlay stay aligned when RTL pages gain a scrollbar', async ({ page }) => {
  await open(page, { ...query, scope: 'international', destinationCityId: 'van' });
  // Force the same reserved scrollbar gutter as the owner's visible Chrome window.
  await page.addStyleTag({ content: 'html { scrollbar-gutter: stable; }' });
  const measurements = [];
  for (const height of [1000, 768, 1200]) {
    await page.setViewportSize({ width: 1440, height });
    await assertRendering(page);
    // A rendered frame can precede R3F's ResizeObserver canvas-size commit.
    // Observe actual layout until the same original strict alignment is present;
    // retain the first and intermediate frames even if it never becomes aligned.
    const observation = await page.evaluate(async () => {
      const sample = () => {
        const canvas = document.querySelector<HTMLCanvasElement>('[data-active-scenes] canvas');
        const labels = document.querySelector<HTMLElement>('[data-graphics-label-layer]');
        const box = (node: Element | null) => { const rect = node?.getBoundingClientRect(); return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null; };
        const wrapper = canvas?.closest<HTMLElement>('[data-active-scenes]');
        return { at: performance.now(), canvas: box(canvas), labels: box(labels), wrapper: box(wrapper ?? null), canvasCount: document.querySelectorAll('[data-active-scenes] canvas').length, labelsCount: document.querySelectorAll('[data-graphics-label-layer]').length,
          canvasStyle: canvas?.getAttribute('style'), parentStyle: canvas?.parentElement?.getAttribute('style'), wrapperStyle: wrapper ? { width: getComputedStyle(wrapper).width, height: getComputedStyle(wrapper).height, position: getComputedStyle(wrapper).position, left: getComputedStyle(wrapper).left, right: getComputedStyle(wrapper).right } : null,
          backing: canvas ? { width: canvas.width, height: canvas.height } : null, endpoints: Array.from(labels?.querySelectorAll('[data-journey-endpoint]') ?? [], node => ({ role: node.getAttribute('data-journey-endpoint'), rect: box(node) })),
          viewport: { innerWidth, innerHeight, clientWidth: document.documentElement.clientWidth, root: box(document.documentElement), scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter, direction: getComputedStyle(document.documentElement).direction } };
      };
      const aligned = (value: ReturnType<typeof sample>) => {
        const { canvas, labels, wrapper } = value;
        return value.canvasCount === 1 && value.labelsCount === 1 && canvas !== null && labels !== null && wrapper !== null &&
          [canvas, labels, wrapper].every(rect => Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0) &&
          (['x', 'y', 'width', 'height'] as const).every(key => Math.abs(canvas[key] - labels[key]) < .05 && Math.abs(wrapper[key] - labels[key]) < .05);
      };
      const samples = [sample()], deadline = performance.now() + 5000;
      while (!aligned(samples.at(-1)!) && performance.now() < deadline) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        samples.push(sample());
      }
      return { samples, settled: aligned(samples.at(-1)!), elapsed: samples.at(-1)!.at - samples[0]!.at };
    });
    record('alignment-' + height, observation);
    expect(observation.settled).toBe(true);
    const measurement = observation.samples.at(-1)!;
    expect(measurement.canvas).not.toBeNull();expect(measurement.labels).not.toBeNull();
    if (!measurement.canvas || !measurement.labels) throw new Error('Expected the one renderer canvas and endpoint layer');
    expect(measurement.canvas.x).toBeCloseTo(measurement.labels.x, 1);
    expect(measurement.canvas.y).toBeCloseTo(measurement.labels.y, 1);
    expect(measurement.canvas.width).toBeCloseTo(measurement.labels.width, 1);
    expect(measurement.canvas.height).toBeCloseTo(measurement.labels.height, 1);
    measurements.push(measurement);
  }
  record('rtl-scrollbar-alignment', measurements);
  await page.screenshot({ path: resolve(evidence, 'single-endpoints.png') });
});

test('@map-navigation confirmed new tab preserves the selected comparison and map rendering survives native home Back/Forward', async ({ page, context }) => {
  test.setTimeout(90000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await context.route(/^https:\/\/zarei\.xyz(?:\/|$)/, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Approved placeholder intercepted</title>' }));
  await open(page, { ...query, scope: 'international', destinationCityId: 'van' }); const source=await search(page); await pinFirst(page); await assertRendering(page);
  const selected = await map(page).getAttribute('data-map-itinerary');
  const camera = await map(page).locator('[data-camera-intent]').getAttribute('data-camera-intent');
  const comparisonURL=page.url(),historyLength=await page.evaluate(()=>history.length),quoteId=await results(page).locator('article[data-selected="true"]').getAttribute('data-quote-id');
  const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&(r.url().endsWith('/api/v1/searches')||r.url().includes('/api/v1/referrals/')))writes.push(new URL(r.url()).pathname);});
  const prepare=page.waitForResponse(r=>r.url().endsWith('/api/v1/referrals/prepare')&&r.request().method()==='POST'),confirm=page.waitForResponse(r=>r.url().endsWith('/api/v1/referrals/confirm')&&r.request().method()==='POST');
  const popup=await expectPlaceholder(page,()=>results(page).locator(`article[data-selected="true"] [data-seller-link-quote-id="${quoteId}"]`).click());
  const checked=await prepare;expect(checked.status()).toBe(201);const recheck=RecheckResultSchema.parse(await checked.json());expect(recheck.status).toBe('ready');if(recheck.status!=='ready')throw new Error('Expected the selected normal quote to recheck');
  const confirmed=await confirm;expect(confirmed.status()).toBe(201);const receipt=ReferralReceiptSchema.parse(await confirmed.json());exactReceipt(receipt,recheck.intent);expect(receipt.selection.quoteId).toBe(quoteId);expect(receipt.payload.kind).toBe('transport');if(receipt.payload.kind!=='transport')throw new Error('Expected transport receipt');expect(receipt.payload.itinerary.itineraryId).toBe(selected);
  const read=await page.request.get('/api/v1/referrals/'+receipt.referralId);expect(read.status()).toBe(200);expect(ReferralReceiptSchema.parse(await read.json())).toEqual(receipt);
  await popup.close();await page.bringToFront();expect(page.url()).toBe(comparisonURL);expect(await page.evaluate(()=>history.length)).toBe(historyLength);await expect(results(page)).toHaveAttribute('data-search-id',source.snapshot.searchId);await expect(results(page).locator('article[data-selected="true"]')).toHaveAttribute('data-quote-id',quoteId!);await expect(map(page)).toHaveAttribute('data-map-itinerary',selected!);expect(await map(page).locator('[data-camera-intent]').getAttribute('data-camera-intent')).toBe(camera);await assertRendering(page);
  // Real home/query history remains navigable. Current new-tab handoff does
  // not create the legacy in-app provider checkpoint or provider history entry.
  await page.getByRole('link', { name: 'ترب تیکت، خانه', exact: true }).click();await expect(page).toHaveURL(new URL('/',comparisonURL).href);await assertRendering(page);
  for (let index = 0; index < 2; index++) {
    await page.goBack();await expect(page).toHaveURL(comparisonURL);await assertRendering(page);await expect(page.getByRole('combobox',{name:'مقصد',exact:true})).toHaveValue('وان');
    await page.goForward();await expect(page).toHaveURL(new URL('/',comparisonURL).href);await assertRendering(page);
  }
  await page.goBack();await expect(page).toHaveURL(comparisonURL);await assertRendering(page);
  await page.setViewportSize({ width: 390, height: 844 }); await expect(map(page)).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 }); await assertRendering(page);
  expect(writes).toEqual(['/api/v1/referrals/prepare','/api/v1/referrals/confirm']);expect(SearchRecoverySchema.parse(await(await page.request.get('/api/v1/searches/'+source.snapshot.searchId)).json()).snapshot).toEqual(source.snapshot);
  expect(errors).toEqual([]); record('navigation-resume', { errors, stats: await gpu(page), selected, camera, comparisonURL, historyLength, receipt, writes, currentBoundary:'Confirmed external new-tab navigation intercepted; original comparison preserved. Subsequent Back/Forward is actual home/query history, not a fabricated legacy provider entry.' });
  await page.screenshot({ path: resolve(evidence, 'navigation-resumed.png') });
});

test('@map-navigation editing flight to train cannot select an old flight and the fresh train uses rail rendering', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);const previous=await search(page);await pinFirst(page);const retired=await results(page).locator('article[data-price-card-id]').last().getByRole('button',{name:'انتخاب پیشنهاد',exact:true}).elementHandle();expect(retired).not.toBeNull();
  const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&(r.url().endsWith('/api/v1/searches')||r.url().includes('/api/v1/referrals/')))writes.push(new URL(r.url()).pathname);});
  await page.getByRole('radiogroup', { name: 'وسیله سفر', exact: true }).getByText('قطار', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'train');
  await expect(map(page)).not.toHaveAttribute('data-map-itinerary', /.+/);
  await expect(results(page).locator('article[data-price-card-id]')).toHaveCount(0);
  const retirement=await retired!.evaluate(node=>({connected:node.isConnected,inert:Boolean(node.closest('[inert]')),hidden:Boolean(node.closest('[aria-hidden="true"]'))}));expect(!retirement.connected||retirement.inert||retirement.hidden).toBe(true);
  await retired!.evaluate(node=>(node as HTMLButtonElement).click());await expect(map(page)).not.toHaveAttribute('data-map-itinerary',/.+/);expect(writes).toEqual([]);
  await expect(page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true }).getByRole('radio',{name:'صندلی (سالنی)',exact:true})).toBeChecked();
  const current = await search(page); expect(current.snapshot.query.mode).toBe('train');
  expect(current.snapshot.groups.length).toBeGreaterThan(0);
  expect(current.snapshot.groups.every(group => group.itinerary.mode === 'train')).toBe(true);
  await pinFirst(page); await assertRendering(page);
  await expect.poll(async () => (await gpu(page)).vehicleModes.includes(1)).toBe(true);
  await expect.poll(async () => (await gpu(page)).vehicleModes.includes(3)).toBe(true);
  expect(SearchRecoverySchema.parse(await(await page.request.get('/api/v1/searches/'+previous.snapshot.searchId)).json()).snapshot).toEqual(previous.snapshot);expect(writes).toEqual(['/api/v1/searches']);
  expect(errors).toEqual([]); record('train-after-flight', { query: current.snapshot.query, stats: await gpu(page), errors, retirement, writes, proof:'Late retired DOM event cannot restore flight selection; no claim of direct retained React callback execution.' });
  await page.screenshot({ path: resolve(evidence, 'train-after-flight.png') });
});

test('@map-navigation world borders and sparse labels persist through three dot-density crossfades', async ({ page }) => {
  test.setTimeout(90000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await page.getByRole('radiogroup', { name: 'محدوده سفر', exact: true }).getByText('بین‌المللی', { exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('');
  await expect(page.locator('[data-world-country-borders]')).not.toHaveAttribute('data-world-country-borders', '0');
  await expect.poll(async () => (await gpu(page)).dotSpacings.includes(4)).toBe(true);
  await page.waitForTimeout(1300);
  const world = await page.locator('[data-route-presentation]').getAttribute('data-map-dot-weights');
  const worldLabels = await page.locator('[data-context-city][data-visible="true"]').count();
  expect(worldLabels).toBeGreaterThan(0); expect(worldLabels).toBeLessThanOrEqual(6);
  await map(page).screenshot({ path: resolve(evidence, 'world-context.png') });
  await page.screenshot({ path: resolve(evidence, 'world-context-page.png') });
  await page.getByRole('combobox', { name: 'مقصد', exact: true }).fill('وان');
  await page.getByRole('option', { name: 'وان', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'مقصد', exact: true })).toHaveValue('وان');
  await page.waitForTimeout(1300); await assertRendering(page);
  const regional = await page.locator('[data-route-presentation]').getAttribute('data-map-dot-weights');
  await map(page).screenshot({ path: resolve(evidence, 'regional-context.png') });
  await page.screenshot({ path: resolve(evidence, 'regional-context-page.png') });
  const box = (await map(page).locator('[data-camera]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control');
  for (let index = 0; index < 5; index++) { await page.mouse.wheel(0, -80); await page.waitForTimeout(180); }
  await page.keyboard.up('Control'); await page.waitForTimeout(1300);
  const deep = await page.locator('[data-route-presentation]').getAttribute('data-map-dot-weights');
  const deepFrame = JSON.parse((await map(page).locator('[data-camera]').getAttribute('data-camera'))!);
  expect(deepFrame.zoom).toBe(8); expect(await page.locator('[data-context-city][data-visible="true"]').count()).toBeLessThanOrEqual(10);
  await map(page).screenshot({ path: resolve(evidence, 'deep-context.png') });
  await page.screenshot({ path: resolve(evidence, 'deep-context-page.png') });
  const stats = await gpu(page);
  expect(stats.dotWeights.length).toBeGreaterThan(10);
  expect(stats.dotLattices).toContainEqual([4, 1, .25, .0625]);
  for (let level = 0; level < 3; level++) expect(stats.dotWeights.some(weights => weights[level]! > .05 && weights[level + 1]! > .05)).toBe(true);
  expect(stats.dotWeights.every(weights => Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < .001)).toBe(true);
  expect(stats.failures).toEqual([]); expect(errors).toEqual([]);
  await page.keyboard.down('Control'); for (let index = 0; index < 5; index++) { await page.mouse.wheel(0, 80); await page.waitForTimeout(180); } await page.keyboard.up('Control');
  await page.waitForTimeout(1300); await assertRendering(page);
  record('world-zoom-density', { world, regional, deep, deepFrame, worldLabels, stats, errors });
});

test('@map-navigation domestic zoom keeps airy dots through successive density fades', async ({ page }) => {
  await open(page); await page.waitForTimeout(1300);
  await expect.poll(async () => (await gpu(page)).dotSpacings.includes(.44)).toBe(true);
  const box = (await map(page).locator('[data-camera]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control');
  for (let index = 0; index < 5; index++) { await page.mouse.wheel(0, -80); await page.waitForTimeout(180); }
  await page.keyboard.up('Control'); await page.waitForTimeout(1300);
  const stats = await gpu(page);
  expect(stats.dotLattices).toContainEqual([.44, .22, .11, .055]);
  const transitions = [0, 1, 2].filter(level => stats.dotWeights.some(weights => weights[level]! > .05 && weights[level + 1]! > .05));
  expect(transitions.length).toBeGreaterThanOrEqual(2);
  expect(stats.dotWeights.every(weights => Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < .001)).toBe(true);
  await expect(page.locator('[data-route-scene]')).toHaveAttribute('data-world-country-borders', '0');
  await expect(page.locator('[data-context-city]')).toHaveCount(0);
  expect(stats.failures).toEqual([]); expect(stats.lost).toBe(0);
  record('domestic-zoom-density', { transitions, stats });
  await map(page).screenshot({ path: resolve(evidence, 'domestic-deep-dots.png') });
});

test('@map-navigation sparse dots retain a dim geographic mouse trail after the cursor leaves', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const peak = (samples: number[]) => Math.max(0, ...samples.filter((_, index) => index % 4 === 3));
  const records = [];
  for (const scope of ['domestic', 'international'] as const) {
    await open(page, { ...query, scope, destinationCityId: scope === 'domestic' ? 'mashhad' : 'van' });
    await page.waitForTimeout(1300);
    await expect.poll(async () => (await gpu(page)).trailSamples.length).toBe(64);
    const box = (await map(page).locator('[data-camera]').boundingBox())!;
    const url = page.url();
    await map(page).screenshot({ path: resolve(evidence, scope + '-airy-dots.png') });
    await page.mouse.move(box.x + box.width * .36, box.y + box.height * .45);
    await expect.poll(async () => peak((await gpu(page)).trailSamples)).toBeGreaterThan(.1);
    const first = (await gpu(page)).trailSamples;
    const firstIndex = first.findIndex((value, index) => index % 4 === 3 && value > .1) - 3;
    const anchor = { x: first[firstIndex]!, y: first[firstIndex + 1]! };
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .45, { steps: 5 });
    await page.waitForTimeout(200);
    const moved = (await gpu(page)).trailSamples;
    const anchored = moved.some((value, index) => index % 4 === 0 && value === anchor.x && moved[index + 1] === anchor.y && moved[index + 3]! > .05);
    expect(anchored).toBe(true);
    const activeLocations = new Set(moved.filter((_, index) => index % 4 === 0 && moved[index + 3]! > .01));
    expect(activeLocations.size).toBeGreaterThan(1);
    await page.mouse.move(1439, 1);
    await page.waitForTimeout(250);
    const lingering = (await gpu(page)).trailSamples;
    expect(peak(lingering)).toBeGreaterThan(.05);
    expect(peak(lingering)).toBeLessThanOrEqual(1);
    await map(page).screenshot({ path: resolve(evidence, scope + '-lingering-trail.png') });
    await expect.poll(async () => peak((await gpu(page)).trailSamples), { timeout: 3500 }).toBe(0);
    const faded = (await gpu(page)).trailSamples;
    expect(page.url()).toBe(url);
    await expect(map(page)).not.toHaveAttribute('data-map-itinerary', /.+/);
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
    await expect.poll(async () => peak((await gpu(page)).trailSamples)).toBeGreaterThan(.1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-reduced-motion', 'true');
    await expect.poll(async () => peak((await gpu(page)).trailSamples)).toBe(0);
    const reduced = await gpu(page);
    expect(reduced.failures).toEqual([]); expect(reduced.lost).toBe(0);
    records.push({ scope, anchor, moved, lingering, faded, reduced });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.mouse.move(1439, 1);
  }
  expect(errors).toEqual([]); record('pointer-trail', { records, errors });
});
