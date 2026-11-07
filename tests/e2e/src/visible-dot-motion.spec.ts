import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// GPU parity intentionally checks the internal pure snapshot math, without loading React/raw shaders through the public graphics barrel.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { sampleLivingDotOffset, sampleLivingDotOpacity } from '../../../libs/graphics/src/scenes/living-dot-drift';

const out = resolve(process.env.VISIBLE_DOT_EVIDENCE_DIR ?? '.local/evidence/adjustments/visible-dot-motion/native');
interface Dot { x: number; y: number; mass: number }
interface Frame { seconds: number; wallSeconds: number; amplitude: number; unit: number; dpr: number; viewport: number[]; camera: number[]; dots: Dot[]; png: string }
interface Proof { request: boolean; frames: Frame[]; frameWallTimes: number[]; linked: boolean; particleLifecycle: boolean; morphSeen: boolean; opacity: number; time: number; amplitude: number }
const proof = (page: Page) => page.evaluate(() => { const s=(window as unknown as { visibleDotProof: Proof }).visibleDotProof; return { ...s, frames:s.frames.map(f=>({seconds:f.seconds})) }; });

test.use({video:process.env.VISIBLE_DOT_VIDEO === '1' ? {mode:'on',size:{width:1366,height:768}} : 'off',deviceScaleFactor:process.env.VISIBLE_DOT_HIDPI === '1' ? 2 : 1});

test('@visible-dot-motion dots keep wandering during idle and resume after the calendar closes', async ({ page }) => {
  mkdirSync(out, { recursive: true }); await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('torobticket.appearance', 'dark');
    const state: Proof = { request: false, frames: [], frameWallTimes: [], linked: true, particleLifecycle: false, morphSeen: false, opacity: 0, time: 0, amplitude: 0 };
    Object.assign(window, { visibleDotProof: state });
    const programs = new WeakSet<WebGLProgram>();
    const proto = WebGL2RenderingContext.prototype, link = proto.linkProgram, location = proto.getUniformLocation;
    const names = new WeakMap<WebGLUniformLocation, string>(), upload = proto.uniform1f;
    proto.linkProgram = function (program) {
      link.call(this, program);
      const source = (this.getAttachedShaders(program) ?? []).map(shader => this.getShaderSource(shader) ?? '').join('\n');
      if (source.includes('vec4 lattice(') && source.includes('livingDotOffset')) { programs.add(program); state.linked &&= Boolean(this.getProgramParameter(program, this.LINK_STATUS)); state.particleLifecycle ||= source.includes('float presence = smoothstep'); }
    };
    proto.getUniformLocation = function (program, name) { const value = location.call(this, program, name); if (value && (programs.has(program) || name === 'morphProgress')) names.set(value, name); return value; };
    proto.uniform1f = function (at, value) {
      const name = at && names.get(at);
      if (name === 'time') { if(value !== state.time) {state.frameWallTimes.push(performance.now());if(state.frameWallTimes.length>120)state.frameWallTimes.shift();} state.time = value; }
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
      const wallSeconds = performance.now() / 1000;
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
      state.frames.push({ seconds: uniform('time'), wallSeconds, amplitude: uniform('dotDriftAmplitude'), unit: uniform('unitsPerPixel'), dpr, viewport, camera, dots, png: canvas.toDataURL('image/png') });
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
    await expect.poll(async () => (await proof(page)).amplitude).toBe(9);
    const capture = async () => {
      const count = (await proof(page)).frames.length;
      await page.evaluate(() => { (window as unknown as { visibleDotProof: Proof }).visibleDotProof.request = true; });
      await expect.poll(async () => (await proof(page)).frames.length).toBe(count + 1);
      return page.evaluate(() => (window as unknown as {visibleDotProof:Proof}).visibleDotProof.frames.at(-1)!);
    };
    const evidence: unknown[] = [];
    const compare = async (name: string) => {
      const a = await capture();
      await expect.poll(async () => (await proof(page)).time, { timeout: 10000 }).toBeGreaterThan(a.seconds + .75);
      const b = await capture();
      expect(b.viewport).toEqual(a.viewport); expect(b.camera).toEqual(a.camera); expect(b.unit).toBe(a.unit);
      expect(a.amplitude).toBe(9); expect(b.amplitude).toBe(9);
      expect((b.seconds-a.seconds)/(b.wallSeconds-a.wallSeconds)).toBeGreaterThan(.85);
      expect((b.seconds-a.seconds)/(b.wallSeconds-a.wallSeconds)).toBeLessThan(1.15);
      const distances: number[] = [];
      for (const dot of a.dots) {
        const matches = b.dots.map(next => ({ next, distance: Math.hypot(dot.x - next.x, dot.y - next.y) })).sort((u, v) => u.distance - v.distance);
        const match = matches[0]; if (!match || match.distance > 5 || (matches[1] && matches[1].distance - match.distance < .7)) continue;
        const reverse = a.dots.map(next => ({ next, distance: Math.hypot(match.next.x - next.x, match.next.y - next.y) })).sort((u, v) => u.distance - v.distance)[0];
        if (reverse?.next === dot) distances.push(match.distance);
      }
      distances.sort((u, v) => u - v);
      const median = distances[Math.floor(distances.length / 2)] ?? 0;
      const times=(await proof(page)).frameWallTimes;
      const intervals=times.slice(1).map((value,i)=>value-times[i]!).sort((u,v)=>u-v);
      evidence.push({ name, first: { ...a, png: undefined }, second: { ...b, png: undefined }, matchedCenters: distances.length, medianDisplacementCssPx: median, distances, frameCadence:{samples:intervals.length,medianIntervalMs:intervals[Math.floor(intervals.length/2)],p95IntervalMs:intervals[Math.floor(intervals.length*.95)]} });
      for (const [suffix, frame] of [['a', a], ['b', b]] as const) writeFileSync(resolve(out, `${name}-${suffix}.png`), Buffer.from(frame.png.split(',')[1]!, 'base64'));
      writeFileSync(resolve(out, 'rendered-centers.json'), JSON.stringify(evidence, null, 2));
      expect(distances.length).toBeGreaterThan(25); expect(median).toBeGreaterThan(1);
      await page.screenshot({ path: resolve(out, name + '-page.png') });
    };
    // Let the initial overview finish its finite camera transition first.
    await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:20000});
    await page.waitForTimeout(process.env.VISIBLE_DOT_IDLE_PROBE === '1' ? 12000 : 1000); await compare('iran');
    await page.getByRole('radiogroup', { name: 'محدوده سفر', exact: true }).getByText('بین‌المللی', { exact: true }).click();
    await expect.poll(async () => { const current = await proof(page); return current.morphSeen && current.opacity === 1; }, { timeout: 15000 }).toBe(true);
    await page.waitForTimeout(350); await compare('world-after-morph');
    await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click(); await page.waitForTimeout(250);
    const covered = (await proof(page)).time; await page.waitForTimeout(300); expect((await proof(page)).time).toBe(covered);
    await page.getByRole('button', { name: 'انصراف', exact: true }).click();
    await expect.poll(async () => (await proof(page)).time, {timeout:6000}).toBeGreaterThan(covered + .8);
    if(process.env.VISIBLE_DOT_IDLE_PROBE === '1') { await page.waitForTimeout(2500); await compare('world-resumed-idle'); }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await expect.poll(async () => (await proof(page)).amplitude).toBe(0);
    const reduced = (await proof(page)).time; await page.waitForTimeout(300); expect((await proof(page)).time).toBe(reduced);
    expect((await proof(page)).linked).toBe(true); expect((await proof(page)).particleLifecycle).toBe(true); expect(errors).toEqual([]);
    writeFileSync(resolve(out, 'lifecycle.json'), JSON.stringify({ covered, reduced, linked: true, errors }, null, 2));
  } finally {
    const response = await page.request.post('/api/v1/admin/reset', { data: {} });
    writeFileSync(resolve(out, 'cleanup.json'), JSON.stringify({ status: response.status() })); expect(response.status()).toBe(201);
  }
});

