import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SearchRecoverySchema } from '@torob-ticket/contracts';
import { dateExplorer, expect, resultRegion, runSearch, test } from '../fixtures';

const evidence = process.env.T15_EVIDENCE_DIR;
function record(name: string, value: unknown) { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, name), JSON.stringify(value, null, 2)); } }
const nextDay = (date: string) => { const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); };

test.describe('@search-composer actual API consumer journey', () => {
  test('six modes/scopes use the API network, one-adult intent, local dates and actual requests', async ({ newReviewer }) => {
    test.setTimeout(180_000);
    const errors: string[] = [], journeys = [], ownedContexts = new Set(); let starts = 0, sessionReads = 0;
    for (const mode of ['پرواز', 'قطار', 'اتوبوس']) for (const scope of ['داخلی', 'بین‌المللی']) {
      const reviewer = await newReviewer(), { page } = reviewer; ownedContexts.add(reviewer.context); let reads = 0;
      page.on('pageerror', () => errors.push('uncaught-page-error'));
      page.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) starts++;
        if (request.method() === 'GET' && request.url().endsWith('/api/v1/demo/session')) { reads++; sessionReads++; }
      });
      await page.goto('/'); await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'سفرهای پیشنهادی', exact: true }).click();
      await page.getByRole('button', { name: new RegExp('^' + mode + ' ' + scope + ' ·') }).click();
      await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30_000 });
      const before = page.url(), selectedDate = await dateExplorer(page).getAttribute('data-selected-outbound');
      await expect(page.getByLabel('تعداد کودک', { exact: true })).toHaveCount(0); await expect(page.getByLabel('تعداد نوزاد', { exact: true })).toHaveCount(0);
      expect(page.url()).toBe(before);
      const result = await runSearch(reviewer);
      expect(result.snapshot.query.party).toEqual({ adults: 1, children: 0, infants: 0 });
      expect(result.snapshot.query.departureDate).toBe(selectedDate);
      expect(reads).toBeGreaterThan(0);
      journeys.push({ mode, scope, session: reviewer.session, browserSessionReads: reads, query: result.snapshot.query, searchId: result.snapshot.searchId, status: result.snapshot.status });
    }
    expect(starts).toBe(6); expect(ownedContexts.size).toBe(6); expect(journeys).toHaveLength(6); expect(sessionReads).toBeGreaterThanOrEqual(6); expect(errors).toEqual([]);
    record('six-combinations.json', { journeys, starts, ownedSessions: ownedContexts.size, browserSessionReads: sessionReads, pageErrors: errors, sessionProof: 'Each newReviewer creates and schema-validates its own201 POST bootstrap. Browser GET reads may repeat during development StrictMode; they are observed per namespace rather than counted as new sessions.', replacement: 'Current consumer requests normalize to one adult. Required ages, family/maximum-party prices and invalid structures are covered by actual API acceptance.' });
  });

  test('keyboard endpoints, round-trip invalidation and browser URL history preserve the current one-adult contract', async ({ reviewer }) => {
    const { page } = reviewer; await page.goto('/');
    const origin = page.getByRole('combobox', { name: 'مبدا', exact: true }); await expect(origin).toHaveValue('تهران');
    await origin.fill('مشهد'); await expect(page.getByRole('option', { name: 'مشهد', exact: true })).toBeVisible(); await origin.press('ArrowDown'); await expect(origin).toHaveAttribute('aria-activedescendant', /.+/); await origin.press('Enter');
    await expect(origin).toHaveValue('مشهد');
    const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
    await destination.fill('تهران'); await expect(page.getByRole('option', { name: 'تهران', exact: true })).toBeVisible(); await destination.press('ArrowDown'); await expect(destination).toHaveAttribute('aria-activedescendant', /.+/); await destination.press('Enter'); await expect(destination).toHaveValue('تهران');
    await page.getByRole('radio', { name: 'رفت‌وبرگشت', exact: true }).focus(); await page.keyboard.press('Space');
    const date = (await dateExplorer(page).getAttribute('data-selected-outbound'))!, next = nextDay(date);
    const trigger = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }); await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
    await dialog.getByText('ورود تاریخ میلادی', { exact: true }).click(); await dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true }).fill(date);
    const firstResult = await runSearch(reviewer, () => dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click());
    const first = page.url(); expect(firstResult.snapshot.query.party).toEqual({ adults: 1, children: 0, infants: 0 });
    await trigger.click(); await dialog.getByText('ورود تاریخ میلادی', { exact: true }).click();
    await dialog.getByLabel('تاریخ رفت میلادی در تقویم', { exact: true }).fill(next);
    await expect(dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true })).toHaveValue('');
    await expect(dialog.getByText(/تاریخ برگشت را دوباره انتخاب کنید/)).toBeVisible(); expect(page.url()).toBe(first);
    await expect(dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true })).toBeDisabled();
    await dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true }).fill(next);
    const secondResult = await runSearch(reviewer, () => dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click());
    const second = page.url(); expect(second).not.toBe(first);
    let posts = 0; page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) posts++; });
    await page.goBack(); await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', date); await expect(resultRegion(page)).toHaveCount(0);
    await page.goForward(); await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', next);
    await page.reload(); await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', next); expect(posts).toBe(0);
    record('history-keyboard.json', { first, second, firstResult, secondResult, postsAfterNavigation: posts, invalidReturnRequiresReselection: true });
  });

  test('recoverable malformed links and responsive layout retain one shared deferred chart host', async ({ reviewer }) => {
    const { page } = reviewer; const scripts: string[] = [];
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    await page.goto('/?q=x&q=y'); await expect(page.getByText(/پیوند جست‌وجو معتبر نیست/)).toBeVisible(); await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
    if (evidence) await page.screenshot({ path: resolve(evidence, 'invalid-link.png'), fullPage: true });
    await page.goto('/'); await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30_000 });
    const widths = [];
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 }); const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth })); expect(dimensions.scroll).toBeLessThanOrEqual(width);
      const map = page.getByRole('complementary', { name: 'نقشه سفر', exact: true }); if (width >= 1120) await expect(map).toBeVisible(); else await expect(map).toBeHidden();
      if (evidence) await page.screenshot({ path: resolve(evidence, 'consumer-' + width + '.png'), fullPage: true }); widths.push(dimensions);
    }
    await page.getByRole('button', { name: 'سفرهای پیشنهادی', exact: true }).click(); await page.getByRole('button', { name: /^قطار داخلی ·/ }).click();
    if (await page.locator('html').getAttribute('data-appearance') !== 'dark') await page.getByRole('button', { name: 'نمای تیره', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'train'); await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
    await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready'); await expect(page.locator('canvas')).toHaveCount(1);
    expect(scripts.length).toBeGreaterThan(0); expect(scripts.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
    if (evidence) await page.screenshot({ path: resolve(evidence, 'train-dark-1440.png'), fullPage: true });
    record('responsive.json', { widths, scriptCount: scripts.length, graphicsRequestedForDateChart: true, sharedCanvases: 1, moduleIdentity: 'Observed same-origin scripts and actual renderer readiness; no packaged filename assumption in development Compose.' });
  });

  test('owner API reset fences a held response across document reload', async ({ reviewer }) => {
    const { page } = reviewer; let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; }); let sent = false, heldSearchId = '';
    await page.route('**/api/v1/searches', async route => { const response = await route.fetch(); expect(response.status()).toBe(201); heldSearchId = SearchRecoverySchema.parse(await response.json()).snapshot.searchId; sent = true; await held; await route.fulfill({ response }).catch(() => undefined); });
    try {
      await page.goto('/'); const submit = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }); await expect(submit).toBeEnabled(); await submit.click(); await expect.poll(() => sent).toBe(true);
      await expect(page.getByRole('button', { name: /پاک کردن فعالیت|شروع دوباره نشست/ })).toHaveCount(0);
      const began = Date.now(), reset = await reviewer.context.request.post('/api/v1/demo/reset', { data: {} }); expect(reset.status()).toBe(201); expect(Date.now() - began).toBeLessThan(5000);
      expect((await reviewer.context.request.get('/api/v1/searches/' + heldSearchId)).status()).toBe(404);
      await page.reload(); release(); await expect(submit).toBeEnabled(); await expect(resultRegion(page)).toHaveCount(0);
      record('reset-race.json', { heldSearch: true, heldSearchId, resetStatus: 201, resetBody: {}, recovery: 'Owned API reset plus document reload', oldSource404: true, elapsedMs: Date.now() - began, lateAdoption: false });
    } finally { release(); }
  });

  test('exact pending request is suppressed and native history permits a fresh date while a held obsolete response cannot adopt', async ({ reviewer }) => {
    const { page } = reviewer; let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    const requests: { searchId: string; date: string; status: number }[] = []; let oldHandlerFinished = false;
    await page.route('**/api/v1/searches', async route => {
      const response = await route.fetch(), initial = SearchRecoverySchema.parse(await response.json());
      requests.push({ status: response.status(), searchId: initial.snapshot.searchId, date: initial.snapshot.query.departureDate });
      if (requests.length === 1) { await held; await route.fulfill({ response }).catch(() => undefined); oldHandlerFinished = true; } else await route.fulfill({ response });
    });
    try {
      await page.goto('/'); await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30_000 });
      // Locate the real action across regular/pending native button attributes.
      const submit = page.getByRole('form', { name: 'جست‌وجوی سفر', exact: true }).getByRole('button', { name: /جست‌وجوی سفر$/ });
      await expect(submit).toHaveAccessibleName('جست‌وجوی سفر'); await submit.click(); await expect.poll(() => requests.length).toBe(1);
      await expect(submit).toHaveAccessibleName('در حال بارگذاری، جست‌وجوی سفر'); await expect(submit).toBeDisabled();
      const box = (await submit.boundingBox())!; await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); expect(requests).toHaveLength(1);
      await page.goBack(); await expect(submit).toBeEnabled(); await expect(submit).toHaveAccessibleName('جست‌وجوی سفر');
      const current = await runSearch(reviewer, () => page.getByRole('button', { name: 'روز بعد', exact: true }).click());
      expect(requests).toHaveLength(2); expect(requests[1]!.date).not.toBe(requests[0]!.date); expect(current.snapshot.searchId).toBe(requests[1]!.searchId);
      release(); await expect.poll(() => oldHandlerFinished).toBe(true);
      await expect(resultRegion(page)).toHaveAttribute('data-search-id', current.snapshot.searchId); expect(requests).toHaveLength(2);
      record('unresolved-start-cap.json', { requests, current, exactPendingSuppressed: true, nativeAbortRecoveredCapacity: true, lateOldResponseFenced: true, fault: 'Playwright holds actual POST response delivery. Native history aborts the browser fetch; the new native date intent is real. Unabortable custom-transport capacity is covered by the search controller tests, not inferred from this browser interception.' });
    } finally { release(); }
  });
});
