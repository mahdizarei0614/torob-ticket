import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.env.PARTICLE_BLOOM_EVIDENCE_DIR ?? '.local/evidence/adjustments/staggered-particles-bloom/native-bloom');
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-01', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
interface PixelReceipt { viewport: number[]; scissor: number[]; scissorEnabled: boolean; canvas: number[]; changedInside: number; changedOutside: number; changedRight: number; clearEdgePixels: number; edgePixels: number; beforeAfterStateEqual: boolean; maxChange: number; error: number }
interface BloomProof { draws: number; ordinaryDraws: number; compositePrograms: number; floatAllocations: number; contextCanvases: number; pixel?: PixelReceipt; errors: string[]; gpuChecks: Record<string, unknown>[]; gpuLifecycle: Record<string, unknown>[] }
interface ProbeRuntime extends BloomProof { context?: WebGL2RenderingContext; capturePixels: boolean; restore?: WEBGL_lose_context; markIntentionalLoss?: () => void }
const record = (name: string, data: unknown) => writeFileSync(resolve(out, name + '.json'), JSON.stringify(data, null, 2) + '\n');
async function installProbe(page: Page, options: { unsupported?: boolean; pixels?: boolean } = {}) {
  await page.addInitScript(({ unsupported, pixels }) => {
    const proof: ProbeRuntime = { draws: 0, ordinaryDraws: 0, compositePrograms: 0, floatAllocations: 0, contextCanvases: 0, capturePixels: Boolean(pixels), errors: [], gpuChecks: [], gpuLifecycle: [] };
    Object.assign(window, { mapBloomProof: proof });
    const programs = new WeakSet<WebGLProgram>(), canvases = new WeakSet<HTMLCanvasElement>();
    const proto = WebGL2RenderingContext.prototype, link = proto.linkProgram, extension = proto.getExtension;
    const states = new WeakMap<WebGL2RenderingContext, { id: number; generation: number; expectedLoss: boolean }>();
    const objects = new WeakMap<object, number>(); let contextSequence = 0, objectSequence = 0;
    const objectId = (value: object | null) => { if (!value) return null; let id = objects.get(value); if (id === undefined) { id = ++objectSequence; objects.set(value, id); } return id; };
    const contextState = (gl: WebGL2RenderingContext) => {
      let state = states.get(gl); if (state) return state;
      state = { id: ++contextSequence, generation: 0, expectedLoss: false }; states.set(gl, state); const owned = state;
      gl.canvas.addEventListener('webglcontextlost', () => proof.gpuLifecycle.push({ event: 'lost', at: performance.now(), contextId: owned.id, generation: owned.generation, intentional: owned.expectedLoss, nativeLost: gl.isContextLost() }), true);
      gl.canvas.addEventListener('webglcontextrestored', () => { owned.generation++; owned.expectedLoss = false; proof.gpuLifecycle.push({ event: 'restored', at: performance.now(), contextId: owned.id, generation: owned.generation, nativeLost: gl.isContextLost() }); }, true);
      return state;
    };
    proof.markIntentionalLoss = () => { const gl = proof.context; if (!gl) throw new Error('intentional-loss-context-unavailable'); const state = contextState(gl); state.expectedLoss = true; proof.gpuLifecycle.push({ event: 'intentional-loss-requested', at: performance.now(), contextId: state.id, generation: state.generation, nativeLost: gl.isContextLost() }); };
    const status = (gl: WebGL2RenderingContext, kind: 'link' | 'compile', value: object | null, result: unknown, lostBefore: boolean, infoLog: string | null) => {
      const state = contextState(gl), lostAfter = gl.isContextLost();
      const unavailable = result === null && state.expectedLoss && lostBefore && lostAfter;
      proof.gpuChecks.push({ kind, at: performance.now(), contextId: state.id, generation: state.generation, objectId: objectId(value), status: result, infoLog, intentional: state.expectedLoss, lostBefore, lostAfter, classification: result === true ? 'success' : unavailable ? 'unavailable-during-intentional-loss' : 'failure' });
      if (result !== true && !unavailable) proof.errors.push(infoLog || (kind === 'link' ? 'program link failed' : 'shader compile failed'));
    };
    const programStatus = proto.getProgramParameter, shaderStatus = proto.getShaderParameter, programLog = proto.getProgramInfoLog, shaderLog = proto.getShaderInfoLog;
    proto.getProgramParameter = function (program, pname) { const lost = this.isContextLost(), result: unknown = programStatus.call(this, program, pname); if (pname === this.LINK_STATUS) status(this, 'link', program, result, lost, programLog.call(this, program)); return result; };
    proto.getShaderParameter = function (shader, pname) { const lost = this.isContextLost(), result: unknown = shaderStatus.call(this, shader, pname); if (pname === this.COMPILE_STATUS) status(this, 'compile', shader, result, lost, shaderLog.call(this, shader)); return result; };
    proto.getExtension = function (this: WebGL2RenderingContext, name: string) { if (unsupported && name === 'EXT_color_buffer_float') return null; return Reflect.apply(extension, this, [name]); } as WebGL2RenderingContext['getExtension'];
    proto.linkProgram = function (program) {
      link.call(this, program); proof.context = this;
      if (this.canvas instanceof HTMLCanvasElement && !canvases.has(this.canvas)) { canvases.add(this.canvas); proof.contextCanvases++; }
      const source = (this.getAttachedShaders(program) ?? []).map(shader => this.getShaderSource(shader) ?? '').join('\n');
      if (source.includes('uniform sampler2D glow') && source.includes('uniform float strength')) { programs.add(program); proof.compositePrograms++; }
      this.getProgramParameter(program, this.LINK_STATUS);
    };
    const texture = proto.texImage2D, storage = proto.texStorage2D;
    const floating = (format: number) => [0x881a, 0x881b, 0x822d, 0x822f].includes(format);
    proto.texImage2D = function (this: WebGL2RenderingContext, ...args: Parameters<WebGL2RenderingContext['texImage2D']>) { if (floating(Number(args[2]))) proof.floatAllocations++; return texture.apply(this, args); } as WebGL2RenderingContext['texImage2D'];
    proto.texStorage2D = function (...args: Parameters<WebGL2RenderingContext['texStorage2D']>) { if (floating(args[2])) proof.floatAllocations++; return storage.apply(this, args); };
    for (const name of ['drawArrays', 'drawElements'] as const) {
      const original = proto[name];
      Object.defineProperty(proto, name, { configurable: true, value: function (this: WebGL2RenderingContext, ...args: number[]) {
        const program = this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram | null;
        const composite = program && programs.has(program) && this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) === null;
        if (!composite) { proof.ordinaryDraws++; return Reflect.apply(original, this, args); }
        proof.draws++;
        // Capture exactly one same-frame composite, after initial shader compilation.
        // Blocking readPixels is evidence-only and excluded from performance measurement.
        if (!proof.capturePixels || proof.pixel || proof.draws < 20) return Reflect.apply(original, this, args);
        const width = this.drawingBufferWidth, height = this.drawingBufferHeight;
        const viewport = Array.from(this.getParameter(this.VIEWPORT) as Int32Array), scissor = Array.from(this.getParameter(this.SCISSOR_BOX) as Int32Array), scissorEnabled = this.isEnabled(this.SCISSOR_TEST);
        const before = new Uint8Array(width * height * 4), after = new Uint8Array(before.length);
        this.readPixels(0, 0, width, height, this.RGBA, this.UNSIGNED_BYTE, before);
        Reflect.apply(original, this, args);
        this.readPixels(0, 0, width, height, this.RGBA, this.UNSIGNED_BYTE, after);
        let changedInside = 0, changedOutside = 0, changedRight = 0, maxChange = 0, clearEdgePixels = 0, edgePixels = 0;
        const bounds = scissorEnabled ? scissor : viewport;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 4, change = Math.max(...[0, 1, 2, 3].map(channel => Math.abs(after[offset + channel]! - before[offset + channel]!)));
          const inside = x >= bounds[0]! && x < bounds[0]! + bounds[2]! && y >= bounds[1]! && y < bounds[1]! + bounds[3]!;
          if (change) { if (inside) changedInside++; else changedOutside++; if (x >= width * .5) changedRight++; maxChange = Math.max(maxChange, change); }
          if (inside && (x === bounds[0] || y === bounds[1] || x === bounds[0]! + bounds[2]! - 1 || y === bounds[1]! + bounds[3]! - 1)) { edgePixels++; if (after[offset + 3] === 0) clearEdgePixels++; }
        }
        const viewportAfter = Array.from(this.getParameter(this.VIEWPORT) as Int32Array), scissorAfter = Array.from(this.getParameter(this.SCISSOR_BOX) as Int32Array);
        proof.pixel = { viewport, scissor, scissorEnabled, canvas: [width, height], changedInside, changedOutside, changedRight, clearEdgePixels, edgePixels, beforeAfterStateEqual: JSON.stringify(viewport) === JSON.stringify(viewportAfter) && JSON.stringify(scissor) === JSON.stringify(scissorAfter) && scissorEnabled === this.isEnabled(this.SCISSOR_TEST) && this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) === null && this.drawingBufferWidth === width && this.drawingBufferHeight === height, maxChange, error: this.getError() };
        return undefined;
      } });
    }
  }, options);
}
const read = (page: Page) => page.evaluate(() => { const proof = (window as unknown as { mapBloomProof: ProbeRuntime }).mapBloomProof; return { draws: proof.draws, ordinaryDraws: proof.ordinaryDraws, compositePrograms: proof.compositePrograms, floatAllocations: proof.floatAllocations, contextCanvases: proof.contextCanvases, pixel: proof.pixel, errors: proof.errors, gpuChecks: proof.gpuChecks, gpuLifecycle: proof.gpuLifecycle }; });
const canvas = (page: Page) => page.locator('canvas[data-bloom-status]');
async function open(page: Page) { await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query))); await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready'); await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status', 'complete', { timeout: 20000 }); }
test.beforeEach(async ({ page }) => { mkdirSync(out, { recursive: true }); await page.setViewportSize({ width: 1366, height: 768 }); await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark')); expect((await page.request.post('/api/v1/demo/session', { data: { seed: 4545, anchorInstant: '2026-10-25T06:00:00Z', scenario: 'normal' } })).status()).toBe(201); });
test.afterEach(async ({ page }, info) => { if (!page.isClosed()) { const response = await page.request.post('/api/v1/admin/reset', { data: {} }); record('cleanup-' + info.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 65), { status: response.status() }); expect(response.status()).toBe(201); } });

test('@particle-bloom actual additive glow changes only the clipped map and leaves empty edges clear', async ({ page }) => {
  await installProbe(page, { pixels: true }); await open(page);
  await expect.poll(async () => Boolean((await read(page)).pixel), { timeout: 20000 }).toBe(true);
  const proof = await read(page), pixel = proof.pixel!;
  expect(pixel.canvas).toEqual([1366, 768]); expect(pixel.changedInside).toBeGreaterThan(0); expect(pixel.maxChange).toBeGreaterThan(0);
  expect(pixel.changedOutside).toBe(0); expect(pixel.changedRight).toBe(0); expect(pixel.beforeAfterStateEqual).toBe(true); expect(pixel.error).toBe(0);
  expect(pixel.edgePixels).toBeGreaterThan(0); expect(pixel.clearEdgePixels).toBe(pixel.edgePixels);
  expect(proof.contextCanvases).toBe(1); expect(proof.errors).toEqual([]);
  await expect(canvas(page)).toHaveAttribute('data-bloom-status', 'enabled', { timeout: 20000 });
  await page.screenshot({ path: resolve(out, 'map-bloom-clipped.png') }); record('same-frame-bloom-pixels', proof);
});

test('@particle-bloom unsupported floating targets retain the ordinary map and chart without bloom allocations', async ({ page }) => {
  await installProbe(page, { unsupported: true }); await open(page);
  await expect(canvas(page)).toHaveAttribute('data-bloom-status', 'unsupported');
  await expect(page.locator('[data-chart-gpu-ready]')).toHaveAttribute('data-chart-gpu-ready', 'true');
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await page.waitForTimeout(500); const proof = await read(page);
  expect(proof.draws).toBe(0); expect(proof.compositePrograms).toBe(0); expect(proof.floatAllocations).toBe(0); expect(proof.ordinaryDraws).toBeGreaterThan(0); expect(proof.contextCanvases).toBe(1); expect(proof.errors).toEqual([]);
  await page.screenshot({ path: resolve(out, 'map-bloom-unsupported.png') }); record('unsupported-fallback', proof);
});

test('@particle-bloom reduced covered and mobile policies stop composites and context restoration rebuilds cleanly', async ({ page }) => {
  await installProbe(page); await open(page); await expect(canvas(page)).toHaveAttribute('data-bloom-status', 'enabled', { timeout: 20000 });
  const stages: { name: string; proof: BloomProof }[] = [];
  const paused = async (name: string) => { await expect(canvas(page)).toHaveAttribute('data-bloom-status', 'suspended'); const before = (await read(page)).draws; await page.waitForTimeout(300); const proof = await read(page); expect(proof.draws).toBe(before); stages.push({ name, proof }); };
  await page.emulateMedia({ reducedMotion: 'reduce' }); await paused('reduced');
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await expect(canvas(page)).toHaveAttribute('data-bloom-status', 'enabled');
  await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click(); await paused('calendar-covered');
  await page.getByRole('button', { name: 'انصراف', exact: true }).click(); await expect(canvas(page)).toHaveAttribute('data-bloom-status', 'enabled');
  await page.setViewportSize({ width: 390, height: 844 }); await paused('mobile');
  await expect(page.locator('aside[aria-label="نقشه سفر"]')).toHaveCount(0); await expect(page.locator('[data-chart-gpu-ready]')).toHaveAttribute('data-chart-gpu-ready', 'true');
  await page.setViewportSize({ width: 1366, height: 768 }); await expect(canvas(page)).toHaveAttribute('data-bloom-status', 'enabled');
  const beforeLoss = await read(page);
  await page.evaluate(() => { const proof = (window as unknown as { mapBloomProof: ProbeRuntime }).mapBloomProof; proof.restore = proof.context!.getExtension('WEBGL_lose_context')!; proof.markIntentionalLoss!(); proof.restore.loseContext(); });
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'context-lost'); await paused('context-lost');
  await page.evaluate(() => { (window as unknown as { mapBloomProof: ProbeRuntime }).mapBloomProof.restore!.restoreContext(); });
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready', { timeout: 20000 });
  await expect(canvas(page)).toHaveAttribute('data-bloom-status', 'enabled', { timeout: 20000 });
  const restored = await read(page); record('bloom-policy-and-context', { stages, beforeLoss, restored });
  expect(restored.draws).toBeGreaterThan(beforeLoss.draws); expect(restored.compositePrograms).toBeGreaterThan(beforeLoss.compositePrograms); expect(restored.contextCanvases).toBe(1); expect(restored.errors).toEqual([]);
});
