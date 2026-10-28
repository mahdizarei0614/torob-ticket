import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.env.VISIBLE_DOT_EVIDENCE_DIR ?? 'docs/evidence/adjustments/visible-dot-motion/native');
interface Dot { x: number; y: number; mass: number }
interface Frame { seconds: number; amplitude: number; unit: number; dpr: number; viewport: number[]; camera: number[]; dots: Dot[]; png: string }
interface Proof { request: boolean; frames: Frame[]; linked: boolean; morphSeen: boolean; opacity: number; time: number; amplitude: number }
const proof = (page: Page) => page.evaluate(() => (window as unknown as { visibleDotProof: Proof }).visibleDotProof);

test('@visible-dot-motion rendered dot centers drift initially and after the scope morph', async ({ page }) => {
  mkdirSync(out, { recursive: true }); await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('torobticket.appearance', 'dark');
    const state: Proof = { request: false, frames: [], linked: true, morphSeen: false, opacity: 0, time: 0, amplitude: 0 };
    Object.assign(window, { visibleDotProof: state });
    const programs = new WeakSet<WebGLProgram>();
    const proto = WebGL2RenderingContext.prototype, link = proto.linkProgram, location = proto.getUniformLocation;
    const names = new WeakMap<WebGLUniformLocation, string>(), upload = proto.uniform1f;
    proto.linkProgram = function (program) {
      link.call(this, program);
      const source = (this.getAttachedShaders(program) ?? []).map(shader => this.getShaderSource(shader) ?? '').join('\n');
      if (source.includes('vec4 lattice(') && source.includes('livingDotOffset')) { programs.add(program); state.linked &&= Boolean(this.getProgramParameter(program, this.LINK_STATUS)); }
    };
    proto.getUniformLocation = function (program, name) { const value = location.call(this, program, name); if (value && (programs.has(program) || name === 'morphProgress')) names.set(value, name); return value; };
    proto.uniform1f = function (at, value) {
      const name = at && names.get(at);
      if (name === 'time') state.time = value;
      if (name === 'mapOpacity') state.opacity = value;
      if (name === 'dotDriftAmplitude') state.amplitude = value;
      if (name === 'morphProgress' && value < .99) state.morphSeen = true;
      upload.call(this, at, value);
    };
    const capture = (gl: WebGL2RenderingContext) => {
      if (!state.request || gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)) return;
      const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
      if (!programs.has(program)) return;
      const uniform = (name: string) => gl.getUniform(program, location.call(gl, program, name)! ) as number;
      if (uniform('layer') < .5 || uniform('mapOpacity') < .999) return;
      state.request = false;
      const viewport = [...gl.getParameter(gl.VIEWPORT) as Int32Array];
      const x = Math.max(0, viewport[0]!), y = Math.max(0, viewport[1]!);
      const width = Math.min(gl.drawingBufferWidth, viewport[0]! + viewport[2]!) - x;
      const height = Math.min(gl.drawingBufferHeight, viewport[1]! + viewport[3]!) - y;
      const dpr = gl.drawingBufferWidth / (gl.canvas as HTMLCanvasElement).getBoundingClientRect().width;
      const pixels = new Uint8Array(width * height * 4); gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const seen = new Uint8Array(width * height), dots: Dot[] = [];
      // Weighted component centers establish positional movement independently
      // of the brightness pulse or the shader's displacement formula.
      for (let i = 0; i < seen.length; i++) {
        if (seen[i] || pixels[i * 4 + 3]! < 5) continue;
        const queue = [i]; seen[i] = 1;
        let mass = 0, sx = 0, sy = 0, left = width, right = 0, bottom = height, top = 0;
        for (let q = 0; q < queue.length; q++) {
          const index = queue[q]!, px = index % width, py = Math.floor(index / width), weight = pixels[index * 4 + 3]!;
          mass += weight; sx += px * weight; sy += py * weight;
          left = Math.min(left, px); right = Math.max(right, px); bottom = Math.min(bottom, py); top = Math.max(top, py);
          for (const next of [index - 1, index + 1, index - width, index + width]) {
            if (next < 0 || next >= seen.length || seen[next] || Math.abs(next % width - px) > 1 || pixels[next * 4 + 3]! < 5) continue;
            seen[next] = 1; queue.push(next);
          }
        }
        if (queue.length >= 2 && (right - left) / dpr < 9 && (top - bottom) / dpr < 9 && left > 12 * dpr && right < width - 12 * dpr && bottom > 12 * dpr && top < height - 12 * dpr) dots.push({ x: (sx / mass + x) / dpr, y: (sy / mass + y) / dpr, mass });
      }
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d')!, image = context.createImageData(width, height);
      for (let row = 0; row < height; row++) image.data.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), (height - 1 - row) * width * 4);
      context.putImageData(image, 0, 0);
      const camera = ['projectionMatrix', 'modelViewMatrix'].flatMap(name => [...gl.getUniform(program, location.call(gl, program, name)!) as Float32Array]);
      state.frames.push({ seconds: uniform('time'), amplitude: uniform('dotDriftAmplitude'), unit: uniform('unitsPerPixel'), dpr, viewport, camera, dots, png: canvas.toDataURL('image/png') });
    };
    const elements = proto.drawElements, arrays = proto.drawArrays;
    proto.drawElements = function (mode, count, type, offset) { elements.call(this, mode, count, type, offset); capture(this); };
    proto.drawArrays = function (mode, first, count) { arrays.call(this, mode, first, count); capture(this); };
  });
  expect((await page.request.post('/api/v1/demo/session', { data: { seed: 3333, anchorInstant: '2026-10-25T06:00:00Z', scenario: 'normal' } })).status()).toBe(201);
  try {
    const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-29', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'fastest' };
    await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
    await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
    await expect.poll(async () => (await proof(page)).amplitude).toBe(4);
    const capture = async () => {
      const count = (await proof(page)).frames.length;
      await page.evaluate(() => { (window as unknown as { visibleDotProof: Proof }).visibleDotProof.request = true; });
      await expect.poll(async () => (await proof(page)).frames.length).toBe(count + 1);
      return (await proof(page)).frames.at(-1)!;
    };
    const evidence: unknown[] = [];
    const compare = async (name: string) => {
      const a = await capture();
      await expect.poll(async () => (await proof(page)).time, { timeout: 10000 }).toBeGreaterThan(a.seconds + 2);
      const b = await capture();
      expect(b.viewport).toEqual(a.viewport); expect(b.camera).toEqual(a.camera); expect(b.unit).toBe(a.unit);
      expect(a.amplitude).toBe(4); expect(b.amplitude).toBe(4);
      const distances: number[] = [];
      for (const dot of a.dots) {
        const matches = b.dots.map(next => ({ next, distance: Math.hypot(dot.x - next.x, dot.y - next.y) })).sort((u, v) => u.distance - v.distance);
        const match = matches[0]; if (!match || match.distance > 5 || (matches[1] && matches[1].distance - match.distance < .7)) continue;
        const reverse = a.dots.map(next => ({ next, distance: Math.hypot(match.next.x - next.x, match.next.y - next.y) })).sort((u, v) => u.distance - v.distance)[0];
        if (reverse?.next === dot) distances.push(match.distance);
      }
      distances.sort((u, v) => u - v);
      const median = distances[Math.floor(distances.length / 2)] ?? 0;
      evidence.push({ name, first: { ...a, png: undefined }, second: { ...b, png: undefined }, matchedCenters: distances.length, medianDisplacementCssPx: median, distances });
      for (const [suffix, frame] of [['a', a], ['b', b]] as const) writeFileSync(resolve(out, `${name}-${suffix}.png`), Buffer.from(frame.png.split(',')[1]!, 'base64'));
      writeFileSync(resolve(out, 'rendered-centers.json'), JSON.stringify(evidence, null, 2));
      expect(distances.length).toBeGreaterThan(25); expect(median).toBeGreaterThan(1);
      await page.screenshot({ path: resolve(out, name + '-page.png') });
    };
    // Let the initial overview finish its finite camera transition first.
    await page.waitForTimeout(1000); await compare('iran');
    await page.getByRole('radiogroup', { name: 'محدوده سفر', exact: true }).getByText('بین‌المللی', { exact: true }).click();
    await expect.poll(async () => { const current = await proof(page); return current.morphSeen && current.opacity === 1; }, { timeout: 15000 }).toBe(true);
    await page.waitForTimeout(350); await compare('world-after-morph');
    await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click(); await page.waitForTimeout(250);
    const covered = (await proof(page)).time; await page.waitForTimeout(300); expect((await proof(page)).time).toBe(covered);
    await page.getByRole('button', { name: 'انصراف', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' }); await expect.poll(async () => (await proof(page)).amplitude).toBe(0);
    const reduced = (await proof(page)).time; await page.waitForTimeout(300); expect((await proof(page)).time).toBe(reduced);
    expect((await proof(page)).linked).toBe(true); expect(errors).toEqual([]);
    writeFileSync(resolve(out, 'lifecycle.json'), JSON.stringify({ covered, reduced, linked: true, errors }, null, 2));
  } finally {
    const response = await page.request.post('/api/v1/admin/reset', { data: {} });
    writeFileSync(resolve(out, 'cleanup.json'), JSON.stringify({ status: response.status() })); expect(response.status()).toBe(201);
  }
});
