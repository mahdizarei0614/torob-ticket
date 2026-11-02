import type { Locator, Page, TestInfo } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { expect } from '../fixtures';

export interface NativeContext {
  id: number; owner: string; connected: boolean; lost: boolean; generation: number;
  draws: number; clears: number; frames: number; renderer: string; version: string;
  created: Record<string, number>; deleted: Record<string, number>; live: Record<string, number>;
  compiled: number; linked: number; errors: string[];
  attributes: WebGLContextAttributes | null; limits: Record<string, number>; gpuTimerQuerySupported: boolean;
}
export interface NativeAudit {
  contexts: NativeContext[]; appFrameTimes: number[]; appCallbackMs: { sequence: number; at: number; ms: number }[];
  visibility: string; capturedAt: number; wallClockISO: string; timeOrigin: number; viewport: { width: number; height: number; dpr: number };
  heap: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null;
  canvas: { app: number; provider: number; all: number; width: number | null; height: number | null; cssWidth: number | null; cssHeight: number | null; pixelRatio: number | null };
  bloom: Record<string, string | null>; qualityTier: string; graphics: Record<string, string | null>; shaders: string[];
}

/** Test-only passive native calls. No app/Three internals, query spoofing or GPU readback. */
export async function installNativeAudit(page: Page, unavailable = false) {
  await page.addInitScript(({ unavailable }) => {
    interface Row {
      id: number; gl: WeakRef<WebGL2RenderingContext | WebGLRenderingContext>; canvas: WeakRef<HTMLCanvasElement>;
      owner: string; generation: number; draws: number; clears: number; frames: number; lastFrame: number;
      created: Record<string, number>; deleted: Record<string, number>; objects: Record<string, Set<number>>;
      compiled: number; linked: number; errors: string[]; renderer: string; version: string;
      attributes: WebGLContextAttributes | null; limits: Record<string, number>; gpuTimerQuerySupported: boolean;
    }
    const rows: Row[] = [], known = new WeakMap<object, Row>(), ids = new WeakMap<object, number>();
    let sequence = 0, activeFrame = -1, appWork = 0, callbackSequence = 0;
    const appFrameTimes: number[] = [], appCallbackMs: { sequence: number; at: number; ms: number }[] = [];
    const bounded = (array: number[], value: number) => { array.push(value); if (array.length > 4096) array.shift(); };
    const identify = (value: object) => { let id = ids.get(value); if (id === undefined) { id = ++sequence; ids.set(value, id); } return id; };
    const owner = (canvas: HTMLCanvasElement) => canvas.classList.contains('maplibregl-canvas') || canvas.closest('[data-hotel-map]') ? 'hotel-maplibre' : canvas.closest('[data-active-scenes]') ? 'app-shared' : 'other';
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => raf.call(window, time => {
      const prior = activeFrame, before = appWork, start = performance.now(); activeFrame = time;
      try { callback(time); } finally {
        if (appWork > before) {
          if (appFrameTimes.at(-1) !== time) bounded(appFrameTimes, time);
          appCallbackMs.push({ sequence: ++callbackSequence, at: time, ms: performance.now() - start });
          if (appCallbackMs.length > 4096) appCallbackMs.shift();
        }
        activeFrame = prior;
      }
    });
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof context>) {
      if (unavailable && args[0] === 'webgl2') return null;
      const value = context.apply(this, args);
      if (!value || !['webgl', 'webgl2', 'experimental-webgl'].includes(String(args[0])) || known.has(value)) return value;
      const gl = value as unknown as WebGL2RenderingContext;
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      const limits = Object.fromEntries(['MAX_TEXTURE_SIZE', 'MAX_RENDERBUFFER_SIZE', 'MAX_VERTEX_ATTRIBS', 'MAX_VARYING_VECTORS', 'MAX_VERTEX_TEXTURE_IMAGE_UNITS', 'MAX_TEXTURE_IMAGE_UNITS', 'RED_BITS', 'GREEN_BITS', 'BLUE_BITS', 'ALPHA_BITS', 'DEPTH_BITS'].map(name => [name, Number(gl.getParameter((gl as unknown as Record<string, number>)[name]!))]));
      const row: Row = { id: rows.length + 1, gl: new WeakRef(gl), canvas: new WeakRef(this), owner: owner(this), generation: 0, draws: 0, clears: 0, frames: 0, lastFrame: -1, created: {}, deleted: {}, objects: {}, compiled: 0, linked: 0, errors: [], renderer: String(gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER)), version: String(gl.getParameter(gl.VERSION)), attributes: gl.getContextAttributes(), limits, gpuTimerQuerySupported: gl.getSupportedExtensions()?.includes('EXT_disjoint_timer_query_webgl2') ?? false };
      rows.push(row); known.set(gl, row);
      this.addEventListener('webglcontextlost', () => { for (const live of Object.values(row.objects)) live.clear(); });
      this.addEventListener('webglcontextrestored', () => { row.generation++; });
      const api = gl as unknown as Record<string, (...args: unknown[]) => unknown>;
      for (const kind of ['Buffer', 'Texture', 'Framebuffer', 'Renderbuffer', 'Program', 'Shader', 'VertexArray', 'Query', 'TransformFeedback']) {
        const createName = 'create' + kind, deleteName = 'delete' + kind;
        const create = api[createName], remove = api[deleteName];
        if (!create || !remove) continue;
        row.created[kind] = 0; row.deleted[kind] = 0; row.objects[kind] = new Set();
        api[createName] = function (...parameters) {
          const result = Reflect.apply(create, gl, parameters) as object | null;
          if (result) { row.created[kind]!++; row.objects[kind]!.add(identify(result)); }
          return result;
        };
        api[deleteName] = function (...parameters) {
          const result = Reflect.apply(remove, gl, parameters);
          const object = parameters[0];
          if (object && row.objects[kind]!.delete(identify(object as object))) row.deleted[kind]!++;
          return result;
        };
      }
      const compile = gl.compileShader.bind(gl), link = gl.linkProgram.bind(gl);
      gl.compileShader = shader => {
        compile(shader); row.compiled++;
        if (!gl.isContextLost() && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) row.errors.push('shader-compile:' + (gl.getShaderInfoLog(shader) ?? 'unknown'));
      };
      gl.linkProgram = program => {
        link(program); row.linked++;
        if (!gl.isContextLost() && !gl.getProgramParameter(program, gl.LINK_STATUS)) row.errors.push('program-link:' + (gl.getProgramInfoLog(program) ?? 'unknown'));
      };
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = api[method]; if (!original) continue;
        api[method] = function (...parameters) {
          const canvas = row.canvas.deref(); if (row.owner === 'other' && canvas) row.owner = owner(canvas);
          row.draws++;
          if (activeFrame !== row.lastFrame) { row.frames++; row.lastFrame = activeFrame; }
          if (row.owner === 'app-shared') appWork++;
          return Reflect.apply(original, gl, parameters);
        };
      }
      const clear = gl.clear.bind(gl);
      gl.clear = mask => { const canvas = row.canvas.deref(); if (row.owner === 'other' && canvas) row.owner = owner(canvas); row.clears++; if (row.owner === 'app-shared') appWork++; clear(mask); };
      return value;
    } as typeof context;
    Object.assign(window, {
      t32NativeAudit: {
        snapshot: () => {
          const app = document.querySelector<HTMLCanvasElement>('[data-active-scenes] canvas');
          const bounds = app?.getBoundingClientRect();
          const heap = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
          const bloomKeys = ['bloomStatus', 'bloomReason', 'bloomFrameP50', 'bloomFrameP90', 'bloomCpuP90', 'bloomGpuP90', 'bloomSamples', 'bloomDraws', 'bloomTarget', 'bloomCadenceReferenceMs', 'bloomCadenceLimitMs', 'bloomLimitingFactor'];
          return {
            contexts: rows.map(row => ({ id: row.id, owner: row.owner, connected: !!row.canvas.deref()?.isConnected, lost: row.gl.deref()?.isContextLost() ?? true, generation: row.generation, draws: row.draws, clears: row.clears, frames: row.frames, renderer: row.renderer, version: row.version, attributes: row.attributes, limits: row.limits, gpuTimerQuerySupported: row.gpuTimerQuerySupported, created: { ...row.created }, deleted: { ...row.deleted }, live: Object.fromEntries(Object.entries(row.objects).map(([kind, set]) => [kind, set.size])), compiled: row.compiled, linked: row.linked, errors: [...row.errors] })),
            appFrameTimes: [...appFrameTimes], appCallbackMs: [...appCallbackMs], visibility: document.visibilityState, capturedAt: performance.now(), wallClockISO: new Date().toISOString(), timeOrigin: performance.timeOrigin,
            viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, heap: heap ? { usedJSHeapSize: heap.usedJSHeapSize, totalJSHeapSize: heap.totalJSHeapSize, jsHeapSizeLimit: heap.jsHeapSizeLimit } : null,
            canvas: { app: document.querySelectorAll('[data-active-scenes] canvas').length, provider: document.querySelectorAll('[data-hotel-map] canvas.maplibregl-canvas').length, all: document.querySelectorAll('canvas').length, width: app?.width ?? null, height: app?.height ?? null, cssWidth: bounds?.width ?? null, cssHeight: bounds?.height ?? null, pixelRatio: app && bounds?.width ? app.width / bounds.width : null },
            bloom: Object.fromEntries(bloomKeys.map(key => [key, app?.dataset[key] ?? null])), qualityTier: app?.dataset.graphicsQuality ?? 'unknown',
            graphics: Object.fromEntries(['graphicsQuality', 'graphicsDpr', 'graphicsGeometries', 'graphicsPrograms'].map(key => [key, app?.dataset[key] ?? null])),
            shaders: rows.flatMap(row => row.errors),
          };
        },
        lose: () => { const row = rows.find(item => item.owner === 'app-shared' && item.canvas.deref()?.isConnected); const control = row?.gl.deref()?.getExtension('WEBGL_lose_context'); control?.loseContext(); Object.assign(window, { t32Restore: () => control?.restoreContext() }); return !!control; },
      },
    });
  }, { unavailable });
}

