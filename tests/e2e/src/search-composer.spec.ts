import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const evidence = process.env.T15_EVIDENCE_DIR;
function record(name: string, value: unknown) { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, name), JSON.stringify(value, null, 2)); } }
test.describe('@search-composer actual API consumer journey', () => {
  test('six modes/scopes, API-only network, ages, local dates and real requests', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    let starts = 0; let sessions = 0;
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) starts++; if (request.url().endsWith('/api/v1/demo/session')) sessions++; });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
    expect(starts).toBe(0); expect(sessions).toBe(1);
    const journeys = [];
    for (const mode of ['پرواز', 'قطار', 'اتوبوس']) for (const scope of ['داخلی','بین‌المللی']) {
      await page.getByRole('button', { name: 'سفرهای پیشنهادی', exact: true }).click();
      const preset = page.getByRole('button', { name: new RegExp(`^${mode} ${scope} ·`) });
      await preset.click();
      await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
      const before = page.url();
      await page.getByLabel('تعداد کودک', { exact: true }).fill('1');
      await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeDisabled();
      await page.getByLabel('سن کودک 1 سال', { exact: true }).fill('8');
      await page.getByLabel('تعداد نوزاد', { exact: true }).fill('1');
      await page.getByLabel('سن نوزاد 1 ماه', { exact: true }).fill('12');
      expect(page.url()).toBe(before);
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/searches') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const result = await response.json();
      expect(result.snapshot.query.party).toMatchObject({ adults: 1, children: 1, infants: 1, childAges: [8], infantAgesMonths: [12] });
      await expect(page.getByRole('status').filter({ hasText: 'درخواست جست‌وجو برای' })).toBeVisible();
      journeys.push({ mode, scope, status: response.status(), query: result.snapshot.query, searchId: result.snapshot.searchId });
    }
    expect(starts).toBe(6); expect(errors).toEqual([]);
    record('six-combinations.json', { journeys, starts, sessions, pageErrors: errors });
  });
  test('keyboard endpoints, round trip invalidation, party limits and browser URL history', async ({ page }) => {
    await page.goto('/');
    const origin = page.getByRole('combobox', { name: 'مبدا', exact: true });
    await expect(origin).toHaveValue('تهران');
    await origin.fill('مشهد'); await expect(page.getByRole('option', { name: 'مشهد', exact: true })).toBeVisible(); await origin.press('ArrowDown'); await expect(origin).toHaveAttribute('aria-activedescendant', /.+/); await origin.press('Enter');
    await expect(origin).toHaveValue('مشهد');
    const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
    await destination.fill('تهران'); await expect(page.getByRole('option', { name: 'تهران', exact: true })).toBeVisible(); await destination.press('ArrowDown'); await expect(destination).toHaveAttribute('aria-activedescendant', /.+/); await destination.press('Enter');
    await expect(destination).toHaveValue('تهران');
    await page.getByRole('radio', { name: 'رفت‌وبرگشت', exact: true }).focus(); await page.keyboard.press('Space');
    const explorer = page.getByRole('region', { name: 'کاوش تاریخ سفر' });
    const date = (await explorer.getAttribute('data-selected-outbound'))!;
    const calendar = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ' });
    await calendar.click();
    const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر' });
    await dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true }).fill(date);
    await dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'درخواست جست‌وجو برای' })).toBeVisible();
    const first = page.url();
    const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    await page.getByLabel('تعداد نوزاد', { exact: true }).fill('2');
    await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeDisabled();
    await page.getByLabel('تعداد نوزاد', { exact: true }).fill('0');
    await calendar.click();
    await dialog.getByLabel('تاریخ رفت میلادی در تقویم', { exact: true }).fill(next.toISOString().slice(0,10));
    await expect(dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true })).toHaveValue('');
    await expect(dialog.getByText(/تاریخ برگشت را دوباره انتخاب کنید/)).toBeVisible();
    expect(page.url()).toBe(first);
    await dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true }).fill(next.toISOString().slice(0,10));
    await dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'درخواست جست‌وجو برای' })).toBeVisible();
    const second = page.url(); expect(second).not.toBe(first);
    let posts = 0; page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/searches')) posts++; });
    await page.goBack(); await expect(explorer).toHaveAttribute('data-selected-outbound',date);
    await expect(page.getByText('درخواست جست‌وجو برای', { exact: false })).toHaveCount(0);
    await page.goForward(); await expect(explorer).toHaveAttribute('data-selected-outbound',next.toISOString().slice(0,10));
    await page.reload(); await expect(explorer).toHaveAttribute('data-selected-outbound',next.toISOString().slice(0,10));
    expect(posts).toBe(0);
    record('history-keyboard.json', { first, second, postsAfterNavigation: posts });
  });
  test('recoverable malformed links and responsive layout with one shared deferred chart host', async ({ page }) => {
    await page.addInitScript(() => {
      if (!document.startViewTransition) return;
      const original = document.startViewTransition.bind(document);
      const transitions: Promise<void>[] = [];
      (window as unknown as { composerTransitions: Promise<void>[] }).composerTransitions = transitions;
      document.startViewTransition = ((update: Parameters<Document['startViewTransition']>[0]) => {
        const transition = original(update); transitions.push(transition.finished.catch(() => undefined)); return transition;
      }) as Document['startViewTransition'];
    });
    const scripts: string[] = []; page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    await page.goto('/?q=x&q=y');
    await expect(page.getByText(/پیوند جست‌وجو معتبر نیست/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
    if (evidence) await page.screenshot({ path: resolve(evidence, 'invalid-link.png'), fullPage: true });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
    const widths = [];
    for (const width of [390,768,1440]) {
      await page.setViewportSize({ width, height: 960 });
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
      expect(dimensions.scroll).toBeLessThanOrEqual(width);
      if (width >= 1120) await expect(page.getByRole('complementary', { name: 'نمای مسیر' })).toBeVisible();
      else await expect(page.getByRole('complementary', { name: 'نمای مسیر' })).toBeHidden();
      if (evidence) await page.screenshot({ path: resolve(evidence, `consumer-${width}.png`), fullPage: true });
      widths.push(dimensions);
    }
    await page.getByRole('button', { name: 'سفرهای پیشنهادی', exact: true }).click();
    await page.getByRole('button', { name: /^قطار داخلی ·/ }).click();
    await page.getByRole('button', { name: 'نمای تیره', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'train');
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    await page.evaluate(async () => { await Promise.all((window as unknown as { composerTransitions?: Promise<void>[] }).composerTransitions ?? []); });
    if (evidence) await page.screenshot({ path: resolve(evidence, 'train-dark-1440.png'), fullPage: true });
    await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready');
    await expect(page.locator('canvas')).toHaveCount(1);
    expect(scripts.some(url => /shared-renderer|three/.test(url))).toBe(true);
    record('responsive.json', { widths, scriptCount: scripts.length, graphicsRequestedForDateChart: true, sharedCanvases: 1 });
  });
  test('owner API reset fences a held response across document reload', async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let sent = false;
    let heldSearchId = '';
    await page.route('**/api/v1/searches', async route => {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      heldSearchId = (await response.json()).snapshot.searchId;
      sent = true;
      await held;
      await route.fulfill({ response }).catch(() => undefined);
    });
    await page.goto('/');
    const submit = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true });
    await expect(submit).toBeEnabled(); await submit.click();
    await expect.poll(() => sent).toBe(true);
    // The traveler flow intentionally exposes no destructive session operation.
    await expect(page.getByRole('button',{name:/پاک کردن فعالیت|شروع دوباره نشست/})).toHaveCount(0);
    const start = Date.now();const reset=await page.request.post('/api/v1/demo/reset',{data:{}});
    expect(reset.status()).toBe(201);expect(Date.now()-start).toBeLessThan(5000);
    expect((await page.request.get('/api/v1/searches/'+heldSearchId)).status()).toBe(404);
    await page.reload();release();
    await expect(submit).toBeEnabled();
    await expect(page.getByText(/درخواست جست‌وجو برای/)).toHaveCount(0);
    record('reset-race.json', { heldSearch: true, heldSearchId, resetStatus: 201, resetBody:{}, recovery:'owner API plus document reload', oldSource404:true, elapsedMs: Date.now() - start, lateAdoption: false });
  });

  test('bounds unresolved starts across history and recovers after stale cleanup', async ({ page }) => {
    const held: (() => void)[] = [];
    const requests: { status: number; searchId?: string; supersedesSearchId?: string }[] = [];
    let hold = true;
    await page.route('**/api/v1/searches', async route => {
      const request = route.request().postDataJSON();
      const response = await route.fetch();
      const body = await response.json();
      requests.push({ status: response.status(), searchId: body.snapshot?.searchId, supersedesSearchId: request.supersedesSearchId });
      if (hold) await new Promise<void>(resolve => held.push(resolve));
      await route.fulfill({ response }).catch(() => undefined);
    });
    await page.goto('/');
    const submit = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true });
    try {
      for (let index = 0; index < 2; index++) {
        await expect(submit).toBeEnabled(); await submit.click();
        await expect.poll(() => requests.length).toBe(index + 1);
        await page.goBack();
      }
      // The old implementation admits a third held response after history restore.
      if (await submit.isEnabled()) { await submit.click(); await expect.poll(() => requests.length).toBe(3); }
      expect(requests).toHaveLength(2);
      await expect(submit).toBeDisabled();
      await expect(page.getByRole('status').filter({ hasText: 'دو درخواست جست‌وجو در انتظار پاسخ است' })).toBeVisible();
      const cancel = page.waitForResponse(response => response.url().endsWith(`/searches/${requests[0]!.searchId}/cancel`));
      held[0]!();
      expect((await cancel).status()).toBe(201);
      await expect(submit).toBeEnabled();
      await expect(page.getByText(/درخواست جست‌وجو برای/)).toHaveCount(0);
      hold = false;
      await submit.click(); await expect.poll(() => requests.length).toBe(3);
      await expect(page.getByRole('status').filter({ hasText: 'درخواست جست‌وجو برای' })).toBeVisible();
      expect(requests[2]!.status).toBe(201);
      await submit.click(); await expect.poll(() => requests.length).toBe(4);
      await expect(page.getByRole('status').filter({ hasText: 'درخواست جست‌وجو برای' })).toBeVisible();
      expect(requests[3]!.supersedesSearchId).toBe(requests[2]!.searchId);
      const reset=await page.request.post('/api/v1/demo/reset',{data:{}});expect(reset.status()).toBe(201);
      expect((await page.request.get('/api/v1/searches/'+requests[3]!.searchId)).status()).toBe(404);
      await page.reload();held[1]!();
      await expect(submit).toBeEnabled();
      await expect(page.getByText(/درخواست جست‌وجو برای/)).toHaveCount(0);
      record('unresolved-start-cap.json', { requests, cap: 2, noExtraPostAtCapacity: true, staleCleanupRecoveredCapacity: true, supersessionRetained: true, ownResetStatus: 201, explicitResetBody:{}, recovery:'owner API plus document reload', oldSource404:true });
    } finally { for (const release of held) release(); }
  });

});
