import type { Locator, Page, Request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatePriceQuerySchema, DatePriceSnapshotSchema, SearchRecoverySchema, SearchRequestSchema, TransportSearchQuerySchema, type DatePriceSnapshot, type SearchRequest } from '@torob-ticket/contracts';
import { test as ownedTest, expect, currentDatePrices, dateExplorer, readSearch, resultRegion, runSearch, waitForSearch } from '../fixtures';
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
async function ready(page: Page) { await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30_000 }); }
async function graphicsReady(page: Page) { await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready', { timeout: 45_000 }); }
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

const test = ownedTest.extend({
  reviewer: async ({ newReviewer }, use, info) => {
    const reviewer = await newReviewer({ seed: 1616, scenario: 'normal', anchorInstant: '2026-11-01T00:00:00Z', viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    record(info.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 80) + '-session.json', { session: reviewer.session, viewport: reviewer.page.viewportSize() });
    await use(reviewer);
  },
});
test.use({ trace: 'off' });

function searchRequests(page: Page): SearchRequest[] {
  const requests: SearchRequest[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/searches') requests.push(SearchRequestSchema.parse(request.postDataJSON()));
  });
  return requests;
}
function urlQuery(page: Page) {
  const value = new URL(page.url()).searchParams.get('q'); expect(value).toBeTruthy();
  return TransportSearchQuerySchema.parse(JSON.parse(value!));
}
/** Measure the rendered row pitch and selected center; never assume the old wheel height. */
async function wheelGeometry(wheel: Locator) {
  await wheel.scrollIntoViewIfNeeded();
  const geometry = await wheel.evaluate(node => {
    const box = node.getBoundingClientRect(), rows = Array.from(node.querySelectorAll('[role="option"]'));
    const index = rows.findIndex(row => row.getAttribute('aria-selected') === 'true');
    const selected = rows[index]!.getBoundingClientRect(), adjacent = rows[index + 1] ?? rows[index - 1]!;
    const pitch = Math.abs(adjacent.getBoundingClientRect().top - selected.top);
    return { x: box.x + box.width / 2, y: selected.y + selected.height / 2, pitch, index, rows: rows.length, top: box.top, bottom: box.bottom, selectedHeight: selected.height };
  });
  expect(geometry.pitch).toBeGreaterThan(0); expect(geometry.pitch).toBeCloseTo(geometry.selectedHeight, 3);
  expect(geometry.y).toBeGreaterThan(geometry.top); expect(geometry.y).toBeLessThan(geometry.bottom);
  return geometry;
}
async function chooseLeg(page: Page, leg: 'outbound' | 'return') {
  const radio = page.getByRole('radiogroup', { name: 'جستجو بر اساس', exact: true }).getByRole('radio', { name: leg === 'outbound' ? 'تاریخ رفت' : 'تاریخ برگشت', exact: true });
  await radio.focus(); await radio.press('Space');
  await expect(dateExplorer(page)).toHaveAttribute('data-date-leg', leg);
}
async function responsiveChartLayout(page: Page, columns: number) {
  const layout = await page.getByLabel('نمودار کمترین قیمت واجد شرایط به تاریخ حرکت', { exact: true }).evaluate(node => {
    const plot = node.parentElement!, grid = plot.parentElement!.parentElement!, box = node.getBoundingClientRect(), style = getComputedStyle(grid);
    const tracks = (style.gridTemplateColumns.match(/[\d.]+px/g) ?? []).map(value => parseFloat(value));
    const number = (name: string) => parseFloat(style.getPropertyValue(name));
    return { viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, direction: getComputedStyle(document.documentElement).direction, tracks, gap: parseFloat(style.columnGap), gridWidth: grid.getBoundingClientRect().width, plot: { x: box.x, right: box.right, width: box.width, height: box.height }, expectedHeight: number('--date-wheel-height') + number('--date-stack-gap') + number('--date-calendar-height') };
  });
  expect(layout.direction).toBe('rtl'); expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.tracks).toHaveLength(columns);
  expect(layout.tracks.reduce((sum, width) => sum + width, 0) + layout.gap * (columns - 1)).toBeCloseTo(layout.gridWidth, 1);
  expect(layout.plot.width).toBeCloseTo(layout.tracks.at(-1)!, 1); expect(layout.plot.height).toBeCloseTo(layout.expectedHeight, 1);
  expect(layout.plot.x).toBeGreaterThanOrEqual(0); expect(layout.plot.right).toBeLessThanOrEqual(layout.viewportWidth);
  return layout;
}