export const nativeAudit = (page: Page) => page.evaluate(() => (window as unknown as { t32NativeAudit: { snapshot: () => NativeAudit } }).t32NativeAudit.snapshot());
export const appDraws = (audit: NativeAudit) => audit.contexts.filter(row => row.owner === 'app-shared').reduce((sum, row) => sum + row.draws, 0);
export const appClears = (audit: NativeAudit) => audit.contexts.filter(row => row.owner === 'app-shared').reduce((sum, row) => sum + row.clears, 0);
export const activeContexts = (audit: NativeAudit, owner: string) => audit.contexts.filter(row => row.owner === owner && row.connected && !row.lost);

export async function waitForPaint(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(image => image.complete ? Promise.resolve() : image.decode().catch(() => undefined)));
    await Promise.all(document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined)));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

export async function graphicsReady(page: Page) {
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready', { timeout: 30_000 });
  await expect(page.locator('[data-chart-gpu-ready]')).toHaveAttribute('data-chart-gpu-ready', 'true', { timeout: 30_000 });
  await waitForPaint(page);
}

/** Card centers may contain airport links; use the real free selection surface. */
export async function cardClickPoint(control: Locator) {
  const position = { x: 14, y: 18 };
  await control.scrollIntoViewIfNeeded();
  const hitsControl = await control.evaluate((button, point) => {
    const bounds = button.getBoundingClientRect();
    return document.elementFromPoint(bounds.left + point.x, bounds.top + point.y) === button;
  }, position);
  expect(hitsControl, 'The native background point must hit this exact selection button').toBe(true);
  return position;
}

