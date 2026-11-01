import { test, expect } from '../fixtures';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const evidence = resolve(process.env.SEARCH_CONTROLS_EVIDENCE_DIR ?? 'docs/evidence/adjustments/search-controls-tooltips/native');
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-02', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };

for (const width of [1366, 390]) {
 test(`@search-controls ${width}px empty-city focus and above-field errors keep layout stable`, async ({ newReviewer, browser }) => {
  test.setTimeout(60000);
  mkdirSync(evidence, { recursive: true });
  const reviewer = await newReviewer({ seed: 5630, scenario: 'normal', anchorInstant: '2026-10-29T06:00:00Z', viewport: { width, height: width === 390 ? 844 : 768 }, reducedMotion: 'no-preference' });
  const { page } = reviewer;
  await page.addInitScript(appearance => localStorage.setItem('torobticket.appearance', appearance), width === 1366 ? 'dark' : 'light');
  const errors: string[] = [], searches: string[] = [];
  page.on('pageerror', () => errors.push('uncaught-page-error'));
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) searches.push(new URL(request.url()).pathname); });
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
  const origin = page.getByRole('combobox', { name: 'مبدا', exact: true });
  const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
  const submit = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true });
  const form = page.locator('form[aria-label="جست‌وجوی سفر"]');
  const originBox = form.locator('[data-search-field~="originCityId"] input');
  const destinationBox = form.locator('[data-search-field~="destinationCityId"] input');
  await expect(origin).toHaveValue('تهران'); await expect(destination).toHaveValue('مشهد');
  await page.getByRole('button', { name: 'پاک کردن مبدا', exact: true }).click();
  await expect(origin).toHaveValue(''); await expect(destinationBox).toBeDisabled();
  await origin.press('Escape');
  await expect(origin).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('option', { name: 'تهران', exact: true })).toHaveCount(0);
  await expect(submit).toBeEnabled(); await submit.focus(); await expect(submit).toBeFocused();
  await origin.focus(); await expect(origin).toBeFocused();
  try { await expect(origin).toHaveAttribute('aria-expanded', 'true'); }
  catch (error) {
   // Public focus/lifecycle facts only; retain the actual failure and do not
   // replace empty-focus behavior with a button-open or another gesture.
   try {
    const state = await page.evaluate(() => ({
     visibility: document.visibilityState,
     active: { tag: document.activeElement?.tagName, role: document.activeElement?.getAttribute('role'), label: document.activeElement?.getAttribute('aria-label'), expanded: document.activeElement?.getAttribute('aria-expanded') },
     cities: Array.from(document.querySelectorAll<HTMLInputElement>('input[role="combobox"]')).map(input => ({ value: input.value, focused: input === document.activeElement, expanded: input.getAttribute('aria-expanded'), disabled: input.disabled })),
     listboxes: Array.from(document.querySelectorAll('[role="listbox"]')).map(node => ({ label: node.getAttribute('aria-label'), hidden: node.getAttribute('aria-hidden'), text: node.textContent?.slice(0, 500) })),
    }));
    writeFileSync(resolve(evidence, `empty-focus-${width}-failure.json`), JSON.stringify(state, null, 2) + '\n');
    await page.screenshot({ path: resolve(evidence, `empty-focus-${width}-failure.png`), timeout: 5000 });
   } catch { /* Shared owned teardown also captures public failure state. */ }
   throw error;
  }
  await expect(page.getByRole('option', { name: 'تهران', exact: true })).toBeVisible();
  await expect(origin).toHaveValue('');
  await page.getByRole('option', { name: 'تهران', exact: true }).click();
  await expect(destination).toBeEnabled(); await expect(destination).toHaveValue('');
  await destination.focus();
  await expect(destination).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('option', { name: 'مشهد', exact: true })).toBeVisible();
  await destination.press('Escape'); await submit.focus();
  await page.evaluate(() => document.fonts.ready);
  const destinationField = form.locator('[data-search-field~="destinationCityId"]');
  const before = { form: await form.boundingBox(), origin: await originBox.boundingBox(), destination: await destinationBox.boundingBox(), destinationField: await destinationField.boundingBox() };
  await submit.click();
  await expect(destination).toBeFocused(); await expect(destination).toHaveAttribute('aria-invalid', 'true');
  await expect(destination).toHaveAccessibleDescription('شهر مقصد را از فهرست انتخاب کنید.');
  // The combobox popup may hide unrelated visual overlays from the AT tree;
  // accessible field descriptions are asserted separately above and below.
  const tooltip = page.locator('[data-field-error-tooltip]').filter({ hasText: 'شهر مقصد را از فهرست انتخاب کنید.' });
  await expect(tooltip).toBeVisible();
  await expect.poll(() => tooltip.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.98);
  // The finite shake changes x, never the measured layout height.
  const after = { form: await form.boundingBox(), origin: await originBox.boundingBox(), destination: await destinationBox.boundingBox(), destinationField: await destinationField.boundingBox(), tooltip: await tooltip.boundingBox() };
  expect(Math.abs(after.form!.height - before.form!.height)).toBeLessThan(1);
  expect(Math.abs(after.origin!.height - before.origin!.height)).toBeLessThan(1);
  expect(Math.abs(after.destination!.height - before.destination!.height)).toBeLessThan(1);
  expect(Math.abs(after.destinationField!.height - before.destinationField!.height)).toBeLessThan(1);
  expect(after.tooltip!.y + after.tooltip!.height).toBeLessThanOrEqual(after.destination!.y);
  expect(after.tooltip!.y + after.tooltip!.height).toBeLessThanOrEqual(after.destinationField!.y);
  expect(after.tooltip!.x).toBeGreaterThanOrEqual(0);
  expect(after.tooltip!.x + after.tooltip!.width).toBeLessThanOrEqual(width);
  await page.screenshot({ path: resolve(evidence, `validation-${width}.png`) });
  await destination.press('Escape');
  await expect(tooltip).toBeHidden();
  await expect(destination).toHaveAccessibleDescription('شهر مقصد را از فهرست انتخاب کنید.');
  await submit.focus(); await page.mouse.move(1, 1); await destination.hover();
  await expect(tooltip).toBeVisible(); await expect(submit).toBeFocused();
  await tooltip.hover(); await page.waitForTimeout(250);
  await expect(tooltip).toBeVisible(); await expect(submit).toBeFocused();
  // Hover-only tips must also dismiss while keyboard focus is elsewhere.
  await page.keyboard.press('Escape'); await expect(tooltip).toBeHidden();
  await page.mouse.move(1, 1); await destination.focus();
  await expect(destination).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('option', { name: 'مشهد', exact: true }).click();
  await expect(destination).not.toHaveAttribute('aria-invalid', 'true');
  await expect(tooltip).toBeHidden();
  expect(searches).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  writeFileSync(resolve(evidence, `validation-${width}.json`), JSON.stringify({ browser: browser.version(), session: reviewer.session, width, appearance: width === 1366 ? 'dark' : 'light', before, after, searchPosts: searches.length, pageErrors: errors,
   emptyFocusOpens: true, disabledDestinationPreserved: true, focusAndHoverEscape: true, descriptionRetainedWhileDismissed: true, correctionClearsError: true,
   cleanup: 'Shared owned fixture resets only this newly created namespace using its in-memory cookie jar, then closes the context.' }, null, 2) + '\n');
 });

 test(`@search-controls ${width}px date-leg segments share class row and retain calendar semantics`, async ({ newReviewer, browser }) => {
  test.setTimeout(60000);
  mkdirSync(evidence, { recursive: true });
  const reviewer = await newReviewer({ seed: 5631, scenario: 'normal', anchorInstant: '2026-10-29T06:00:00Z', viewport: { width, height: width === 390 ? 844 : 768 }, reducedMotion: 'no-preference' });
  const { page } = reviewer;
  await page.addInitScript(appearance => localStorage.setItem('torobticket.appearance', appearance), width === 1366 ? 'dark' : 'light');
  const errors: string[] = [], searches: string[] = [];
  page.on('pageerror', () => errors.push('uncaught-page-error'));
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/searches')) searches.push(new URL(request.url()).pathname); });
  const round = { ...query, tripType: 'round-trip', returnDate: '2026-11-05' };
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(round)));
  const date = page.getByRole('region', { name: 'کاوش تاریخ سفر', exact: true });
  const leg = page.getByRole('radiogroup', { name: 'جستجو بر اساس', exact: true });
  const travelClass = page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true });
  const row = page.locator('[data-search-preferences]');
  await expect(row).toBeVisible(); await expect(row.locator('[role="radiogroup"]')).toHaveCount(2);
  await expect(leg.getByRole('radio', { name: 'تاریخ رفت', exact: true })).toBeChecked();
  await expect(date).toHaveAttribute('data-date-leg', 'outbound');
  await expect(date).not.toContainText('برگشت ثابت'); await expect(date).not.toContainText('رفت ثابت');
  const geometry = { class: await travelClass.locator('[data-segment-track]').boundingBox(), leg: await leg.locator('[data-segment-track]').boundingBox() };
  if (width === 1366) expect(Math.abs(geometry.class!.y - geometry.leg!.y)).toBeLessThan(1);
  const selectedDate = () => date.getByRole('option', { selected: true }).locator('bdi').first().textContent();
  const outbound = await selectedDate(), originalURL = page.url();
  await leg.getByText('تاریخ برگشت', { exact: true }).click();
  await expect(date).toHaveAttribute('data-date-leg', 'return');
  const returning = await selectedDate(); expect(returning).not.toEqual(outbound);
  expect(page.url()).toBe(originalURL);
  await leg.getByText('تاریخ رفت', { exact: true }).click();
  await expect(date).toHaveAttribute('data-date-leg', 'outbound'); expect(await selectedDate()).toEqual(outbound);
  expect(searches).toEqual([]);
  const calendar = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true });
  await calendar.click();
  const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
  await expect(dialog).toBeVisible(); await expect(dialog).toContainText('قیمت‌ها به هزار تومان');
  await dialog.getByText('ورود تاریخ میلادی', { exact: true }).click();
  await dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true }).fill('2026-11-06');
  await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(date).toHaveAttribute('data-selected-return', '2026-11-05');
  await expect(calendar).toBeFocused();
  await calendar.click();
  await dialog.getByText('ورود تاریخ میلادی', { exact: true }).click();
  await dialog.getByLabel('تاریخ برگشت میلادی در تقویم', { exact: true }).fill('2026-11-06');
  await dialog.getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }).click();
  await expect(dialog).toBeHidden(); await expect(date).toHaveAttribute('data-selected-return', '2026-11-06');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const targets = await leg.locator('[data-segment-option]').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { width: box.width, height: box.height }; }));
  expect(targets).toHaveLength(2);
  expect(targets.every(target => target.height >= 44)).toBe(true);
  await page.screenshot({ path: resolve(evidence, `date-controls-${width}.png`) });
  // A later departure revokes the return. Its calendar-button feedback uses
  // a parent-wrapper anchor, unlike the combobox's sibling Group anchor.
  await date.getByRole('listbox', { name: 'روزهای نزدیک', exact: true }).press('PageDown');
  await expect(date).toHaveAttribute('data-selected-return', '');
  await expect(date).toHaveAttribute('data-date-leg', 'return');
  const submit = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true });
  await expect(submit).toBeEnabled();
  const calendarBefore = await calendar.boundingBox();
  await submit.click();
  await expect(calendar).toBeFocused(); await expect(calendar).toHaveAccessibleDescription('تاریخ برگشت را انتخاب کنید.');
  const calendarError = page.locator('[data-field-error-tooltip]').filter({ hasText: 'تاریخ برگشت را انتخاب کنید.' });
  await expect(calendarError).toBeVisible();
  const calendarAfter = await calendar.boundingBox(), calendarTip = await calendarError.boundingBox();
  expect(Math.abs(calendarAfter!.height - calendarBefore!.height)).toBeLessThan(1);
  expect(calendarTip!.y + calendarTip!.height).toBeLessThanOrEqual(calendarAfter!.y);
  await page.screenshot({ path: resolve(evidence, `calendar-validation-${width}.png`) });
  await page.keyboard.press('Escape'); await expect(calendarError).toBeHidden();
  if (width === 390) {
   await page.setViewportSize({ width: 320, height: 844 });
   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
   await expect(leg).toBeVisible(); await expect(travelClass).toBeVisible();
   await page.screenshot({ path: resolve(evidence, 'date-controls-320.png') });
  }
  expect(errors).toEqual([]);
  writeFileSync(resolve(evidence, `date-controls-${width}.json`), JSON.stringify({ browser: browser.version(), session: reviewer.session, width, appearance: width === 1366 ? 'dark' : 'light', geometry, outbound, returning, switchDidNotEditURL: true, switchSearchPosts: 0,
   calendarCancelPreservedReturn: '2026-11-05', appliedReturn: '2026-11-06', laterDepartureClearsReturn: true, calendarBefore, calendarAfter, calendarTip, targets, pageErrors: errors,
   cleanup: 'Shared owned fixture resets only this newly created namespace using its in-memory cookie jar, then closes the context.' }, null, 2) + '\n');
 });
}
