import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TransportSearchQuery } from '@torob-ticket/contracts';
import { expect, loadQuery, priceCards, queryFor, readSearch, resultRegion, runSearch, test } from '../fixtures';

const evidence = process.env.T17_CORRECTION_EVIDENCE_DIR;
function record(name: string, value: unknown) { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, name), JSON.stringify(value, null, 2)); } }

test.describe('@results-correction real ownership and filter transactions', () => {
  test('native Pop fences attempted old references and edited city intent keeps evidence readable without stale selection', async ({ reviewer }) => {
    const { page } = reviewer, query = queryFor(); let searches = 0;
    await loadQuery(reviewer, query);
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) searches++; });
    const initial = await runSearch(reviewer), first = priceCards(page).first(), main = page.locator('main').first();
    await first.locator('[data-card-select]').click(); await expect(main).toHaveAttribute('data-pinned-itinerary', /.+/);
    const before = { pinned: await main.getAttribute('data-pinned-itinerary'), quote: await first.getAttribute('data-quote-id') };
    const restored = { ...query, departureDate: '2026-11-03' };
    const result = await page.evaluate(next => {
      const card = document.querySelector<HTMLElement>('article[data-price-card-id]')!, button = card.querySelector<HTMLButtonElement>('[data-card-select]')!;
      history.replaceState({}, '', '/?' + new URLSearchParams({ q: JSON.stringify(next) })); dispatchEvent(new PopStateEvent('popstate'));
      button.click(); card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      return { oldDomReferenceRetained: Boolean(card), url: location.search };
    }, restored);
    await expect(resultRegion(page)).toHaveCount(0); await expect(main).not.toHaveAttribute('data-pinned-itinerary'); await expect(main).not.toHaveAttribute('data-preview-itinerary');
    await expect(page.locator('[data-selected-outbound]')).toHaveAttribute('data-selected-outbound', restored.departureDate); expect(searches).toBe(1);
    const fresh = await runSearch(reviewer);
    const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
    await destination.fill('شیراز'); await expect(destination).toHaveValue('شیراز');
    // Close the native suggestion popup before reading the background evidence.
    // The unconfirmed destination text and invalid draft must remain intact.
    await page.keyboard.press('Escape'); await expect(destination).not.toHaveAttribute('aria-expanded', 'true');
    await expect(destination).toHaveValue('شیراز');
    await expect(resultRegion(page).getByRole('radio', { name: 'ارزان‌ترین', exact: true })).toBeDisabled();
    const current = priceCards(page).first(); await expect(current.locator('[data-card-select]')).toBeDisabled();
    await expect(current.locator('[data-invalid-price="changed-intent"]')).toBeVisible();
    await current.getByRole('button', { name: 'جزئیات سفر', exact: true }).click(); await expect(current.getByRole('region', { name: 'جزئیات مسیر رفت' })).toBeVisible();
    await expect(main).not.toHaveAttribute('data-pinned-itinerary'); expect(searches).toBe(2);
    expect(await readSearch(reviewer, fresh.snapshot.searchId)).toEqual(fresh);
    record('native-pop-result-ownership.json', { metadata: reviewer.session, initialSearch: initial.snapshot.searchId, before, result, restored, currentSearch: fresh.snapshot.searchId, searches, oldReferenceFenced: true, editedEvidenceReadable: true, staleSelectionBlocked: true, fault: 'Native PopState plus attempted click/mouseover on old element references in one browser turn. Exact callback fencing also has focused SearchPage component coverage. Current city editing uses real input; provider/search evidence is unchanged.' });
  });

  test('Cancel, Escape and toggle restore all committed filters; clear discards invalid drafts once without changing trip or class', async ({ reviewer }) => {
    const { page } = reviewer;
    const committed: TransportSearchQuery = { ...queryFor(), filters: { budgetMaxRial: 50_000_000, maxStopsOrTransfers: 3, checkedBaggageMinKg: 20, refundableOnly: true, providerIds: ['demo-provider-01', 'demo-provider-04'], operatorIds: ['demo-operator-flight-1'], departureWindow: { startMinute: 480, endMinute: 1080 } } };
    await loadQuery(reviewer, committed); const requests: TransportSearchQuery[] = [];
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) requests.push(request.postDataJSON().query); });
    await runSearch(reviewer); const trigger = resultRegion(page).getByRole('button', { name: /^فیلتر نتایج/ }); await trigger.click();
    const form = page.getByRole('form', { name: 'فیلتر پیشنهادهای سفر', exact: true });
    await form.getByLabel('سقف مبلغ کل (تومان)', { exact: true }).fill('1'); await form.getByLabel('حداکثر توقف', { exact: true }).fill('0'); await form.getByLabel('حداقل بار تحویلی (کیلوگرم)', { exact: true }).fill('0');
    await form.getByRole('combobox', { name: 'کلاس نتایج', exact: true }).selectOption('business'); await form.getByLabel('فقط قابل استرداد؛ شرایط نامشخص پذیرفته نمی‌شود').uncheck();
    await form.getByLabel('راه‌آرا', { exact: true }).uncheck(); await form.getByLabel('محدود کردن بازه حرکت', { exact: true }).uncheck();
    await form.getByRole('button', { name: 'انصراف از فیلتر', exact: true }).click(); await expect(trigger).toBeFocused(); expect(requests).toHaveLength(1);
    await trigger.click();
    await expect(form.getByLabel('سقف مبلغ کل (تومان)', { exact: true })).toHaveValue('5000000'); await expect(form.getByLabel('حداکثر توقف', { exact: true })).toHaveValue('3');
    await expect(form.getByLabel('حداقل بار تحویلی (کیلوگرم)', { exact: true })).toHaveValue('20'); await expect(form.getByRole('combobox', { name: 'کلاس نتایج', exact: true })).toHaveValue('economy');
    await expect(form.getByLabel('فقط قابل استرداد؛ شرایط نامشخص پذیرفته نمی‌شود')).toBeChecked(); await expect(form.getByLabel('راه‌آرا', { exact: true })).toBeChecked();
    await expect(form.getByLabel('از ساعت', { exact: true })).toHaveValue('08:00'); await expect(form.getByLabel('تا ساعت', { exact: true })).toHaveValue('18:00');
    await form.getByLabel('سقف مبلغ کل (تومان)', { exact: true }).fill('2'); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await trigger.click(); await expect(form.getByLabel('سقف مبلغ کل (تومان)', { exact: true })).toHaveValue('5000000'); await form.getByLabel('سقف مبلغ کل (تومان)', { exact: true }).fill('3'); await trigger.click(); await trigger.click();
    await expect(form.getByLabel('سقف مبلغ کل (تومان)', { exact: true })).toHaveValue('5000000'); expect(requests).toHaveLength(1);
    await form.getByLabel('سقف مبلغ کل (تومان)', { exact: true }).fill('-1'); await form.getByLabel('حداقل بار تحویلی (کیلوگرم)', { exact: true }).fill('-2');
    await form.getByRole('combobox', { name: 'کلاس نتایج', exact: true }).selectOption('business');
    const final = await runSearch(reviewer, () => form.getByRole('button', { name: 'پاک کردن فیلترها', exact: true }).click());
    expect(requests).toHaveLength(2); expect(requests[1]).toEqual({ ...committed, filters: {} }); expect(final.snapshot.query).toEqual({ ...committed, filters: {} });
    expect(JSON.parse(new URLSearchParams(new URL(page.url()).search).get('q')!).classCode).toBe('economy');
    record('filter-transactions.json', { metadata: reviewer.session, requests, final, cancelRestoredAllFields: true, escapeReturnedFocus: true, toggleDiscarded: true, clearDiscardedInvalidDraft: true });
  });
});
