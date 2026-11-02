import { chromium, type BrowserContext } from '@playwright/test';
import { SessionInfoSchema } from '@torob-ticket/contracts';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, dateExplorer, loadQuery, priceCards, queryFor, runSearch, type OwnedReviewer } from '../fixtures';
import { activeContexts, cardClickPoint, graphicsReady, installNativeAudit, nativeAudit, observeWindow, save, waitForPaint, type NativeAudit } from './t32-graphics-audit';

const appearanceToggle = (reviewer: OwnedReviewer) => reviewer.page.getByRole('button', { name: /^(نمای روشن|نمای تیره)$/ });
async function settle(page: OwnedReviewer['page']) { await waitForPaint(page); await page.waitForTimeout(150); }
async function owned(context: BrowserContext, baseURL: string, seed: number): Promise<OwnedReviewer> {
  expect((await context.cookies()).length).toBe(0);
  const response = await context.request.post(baseURL + '/api/v1/demo/session', { data: { seed, anchorInstant: '2026-10-29T06:00:00Z', scenario: 'normal' }, timeout: 10_000 });
  expect(response.status()).toBe(201);
  return { context, page: context.pages()[0] ?? await context.newPage(), session: SessionInfoSchema.parse(await response.json()) };
}
async function reset(context: BrowserContext, baseURL: string) {
  if ((await context.cookies()).some(cookie => cookie.name === 'torob_demo')) {
    const response = await context.request.post(baseURL + '/api/v1/demo/reset', { data: {}, timeout: 5000 }); expect(response.status()).toBe(201);
  }
}

