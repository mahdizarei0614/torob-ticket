import { type Frame, type Page, type Request, type Response } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatePriceQuerySchema, DatePriceSnapshotSchema } from '@torob-ticket/contracts';
import { currentDatePrices, dateExplorer, expect, resultRegion, runSearch, test } from '../fixtures';

const evidence = process.env.T16_CORRECTION_EVIDENCE_DIR;
function record(name: string, value: unknown) { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, name), JSON.stringify(value, null, 2)); } }
async function ready(page: Page) { await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30_000 }); }
const tomorrow = (date: string) => { const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); };

test.describe('@dates-correction controlled freshness and authorization', () => {
  test('physical wheel settle cannot commit after native Back to the same selected date', async ({ reviewer }) => {
    const { page } = reviewer; let searches = 0;
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) searches++; });
    await page.goto('/'); await ready(page);
    const date = await dateExplorer(page).getAttribute('data-selected-outbound');
    await runSearch(reviewer); expect(searches).toBe(1);
    const wheel = page.getByRole('listbox', { name: 'روزهای نزدیک' }); await wheel.scrollIntoViewIfNeeded(); const box = (await wheel.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, 54);
    await expect(wheel).not.toHaveAttribute('data-preview-date', date!);
    await page.goBack();
    // Bounded negative observation covers the real 250ms settle timer after history revokes it.
    await page.waitForTimeout(350);
    expect(searches).toBe(1); await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', date!);
    await expect(wheel).toHaveAttribute('data-preview-date', date!); expect(new URL(page.url()).search).toBe('');
    const current = await runSearch(reviewer, () => page.getByRole('button', { name: 'روز بعد', exact: true }).click());
    expect(searches).toBe(2); expect(current.snapshot.query.departureDate).toBe(tomorrow(date!));
    record('physical-history.json', { session: reviewer.session, date, searches, oldSettleCancelled: true, newGestureSearchesOnce: true, current, url: page.url() });
  });

  test('native history discards a provisional calendar from an old class basis and preserves one-adult intent', async ({ reviewer }) => {
    const { page } = reviewer; const requests: { party: unknown; date: string; classCode: string }[] = [];
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) { const query = request.postDataJSON().query; requests.push({ party: query.party, date: query.departureDate, classCode: query.classCode }); } });
    await page.goto('/'); await ready(page); await runSearch(reviewer);
    const original = (await dateExplorer(page).getAttribute('data-selected-outbound'))!, next = tomorrow(original);
    const business = page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true }).getByRole('radio', { name: 'تجاری', exact: true });
    await business.focus(); await page.keyboard.press('Space'); await expect(resultRegion(page)).toHaveCount(0);
    const trigger = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true });
    await trigger.click(); const calendar = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
    await calendar.getByText('ورود تاریخ میلادی', { exact: true }).click(); await calendar.getByLabel('تاریخ رفت میلادی در تقویم', { exact: true }).fill(next);
    await page.goBack(); await expect(calendar).toHaveCount(0); await expect(trigger).toBeFocused();
    await expect(page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true }).getByRole('radio', { name: 'اقتصادی', exact: true })).toBeChecked();
    await ready(page); expect(requests).toHaveLength(1);
    await trigger.click(); await calendar.getByText('ورود تاریخ میلادی', { exact: true }).click(); await calendar.getByLabel('تاریخ رفت میلادی در تقویم', { exact: true }).fill(next);
    const current = await runSearch(reviewer, () => calendar.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click());
    expect(requests).toHaveLength(2); expect(requests[1]).toEqual({ party: { adults: 1, children: 0, infants: 0 }, date: next, classCode: 'economy' });
    record('calendar-history.json', { requests, current, provisionalOldClassNotCommitted: true, focusReturned: true, replacement: 'Removed passenger-form mutation is replaced with an actual class-basis mutation; varied-party API behavior remains in acceptance/party-and-eligibility.spec.ts.' });
  });

  test('real date observations remain reusable beyond sixty seconds; transport failure gets one quiet retry and reconnect recovery', async ({ reviewer }) => {
    const { page } = reviewer; await page.clock.install({ time: Date.now() + 61_000 });
    let starts = 0, transportPosts = 0, fail = false, retryGeneration = '', failedRetryGeneration = '', documentEpoch = 0;
    let retryRequest: Request | undefined, releaseRetry!: () => void;
    const retryGate = new Promise<void>(resolve => { releaseRetry = resolve; });
    const originals: unknown[] = [], pendingReads = new Set<Promise<void>>(), requestEpochs = new WeakMap<Request, number>();
    const readFailures: { epoch: number; kind: 'read' | 'contract' | 'deadline' | 'owner'; request?: Request }[] = [];
    const onFrameNavigated = (frame: Frame) => { if (frame === page.mainFrame()) documentEpoch++; };
    const onRequest = (request: Request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && path === '/api/v1/searches') transportPosts++;
      if (path === '/api/v1/date-prices' || path.startsWith('/api/v1/date-prices/')) requestEpochs.set(request, documentEpoch);
    };
    const onRequestFailed = (request: Request) => { if (request === retryRequest) failedRetryGeneration = retryGeneration; };
    const onResponse = (response: Response) => {
      if (!response.url().includes('/api/v1/date-prices') || !response.ok()) return;
      const epoch = requestEpochs.get(response.request());
      if (epoch === undefined) { readFailures.push({ epoch: -1, kind: 'owner' }); return; }
      const work = (async () => {
        try {
          const parsed = DatePriceSnapshotSchema.safeParse(await response.json());
          if (!parsed.success) { readFailures.push({ epoch, kind: 'contract' }); return; }
          if (parsed.data.status === 'complete') originals.push(parsed.data);
        } catch {
          readFailures.push({ epoch, kind: 'read', request: response.request() });
        }
      })();
      pendingReads.add(work); void work.then(() => pendingReads.delete(work));
    };
    async function joinReads() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([Promise.all([...pendingReads]), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('owned-date-response-read-deadline')), 5000); })]); }
      catch (error) { readFailures.push({ epoch: documentEpoch, kind: 'deadline' }); throw error; }
      finally { clearTimeout(timer); }
    }
    page.on('framenavigated', onFrameNavigated); page.on('request', onRequest); page.on('requestfailed', onRequestFailed); page.on('response', onResponse);
    await page.route('**/api/v1/date-prices', async route => {
      if (route.request().method() === 'POST') {
        starts++;
        if (fail) {
          if (starts === 3) { retryRequest = route.request(); retryGeneration = DatePriceQuerySchema.parse(retryRequest.postDataJSON()).clientGeneration; await retryGate; }
          await route.abort('internetdisconnected'); return;
        }
      }
      await route.continue();
    });
    try {
      await page.goto('/'); await ready(page); expect(starts).toBe(1);
      const actual = await currentDatePrices(reviewer);
      const before = { url: page.url(), date: await dateExplorer(page).getAttribute('data-selected-outbound'), id: actual.datePriceId };
      await page.clock.fastForward(61_000); await ready(page);
      expect(starts).toBe(1); await expect(dateExplorer(page)).toHaveAttribute('data-date-price-id', before.id);
      await expect(page.getByRole('listbox', { name: 'روزهای نزدیک' }).getByText(/تومان/).first()).toBeVisible();
      await expect(page.getByRole('alert').filter({ hasText: 'دیگر تازه نیستند' })).toHaveCount(0);
      await joinReads(); fail = true; await page.reload();
      const alert = page.getByRole('alert').filter({ hasText: 'قیمت روزها دریافت نشد' });
      await expect(alert).toBeVisible(); expect(starts).toBe(2);
      await expect(page.getByText('پیشنهاد مطابق نیست', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'تلاش دوباره برای قیمت روزها' })).toHaveCount(0);
      await page.clock.fastForward(2000); await expect.poll(() => starts).toBe(3);
      expect(retryGeneration).not.toBe('');
      await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'checking'); await expect(alert).toHaveCount(0);
      releaseRetry(); await expect.poll(() => failedRetryGeneration).toBe(retryGeneration);
      await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'unavailable'); await expect(alert).toBeVisible();
      await page.clock.fastForward(61_000); expect(starts).toBe(3); expect(transportPosts).toBe(0);
      fail = false; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await ready(page);
      expect(starts).toBe(4); expect(transportPosts).toBe(0); expect(page.url()).toBe(before.url); await expect(dateExplorer(page)).toHaveAttribute('data-selected-outbound', before.date!);
      const recovered = await currentDatePrices(reviewer); expect(recovered.cells).toEqual(actual.cells);
      await joinReads();
      record('stale-recovery.json', { session: reviewer.session, fault: 'Client clock is +61 seconds with unmodified real API observations. Two date POSTs are deliberately transport-aborted; provider evidence is unchanged.', starts, transportPosts, actual, recovered, originals, selectionPreserved: before, validObservationReuse: true, oneQuietDelayedRetry: true, reconnectRecovery: true, retrySettlement: { retryGeneration, failedRetryGeneration, publicTransition: 'checking to unavailable before quiet interval and online event' } });
    } finally {
      releaseRetry(); page.off('response', onResponse); page.off('framenavigated', onFrameNavigated); page.off('request', onRequest); page.off('requestfailed', onRequestFailed);
      try { await joinReads(); } catch { /* Every join failure is already retained by joinReads and asserted below. */ }
      const observer = readFailures.map(failure => ({ epoch: failure.epoch, label: failure.kind === 'read' && failure.epoch < documentEpoch && failure.request?.failure()?.errorText === 'net::ERR_ABORTED' ? 'retired-date-response-aborted' : failure.kind === 'contract' ? 'date-response-contract-invalid' : failure.kind === 'deadline' ? 'owned-date-response-read-deadline' : failure.kind === 'owner' ? 'date-response-owner-unobserved' : 'unexpected-date-response-read-failed' }));
      record('date-read-observer.json', { documentEpoch, pendingReads: pendingReads.size, outcomes: observer });
      expect(observer.filter(outcome => outcome.label !== 'retired-date-response-aborted')).toEqual([]);
    }
  });

});