test.describe('@dates real date exploration', () => {
  test('actual batch prices, physical drag preview/single settle, cancel, chart sync and native scrolling', async ({ reviewer }) => {
    const { page } = reviewer, requests = searchRequests(page), datePosts: unknown[] = [];
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/date-prices')) datePosts.push(request.postDataJSON()); });
    await page.goto('/'); await ready(page); expect(requests).toHaveLength(0);
    const actual = await currentDatePrices(reviewer), date = (await dateExplorer(page).getAttribute('data-selected-outbound'))!;
    const wheel = page.getByRole('listbox', { name: 'روزهای نزدیک', exact: true }), geometry = await wheelGeometry(wheel);
    await page.mouse.move(geometry.x, geometry.y); await page.mouse.down(); await page.mouse.move(geometry.x, geometry.y - geometry.pitch, { steps: 6 });
    await expect(wheel).toHaveAttribute('data-preview-date', addDays(date, 1));
    await expect(page.locator('[data-chart-selected]')).toHaveAttribute('data-chart-selected', addDays(date, 1)); expect(requests).toHaveLength(0);
    await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeDisabled();
    const batchesBeforeSettle = datePosts.length, releaseAt = Date.now();
    const drag = await runSearch(reviewer, () => page.mouse.up()), elapsed = Date.now() - releaseAt;
    expect(drag.snapshot.query.departureDate).toBe(addDays(date, 1)); expect(requests).toHaveLength(1);
    await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', addDays(date, 1)); await ready(page);
    expect(datePosts).toHaveLength(batchesBeforeSettle); await expect(dateExplorer(page)).toHaveAttribute('data-date-price-id', actual.datePriceId);
    const cancelGeometry = await wheelGeometry(wheel);
    await page.mouse.move(cancelGeometry.x, cancelGeometry.y); await page.mouse.down(); await page.mouse.move(cancelGeometry.x, cancelGeometry.y - cancelGeometry.pitch, { steps: 4 });
    await expect(wheel).toHaveAttribute('data-preview-date', addDays(date, 2));
    await wheel.dispatchEvent('pointercancel', { pointerId: 1 }); await page.mouse.up();
    // Negative observation spans the real250ms settle timer after cancellation.
    await page.waitForTimeout(350); expect(requests).toHaveLength(1);
    await expect(wheel).toHaveAttribute('data-preview-date', addDays(date, 1));
    await expect(page.locator('[data-chart-selected]')).toHaveAttribute('data-chart-selected', addDays(date, 1));
    const slider = page.getByRole('slider', { name: 'انتخاب روز از نمودار', exact: true }); await slider.focus();
    const chart = await runSearch(reviewer, () => slider.press('ArrowRight')); expect(chart.snapshot.query.departureDate).toBe(addDays(date, 2));
    await expect(wheel).toHaveAttribute('data-preview-date', addDays(date, 2)); await ready(page); await wheel.focus();
    const keyboard = await runSearch(reviewer, () => page.keyboard.press('ArrowDown')); expect(keyboard.snapshot.query.departureDate).toBe(addDays(date, 3)); await ready(page);
    const wheelMotion = await wheelGeometry(wheel); await page.mouse.move(wheelMotion.x, wheelMotion.y);
    const scrolled = await runSearch(reviewer, () => page.mouse.wheel(0, wheelMotion.pitch)); expect(scrolled.snapshot.query.departureDate).toBe(addDays(date, 4));
    await expect(wheel).toHaveAttribute('data-preview-date', addDays(date, 4));
    const atEnd = await runSearch(reviewer, () => wheel.press('End')); expect(atEnd.snapshot.query.departureDate).toBe(addDays(date, geometry.rows - 1)); await ready(page);
    const edge = await wheelGeometry(wheel), before = await page.evaluate(() => scrollY);
    const routeMap = page.getByRole('complementary', { name: 'نقشه سفر', exact: true }), mapBefore = await routeMap.boundingBox();
    await page.mouse.move(edge.x, edge.y); await page.mouse.wheel(0, edge.pitch * 5);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
    const after = await page.evaluate(() => scrollY), mapAfter = await routeMap.boundingBox(); expect(mapAfter).toEqual(mapBefore); expect(requests).toHaveLength(5);
    expect(urlQuery(page)).toEqual(atEnd.snapshot.query);
    if (evidence) { await page.screenshot({ path: resolve(evidence, 'dates-viewport.png') }); await page.screenshot({ path: resolve(evidence, 'dates-desktop.png'), fullPage: true }); }
    record('actual-drag.json', { session: reviewer.session, actual, geometry, cancelGeometry, wheelMotion, requests, drag, chart, keyboard, scrolled, atEnd, datePosts, settleObservedMs: elapsed, cancellationInput: 'Explicit pointercancel after native mouse drag; no synthetic selection/commit', nativeScroll: { before, after, mapBefore, mapAfter } });
  });

  test('provisional Jalali month jump/cancel/focus, same-day return, invalidated return reselection', async ({ reviewer }) => {
    const { page } = reviewer, requests = searchRequests(page);
    await page.goto('/'); await ready(page); const original = (await dateExplorer(page).getAttribute('data-selected-outbound'))!, url = page.url();
    const trigger = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }); await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true }); await expect(dialog).toBeVisible();
    const months = dialog.getByLabel('رفتن به ماه جلالی', { exact: true }), options = await months.locator('option').all(); expect(options.length).toBeGreaterThan(2);
    await months.selectOption((await options[1]!.getAttribute('value'))!); await ready(page);
    await expect(dialog.getByRole('grid')).toBeVisible(); await dialog.getByText('ورود تاریخ میلادی', { exact: true }).click();
    await dialog.getByLabel('تاریخ رفت میلادی در تقویم', { exact: true }).fill(addDays(original, 3));
    expect(requests).toHaveLength(0); expect(page.url()).toBe(url);
    if (evidence) await page.screenshot({ path: resolve(evidence, 'calendar-desktop.png') });
    await dialog.getByRole('button', { name: 'انصراف', exact: true }).click(); await expect(trigger).toBeFocused();
    await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', original);
    const roundTrip = page.getByRole('radio', { name: 'رفت‌وبرگشت', exact: true }); await roundTrip.focus(); await roundTrip.press('Space');
    await expect(dateExplorer(page)).toHaveAttribute('data-selected-return', addDays(original, 3)); expect(requests).toHaveLength(0);
    await trigger.click(); await dialog.getByLabel('بخش سفر در تقویم', { exact: true }).selectOption('return');
    await dialog.getByText('ورود تاریخ میلادی', { exact: true }).click(); await dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true }).fill(original);
    const sameDay = await runSearch(reviewer, () => dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click());
    expect(sameDay.snapshot.query.departureDate).toBe(original); expect(sameDay.snapshot.query.returnDate).toBe(original); expect(sameDay.snapshot.query.tripType).toBe('round-trip');
    expect(requests).toHaveLength(1); await expect(dateExplorer(page)).toHaveAttribute('data-selected-return', original);
    const committed = page.url(); await chooseLeg(page, 'outbound'); await ready(page); await page.getByRole('button', { name: 'روز بعد', exact: true }).click();
    await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', addDays(original, 1)); await expect(dateExplorer(page)).toHaveAttribute('data-selected-return', '');
    const invalidSubmit = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true });
    // Invalid intent remains invokable so inline validation can explain it.
    await expect(invalidSubmit).toBeEnabled(); await expect(invalidSubmit).toHaveAttribute('data-invalid', 'true');
    await page.waitForTimeout(350); expect(requests).toHaveLength(1); expect(page.url()).toBe(committed);
    await invalidSubmit.click(); await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAccessibleDescription('تاریخ برگشت را انتخاب کنید.');
    expect(requests).toHaveLength(1); expect(page.url()).toBe(committed);
    await trigger.click(); await dialog.getByLabel('بخش سفر در تقویم', { exact: true }).selectOption('return');
    await dialog.getByText('ورود تاریخ میلادی', { exact: true }).click(); await dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true }).fill(addDays(original, 2));
    const reselected = await runSearch(reviewer, () => dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click());
    expect(reselected.snapshot.query.departureDate).toBe(addDays(original, 1)); expect(reselected.snapshot.query.returnDate).toBe(addDays(original, 2)); expect(requests).toHaveLength(2);
    await expect(trigger).toBeFocused(); expect(urlQuery(page)).toEqual(reselected.snapshot.query);
    record('calendar-roundtrip.json', { session: reviewer.session, original, requests, sameDay, reselected, automaticReturn: addDays(original, 3), cancelPreservedUrl: true, invalidPairDidNotSearch: true });
  });

  test('actual no-match remains selectable and transport failure has recovery without a false no-match', async ({ newReviewer }) => {
    const empty = await newReviewer({ seed: 1616, anchorInstant: '2026-10-25T00:00:00Z', scenario: 'no-eligible-results' }), emptyPage = empty.page;
    const emptyRequests = searchRequests(emptyPage); record('no-match-session.json', empty.session);
    await emptyPage.goto('/'); await ready(emptyPage); await expect(emptyPage.getByText('پیشنهاد مطابق نیست', { exact: true }).first()).toBeVisible();
    const actualSnapshot = await currentDatePrices(empty); expect(actualSnapshot.cells.length).toBeGreaterThan(0); expect(actualSnapshot.cells.every(cell => cell.status === 'no-match' && cell.coverage.complete)).toBe(true);
    const original = (await dateExplorer(emptyPage).getAttribute('data-selected-outbound'))!;
    const selected = await runSearch(empty, () => emptyPage.getByRole('button', { name: 'روز بعد', exact: true }).click());
    expect(selected.snapshot.query.departureDate).toBe(addDays(original, 1)); expect(selected.snapshot.status).toBe('empty'); expect(selected.snapshot.coverage.complete).toBe(true); expect(selected.snapshot.groups).toEqual([]);
    expect(emptyRequests).toHaveLength(1); expect(urlQuery(emptyPage)).toEqual(selected.snapshot.query);

    const failed = await newReviewer({ seed: 1616, anchorInstant: '2026-10-25T00:00:00Z', scenario: 'normal' }), page = failed.page;
    record('transport-failure-session.json', failed.session); await page.clock.install({ time: Date.now() });
    let fail = true, attempts = 0, retryGeneration = '', failedRetryGeneration = '';
    let retryRequest: Request | undefined, releaseRetry!: () => void;
    const retryGate = new Promise<void>(resolve => { releaseRetry = resolve; });
    const onRequestFailed = (request: Request) => { if (request === retryRequest) failedRetryGeneration = retryGeneration; };
    page.on('requestfailed', onRequestFailed);
    await page.route('**/api/v1/date-prices', async route => {
      if (route.request().method() === 'POST') {
        attempts++;
        if (fail) {
          if (attempts === 2) { retryRequest = route.request(); retryGeneration = DatePriceQuerySchema.parse(retryRequest.postDataJSON()).clientGeneration; await retryGate; }
          await route.abort('internetdisconnected'); return;
        }
      }
      await route.continue();
    });
    const requests = searchRequests(page);
    try {
      await page.goto('/');
      const alert = page.getByRole('alert').filter({ hasText: 'قیمت روزها دریافت نشد' }); await expect(alert).toBeVisible(); expect(attempts).toBe(1);
      const unchanged = { url: page.url(), date: await dateExplorer(page).getAttribute('data-selected-outbound') };
      await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'unavailable');
      await expect(page.getByText('پیشنهاد مطابق نیست', { exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'تلاش دوباره برای قیمت روزها' })).toHaveCount(0);
      await page.clock.fastForward(2000); await expect.poll(() => attempts).toBe(2);
      // Request entry and the previous alert cannot settle a fresh failure.
      // Hold this exact generation until its public checking state is current.
      expect(retryGeneration).not.toBe('');
      await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'checking'); await expect(alert).toHaveCount(0);
      releaseRetry(); await expect.poll(() => failedRetryGeneration).toBe(retryGeneration);
      await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'unavailable'); await expect(alert).toBeVisible();
      await page.clock.fastForward(61_000); expect(attempts).toBe(2); expect(requests).toHaveLength(0);
      fail = false; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await ready(page); expect(attempts).toBe(3);
      const recovered = await currentDatePrices(failed); expect(recovered.cells.some(cell => cell.status === 'priced')).toBe(true);
      expect(recovered.cells.some(cell => cell.status === 'no-match')).toBe(false); expect(page.url()).toBe(unchanged.url); await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', unchanged.date!);
      record('no-match-recovery.json', { actualScenario: 'no-eligible-results', actualSnapshot, selected, networkFailure: 'Two Playwright transport aborts in a separately owned normal namespace; no provider evidence altered', attempts, unchanged, recovered, oneQuietRetry: true, onlineRecovery: true, retrySettlement: { retryGeneration, failedRetryGeneration, publicTransition: 'checking to unavailable before quiet interval and online event' } });
    } finally { releaseRetry(); page.off('requestfailed', onRequestFailed); }
  });

  test('mobile physical touch drag keeps the chart and calendar usable', async ({ newReviewer, browserName }) => {
    test.skip(browserName !== 'chromium', 'Physical CDP touch injection is Chromium-specific; portable keyboard/date coverage runs separately.');
    const reviewer = await newReviewer({ seed: 1618, anchorInstant: '2026-11-01T00:00:00Z', scenario: 'normal', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const { page, context } = reviewer, cdp = await context.newCDPSession(page), requests = searchRequests(page); record('mobile-session.json', reviewer.session);
    try {
      await page.goto('/'); await ready(page); expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
      const date = (await dateExplorer(page).getAttribute('data-selected-outbound'))!, wheel = page.getByRole('listbox', { name: 'روزهای نزدیک', exact: true }), geometry = await wheelGeometry(wheel);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: geometry.x, y: geometry.y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: geometry.x, y: geometry.y - geometry.pitch }] });
      await expect(wheel).toHaveAttribute('data-preview-date', addDays(date, 1)); expect(requests).toHaveLength(0);
      const current = await runSearch(reviewer, () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
      expect(current.snapshot.query.departureDate).toBe(addDays(date, 1)); expect(requests).toHaveLength(1);
      await expect(page.getByLabel('نمودار کمترین قیمت واجد شرایط به تاریخ حرکت', { exact: true })).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveCount(0);
      const selected = resultRegion(page).getByRole('article').locator('xpath=self::article[@data-selected="true"]'); await expect(selected).toHaveCount(1);
      const groupId = await selected.getAttribute('data-group-id'), group = current.snapshot.groups.find(group => group.groupId === groupId); expect(group).toBeDefined();
      const mobileRoute = page.getByRole('region', { name: 'جزئیات مسیر سفر', exact: true });
      await expect(mobileRoute).toBeVisible(); await expect(mobileRoute).toHaveAttribute('data-mobile-itinerary', group!.itinerary.itineraryId);
      await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true }); await expect(dialog).toBeVisible(); await ready(page);
      const targets = await dialog.locator('[data-date]:not([data-outside-month])').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
      expect(targets.length).toBeGreaterThan(0); expect(targets.every(target => target.width >= 44 && target.height >= 44)).toBe(true);
      const apply = await dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).boundingBox(); expect(apply).toBeTruthy(); expect(apply!.y).toBeGreaterThanOrEqual(0); expect(apply!.y + apply!.height).toBeLessThanOrEqual(844);
      record('calendar-mobile-targets.json', { targets, apply }); if (evidence) await page.screenshot({ path: resolve(evidence, 'calendar-mobile.png') });
      await dialog.getByRole('button', { name: 'انصراف', exact: true }).click(); await ready(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); expect(requests).toHaveLength(1);
      if (evidence) await page.screenshot({ path: resolve(evidence, 'dates-mobile.png'), fullPage: true });
      record('touch.json', { session: reviewer.session, viewport: { width: 390, height: 844 }, actualCdpTouch: true, geometry, requests, current, date });
    } finally { await cdp.detach().catch(() => undefined); }
  });

  test('physical wheel row click commits the clicked noncenter day exactly once', async ({ reviewer }) => {
    const { page } = reviewer, requests = searchRequests(page); await page.goto('/'); await ready(page);
    const date = (await dateExplorer(page).getAttribute('data-selected-outbound'))!, wheel = page.getByRole('listbox', { name: 'روزهای نزدیک', exact: true }), geometry = await wheelGeometry(wheel);
    expect(geometry.index + 1).toBeLessThan(geometry.rows);
    const row = wheel.getByRole('option').nth(geometry.index + 1); await expect(row).toHaveAttribute('aria-selected', 'false');
    const rowBox = (await row.boundingBox())!; expect(rowBox.y + rowBox.height / 2).toBeLessThan(geometry.bottom);
    const current = await runSearch(reviewer, () => row.click()); expect(current.snapshot.query.departureDate).toBe(addDays(date, 1));
    await expect(wheel).toHaveAttribute('data-preview-date', addDays(date, 1)); await page.waitForTimeout(350); expect(requests).toHaveLength(1);
    record('physical-row-click.json', { geometry, rowBox, current, requests, duplicateSettle: false });
  });

  test('fast native Back fences a late actual start while a new explicit date intent survives', async ({ reviewer }) => {
    const { page } = reviewer, starts = searchRequests(page), requests: { id: string; date: string; generation: string }[] = [];
    let release!: () => void, settled = false, lateDelivery: 'fulfilled' | 'request-gone' | undefined;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/searches', async route => {
      const response = await route.fetch(); expect(response.status()).toBe(201); const body = SearchRecoverySchema.parse(await response.json());
      requests.push({ id: body.snapshot.searchId, date: body.snapshot.query.departureDate, generation: body.snapshot.clientGeneration });
      if (requests.length === 1) {
        await held;
        try { await route.fulfill({ response }); lateDelivery = 'fulfilled'; } catch { lateDelivery = 'request-gone'; }
        finally { settled = true; }
      } else await route.fulfill({ response });
    });
    try {
      await page.goto('/'); await ready(page); await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click(); await expect.poll(() => requests.length).toBe(1);
      await page.goBack(); await ready(page);
      const current = await runSearch(reviewer, () => page.getByRole('button', { name: 'روز بعد', exact: true }).click()); await expect.poll(() => requests.length).toBe(2);
      expect(current.snapshot.searchId).toBe(requests[1]!.id); expect(current.snapshot.clientGeneration).toBe(requests[1]!.generation); expect(current.snapshot.query.departureDate).not.toBe(requests[0]!.date);
      expect(urlQuery(page)).toEqual(current.snapshot.query); const latest = page.url(), itineraryId = await page.getByRole('complementary', { name: 'نقشه سفر', exact: true }).getAttribute('data-map-itinerary');
      expect(current.snapshot.groups.some(group => group.itinerary.itineraryId === itineraryId)).toBe(true);
      release(); await expect.poll(() => settled).toBe(true);
      const old = await waitForSearch(reviewer, requests[0]!.id); expect(old.snapshot.searchId).not.toBe(current.snapshot.searchId); expect(old.snapshot.status).toMatch(/^(complete|cancelled)$/);
      expect(page.url()).toBe(latest); await expect(resultRegion(page)).toHaveAttribute('data-search-id', current.snapshot.searchId); expect(await readSearch(reviewer, current.snapshot.searchId)).toEqual(current);
      await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-itinerary', itineraryId!); expect(starts).toHaveLength(2);
      record('fast-pop-new-intent.json', { session: reviewer.session, requests, latest, lateDelivery, old, current, itineraryId, proofLimit: 'Native Abort may discard the held201 before its ID reaches the client. The old owned search may complete; exact late-ID cancellation is separately asserted with an unabortable client in controller tests. This native case proves the latest explicit query/result/map authority survives the late real response.' });
    } finally { release(); }
  });

  test('Jalali leap-day keyboard navigation converts local dates without a UTC shift', async ({ newReviewer }) => {
    const reviewer = await newReviewer({ seed: 1617, anchorInstant: '2025-03-19T00:00:00Z', scenario: 'normal' }), { page } = reviewer, requests = searchRequests(page); record('leap-session.json', reviewer.session);
    await page.goto('/'); await ready(page); await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true }), leap = dialog.locator('[data-date="2025-03-20"]');
    await expect(leap).toBeVisible(); await leap.focus(); await page.keyboard.press('Enter');
    await expect(dialog.getByLabel('تاریخ رفت میلادی در تقویم', { exact: true })).toHaveValue('2025-03-20');
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter');
    await expect(dialog.getByLabel('تاریخ رفت میلادی در تقویم', { exact: true })).toHaveValue('2025-03-21'); expect(requests).toHaveLength(0);
    if (evidence) await page.screenshot({ path: resolve(evidence, 'calendar-leap-desktop.png') });
    const current = await runSearch(reviewer, () => dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click());
    expect(current.snapshot.query.departureDate).toBe('2025-03-21'); expect(requests).toHaveLength(1); expect(urlQuery(page)).toEqual(current.snapshot.query);
    await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', '2025-03-21');
    record('jalali-leap.json', { session: reviewer.session, leap: '1403-12-30', wireLeap: '2025-03-20', next: '1404-01-01', wireNext: '2025-03-21', keyboard: 'Enter,ArrowLeft RTL,Enter', current, requests });
  });

  test('actual native chart ribbon buffers preserve source prices, unavailable gaps and CSS-pixel width after resize', async ({ reviewer }) => {
    const { page } = reviewer; await observeNativeChartBuffers(page);
    let source: DatePriceSnapshot | undefined, rendered: DatePriceSnapshot | undefined;
    await page.route('**/api/v1/date-prices**', async route => {
      if (!['GET', 'POST'].includes(route.request().method())) { await route.continue(); return; }
      const response = await route.fetch(); if (!response.ok()) { await route.fulfill({ response }); return; }
      const snapshot = DatePriceSnapshotSchema.parse(await response.json()); if (snapshot.status !== 'complete') { await route.fulfill({ response }); return; }
      source = snapshot; const gapIndices = new Set([Math.floor(snapshot.cells.length / 3), Math.floor(snapshot.cells.length * 2 / 3)]);
      // Explicit response fixture removes two prices; all remaining numerical
      // prices and provenance are the unchanged real same-origin API response.
      rendered = DatePriceSnapshotSchema.parse({ ...snapshot, cells: snapshot.cells.map((cell, index) => gapIndices.has(index) && cell.status === 'priced' ? { date: cell.date, status: 'unavailable', reason: 'incomplete-price', retryable: false, coverage: cell.coverage } : cell) });
      await route.fulfill({ response, json: rendered });
    });
    await page.goto('/'); await ready(page); await graphicsReady(page); await expect.poll(() => rendered?.status).toBe('complete');
    const snapshot = rendered!; expect(snapshot.cells.filter(cell => cell.status === 'unavailable').length).toBeGreaterThanOrEqual(2); expect(priceChartGeometry(snapshot.cells).paths.length).toBeGreaterThan(1);
    const wide = await assertNativeChartBuffers(page, snapshot, 'native-chart-ribbon-wide.json'), desktopLayout = await responsiveChartLayout(page, 2);
    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await assertNativeChartBuffers(page, snapshot, 'native-chart-ribbon-narrow.json'), mobileLayout = await responsiveChartLayout(page, 1);
    // The one-column mobile plot may exceed one desktop column. Require the
    // actual changed CSS viewport and native resize, not a monotonic width rule.
    expect(Math.abs(narrow.viewport.width - wide.viewport.width)).toBeGreaterThan(1); expect(Math.abs(narrow.strokeCss - wide.strokeCss)).toBeLessThan(1.25);
    record('native-chart-ribbon-source.json', { session: reviewer.session, source, rendered: snapshot, wide, narrow, desktopLayout, mobileLayout, fixture: 'Playwright response fixture replaces two priced cells with explicit incomplete-price gaps; it never adds or changes a numerical price' });
  });

  test('actual GLSL compile/draw across six routes and themes, context loss fallback and restoration', async ({ reviewer }) => {
    test.setTimeout(180_000); const { page } = reviewer, requests = searchRequests(page);
    await transitionProbe(page); await observeNativeChartBuffers(page); await page.setViewportSize({ width: 1440, height: 1100 });
    await page.addInitScript(() => {
      const colorNames = ['priceLow', 'priceMid', 'priceHigh', 'chartGrid', 'chartMarker'] as const;
      const contexts: WebGL2RenderingContext[] = [], draws: { pixels: number[]; scissor: number[]; colors: Record<string, number[]>; kind: number; mode?: string; appearance?: string; datePriceId: string | null }[] = [], shaders: boolean[] = [], programs: boolean[] = [];
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement['getContext']>) {
        const result = original.apply(this, args); if (args[0] === 'webgl2' && result && !contexts.includes(result as WebGL2RenderingContext)) contexts.push(result as WebGL2RenderingContext); return result;
      } as HTMLCanvasElement['getContext'];
      const compile = WebGL2RenderingContext.prototype.compileShader;
      WebGL2RenderingContext.prototype.compileShader = function (shader) { compile.call(this, shader); shaders.push(this.getShaderParameter(shader, this.COMPILE_STATUS) as boolean); };
      const link = WebGL2RenderingContext.prototype.linkProgram;
      WebGL2RenderingContext.prototype.linkProgram = function (program) { link.call(this, program); programs.push(this.getProgramParameter(program, this.LINK_STATUS) as boolean); };
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        draw.apply(this, args); const program = this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram | null; if (!program) return;
        // Probe only the actual active date-chart palette. Its fragment shader
        // uses price bands; chartLine is not a declared/active uniform.
        const kind = this.getUniformLocation(program, 'kind'), colors = Object.fromEntries(colorNames.map(name => [name, this.getUniformLocation(program, name)] as const));
        if (!kind || colorNames.some(name => !colors[name])) return;
        const scissor = Array.from(this.getParameter(this.SCISSOR_BOX) as Int32Array), width = Math.min(512, Math.max(1, scissor[2]!)), height = Math.min(512, Math.max(1, scissor[3]!)), buffer = new Uint8Array(width * height * 4);
        this.readPixels(Math.max(0, scissor[0]!), Math.max(0, scissor[1]!), width, height, this.RGBA, this.UNSIGNED_BYTE, buffer);
        const hit = buffer.findIndex((value, index) => index % 4 === 3 && value > 0), pixel = hit >= 3 ? buffer.slice(hit - 3, hit + 1) : new Uint8Array(4);
        draws.push({ pixels: Array.from(pixel), scissor, colors: Object.fromEntries(colorNames.map(name => [name, Array.from(this.getUniform(program, colors[name]!) as Float32Array)])), kind: Number(this.getUniform(program, kind)), mode: document.documentElement.dataset['mode'], appearance: document.documentElement.dataset['appearance'], datePriceId: document.querySelector('[data-date-price-id]')?.getAttribute('data-date-price-id') ?? null });
        if (draws.length > 500) draws.shift();
      };
      (window as unknown as { gpu: unknown }).gpu = { contexts, draws, shaders, programs };
    });
    const readGpu = (datePriceId: string) => page.evaluate(datePriceId => {
      const { contexts, draws, shaders, programs } = (window as unknown as { gpu: { contexts: WebGL2RenderingContext[]; draws: { pixels: number[]; colors: Record<string, number[]>; kind: number; mode?: string; appearance?: string; datePriceId: string | null }[]; shaders: boolean[]; programs: boolean[] } }).gpu;
      const root = document.documentElement, cssPalette: Record<string, string> = {};
      const palette = [['priceLow', '--price-low'], ['priceMid', '--price-mid'], ['priceHigh', '--price-high'], ['chartGrid', '--chart-grid'], ['chartMarker', '--chart-marker']] as const;
      const resolvedLinear: Record<string, number[]> = Object.fromEntries(palette.map(([name, token]) => {
        const probe = document.createElement('span'); probe.style.color = `var(${token})`; document.body.append(probe); const normalized = getComputedStyle(probe).color; probe.remove(); cssPalette[name] = normalized;
        const channels = normalized.match(/[\d.]+/g)!.map(Number), linear = channels.slice(0, 3).map(value => value / 255 <= .04045 ? value / 255 / 12.92 : ((value / 255 + .055) / 1.055) ** 2.4); linear.push(channels[3] ?? 1);
        return [name, linear] as const;
      }));
      const current = draws.filter(draw => draw.datePriceId === datePriceId && draw.mode === root.dataset['mode'] && draw.appearance === root.dataset['appearance'] && Object.entries(resolvedLinear).every(([name, linear]) => draw.colors[name]?.length === 4 && draw.colors[name]!.every((value, index) => Math.abs(value - linear[index]!) < .0001)));
      const gl = contexts[0]; return { contexts: contexts.length, draws: current.slice(-6), recentDraws: draws.slice(-6), compiled: shaders, linked: programs, cssPalette, resolvedLinear, renderer: gl?.getParameter(gl.RENDERER), version: gl?.getParameter(gl.VERSION), mode: root.dataset['mode'], appearance: root.dataset['appearance'] };
    }, datePriceId);
    await page.goto('/'); await ready(page); await dateExplorer(page).scrollIntoViewIfNeeded(); await graphicsReady(page);
    const palettes = [];
    for (const mode of [{ id: 'flight', label: 'پرواز' }, { id: 'train', label: 'قطار' }, { id: 'bus', label: 'اتوبوس' }]) for (const scope of [{ id: 'domestic', label: 'داخلی' }, { id: 'international', label: 'بین‌المللی' }]) {
      await page.getByRole('button', { name: 'سفرهای پیشنهادی', exact: true }).click(); await page.getByRole('button', { name: new RegExp(`^${mode.label} ${scope.label} ·`) }).click(); await ready(page);
      const actual = await currentDatePrices(reviewer); expect(actual.query.query.mode).toBe(mode.id); expect(actual.query.query.scope).toBe(scope.id);
      for (const appearance of ['dark', 'light']) {
        if (await page.locator('html').getAttribute('data-appearance') !== appearance) await page.getByRole('button', { name: appearance === 'dark' ? 'نمای تیره' : 'نمای روشن', exact: true }).click();
        await settledTheme(page); await dateExplorer(page).scrollIntoViewIfNeeded(); await graphicsReady(page);
        try { await expect.poll(async () => (await readGpu(actual.datePriceId)).draws.some(draw => (draw.kind === 0 || draw.kind === 1) && draw.pixels[3]! > 0), { timeout: 45_000 }).toBe(true); }
        catch (error) { record('gpu-palette-failure.json', { mode: mode.id, scope: scope.id, appearance, actual, native: await readGpu(actual.datePriceId) }); throw error; }
        const state = await readGpu(actual.datePriceId); expect(state.contexts).toBe(1); expect(state.mode).toBe(mode.id); expect(state.appearance).toBe(appearance);
        expect(state.compiled.length).toBeGreaterThan(0); expect(state.linked.length).toBeGreaterThan(0); expect(state.compiled.every(Boolean)).toBe(true); expect(state.linked.every(Boolean)).toBe(true);
        palettes.push({ labelMode: mode.label, scope: scope.id, datePriceId: actual.datePriceId, ...state });
        if (evidence) await page.screenshot({ path: resolve(evidence, `chart-${mode.id}-${scope.id}-${appearance}.png`) });
      }
    }
    expect(palettes).toHaveLength(12); record('gpu-palettes-progress.json', { palettes }); expect(requests).toHaveLength(0);
    const nativeSnapshot = await currentDatePrices(reviewer); await assertNativeChartBuffers(page, nativeSnapshot, 'native-chart-buffer.json');
    const compiledBefore = palettes.at(-1)!.compiled.length; expect(compiledBefore).toBeGreaterThan(0);
    const lossSupported = await page.evaluate(() => {
      const gl = (window as unknown as { gpu: { contexts: WebGL2RenderingContext[] } }).gpu.contexts[0]!, extension = gl.getExtension('WEBGL_lose_context'); if (!extension) return false;
      (window as unknown as { dateRestore: () => void }).dateRestore = () => extension.restoreContext(); extension.loseContext(); return true;
    });
    expect(lossSupported).toBe(true); await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'context-lost');
    await expect(page.getByLabel('نمودار کمترین قیمت واجد شرایط به تاریخ حرکت', { exact: true }).locator('svg')).toBeVisible();
    const oldDate = (await dateExplorer(page).getAttribute('data-selected-outbound'))!;
    const current = await runSearch(reviewer, () => page.getByRole('button', { name: 'روز بعد', exact: true }).click());
    expect(current.snapshot.query.departureDate).toBe(addDays(oldDate, 1)); expect(urlQuery(page)).toEqual(current.snapshot.query); expect(requests).toHaveLength(1);
    await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'context-lost'); await expect(page.getByLabel('نمودار کمترین قیمت واجد شرایط به تاریخ حرکت', { exact: true }).locator('svg')).toBeVisible();
    await page.evaluate(() => (window as unknown as { dateRestore: () => void }).dateRestore()); await graphicsReady(page); await ready(page);
    const restoredSnapshot = await currentDatePrices(reviewer); await assertNativeChartBuffers(page, restoredSnapshot, 'native-chart-restored-buffer.json');
    await expect(resultRegion(page)).toHaveAttribute('data-search-id', current.snapshot.searchId);
    record('gpu-palettes.json', { session: reviewer.session, palettes, actualContextLoss: true, current, requests, restoredSnapshot, selectionDuringFallback: true, restored: true, userAgent: await page.evaluate(() => navigator.userAgent) });
  });
});
