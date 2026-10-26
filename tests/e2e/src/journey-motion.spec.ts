import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TransportSearchQuery } from '@torob-ticket/contracts';

const evidence = resolve(process.env.JOURNEY_MOTION_EVIDENCE_DIR ?? 'docs/evidence/adjustments/compact-journey/browser');
const base: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
interface Draw { mode: number; opacity: number; blur: number; angle: number; x: number; y: number; time: number }
interface Observed { morph: number[]; opacity: number[]; particles: number[]; vehicles: Draw[]; failures: string[]; lost: number }
const read = (page: Page) => page.evaluate(() => (window as unknown as { journeyGPU: Observed }).journeyGPU);
const save = (name: string, value: unknown) => writeFileSync(resolve(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n');
async function observe(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('torobticket.appearance', 'dark');
    const stats: Observed = { morph: [], opacity: [], particles: [], vehicles: [], failures: [], lost: 0 }; Object.assign(window, { journeyGPU: stats });
    document.addEventListener('webglcontextlost', () => stats.lost++, true);
    const gl = WebGL2RenderingContext.prototype;
    const locations = new WeakMap<WebGLUniformLocation, { name: string; program: WebGLProgram }>();
    const programs = new WeakMap<WebGLProgram, { mode?: number; opacity: number; blur: number; matrix: number[]; morph: boolean }>();
    let current: WebGLProgram | null = null;
    const find = gl.getUniformLocation, use = gl.useProgram, scalar = gl.uniform1f, matrix = gl.uniformMatrix4fv, link = gl.linkProgram;
    gl.getUniformLocation = function(program, name) { const location = find.call(this, program, name); if (location) locations.set(location, { name, program }); return location; };
    gl.useProgram = function(program) { current = program; if (program && !programs.has(program)) programs.set(program, { opacity: 1, blur: 0, matrix: [], morph: false }); use.call(this, program); };
    gl.uniform1f = function(location, value) {
      const record = location && locations.get(location), state = record && programs.get(record.program);
      if (record && state) {
        if (record.name === 'vehicleMode') state.mode = value;
        if (record.name === 'vehicleOpacity') state.opacity = value;
        if (record.name === 'vehicleBlur') state.blur = value;
        if (record.name === 'morphProgress') { state.morph = true; stats.morph.push(value); if (stats.morph.length > 800) stats.morph.shift(); }
        if (record.name === 'morphOpacity') { stats.opacity.push(value); if (stats.opacity.length > 800) stats.opacity.shift(); }
      }
      scalar.call(this, location, value);
    };
    gl.uniformMatrix4fv = function(location, transpose, values, ...offsets) { const record = location && locations.get(location), state = record && programs.get(record.program); if (state && record?.name === 'modelViewMatrix') state.matrix = Array.from(values); matrix.call(this, location, transpose, values, ...offsets); };
    gl.linkProgram = function(program) { link.call(this, program); if (!this.getProgramParameter(program, this.LINK_STATUS)) stats.failures.push(this.getProgramInfoLog(program) ?? 'link failed'); };
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'] as const) {
      const original = gl[name];
      Object.defineProperty(gl, name, { configurable: true, value: function(this: WebGL2RenderingContext, ...args: number[]) {
        const state = current && programs.get(current);
        if (state?.morph) { const count = name.startsWith('drawArrays') ? args[2]! : args[1]!; if (!stats.particles.includes(count)) stats.particles.push(count); }
        if (state?.mode !== undefined && state.matrix.length === 16 && stats.vehicles.length < 6000) stats.vehicles.push({ mode: state.mode, opacity: state.opacity, blur: state.blur, angle: Math.atan2(state.matrix[1]!, state.matrix[0]!), x: state.matrix[12]!, y: state.matrix[13]!, time: performance.now() });
        return Reflect.apply(original, this, args);
      } });
    }
  });
}
async function open(page: Page, query = base) {
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready');
}
async function select(page: Page) {
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  const results = page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
  await expect(results).toHaveAttribute('data-status', 'complete');
  await results.locator('article[data-group-id]').first().getByRole('button', { name: 'انتخاب پیشنهاد', exact: true }).click();
  await page.mouse.move(1439, 1);
}
test.beforeEach(async ({ context, page }) => {
  mkdirSync(evidence, { recursive: true }); await page.setViewportSize({ width: 1440, height: 900 });
  expect((await context.request.post('/api/v1/demo/session', { data: { seed: 3333, anchorInstant: '2026-10-25T06:00:00Z' } })).status()).toBe(201);
  await observe(page);
});
test.afterEach(async ({ context }, info) => {
  const response = await context.request.post('/api/v1/admin/reset', { data: {} }); expect(response.status()).toBe(201);
  save('cleanup-' + info.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 70), { status: response.status() });
});

