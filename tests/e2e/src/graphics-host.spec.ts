import { chromium, expect, test, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GraphicsDiagnostics } from '@torob-ticket/graphics';
type Report = GraphicsDiagnostics & { selected: string; cameraX: number };
async function report(page: Page): Promise<Report> {
  await page.getByRole('button', { name: 'تازه‌سازی گزارش' }).evaluate((element: HTMLButtonElement) => element.click());
  return JSON.parse(await page.getByTestId('graphics-report').innerText()) as Report;
}
async function ready(page: Page) {
  await page.goto('/graphics-lab');
  try { await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible(); } catch (error) { console.log('HOST_DIAGNOSTICS', await report(page), await page.locator('[data-active-scenes]').getAttribute('data-active-scenes')); throw error; }
}
async function evidence(name: string, value: unknown) {
  if (process.env.GRAPHICS_EVIDENCE_DIR) await writeFile(`${process.env.GRAPHICS_EVIDENCE_DIR}/${name}.json`, JSON.stringify(value, null, 2));
}
const firstView = 'مسیر اول: تهران به شیراز';
const secondView = 'مسیر دوم: تهران به اصفهان';
test('@graphics-host real shaders share resources, clip, and synchronously follow all six palettes', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.getByRole('heading', { name: 'کارگاه گرافیک' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  const initial = await report(page);
  expect(initial.programs).toEqual([{ linked: true, vertexCompiled: true, fragmentCompiled: true, programLog: '', vertexLog: '', fragmentLog: '' }]);
  expect(initial.geometries).toBe(1);
  expect(initial.programsInMemory).toBe(1);
  expect(initial.activeViews).toBe(2);
  expect(initial.pixels['outside']).toEqual([0, 0, 0, 0]);
  const palettes = [
    { mode: 'flight', light: [244, 246, 248, 255], dark: [14, 27, 37, 255] },
    { mode: 'train', light: [241, 247, 243, 255], dark: [13, 33, 26, 255] },
    { mode: 'bus', light: [250, 243, 243, 255], dark: [36, 18, 22, 255] },
  ];
  const snapshots: unknown[] = [];
  // Capture pixels inside the actual native transition callback, immediately after its DOM update.
  await page.evaluate(() => {
    const original = document.startViewTransition.bind(document);
    const samples: number[][] = [];
    (window as unknown as { transitionPixels: number[][] }).transitionPixels = samples;
    document.startViewTransition = ((update: () => Promise<void> | void) => original(async () => {
      await update();
      const canvas = document.querySelector('canvas')!;
      const gl = canvas.getContext('webgl2')!;
      const rect = document.querySelector('[data-graphics-view]')!.getBoundingClientRect();
      const ratio = canvas.width / innerWidth;
      const pixel = new Uint8Array(4);
      gl.readPixels(Math.floor((rect.left + rect.width * 0.25) * ratio), Math.floor((innerHeight - rect.top - rect.height * 0.5) * ratio), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      samples.push([...pixel]);
    })) as typeof document.startViewTransition;
  });
  for (const palette of palettes) {
    await page.getByRole('combobox', { name: 'نوع سفر' }).selectOption(palette.mode);
    await expect(page.locator('html')).toHaveAttribute('data-mode', palette.mode);
    await expect.poll(async () => (await report(page)).pixels[firstView]).toEqual(palette.light);
    const light = await report(page);
    expect(light.pixels[secondView]).toEqual(palette.light);
    await page.getByRole('button', { name: 'تغییر روشنایی' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    await expect.poll(async () => (await report(page)).pixels[firstView]).toEqual(palette.dark);
    const dark = await report(page);
    expect(dark.pixels[secondView]).toEqual(palette.dark);
    expect(dark.themeFrames).toBeGreaterThan(light.themeFrames);
    expect(dark.geometries).toBe(1);
    expect(dark.programsInMemory).toBe(1);
    snapshots.push({ palette: palette.mode, light, dark });
    await page.getByRole('button', { name: 'تغییر روشنایی' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'light');
  }
  const transitionPixels = await page.evaluate(() => (window as unknown as { transitionPixels: number[][] }).transitionPixels);
  expect(transitionPixels).toEqual(palettes.flatMap(palette => [palette.dark, palette.light]));
  expect(errors).toEqual([]);
  await evidence('gpu-palettes', { browser: browser.version(), viewport: page.viewportSize(), initial, snapshots, transitionPixels, errors });
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); scrollTo(0, 0); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  if (process.env.GRAPHICS_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.GRAPHICS_EVIDENCE_DIR}/two-views.png` });
});

test('@graphics-host idle, reduced motion, clipping and native dialog preserve controls and intent', async ({ page }) => {
  await ready(page);
  const first = await report(page);
  await page.waitForTimeout(180);
  expect((await report(page)).frames).toBe(first.frames);
  await page.getByRole('button', { name: 'انتخاب مسیر دوم' }).click();
  await page.getByRole('button', { name: 'جابجایی دوربین' }).click();
  await expect(page.getByLabel('جابجایی دوربین', { exact: true })).toHaveText('0.1');
  await page.getByRole('checkbox', { name: 'حرکت مسیر' }).check();
  await expect.poll(async () => (await report(page)).frames).toBeGreaterThan(first.frames + 3);
  await page.getByRole('button', { name: 'باز کردن گفتگو' }).click();
  const modal = page.getByRole('dialog', { name: 'تنظیمات مسیر' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'بستن گفتگو' })).toBeFocused();
  // Native dialog makes the background inert. Read the controller through the report button's real handler,
  // without attempting a pointer click through an inert background.
  const whileCovered = async () => {
    await page.getByRole('button', { name: 'تازه‌سازی گزارش', includeHidden: true }).evaluate((element: HTMLButtonElement) => element.click());
    return JSON.parse(await page.getByTestId('graphics-report').innerText()) as Report;
  };
  const covered = await whileCovered();
  await page.waitForTimeout(180);
  expect((await whileCovered()).frames).toBe(covered.frames);
  await page.keyboard.press('Tab');
  // Chrome may visit browser chrome between native dialog tab cycles; background controls stay inert.
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'بستن گفتگو' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'باز کردن گفتگو' })).toBeFocused();
  await expect(page.getByLabel('مسیر انتخاب‌شده')).toHaveText('دوم');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(80);
  const reduced = await report(page);
  await page.waitForTimeout(180);
  expect((await report(page)).frames).toBe(reduced.frames);
  await page.getByRole('button', { name: 'نمایش یا پنهان کردن نمای دوم' }).click();
  await expect.poll(async () => (await report(page)).activeViews).toBe(1);
  expect((await report(page) as Report & { frameSubscribers: number }).frameSubscribers).toBeLessThan((first as Report & { frameSubscribers: number }).frameSubscribers);
  await page.evaluate(() => scrollTo(0, 140));
  await page.waitForTimeout(80);
  const scrolled = await report(page);
  expect(scrolled.pixels['outside']).toEqual([0, 0, 0, 0]);
  expect(scrolled.pixels[firstView]).toEqual([244, 246, 248, 255]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  const offscreen = await report(page);
  await page.waitForTimeout(180);
  expect((await report(page)).frames).toBe(offscreen.frames);
  await evidence('lifecycle', { idle: first, covered, reduced, scrolled, offscreen });
});

test('@graphics-host actual context loss and restoration retain selection and camera; teardown releases host', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'انتخاب مسیر دوم' }).click();
  await page.getByRole('button', { name: 'جابجایی دوربین' }).click();
  const before = await report(page);
  await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Required real WEBGL_lose_context unavailable');
    (window as unknown as { lossExtension: WEBGL_lose_context }).lossExtension = extension;
    extension.loseContext();
  });
  await expect(page.locator('[data-graphics-status="context-lost"]')).toBeVisible();
  await expect(page.locator('[data-graphics-view][data-fallback="true"]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'انتخاب مسیر دوم' })).toBeEnabled();
  const lost = await report(page);
  await page.getByRole('button', { name: 'تغییر روشنایی' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  expect((await report(page)).frames).toBe(lost.frames);
  await page.evaluate(() => (window as unknown as { lossExtension: WEBGL_lose_context }).lossExtension.restoreContext());
  await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible();
  const restored = await report(page);
  expect(restored.restored).toBe(1);
  expect(restored.selected).toBe(before.selected);
  expect(restored.cameraX).toBe(before.cameraX);
  expect(restored.pixels[firstView]).toEqual([14, 27, 37, 255]);
  expect(restored.programs.every(program => program.linked)).toBe(true);
  await page.locator('canvas').evaluate(canvas => { (window as unknown as { releasedCanvas: HTMLCanvasElement }).releasedCanvas = canvas as HTMLCanvasElement; });
  await page.getByRole('button', { name: 'آزادسازی گرافیک' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  const disposed = await report(page);
  expect(disposed.disposed).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as { releasedCanvas: HTMLCanvasElement }).releasedCanvas.getContext('webgl2')!.isContextLost())).toBe(true);
  await page.waitForTimeout(120);
  expect((await report(page)).frames).toBe(disposed.frames);
  await page.getByRole('button', { name: 'راه‌اندازی گرافیک' }).click();
  await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible();
  expect((await report(page)).geometries).toBe(1);
  await evidence('context-recovery', { before, lost, restored, disposed });
});

test('@graphics-host actual bad GLSL exposes SVG and usable native actions', async ({ page }) => {
  await page.goto('/graphics-lab?shader=broken');
  await expect(page.locator('[data-graphics-status="shader-error"]')).toBeVisible();
  await expect(page.locator('[data-graphics-view][data-fallback="true"] svg')).toHaveCount(2);
  await page.getByRole('button', { name: 'انتخاب مسیر دوم' }).click();
  await expect(page.getByLabel('مسیر انتخاب‌شده')).toHaveText('دوم');
  await page.getByRole('button', { name: 'باز کردن گفتگو' }).click();
  await page.getByRole('button', { name: 'بستن گفتگو' }).click();
  const activeFallback = page.locator('[data-graphics-view] > div').first();
  await expect(activeFallback).not.toHaveAttribute('inert');
  const fallbackFocusWorks = await activeFallback.evaluate(element => {
    const button = document.createElement('button');
    button.textContent = 'fallback keyboard probe';
    element.append(button);
    button.focus();
    const focused = document.activeElement === button;
    button.remove();
    return focused;
  });
  expect(fallbackFocusWorks).toBe(true);
  const failed = await report(page);
  expect(failed.programs[0]?.fragmentCompiled).toBe(false);
  expect(failed.programs[0]?.fragmentLog).toContain('ERROR');
  await evidence('shader-failure', failed);
  if (process.env.GRAPHICS_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.GRAPHICS_EVIDENCE_DIR}/shader-fallback.png`, fullPage: true });
});

test('@graphics-host browser-disabled WebGL still offers useful SVG and selection', async ({ baseURL }) => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL, args: ['--disable-webgl'] });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/graphics-lab`);
    await expect(page.locator('[data-graphics-status="unavailable"]')).toBeVisible();
    await expect(page.locator('[data-graphics-view][data-fallback="true"] svg')).toHaveCount(2);
    await page.getByRole('button', { name: 'انتخاب مسیر دوم' }).click();
    await expect(page.getByLabel('مسیر انتخاب‌شده')).toHaveText('دوم');
    await evidence('webgl-disabled', { browser: browser.version(), webgl2: await page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null), selected: await page.getByLabel('مسیر انتخاب‌شده').innerText() });
  } finally { await browser.close(); }
});

test('@graphics-host genuinely hidden Chrome tab pauses and resumes with latest theme', async ({ baseURL }) => {
  test.setTimeout(45000);
  // Resolve the installed browser through Playwright, then use a fresh CDP connection without
  // its focus emulation. A second CDP session cannot undo another session's focus override.
  const resolver = await chromium.launchServer({ channel: process.env.PLAYWRIGHT_CHANNEL });
  const executable = resolver.process().spawnfile;
  await resolver.close();
  const profile = await mkdtemp(join(tmpdir(), 'torobticket-graphics-visibility-'));
  const processHandle = spawn(executable, ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-background-networking', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
  try {
    let port = '';
    await expect.poll(async () => {
      try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0] ?? ''; return Boolean(port); } catch { return false; }
    }, { timeout: 10000 }).toBe(true);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
    const context = browser.contexts()[0]!;
    const page = context.pages()[0] ?? await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${baseURL}/graphics-lab`);
    await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible();
    await page.getByRole('checkbox', { name: 'حرکت مسیر' }).check();
    const running = await report(page);
    await expect.poll(async () => (await report(page)).frames).toBeGreaterThan(running.frames + 2);
    const foreground = await context.newPage();
    await foreground.goto('about:blank');
    await foreground.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden');
    const readHidden = async () => {
      await page.getByRole('button', { name: 'تازه‌سازی گزارش' }).evaluate((element: HTMLButtonElement) => element.click());
      return JSON.parse(await page.getByTestId('graphics-report').innerText()) as Report;
    };
    const hidden = await readHidden();
    await page.waitForTimeout(200);
    expect((await readHidden()).frames).toBe(hidden.frames);
    await page.getByRole('button', { name: 'تغییر روشنایی' }).evaluate((element: HTMLButtonElement) => element.click());
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    expect((await readHidden()).frames).toBe(hidden.frames);
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
    await expect.poll(async () => (await report(page)).frames).toBeGreaterThan(hidden.frames);
    const resumed = await report(page);
    expect(resumed.pixels[firstView]).toEqual([14, 27, 37, 255]);
    await evidence('document-visibility', { method: 'Chrome CDP noDefaults=true; real foreground/background tabs', running, hidden, resumed });
  } finally {
    await browser?.close();
    if (processHandle.exitCode === null) {
      const exited = new Promise<void>(resolve => processHandle.once('exit', () => resolve()));
      processHandle.kill('SIGTERM');
      await exited;
    }
    await rm(profile, { recursive: true, force: true });
  }
});