export const save = (info: TestInfo, name: string, value: unknown) => writeFileSync(info.outputPath(name + '.json'), JSON.stringify(value, null, 2) + '\n');
export const quantile = (values: readonly number[], fraction: number) => { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]! : null; };

export function frameWindow(start: NativeAudit, end: NativeAudit) {
  const times = end.appFrameTimes.filter(time => time > start.capturedAt && time <= end.capturedAt);
  const intervals = times.slice(1).map((time, index) => time - times[index]!);
  return { elapsedMs: end.capturedAt - start.capturedAt, start, end, drawDelta: appDraws(end) - appDraws(start), clearDelta: appClears(end) - appClears(start), frameSamples: times.length, throughputFps: times.length * 1000 / (end.capturedAt - start.capturedAt), medianIntervalMs: quantile(intervals, .5), p95IntervalMs: quantile(intervals, .95), medianCadenceFps: intervals.length ? 1000 / (quantile(intervals, .5) ?? 1) : null, callbackCpuP95Ms: quantile(end.appCallbackMs.filter(sample => sample.sequence > (start.appCallbackMs.at(-1)?.sequence ?? 0)).map(sample => sample.ms), .95), method: 'Actual app-owned native draw/clear submissions and rAF timestamps. Throughput uses actual elapsed wall-clock; median cadence is separate and can conceal dropped frames. Callback CPU includes the graphics-submitting callback; not GPU duration or physical display FPS. Passive instrumentation has nonzero overhead.' };
}
export async function observeWindow(page: Page, milliseconds: number) {
  const start = await nativeAudit(page);
  await page.evaluate(duration => new Promise(resolve => setTimeout(resolve, duration)), milliseconds);
  return { milliseconds, ...frameWindow(start, await nativeAudit(page)) };
}

