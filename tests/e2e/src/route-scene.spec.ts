import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { GraphicsDiagnostics } from '@torob-ticket/graphics';
interface Report extends GraphicsDiagnostics { pinned: string; displayed: string; direction: string; progress: number; point?: { latitude: number; longitude: number }; selectedPlace: string }
async function report(page: Page): Promise<Report> {
  await page.getByRole('button', { name: 'تازه‌سازی گزارش مسیر' }).evaluate((button: HTMLButtonElement) => button.click());
  return JSON.parse(await page.getByTestId('route-report').innerText());
}
async function camera(page: Page) { return JSON.parse((await page.locator('[data-route-scene] [data-camera]').getAttribute('data-camera'))!); }
async function save(name: string, data: unknown) { if (process.env.GRAPHICS_EVIDENCE_DIR) await writeFile(`${process.env.GRAPHICS_EVIDENCE_DIR}/${name}.json`, JSON.stringify(data, null, 2)); }
async function ready(page: Page) { await page.goto('/route-lab'); await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible(); }
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!document.startViewTransition) return;
    const original = document.startViewTransition.bind(document); const transitions: Promise<void>[] = [];
    (window as unknown as { routeTransitions: Promise<void>[] }).routeTransitions = transitions;
    document.startViewTransition = ((update: Parameters<Document['startViewTransition']>[0]) => {
      const transition = original(update); transitions.push(transition.finished.catch(() => undefined)); return transition;
    }) as Document['startViewTransition'];
  });
});
async function settle(page: Page) { await page.evaluate(async () => { await Promise.all((window as unknown as { routeTransitions?: Promise<void>[] }).routeTransitions ?? []); await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); }); }
// Observe real draw output before Chrome discards the default framebuffer. Never alter context attributes or GPU calls.
async function gpuObserver(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const stats = { drawCalls: 0, maxColoredPixels: 0, hashes: [] as number[], customPointPixel: [] as number[] };
    (window as unknown as { routeGPU: typeof stats }).routeGPU = stats;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      const result = original.apply(this, args);
      if (args[0] === 'webgl2' && result && !(result as unknown as { observed?: boolean }).observed) {
        const gl = result as WebGL2RenderingContext;
        (gl as unknown as { observed: boolean }).observed = true;
        const observe = () => {
          stats.drawCalls++;
          const view = Array.from(document.querySelectorAll('[data-graphics-view]')).find(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.top >= 0 && rect.bottom <= innerHeight; });
          if (!view) return;
          const rect = view.getBoundingClientRect(); const ratio = gl.drawingBufferWidth / innerWidth;
          const width = Math.floor(rect.width * ratio), height = Math.floor(rect.height * ratio);
          const pixels = new Uint8Array(width * height * 4);
          gl.readPixels(Math.floor(rect.left * ratio), Math.floor((innerHeight - rect.bottom) * ratio), width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let colored = 0, hash = 0;
          for (let i = 0; i < pixels.length; i += 4) { if (pixels[i + 3]! > 0) colored++; hash = (hash * 31 + pixels[i]! + pixels[i + 1]! * 3 + pixels[i + 2]! * 5) >>> 0; }
          stats.maxColoredPixels = Math.max(stats.maxColoredPixels, colored);
          const picker = document.querySelector('[data-location-scene] [data-camera]') as HTMLElement | null;
          const marker = picker?.querySelector('button[aria-label="نقطه انتخابی"]')?.parentElement;
          if (picker && marker && !marker.hidden) {
            const pickerBox = picker.getBoundingClientRect(); const px = pickerBox.left + marker.offsetLeft; const py = pickerBox.top + marker.offsetTop;
            if (px >= 0 && py >= 0 && px < innerWidth && py < innerHeight) { const pixel = new Uint8Array(4); gl.readPixels(Math.floor(px * ratio), Math.floor((innerHeight - py) * ratio), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); stats.customPointPixel = Array.from(pixel); }
          }
          stats.hashes.push(hash); stats.hashes = stats.hashes.slice(-40);
        };
        const arrays = gl.drawArrays.bind(gl), elements = gl.drawElements.bind(gl);
        gl.drawArrays = (...args) => { arrays(...args); observe(); };
        gl.drawElements = (...args) => { elements(...args); observe(); };
      }
      return result;
    } as typeof original;
  });
}
test('@route-scene compiles real dotted geography/route shaders and renders all modes/scopes/six palettes', async ({ page, browser }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await gpuObserver(page); await ready(page); await settle(page);
  await expect(page.locator('canvas')).toHaveCount(1);
  const snapshots = [];
  for (const mode of ['flight', 'train', 'bus']) {
    await page.getByRole('combobox', { name: 'نوع سفر', exact: true }).selectOption(mode);
    for (const scope of ['domestic', 'international']) {
      await page.getByRole('combobox', { name: 'محدوده', exact: true }).selectOption(scope);
      await page.getByRole('button', { name: 'نمای کامل جغرافیا' }).click();
      await settle(page);
      const light = await report(page); expect(light.status).toBe('ready');
      if (mode === 'flight' && scope === 'domestic') {
        const hash = async () => page.evaluate(() => (window as unknown as { routeGPU: { hashes: number[] } }).routeGPU.hashes.at(-1));
        const full = await hash();
        await page.getByRole('slider', { name: 'آشکارسازی مسیر', exact: true }).press('Home'); await settle(page);
        expect(await hash()).not.toBe(full);
        await page.getByRole('slider', { name: 'آشکارسازی مسیر', exact: true }).press('End'); await settle(page);
        expect(await hash()).toBe(full);
        await save('route-reveal', { fullHash: full, restoredHash: await hash() });
      }
      expect(light.programs.length).toBeGreaterThanOrEqual(2);
      expect(light.programs.every(program => program.linked && program.vertexCompiled && program.fragmentCompiled && !program.programLog && !program.vertexLog && !program.fragmentLog)).toBe(true);
      expect(light.renderer).toBeTruthy();
      if (process.env.GRAPHICS_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.GRAPHICS_EVIDENCE_DIR}/${mode}-${scope}-light.png` });
      await page.getByRole('button', { name: 'تغییر روشنایی' }).click(); await settle(page);
      const dark = await report(page); expect(dark.themeFrames).toBeGreaterThan(light.themeFrames);
      if (process.env.GRAPHICS_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.GRAPHICS_EVIDENCE_DIR}/${mode}-${scope}-dark.png` });
      snapshots.push({ mode, scope, light, dark });
      await page.getByRole('button', { name: 'تغییر روشنایی' }).click(); await settle(page);
      if (scope === 'domestic') {
        await page.getByRole('button', { name: 'تثبیت و تنظیم دوربین' }).click();
        await page.getByRole('combobox', { name: 'پیشرفت ارجاع', exact: true }).selectOption('0.7'); await settle(page);
        if (process.env.GRAPHICS_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.GRAPHICS_EVIDENCE_DIR}/${mode}-fitted-70.png` });
      }
    }
  }
  const gpu = await page.evaluate(() => (window as unknown as { routeGPU: { maxColoredPixels: number; drawCalls: number; hashes: number[] } }).routeGPU);
  expect(gpu.maxColoredPixels).toBeGreaterThan(400); expect(new Set(gpu.hashes).size).toBeGreaterThan(2);
  expect(errors).toEqual([]); await save('route-gpu-palettes', { browser: browser.version(), snapshots, gpu, errors });
});
test('@route-scene camera stays idle through preview, direction, progress, themes and unrelated scroll; explicit fit/zoom work', async ({ page }) => {
  await ready(page); await page.getByRole('button', { name: 'تثبیت و تنظیم دوربین' }).click(); await settle(page);
  const initial = await camera(page); const first = await report(page);
  await page.waitForTimeout(150); expect((await report(page)).frames).toBe(first.frames);
  await page.getByRole('button', { name: 'پیش‌نمایش مسیر دیگر' }).click(); await settle(page); expect(await camera(page)).toEqual(initial);
  expect((await report(page)).displayed).not.toBe((await report(page)).pinned);
  await page.getByRole('button', { name: 'پایان پیش‌نمایش' }).click(); await settle(page); expect(await camera(page)).toEqual(initial);
  await page.getByRole('combobox', { name: 'جهت', exact: true }).selectOption('return'); await settle(page); expect(await camera(page)).toEqual(initial);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const progress of ['0', '0.35', '0.7', '1']) { await page.getByRole('combobox', { name: 'پیشرفت ارجاع', exact: true }).selectOption(progress); await settle(page); expect(await camera(page)).toEqual(initial); expect((await report(page)).progress).toBe(Number(progress)); }
  const stopped = await report(page); await page.waitForTimeout(150); expect((await report(page)).frames).toBe(stopped.frames);
  await page.getByRole('region', { name: 'محتوای مستقل قابل پیمایش' }).evaluate(element => { element.scrollTop = 250; }); await settle(page); expect(await camera(page)).toEqual(initial);
  await page.locator('[data-route-scene] [data-camera]').hover(); await page.mouse.wheel(0, 100); await settle(page); expect(await camera(page)).toEqual(initial);
  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole('button', { name: 'بزرگ‌نمایی نقشه مسیر', exact: true }).click(); const zoomed = await camera(page); expect(zoomed.zoom).toBeGreaterThan(initial.zoom);
  await page.getByRole('button', { name: 'تغییر روشنایی' }).click(); await settle(page); expect(await camera(page)).toEqual(zoomed);
  await page.getByRole('button', { name: 'تثبیت و تنظیم دوربین' }).click(); await settle(page); expect((await camera(page)).zoom).toBe(1);
  await save('route-camera', { initial, zoomed, first, stopped, final: await report(page) });
});
test('@route-scene preserves ordered canonical stops and separate airport transfer, fallback and context restoration', async ({ page }) => {
  await ready(page); await page.getByRole('combobox', { name: 'مسیر آزمایشی', exact: true }).selectOption('airport-transfer'); await settle(page);
  const timeline = page.locator('[data-route-scene]').getByRole('list', { name: 'ترتیب بخش‌های مسیر' });
  await expect(timeline.locator('li')).toHaveCount(2); await expect(timeline.locator('li').nth(1)).toHaveAttribute('data-transfer', 'true');
  await expect(timeline).toContainText('انتقال زمینی ضروری');
  await expect(page.locator('[data-route-scene] [data-stop-place]')).toHaveAttribute('data-stop-place', 'thr');
  await page.getByRole('button', { name: 'بزرگ‌نمایی نقشه مسیر', exact: true }).click(); const beforeCamera = await camera(page); const before = await report(page);
  await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => { const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context'); if (!extension) throw new Error('Required actual context-loss extension missing'); (window as unknown as { routeLoss: WEBGL_lose_context }).routeLoss = extension; extension.loseContext(); });
  await expect(page.locator('[data-graphics-status="context-lost"]')).toBeVisible(); await expect(page.locator('[data-route-scene] [data-fallback="true"]')).toBeVisible();
  await page.getByRole('combobox', { name: 'انتخاب نقطه نقشه مسیر', exact: true }).selectOption('ika'); expect((await report(page)).selectedPlace).toBe('ika');
  await page.getByRole('button', { name: 'تغییر روشنایی' }).click();
  await page.evaluate(() => (window as unknown as { routeLoss: WEBGL_lose_context }).routeLoss.restoreContext());
  await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible(); await settle(page); expect(await camera(page)).toEqual(beforeCamera);
  const restored = await report(page); expect(restored.restored).toBe(1); expect(restored.pinned).toBe(before.pinned); expect(restored.programs.every(program => program.linked)).toBe(true);
  await save('route-transfer-context', { beforeCamera, before, restored });
});
test('@route-scene local point input supports pointer, landmark, keyboard and two-pointer pinch on mobile', async ({ page }) => {
  await gpuObserver(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/route-lab'); await page.locator('[data-location-scene]').scrollIntoViewIfNeeded(); await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible();
  await expect(page.getByTestId('main-route-map')).not.toBeVisible();
  const picker = page.locator('[data-location-scene]'); await picker.scrollIntoViewIfNeeded();
  await expect(picker).toBeVisible();
  await picker.getByRole('combobox', { name: 'انتخاب نقطه انتخاب موقعیت', exact: true }).selectOption('tehran-landmark');
  expect((await report(page)).point).toEqual({ latitude: 35.673889, longitude: 51.422398 });
  const latitude = picker.getByRole('spinbutton', { name: 'عرض جغرافیایی' }); await latitude.fill('35.68'); await latitude.press('ArrowUp');
  expect((await report(page)).point!.latitude).toBeCloseTo(35.681, 5);
  const surface = picker.locator('[data-camera]'); await expect(surface).toBeVisible();
  await surface.evaluate(element => element.scrollIntoView({ block: 'center' })); const visible = (await surface.boundingBox())!;
  const clickX = visible.x + visible.width * .35, clickY = visible.y + visible.height * .65;
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('button'), { x: clickX, y: clickY })).toBe(false);
  const beforePoint = JSON.parse((await surface.getAttribute('data-camera'))!);
  await page.mouse.click(clickX, clickY);
  const pointer = (await report(page)).point!; expect(Number.isFinite(pointer.longitude)).toBe(true); expect(pointer.latitude).not.toBeCloseTo(35.681, 5);
  expect(pointer.longitude).toBeCloseTo(beforePoint.x - .15 * beforePoint.width, 5); expect(pointer.latitude).toBeCloseTo(beforePoint.y - .15 * beforePoint.height, 5);
  const initial = JSON.parse((await surface.getAttribute('data-camera'))!);
  // Pinch the map surface, away from interactive DOM marker buttons.
  const client = await page.context().newCDPSession(page);
  const x = visible.x + visible.width / 2, y = visible.y + visible.height * .85;
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('button'), { x: x + 30, y })).toBe(false);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 60, y, id: 1 }, { x: x + 60, y, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => JSON.parse((await surface.getAttribute('data-camera'))!).zoom).toBeGreaterThan(initial.zoom);
  const checkMarker = async () => {
    const alignment = await surface.evaluate(element => {
      const frame = JSON.parse((element as HTMLElement).dataset['camera']!);
      const latitude = (document.querySelector('input[aria-label="عرض جغرافیایی"]') as HTMLInputElement).valueAsNumber;
      const longitude = (document.querySelector('input[aria-label="طول جغرافیایی"]') as HTMLInputElement).valueAsNumber;
      const marker = element.querySelector('button[aria-label="نقطه انتخابی"]')!.parentElement!;
      const box = element.getBoundingClientRect();
      return { hidden: marker.hidden, x: marker.offsetLeft, y: marker.offsetTop, expectedX: (0.5 + (longitude - frame.x) / frame.width) * box.width, expectedY: (0.5 - (latitude - frame.y) / frame.height) * box.height };
    });
    expect(alignment.hidden).toBe(false); expect(Math.abs(alignment.x - alignment.expectedX)).toBeLessThan(1); expect(Math.abs(alignment.y - alignment.expectedY)).toBeLessThan(1);
    return alignment;
  };
  const afterPinchAlignment = await checkMarker();
  await picker.getByRole('button', { name: 'مقیاس اولیه انتخاب موقعیت', exact: true }).click(); await surface.scrollIntoViewIfNeeded(); await settle(page);
  const unzoomedAlignment = await checkMarker();
  const gpu = await page.evaluate(() => (window as unknown as { routeGPU: { customPointPixel: number[] } }).routeGPU);
  const focusColor = await page.evaluate(() => { const element = document.createElement('span'); element.style.color = 'var(--focus)'; document.body.append(element); const color = getComputedStyle(element).color.match(/[\d.]+/g)!.map(Number); element.remove(); return color; });
  expect(gpu.customPointPixel.slice(0, 3)).toEqual(focusColor.slice(0, 3)); expect(gpu.customPointPixel[3]).toBe(255);
  if (process.env.GRAPHICS_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.GRAPHICS_EVIDENCE_DIR}/mobile-location.png` });
  await save('route-mobile-location', { point: pointer, afterPinchAlignment, unzoomedAlignment, gpu, focusColor, camera: await surface.getAttribute('data-camera'), report: await report(page) });
});
test('@route-scene unavailable WebGL retains native timeline and location actions', async ({ page }) => {
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) { if (args[0] === 'webgl2') return null; return original.apply(this, args); } as typeof original; });
  await page.goto('/route-lab'); await expect(page.locator('[data-graphics-status="unavailable"]')).toBeVisible();
  await expect(page.locator('[data-route-scene] [data-fallback="true"] svg')).toBeVisible();
  await page.getByRole('combobox', { name: 'انتخاب نقطه نقشه مسیر', exact: true }).selectOption('thr'); expect((await report(page)).selectedPlace).toBe('thr');
  await page.locator('[data-location-scene]').getByRole('combobox', { name: 'انتخاب نقطه انتخاب موقعیت', exact: true }).selectOption('tehran-landmark');
  expect((await report(page)).point!.longitude).toBe(51.422398);
  await save('route-unavailable', await report(page));
});