test('@graphics-host real high-density resize respects desktop and mobile budgets', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ deviceScaleFactor: 3, viewport: { width: 1280, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/graphics-lab`);
    await expect(page.locator('[data-graphics-status="ready"]')).toBeVisible();
    const desktop = await report(page);
    expect(desktop.quality.dpr).toBe(1.75);
    expect(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(2240);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await report(page)).quality.dpr).toBe(1.5);
    await expect.poll(() => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(585);
    const mobile = await report(page);
    await expect(page.getByRole('button', { name: 'انتخاب مسیر دوم' })).toBeEnabled();
    await evidence('dpr-resize', { desktop, mobile });
  } finally { await context.close(); }
});

interface SceneProbe { hits: number; hiddenCommits: number }
async function installNestedSceneProbe(page: Page) {
  // Replace only the laboratory scene response, keeping the actual shared host/GLSL/GPU.
  // The nested component intentionally knows nothing about GraphicsController.
  await page.route('**/libs/graphics/src/lab-scene.tsx', async route => {
    const response = await route.fetch();
    let source = await response.text();
    const signature = 'export function LabScene({ resources, cameraX, moving }) {';
    if (!source.includes(signature) || !source.includes('geometry: resources.geometry,')) throw new Error('Laboratory scene probe insertion points changed');
    source = source.replace(signature, `${signature}
      const [probeVisible, setProbeVisible] = useState(true);
      const sceneInvalidate = useThree(state => state.invalidate);
      useFrame(() => { if (window.graphicsProbeLoop) sceneInvalidate(); });
      useEffect(() => {
        window.graphicsSceneProbe ??= { hits: 0, hiddenCommits: 0 };
        (window.graphicsCapturedInvalidations ??= []).push(sceneInvalidate);
        const hide = () => setProbeVisible(false);
        const imperative = () => { resources.material.uniforms.background.value.w = 0; sceneInvalidate(); };
        window.addEventListener('graphics-probe-local-state', hide);
        window.addEventListener('graphics-probe-invalidate', imperative);
        return () => { window.removeEventListener('graphics-probe-local-state', hide); window.removeEventListener('graphics-probe-invalidate', imperative); };
      }, [resources, sceneInvalidate]);
      useLayoutEffect(() => { if (!probeVisible) window.graphicsSceneProbe.hiddenCommits++; }, [probeVisible]);
    `);
    source = source.replace('geometry: resources.geometry,', 'visible: probeVisible, onPointerDown: () => { window.graphicsSceneProbe.hits++; setProbeVisible(false); }, geometry: resources.geometry,');
    await route.fulfill({ response, body: source });
  });
}
async function settleFrames(page: Page) {
  await page.evaluate(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
}
test('@graphics-host retained fallback permits real mesh pointer hits without invisible keyboard targets', async ({ page }) => {
  await installNestedSceneProbe(page);
  await ready(page);
  await settleFrames(page);
  const before = await report(page);
  const view = page.locator('[data-graphics-view]').first();
  const box = (await view.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await expect.poll(() => page.evaluate(() => (window as unknown as { graphicsSceneProbe: SceneProbe }).graphicsSceneProbe.hits)).toBe(1);
  await expect.poll(async () => (await report(page)).pixels[firstView]).toEqual([0, 0, 0, 0]);
  const after = await report(page);
  expect(after.frames).toBe(before.frames + 1);
  expect(after.pixels[secondView]).toEqual([244, 246, 248, 255]);
  const focus = await view.locator(':scope > div').evaluate(element => {
    const button = document.createElement('button');
    button.textContent = 'fallback keyboard probe';
    element.append(button);
    button.focus();
    const focused = document.activeElement === button;
    button.remove();
    return focused;
  });
  expect(focus).toBe(false);
  const retainedBox = (await view.boundingBox())!;
  expect([retainedBox.width, retainedBox.height]).toEqual([box.width, box.height]);
  await evidence('review-pointer', { before, after, fallbackFocused: focus });
});
test('@graphics-host arbitrary nested local state commits draw without external host events', async ({ page }) => {
  await installNestedSceneProbe(page);
  await ready(page);
  await settleFrames(page);
  const before = await report(page);
  await page.evaluate(() => window.dispatchEvent(new Event('graphics-probe-local-state')));
  await expect.poll(() => page.evaluate(() => (window as unknown as { graphicsSceneProbe: SceneProbe }).graphicsSceneProbe.hiddenCommits)).toBe(2);
  await expect.poll(async () => (await report(page)).pixels[firstView]).toEqual([0, 0, 0, 0]);
  const after = await report(page);
  expect(after.pixels[secondView]).toEqual([0, 0, 0, 0]);
  expect(after.frames).toBe(before.frames + 1);
  await page.waitForTimeout(180);
  expect((await report(page)).frames).toBe(after.frames);
  await evidence('review-local-state', { before, after });
});
test('@graphics-host standard useThree invalidate paints imperative changes once', async ({ page }) => {
  await installNestedSceneProbe(page);
  await ready(page);
  await settleFrames(page);
  const before = await report(page);
  await page.evaluate(() => window.dispatchEvent(new Event('graphics-probe-invalidate')));
  await expect.poll(async () => (await report(page)).pixels[firstView]).toEqual([0, 0, 0, 0]);
  const after = await report(page);
  expect(after.pixels[secondView]).toEqual([0, 0, 0, 0]);
  expect(after.frames).toBe(before.frames + 1);
  await page.waitForTimeout(180);
  expect((await report(page)).frames).toBe(after.frames);
  // A stale externally captured scene invalidator must not wake a covered host.
  await page.getByRole('button', { name: 'باز کردن گفتگو' }).click();
  const coveredReport = async () => {
    await page.getByRole('button', { name: 'تازه‌سازی گزارش', includeHidden: true }).evaluate((element: HTMLButtonElement) => element.click());
    return JSON.parse(await page.getByTestId('graphics-report').innerText()) as Report;
  };
  const covered = await coveredReport();
  await page.evaluate(() => (window as unknown as { graphicsCapturedInvalidations: (() => void)[] }).graphicsCapturedInvalidations.forEach(invalidate => invalidate()));
  await page.waitForTimeout(120);
  expect((await coveredReport()).frames).toBe(covered.frames);
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await settleFrames(page);
  const reduced = await report(page);
  // Standard invalidation from useFrame cannot create an unsolicited/reduced-motion loop.
  await page.evaluate(() => {
    (window as unknown as { graphicsProbeLoop: boolean }).graphicsProbeLoop = true;
    window.dispatchEvent(new Event('graphics-probe-invalidate'));
  });
  await expect.poll(async () => (await report(page)).frames).toBe(reduced.frames + 1);
  await page.waitForTimeout(180);
  const guarded = await report(page);
  expect(guarded.frames).toBe(reduced.frames + 1);
  await evidence('review-hook-invalidate', { before, after, covered, reduced, guarded });
});