test('@graphics-lifecycle repeated hotel mode theme and breakpoint changes retain one app renderer and bounded native resources', async ({ newReviewer, browserName }, info) => {
  test.setTimeout(150_000);
  const reviewer = await newReviewer({ seed: 3234, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const { page } = reviewer; await installNativeAudit(page); await loadQuery(reviewer, queryFor()); await graphicsReady(page); await runSearch(reviewer);
  const cycles: NativeAudit[] = [], hotels: NativeAudit[] = [], modeCycles: NativeAudit[] = [], densities: NativeAudit[] = [];
  const coldHotel: { path?: string; status?: number; bytes?: number; sha256?: string; canceledLateImportDidNotReopen?: boolean } = {};
  try {
    let release!: () => void, delivered = false;
    const held = new Promise<void>(resolve => { release = resolve; }), modulePattern = /\/assets\/hotel-dialog-[^/]+\.js(?:\?.*)?$/;
    await page.route(modulePattern, async route => {
      const response = await route.fetch(), body = await response.body();
      Object.assign(coldHotel, { path: new URL(route.request().url()).pathname, status: response.status(), bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
      await held; await route.fulfill({ response }); delivered = true;
    });
    try {
      await page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true });
      await expect(dialog.getByRole('heading', { name: 'هتل‌های مشهد', exact: true })).toBeVisible(); await expect(dialog.locator('[data-hotel-loading]')).toBeVisible(); await expect.poll(() => coldHotel.status).toBe(200);
      await dialog.getByRole('button', { name: 'بستن', exact: true }).click(); await expect(dialog).toHaveCount(0);
      release(); await expect.poll(() => delivered).toBe(true); await page.waitForTimeout(150); await expect(dialog).toHaveCount(0);
      coldHotel.canceledLateImportDidNotReopen = true;
    } finally { release(); await page.unroute(modulePattern); }
    // Warm the optional real provider-owned renderer before comparing live counts.
    for (let cycle = 0; cycle < 5; cycle++) {
      await page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true }); await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-hotel-map]')).toHaveAttribute('data-free-map-status', /ready|unavailable/, { timeout: 30_000 });
      await settle(page); const open = await nativeAudit(page); hotels.push(open);
      expect(activeContexts(open, 'app-shared')).toHaveLength(1); expect(activeContexts(open, 'hotel-maplibre').length).toBeLessThanOrEqual(1);
      await dialog.getByRole('button', { name: 'بستن', exact: true }).click(); await expect(dialog).toHaveCount(0);
      await appearanceToggle(reviewer).click();
      await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
      expect((await nativeAudit(page)).canvas.provider).toBe(0);
      await page.setViewportSize({ width: 1440, height: 900 }); await settle(page);
      const audit = await nativeAudit(page); cycles.push(audit);
      expect(activeContexts(audit, 'app-shared')).toHaveLength(1); expect(activeContexts(audit, 'hotel-maplibre')).toHaveLength(0);
      expect(audit.contexts.filter(row => row.owner === 'hotel-maplibre').every(row => !row.connected && row.lost)).toBe(true);
      expect(audit.canvas.app).toBe(1); expect(audit.shaders).toEqual([]);
    }
    const warmed = cycles[1]!, last = cycles.at(-1)!;
    const firstApp = activeContexts(warmed, 'app-shared')[0]!, finalApp = activeContexts(last, 'app-shared')[0]!;
    expect(finalApp.id).toBe(firstApp.id);
    // Only native live objects are compared; cumulative creation can legitimately
    // increase on recreation. MapLibre ownership is measured separately above.
    for (const kind of ['Buffer', 'Texture', 'Framebuffer', 'Renderbuffer', 'Program', 'Shader']) expect(finalApp.live[kind] ?? 0, kind).toBeLessThanOrEqual((firstApp.live[kind] ?? 0) + 2);
    for (const mode of ['train', 'bus', 'flight', 'train', 'bus', 'flight'] as const) {
      await page.getByRole('radiogroup', { name: 'وسیله سفر', exact: true }).locator(`[data-segment-option="${mode}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('data-mode', mode); await settle(page);
      const audit = await nativeAudit(page); expect(activeContexts(audit, 'app-shared')).toHaveLength(1); expect(audit.shaders).toEqual([]); modeCycles.push(audit);
    }
    const warmedMode = activeContexts(modeCycles[2]!, 'app-shared')[0]!, finalMode = activeContexts(modeCycles[5]!, 'app-shared')[0]!;
    expect(finalMode.id).toBe(warmedMode.id);
    for (const kind of ['Buffer', 'Texture', 'Framebuffer', 'Renderbuffer', 'Program', 'Shader']) expect(finalMode.live[kind] ?? 0, 'mode cycle ' + kind).toBeLessThanOrEqual((warmedMode.live[kind] ?? 0) + 2);
    if (browserName === 'chromium') {
      const cdp = await reviewer.context.newCDPSession(page);
      try {
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
          await cdp.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 3, mobile: false }); await settle(page);
          const audit = await nativeAudit(page); densities.push(audit); expect(audit.viewport.dpr).toBe(3);
          expect(audit.canvas.pixelRatio).not.toBeNull(); expect(audit.canvas.pixelRatio!).toBeLessThanOrEqual(viewport.width > 600 ? 1.75 : 1.5);
          expect(Number(audit.graphics.graphicsDpr)).toBeCloseTo(audit.canvas.pixelRatio!, 2);
        }
      } finally { await cdp.send('Emulation.clearDeviceMetricsOverride'); await cdp.detach(); }
    }
  } finally { save(info, 'lifecycle-resource-trend', { seed: reviewer.session.seed, clock: reviewer.session.anchorInstant, motion: 'reduce', coldHotel, cycles, hotels, modeCycles, densities, limits: 'Unique native contexts; actual create/delete/live WebGL object counts. Loss clears live generation. Three geometries/programs come only from existing read-only Driver diagnostics; literal material count is unavailable. performance.memory is an uncollected Chromium JS heap trend, not retained GPU memory. Optional MapLibre owns its separate renderer and network failure is recorded. Cold hotel module is an actual fetched production payload held and delivered unchanged.' }); }
});

test('@graphics-lifecycle actual context loss restoration and browser-disabled WebGL retain useful comparison', async ({ newReviewer, baseURL }, info) => {
  test.setTimeout(90_000); const reviewer = await newReviewer({ seed: 3235 }); const { page } = reviewer;
  await installNativeAudit(page); await loadQuery(reviewer, queryFor()); await graphicsReady(page); await runSearch(reviewer);
  const before = await nativeAudit(page); let restored: NativeAudit | undefined, fallback: unknown;
  try {
    expect(await page.evaluate(() => (window as unknown as { t32NativeAudit: { lose: () => boolean } }).t32NativeAudit.lose())).toBe(true);
    await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'context-lost');
    await expect(priceCards(page).first()).toBeVisible();
    await appearanceToggle(reviewer).click();
    await page.evaluate(() => (window as unknown as { t32Restore: () => void }).t32Restore()); await graphicsReady(page);
    restored = await nativeAudit(page); expect(activeContexts(restored, 'app-shared')).toHaveLength(1); expect(restored.shaders).toEqual([]);
    expect(activeContexts(restored, 'app-shared')[0]!.generation).toBe(1);
    const next = priceCards(page).nth(1), selectNext = next.locator('[data-card-select]'); await selectNext.click({ position: await cardClickPoint(selectNext) }); await expect(next).toHaveAttribute('data-selected', 'true');
    await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-itinerary', (await page.locator('main[data-pinned-itinerary]').getAttribute('data-pinned-itinerary'))!);
    const disabled = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL, args: ['--disable-webgl'] });
    try {
      const context = await disabled.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
      try {
        const limited = await owned(context, baseURL!, 3236); await installNativeAudit(limited.page); await loadQuery(limited, queryFor());
        await expect(limited.page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'unavailable');
        const complete = await runSearch(limited); await expect(priceCards(limited.page).first()).toBeVisible();
        const alternate = priceCards(limited.page).nth(1), selectAlternate = alternate.locator('[data-card-select]'); await selectAlternate.click({ position: await cardClickPoint(selectAlternate) }); await expect(alternate).toHaveAttribute('data-selected', 'true');
        await expect(limited.page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-itinerary', (await limited.page.locator('main[data-pinned-itinerary]').getAttribute('data-pinned-itinerary'))!);
        await expect(limited.page.locator('[data-graphics-view][data-fallback="true"] svg').first()).toBeVisible();
        fallback = { status: complete.snapshot.status, cards: await priceCards(limited.page).count(), native: await nativeAudit(limited.page), webgl2Available: await limited.page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null) };
        expect((fallback as { webgl2Available: boolean }).webgl2Available).toBe(false);
      } finally { await reset(context, baseURL!); await context.close(); }
    } finally { await disabled.close(); }
  } finally { save(info, 'context-recovery', { before, restored, fallback, method: 'Real WEBGL_lose_context extension and native Chromium --disable-webgl process. No app diagnostic or production control hook.' }); }
});

test('@graphics-lifecycle visible ambience runs while reduced covered and mobile settled scenes stop native draws', async ({ newReviewer }, info) => {
  test.setTimeout(100_000); const reviewer = await newReviewer({ seed: 3237, reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
  const { page } = reviewer; await installNativeAudit(page); await loadQuery(reviewer, queryFor()); await graphicsReady(page);
  const samples: Record<string, unknown> = {};
  try {
    const visible = await observeWindow(page, 1000); samples.visible = visible; expect(visible.drawDelta).toBeGreaterThan(0);
    let release!: () => void, delivered = false;
    const held = new Promise<void>(resolve => { release = resolve; });
    const payload: { path?: string; status?: number; bytes?: number; sha256?: string } = {};
    const modulePattern = /\/assets\/date-calendar-[^/]+\.js(?:\?.*)?$/;
    await page.route(modulePattern, async route => {
      const response = await route.fetch(); const body = await response.body();
      Object.assign(payload, { path: new URL(route.request().url()).pathname, status: response.status(), bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') });
      await held; await route.fulfill({ response }); delivered = true;
    });
    try {
      const original = (await dateExplorer(page).getAttribute('data-selected-outbound'))!, originalUrl = page.url();
      const trigger = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }), dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
      await trigger.click(); await expect(dialog.getByRole('heading', { name: 'انتخاب تاریخ سفر', exact: true })).toBeVisible();
      await expect(dialog.locator('[data-calendar-loading]')).toBeVisible(); await expect.poll(() => payload.status).toBe(200);
      await expect(dialog.getByRole('button', { name: 'بستن', exact: true })).toBeEnabled();
      await dialog.getByRole('button', { name: 'انصراف', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
      await trigger.click(); await expect(dialog.locator('[data-calendar-loading]')).toBeVisible(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
      release(); await expect.poll(() => delivered).toBe(true); await page.waitForTimeout(150);
      await expect(dialog).toHaveCount(0); await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', original); expect(page.url()).toBe(originalUrl);
      await trigger.click(); await expect(dialog.getByRole('grid')).toBeVisible();
      const next = new Date(Date.parse(original + 'T12:00:00Z') + 86400_000).toISOString().slice(0, 10);
      await dialog.getByText('ورود تاریخ میلادی', { exact: true }).click(); await dialog.getByLabel('تاریخ رفت میلادی در تقویم', { exact: true }).fill(next);
      await dialog.getByRole('button', { name: 'انصراف', exact: true }).click(); await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', original);
      await trigger.click(); await expect(dialog.getByRole('grid')).toBeVisible();
      await dialog.getByText('ورود تاریخ میلادی', { exact: true }).click(); await dialog.getByLabel('تاریخ رفت میلادی در تقویم', { exact: true }).fill(next);
      const applied = await runSearch(reviewer, () => dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click());
      expect(applied.snapshot.query.departureDate).toBe(next); await expect(dialog).toHaveCount(0);
      samples.coldCalendar = { payload, original, applied: next, loadingCancel: true, loadingEscape: true, canceledLateImportDidNotReopen: true, provisionalCancelPreserved: true, actualApplyCommitted: true, method: 'Only actual fetched production dynamic-module delivery was held; original response/payload fulfilled unchanged. No fake calendar content or application state hook.' };
    } finally { release(); await page.unroute(modulePattern); }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await settle(page);
    const reduced = await observeWindow(page, 500); samples.reduced = reduced; expect(reduced.drawDelta).toBe(0); expect(reduced.clearDelta).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await runSearch(reviewer); await settle(page);
    await page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true }); await expect(dialog).toBeVisible(); await settle(page);
    const covered = await observeWindow(page, 500); samples.covered = covered; expect(covered.drawDelta).toBe(0); expect(covered.clearDelta).toBe(0);
    await dialog.getByRole('button', { name: 'بستن', exact: true }).click(); await settle(page);
    const resumed = await observeWindow(page, 500); samples.resumed = resumed; expect(resumed.drawDelta).toBeGreaterThan(0);
    await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
    const mobile = await observeWindow(page, 500); samples.mobile = mobile; expect(mobile.drawDelta).toBe(0); expect(mobile.clearDelta).toBe(0);
  } finally { save(info, 'motion-ownership', { samples, method: 'Actual app-owned native draw deltas. Visible decorative ambience is explicitly permitted continuous rendering. MapLibre draws are separate and never counted as the paused app renderer.' }); }
});

test('@graphics-lifecycle genuinely hidden native Chrome tab stops and resumes app rendering', async ({ baseURL }, info) => {
  test.setTimeout(60_000);
  const resolver = await chromium.launchServer({ channel: process.env.PLAYWRIGHT_CHANNEL }); const executable = resolver.process().spawnfile; await resolver.close();
  const profile = await mkdtemp(join(tmpdir(), 'torobticket-t32-native-visibility-'));
  const child = spawn(executable, ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-background-networking', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined, context: BrowserContext | undefined;
  const samples: Record<string, unknown> = {};
  try {
    let port = '';
    await expect.poll(async () => { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0] ?? ''; return Boolean(port); } catch { return false; } }, { timeout: 10_000 }).toBe(true);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true }); context = browser.contexts()[0]!;
    const reviewer = await owned(context, baseURL!, 3238), { page } = reviewer; await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ reducedMotion: 'no-preference' }); await installNativeAudit(page);
    await page.goto(baseURL + '/?' + new URLSearchParams({ q: JSON.stringify(queryFor()) })); await graphicsReady(page);
    const running = await observeWindow(page, 500); samples.running = running; expect(running.drawDelta).toBeGreaterThan(0);
    const foreground = await context.newPage(); await foreground.goto('about:blank'); await foreground.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden'); await page.waitForTimeout(150);
    const hidden = await observeWindow(page, 500); samples.hidden = hidden; expect(hidden.start.visibility).toBe('hidden'); expect(hidden.end.visibility).toBe('hidden'); expect(hidden.drawDelta).toBe(0); expect(hidden.clearDelta).toBe(0);
    await page.bringToFront(); await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
    const resumed = await observeWindow(page, 500); samples.resumed = resumed; expect(resumed.drawDelta).toBeGreaterThan(0);
  } finally {
    save(info, 'native-tab-visibility', { samples, method: 'Fresh native Chromium process + CDP noDefaults=true, real foreground/background tabs and document.visibilityState. No synthetic visibility property/event or application flag.' });
    const failures: string[] = [];
    try { if (context) await reset(context, baseURL!); } catch { failures.push('owned native reviewer reset failed'); }
    try { await browser?.close(); } finally {
      if (child.exitCode === null) { child.kill('SIGTERM'); await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]); if (child.exitCode === null) child.kill('SIGKILL'); }
      await rm(profile, { recursive: true, force: true });
    }
    expect(failures).toEqual([]);
  }
});