test('@visible-dot-motion actual GPU wandering positions and particle opacity match CPU morph snapshots',async({page})=>{
  mkdirSync(out,{recursive:true}); await page.goto('/');
  const cases: {x:number;y:number;time:number}[]=[];
  for (const domestic of [true,false]) for(let level=0;level<4;level++) {
    const spacing=domestic?.44/2**level:4/4**level,ox=domestic?44:-179,oy=domestic?25:-59;
    for(const lon of domestic?[45,51,59]:[-178,-74,0,51,140]) for(const lat of [28,35,41]) for(const time of [0,.4,5,30,3600]) {
      cases.push({x:ox+Math.round((lon-ox)/spacing)*spacing,y:oy+Math.round((lat-oy)/spacing)*spacing,time});
    }
  }
  const shader=readFileSync(resolve('libs/graphics/src/shaders/living-dot-drift.glsl'),'utf8');
  const actual=await page.evaluate(({shader,cases})=>{
    const gl=new OffscreenCanvas(1,1).getContext('webgl2')!;if(!gl)throw Error('No WebGL2');
    const program=gl.createProgram()!;
    const compile=(kind:number,source:string)=>{const s=gl.createShader(kind)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)??'Compile failed');gl.attachShader(program,s);return s;};
    const vertex=compile(gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;precision highp int;\n'+shader+'\nlayout(location=0) in vec3 sampleInput;out vec3 particle;void main(){particle=livingDotParticle(sampleInput.xy,sampleInput.z,9.0);gl_Position=vec4(0.0);gl_PointSize=1.0;}');
    const fragment=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.0);}');
    gl.transformFeedbackVaryings(program,['particle'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)??'Link failed');gl.useProgram(program);
    const input=gl.createBuffer()!,output=gl.createBuffer()!,vao=gl.createVertexArray()!,feedback=gl.createTransformFeedback()!;
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cases.flatMap(p=>[p.x,p.y,p.time])),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,cases.length*3*4,gl.STREAM_READ);
    gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,cases.length);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
    const values=new Float32Array(cases.length*3);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);const error=gl.getError();
    gl.deleteTransformFeedback(feedback);gl.deleteVertexArray(vao);gl.deleteBuffer(input);gl.deleteBuffer(output);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);gl.getExtension('WEBGL_lose_context')?.loseContext();
    if(error!==gl.NO_ERROR)throw Error('GL error '+error);return Array.from(values);
  },{shader,cases});
  const errors=cases.map((point,i)=>{const xy=sampleLivingDotOffset(point.x,point.y,point.time),opacity=sampleLivingDotOpacity(point.x,point.y,point.time);return Math.max(Math.abs(actual[i*3]!-xy[0]),Math.abs(actual[i*3+1]!-xy[1]),Math.abs(actual[i*3+2]!-opacity));});
  writeFileSync(resolve(out,'gpu-cpu-parity.json'),JSON.stringify({samples:cases.length,maxAbsoluteError:Math.max(...errors),cases:cases.map((point,i)=>({...point,gpu:actual.slice(i*3,i*3+3),error:errors[i]}))},null,2));
  expect(Math.max(...errors)).toBeLessThan(.02);
});