/** Start before native action; stop only on the requested current DOM state. */
export async function inputLatency(page: Page, name: string, trigger: Locator, event: 'click' | 'keydown' | 'wheel' | 'pointermove', condition: { selector: string; attribute: string; expected: string; different?: boolean; visible?: boolean }, action: () => Promise<unknown>) {
  await trigger.evaluate((node, { event, condition }) => {
    let at: number | undefined, captureAt: number | undefined, stopped = false;
    const capture = (input: Event) => { if (at !== undefined || !input.isTrusted) return; at = input.timeStamp; captureAt = performance.now(); };
    node.addEventListener(event, capture, { once: true, capture: true });
    const result: { eventAt: number | null; captureAt: number | null; observedAt: number | null; paintProxyAt: number | null; trusted: boolean } = { eventAt: null, captureAt: null, observedAt: null, paintProxyAt: null, trusted: false };
    const inspect = () => {
      if (stopped || at === undefined || result.observedAt !== null) return;
      const target = document.querySelector(condition.selector), actual = target?.getAttribute(condition.attribute);
      if (!target || (condition.different ? actual === condition.expected : actual !== condition.expected)) return;
      if (condition.visible) {
        if (!target.getBoundingClientRect().width) return;
        for (let ancestor: Element | null = target; ancestor; ancestor = ancestor.parentElement) { const style = getComputedStyle(ancestor); if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < .5) { requestAnimationFrame(inspect); return; } }
      }
      result.eventAt = at; result.captureAt = captureAt!; result.observedAt = performance.now(); result.trusted = true;
      observer.disconnect(); requestAnimationFrame(() => requestAnimationFrame(() => { result.paintProxyAt = performance.now(); }));
    };
    const observer = new MutationObserver(inspect); observer.observe(document, { subtree: true, childList: true, attributes: true });
    const onInput = () => queueMicrotask(inspect); node.addEventListener(event, onInput, { once: true });
    Object.assign(window, { t32InputLatency: { result, stop: () => { stopped = true; observer.disconnect(); node.removeEventListener(event, capture, true); node.removeEventListener(event, onInput); } } });
  }, { event, condition });
  const driverStart = Date.now();
  try {
    await action();
    await expect.poll(() => page.evaluate(() => (window as unknown as { t32InputLatency: { result: { paintProxyAt: number | null } } }).t32InputLatency.result.paintProxyAt), { timeout: 10_000 }).not.toBeNull();
    const result = await page.evaluate(() => (window as unknown as { t32InputLatency: { result: { eventAt: number; captureAt: number; observedAt: number; paintProxyAt: number; trusted: boolean } } }).t32InputLatency.result);
    return { name, event, condition, ...result, queuedInputMs: result.captureAt - result.eventAt, eventToCommitMs: result.observedAt - result.eventAt, eventToPaintProxyMs: result.paintProxyAt - result.eventAt, dispatchToPaintProxyMs: result.paintProxyAt - result.captureAt, driverRoundtripMs: Date.now() - driverStart, method: 'Trusted Event.timeStamp (creation), capture handler (dispatch), exact requested DOM state, then two-rAF paint opportunity. Not physical presentation latency or EventTiming INP.' };
  } finally { await page.evaluate(() => (window as unknown as { t32InputLatency: { stop: () => void } }).t32InputLatency.stop()); }
}