test('@journey-motion Iran and world morph through rapid reversals while endpoint exits fade', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await open(page); await page.waitForTimeout(900);
  const scope = page.getByRole('radiogroup', { name: 'محدوده سفر', exact: true });
  await scope.getByText('بین‌المللی', { exact: true }).click();
  await expect.poll(async () => (await read(page)).morph.some(value => value > .35 && value < .65)).toBe(true);
  await page.screenshot({ path: resolve(evidence, 'scope-morph-in-flight.png') });
  await scope.getByText('داخلی', { exact: true }).click();
  await page.waitForTimeout(180); await scope.getByText('بین‌المللی', { exact: true }).click();
  await expect.poll(async () => (await read(page)).morph.at(-1)).toBe(1);
  const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
  await destination.fill('وان'); await page.getByRole('option', { name: 'وان', exact: true }).click(); await page.waitForTimeout(1000);
  await expect(page.locator('[data-journey-endpoint="origin"]')).toHaveCount(1); await expect(page.locator('[data-journey-endpoint="destination"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'پاک کردن مقصد', exact: true }).click();
  await expect(page.locator('[data-journey-endpoint="destination"]')).toHaveCount(0);
  const ghost = page.locator('[data-endpoint-ghost][data-endpoint-role="destination"]');
  await expect(ghost).toHaveCount(1); await expect(ghost).toHaveAttribute('aria-hidden', 'true');
  const fading = await ghost.locator(':scope > div').evaluate(node => ({ animation: getComputedStyle(node).animationName, duration: getComputedStyle(node).animationDuration }));
  expect(fading.animation).not.toBe('none'); expect(parseFloat(fading.duration)).toBeGreaterThan(0);
  await expect(ghost).toHaveCount(0); await page.keyboard.press('Escape');
  const stats = await read(page); expect(stats.particles.some(count => count > 50)).toBe(true); expect(Math.max(...stats.particles)).toBeLessThanOrEqual(1800);
  expect(stats.morph.filter((value, i, values) => i > 0 && value < values[i - 1]!).length).toBeGreaterThanOrEqual(2);
  expect(stats.opacity.some(value => value > 0 && value < 1)).toBe(true); expect(stats.failures).toEqual([]); expect(stats.lost).toBe(0); expect(errors).toEqual([]);
  save('morph-and-endpoint-fade', { stats, errors, fading });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await scope.getByText('داخلی', { exact: true }).click();
  await expect.poll(async () => (await read(page)).morph.at(-1)).toBe(1); await expect(page.locator('[data-endpoint-ghost]')).toHaveCount(0);
});

test('@journey-motion all vehicles follow tangents with soft loop ends and two train wagons', async ({ page }) => {
  test.setTimeout(120000); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const mode of ['flight', 'train', 'bus'] as const) {
    await open(page, { ...base, mode, classCode: mode === 'flight' ? 'economy' : mode === 'train' ? 'seat' : 'standard' }); await select(page);
    await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete', 'true', { timeout: 20000 });
    const code = mode === 'flight' ? 0 : mode === 'train' ? 1 : 2;
    await expect.poll(async () => (await read(page)).vehicles.filter(draw => draw.mode === code).some(draw => draw.opacity > .2 && draw.opacity < .8 && draw.blur > .2)).toBe(true);
    if (mode === 'train') await expect.poll(async () => (await read(page)).vehicles.filter(draw => draw.mode === 3 && draw.opacity > .8).length).toBeGreaterThan(10);
    const stats = await read(page), heads = stats.vehicles.filter(draw => draw.mode === code && draw.opacity > .8);
    expect(heads.length).toBeGreaterThan(5); expect(heads.every(draw => Number.isFinite(draw.angle))).toBe(true);
    if (mode === 'flight' || mode === 'bus') expect(Math.max(...heads.map(draw => draw.angle)) - Math.min(...heads.map(draw => draw.angle))).toBeGreaterThan(.05);
    if (mode === 'train') {
      const wagonFrames = stats.vehicles.filter(draw => draw.mode === 3 && draw.opacity > .8);
      const pair = wagonFrames.some((draw, index) => { const next = wagonFrames[index + 1]; return next && next.time - draw.time < 4 && Math.hypot(next.x - draw.x, next.y - draw.y) > .001; });
      expect(pair).toBe(true);
    }
    expect(stats.vehicles.some(draw => draw.mode === code && draw.opacity < .1 && draw.blur > .9)).toBe(true);
    expect(stats.failures).toEqual([]); expect(stats.lost).toBe(0);
    await expect.poll(async () => { const value = Number(await page.locator('[data-route-presentation]').getAttribute('data-route-travel')); return value > .48 && value < .68; }, { intervals: [80], timeout: 18000 }).toBe(true);
    await page.screenshot({ path: resolve(evidence, `vehicle-${mode}.png`) }); save(`vehicle-${mode}`, stats);
  }
  expect(errors).toEqual([]); save('vehicle-errors', errors);
});