test('@route-scene custom projection keeps real geography visible through empty fits and stable previews', async ({ page }) => {
  // Supply the public prop at the existing lab caller; production lab/default behavior is unchanged.
  await page.route('**/libs/graphics/src/route-lab.tsx', async route => {
    const response = await route.fetch(); const source = await response.text(); const anchor = 'fitKey: String(fit),';
    if (!source.includes(anchor)) throw new Error('Public RouteScene lab prop insertion point changed');
    await route.fulfill({ response, body: source.replace(anchor, 'projection: { centralLongitude: 54 }, fitKey: String(fit),') });
  });
  await gpuObserver(page); await ready(page); await settle(page);
  const initial = await camera(page); expect(initial.x).toBe(0);
  const gpu = () => page.evaluate(() => (window as unknown as { routeGPU: { maxColoredPixels: number; hashes: number[] } }).routeGPU);
  expect((await gpu()).maxColoredPixels).toBeGreaterThan(400);
  await page.getByRole('checkbox', { name: 'بدون برنامه سفر', exact: true }).check(); await settle(page); expect(await camera(page)).toEqual(initial);
  await expect(page.locator('[data-route-scene]')).toContainText('برای نمایش مسیر، مبدأ و مقصد را انتخاب کنید.');
  await page.getByRole('button', { name: 'تثبیت و تنظیم دوربین', exact: true }).click(); await settle(page); expect((await camera(page)).x).toBe(0);
  await page.getByRole('checkbox', { name: 'بدون برنامه سفر', exact: true }).uncheck();
  await page.getByRole('button', { name: 'تثبیت و تنظیم دوربین', exact: true }).click(); await settle(page);
  const fitted = await camera(page); expect(Math.abs(fitted.x)).toBeLessThan(20); expect(fitted.x).not.toBe(initial.x);
  await page.getByRole('button', { name: 'پیش‌نمایش مسیر دیگر', exact: true }).click(); await settle(page); expect(await camera(page)).toEqual(fitted);
  await page.getByRole('button', { name: 'پایان پیش‌نمایش', exact: true }).click();
  await page.getByRole('combobox', { name: 'محدوده', exact: true }).selectOption('international');
  await page.getByRole('button', { name: 'نمای کامل جغرافیا', exact: true }).click(); await settle(page);
  const world = await camera(page); expect(world.x).toBe(0); expect(world.width).toBe(360);
  const final = await report(page); expect(final.programs.every(program => program.linked && program.vertexCompiled && program.fragmentCompiled)).toBe(true);
  await save('projection-browser', { projection: { centralLongitude: 54 }, initial, fitted, world, gpu: await gpu(), final });
  if (process.env.GRAPHICS_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.GRAPHICS_EVIDENCE_DIR}/projection-context54.png` });
});
