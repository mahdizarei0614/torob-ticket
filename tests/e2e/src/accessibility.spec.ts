import { writeFileSync } from 'node:fs';
import { test, expect, loadQuery, queryFor, runSearch, resultRegion, priceCards } from '../fixtures';
import { expectPlaceholder, interceptPlaceholder, scenarioQuote } from './acceptance/journey-helpers';
import { scanAccessibility, tabTo, focusSnapshot, KeyboardTraversalFailure } from './a11y-helpers';
import { auditCityMenuFocus, installCityMenuFocusTrace } from './city-menu-focus';

test.describe('@a11y representative current tasks', () => {
  test('composer and searchable city menu have complete semantic names and states', async ({ reviewer }, info) => {
    const { page } = reviewer;
    await installCityMenuFocusTrace(page);
    await loadQuery(reviewer, queryFor());
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await scanAccessibility(page, info, 'composer');
    await auditCityMenuFocus(page, info);
  });

  test('invalid fields retain accessible descriptions when their visual tooltip is dismissed', async ({ reviewer }, info) => {
    const { page } = reviewer;
    await loadQuery(reviewer, queryFor());
    await page.getByRole('button', { name: 'پاک کردن مبدا', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
    const origin = page.getByRole('combobox', { name: 'مبدا', exact: true });
    await expect(origin).toBeFocused(); await expect(origin).toHaveAttribute('aria-invalid', 'true');
    const descriptions = await origin.getAttribute('aria-describedby'); expect(descriptions).toBeTruthy();
    const facts = await origin.evaluate(node => (node.getAttribute('aria-describedby') ?? '').split(/\s+/).map(id => ({ id, text: document.getElementById(id)?.textContent })));
    expect(facts.some(fact => fact.text?.includes('مبدا'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(origin).toHaveAttribute('aria-describedby', descriptions!);
    await scanAccessibility(page, info, 'invalid-composer');
    expect(await resultRegion(page).count()).toBe(0);
  });

  test('priced provisional Jalali calendar restores its trigger and leaves committed dates unchanged', async ({ reviewer }, info) => {
    const { page } = reviewer;
    const query = queryFor('flight', 'domestic', 'round-trip');
    await loadQuery(reviewer, query);
    const trigger = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
    await expect(dialog).toBeVisible(); await expect(dialog.getByRole('grid')).toHaveCount(1);
    await scanAccessibility(page, info, 'calendar');
    await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    await expect(page.locator('[data-selected-outbound]')).toHaveAttribute('data-selected-outbound', query.departureDate);
    await expect(page.locator('[data-selected-return]')).toHaveAttribute('data-selected-return', query.returnDate!);
  });

  test('complete results, real route details and filters retain native state and LTR transport codes', async ({ reviewer }, info) => {
    const { page } = reviewer;
    await loadQuery(reviewer, queryFor('flight', 'international', 'round-trip'));
    const run = await runSearch(reviewer); expect(run.snapshot.status).toBe('complete');
    const card = priceCards(page).locator('xpath=self::*[@data-selected="true"]');
    await expect(card).toHaveCount(1);
    await expect(card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await scanAccessibility(page, info, 'results');
    const details = card.getByRole('button', { name: 'جزئیات سفر', exact: true });
    await details.click(); await expect(details).toHaveAttribute('aria-expanded', 'true');
    await expect(card.getByRole('region', { name: 'جزئیات مسیر رفت', exact: true })).toBeVisible();
    await expect(card.getByRole('region', { name: 'جزئیات مسیر برگشت', exact: true })).toBeVisible();
    const codes = await card.locator('[data-card-route-leg]').evaluateAll(nodes => nodes.map(node => ({ direction: getComputedStyle(node).direction, text: node.textContent })));
    expect(codes).toHaveLength(2); expect(codes.every(value => value.direction === 'ltr' && /[A-Z]{3}/.test(value.text ?? ''))).toBe(true);
    // A whole list of cards/canvas frames must not become one repeating live region.
    await expect(resultRegion(page)).not.toHaveAttribute('aria-live', /.+/);
    await expect(card.locator('[aria-live], [role="status"]')).toHaveCount(0);
    await scanAccessibility(page, info, 'expanded-route-and-provider-details');
    const filter = page.getByRole('button', { name: /^فیلتر نتایج/ });
    await filter.click(); const dialog = page.getByRole('dialog', { name: 'فیلتر پیشنهادهای سفر', exact: true });
    await expect(dialog).toBeVisible(); await scanAccessibility(page, info, 'filters');
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(filter).toBeFocused();
  });

  test('arrival hotels, room capacity and custom-point cancellation keep one accessible foreground owner', async ({ reviewer }, info) => {
    const { page } = reviewer;
    await loadQuery(reviewer, queryFor()); await runSearch(reviewer);
    const trigger = page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true });
    await trigger.click(); const dialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('region', { name: 'نتایج مقایسه اقامتگاه‌ها', exact: true })).toHaveAttribute('data-hotel-status', 'complete', { timeout: 30_000 });
    await expect(dialog.getByRole('combobox', { name: 'ظرفیت اتاق', exact: true })).toHaveValue('1');
    await scanAccessibility(page, info, 'arrival-hotels');
    await dialog.getByRole('radio', { name: 'نزدیک به نقطه دلخواه', exact: true }).press('Space');
    await expect(dialog.locator('section[data-hotel-map]')).toHaveAttribute('data-picking-point', 'true');
    await scanAccessibility(page, info, 'hotel-custom-point');
    await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
    await expect(dialog.locator('section[data-hotel-map]')).toHaveAttribute('data-picking-point', 'false');
    await dialog.getByRole('button', { name: 'بستن', exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  });

  test('identity popover exposes names, logout state and Escape focus return', async ({ reviewer }, info) => {
    const { page } = reviewer;
    await loadQuery(reviewer, queryFor());
    const trigger = page.getByRole('button', { name: 'حساب کاربری', exact: true });
    await trigger.click(); const dialog = page.getByRole('dialog', { name: 'حساب کاربری', exact: true });
    await expect(dialog).toBeVisible(); await scanAccessibility(page, info, 'guest-profile');
    const guest = dialog.getByRole('button', { name: 'ادامه با ترب', exact: true });
    const original = await guest.elementHandle(), originalId = await guest.getAttribute('id');
    expect(original).toBeTruthy(); expect(originalId).toBeTruthy();
    const actions: { phase: string; id: string | null; sameNativeNode: boolean; connected: boolean }[] = [];
    const record = async (phase: string, action: Parameters<typeof tabTo>[1]) => {
      actions.push({ phase, id: await action.getAttribute('id'), sameNativeNode: await action.evaluate((node, first) => node === first, original), connected: await action.evaluate(node => node.isConnected) });
      writeFileSync(info.outputPath('profile-action-identity.json'), JSON.stringify({ originalId, actions, boundary: 'Public native button identity across actual local sign-in/out; no private announcer access or AT speech measured.' }, null, 2) + '\n');
      expect(actions.at(-1)).toEqual({ phase, id: originalId, sameNativeNode: true, connected: true });
    };
    try {
      await record('guest', guest); await guest.click();
      const logout = dialog.getByRole('button', { name: 'خروج از حساب', exact: true });
      await expect(logout).toBeEnabled(); await record('signed-in', logout);
      await scanAccessibility(page, info, 'signed-in-profile');
      await logout.click(); await expect(guest).toBeEnabled(); await record('signed-out', guest);
      await scanAccessibility(page, info, 'signed-out-profile');
    } finally { await original?.dispose(); }
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  });

  test('changed-price consent announces its material change and English admin exposes real inspection', async ({ newReviewer }, info) => {
    const reviewer = await newReviewer({ scenario: 'price-change' }); const { page } = reviewer;
    await loadQuery(reviewer, queryFor()); const run = await runSearch(reviewer);
    const quote = scenarioQuote(run.snapshot), card = priceCards(page).locator(`xpath=self::*[@data-quote-id="${quote.quoteId}"]`);
    await card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true }).click();
    await expect(card).toHaveAttribute('data-selected', 'true');
    await card.locator(`[data-seller-link-quote-id="${quote.quoteId}"]`).click();
    const dialog = page.getByRole('dialog', { name: 'شرایط تازه پیشنهاد', exact: true });
    await expect(dialog.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase', 'changed');
    await expect(dialog.getByRole('alert')).toContainText('تغییر کرده');
    await page.screenshot({ path: info.outputPath('changed-price-consent.png') });
    await scanAccessibility(page, info, 'changed-price-consent');
    await dialog.getByRole('button', { name: 'انصراف و بازگشت به مقایسه', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto('/admin/searches/' + run.snapshot.searchId);
    await expect(page.getByRole('heading', { name: 'Search inspection', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await scanAccessibility(page, info, 'admin-search-inspection');
  });

  test('live status changes describe asynchronous results without announcing each route animation frame', async ({ newReviewer }, info) => {
    test.setTimeout(60_000);
    const reviewer = await newReviewer({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });
    const { page } = reviewer;
    await page.addInitScript(() => {
      const entries: { at: number; role: string | null; live: string | null; text: string }[] = [];
      const selector = '[role="status"], [role="alert"], [aria-live]:not([aria-live="off"])';
      const begin = () => new MutationObserver(records => {
        const owners = new Set<Element>();
        for (const record of records) {
          const node = record.target instanceof Element ? record.target : record.target.parentElement;
          const owner = node?.closest(selector); if (owner) owners.add(owner);
          for (const added of Array.from(record.addedNodes)) if (added instanceof Element) {
            if (added.matches(selector)) owners.add(added);
            added.querySelectorAll(selector).forEach(item => owners.add(item));
          }
        }
        for (const owner of owners) {
          if (!owner.isConnected || owner.closest('[inert], [aria-hidden="true"]')) continue;
          const style = getComputedStyle(owner); if (style.display === 'none' || style.visibility === 'hidden') continue;
          const text = owner.textContent?.trim(); if (text) entries.push({ at: performance.now(), role: owner.getAttribute('role'), live: owner.getAttribute('aria-live'), text: text.slice(0, 600) });
        }
      }).observe(document.body, { childList: true, characterData: true, subtree: true });
      if (document.body) begin(); else document.addEventListener('DOMContentLoaded', begin, { once: true });
      Object.assign(window, { t31LiveAnnouncements: entries });
    });
    await loadQuery(reviewer, queryFor());
    await runSearch(reviewer);
    const scene = page.locator('[data-route-presentation]');
    await expect(scene).toHaveAttribute('data-motion-active', 'true');
    await expect.poll(() => scene.getAttribute('data-route-travel'), { timeout: 20_000 }).toMatch(/^0\.[1-8]/);
    const measured = await page.evaluate(() => new Promise<{ start: number; end: number; travel: (string | null)[]; announcements: unknown[] }>(resolve => {
      const start = performance.now(), travel: (string | null)[] = [];
      const sample = () => {
        travel.push(document.querySelector('[data-route-presentation]')?.getAttribute('data-route-travel') ?? null);
        if (travel.length < 30) requestAnimationFrame(sample);
        else {
          const end = performance.now(), all = (window as unknown as { t31LiveAnnouncements: { at: number }[] }).t31LiveAnnouncements;
          resolve({ start, end, travel, announcements: all.filter(entry => entry.at >= start && entry.at <= end) });
        }
      };
      requestAnimationFrame(sample);
    }));
    const allAnnouncements = await page.evaluate(() => (window as unknown as { t31LiveAnnouncements: unknown[] }).t31LiveAnnouncements);
    writeFileSync(info.outputPath('live-announcements.json'), JSON.stringify({ measured, allAnnouncements, scope: 'Actual accessible live-region text mutations during async search and30 native rAFs with changing route progress. This does not measure assistive-technology spoken output.' }, null, 2) + '\n');
    expect(allAnnouncements.length).toBeGreaterThan(0);
    expect(new Set(measured.travel).size).toBeGreaterThan(1);
    expect(measured.announcements).toEqual([]);
  });

  test('real keyboard traversal completes cities, calendar, overlays, card and provider handoff', async ({ reviewer }, info) => {
    test.setTimeout(120_000);
    const { page } = reviewer; const attempts = await interceptPlaceholder(reviewer);
    const tape: { phase: string; steps: Awaited<ReturnType<typeof tabTo>>; focus: Awaited<ReturnType<typeof focusSnapshot>>; failed?: boolean }[] = [];
    const reach = async (phase: string, target: Parameters<typeof tabTo>[1], reverse = false) => {
      try { const steps = await tabTo(page, target, reverse, 140); tape.push({ phase, steps, focus: await focusSnapshot(page) }); }
      catch (error) { if (error instanceof KeyboardTraversalFailure) tape.push({ phase, steps: error.steps, focus: await focusSnapshot(page), failed: true }); throw error; }
      await page.screenshot({ path: info.outputPath(`keyboard-focus-${phase}.png`) });
    };
    try {
      await loadQuery(reviewer, queryFor());
      const origin = page.getByRole('combobox', { name: 'مبدا', exact: true });
      await reach('origin', origin); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('تهران'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      await expect(origin).toHaveValue('تهران');
      const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
      await reach('destination', destination); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('مشهد'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      await expect(destination).toHaveValue('مشهد');
      const calendar = page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true });
      await reach('calendar-trigger', calendar); await page.keyboard.press('Space');
      const dateDialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true }); await expect(dateDialog).toBeVisible();
      const selectedDate = await page.locator('[data-selected-outbound]').getAttribute('data-selected-outbound'); expect(selectedDate).toBeTruthy();
      await reach('calendar-date', dateDialog.locator(`[data-date="${selectedDate}"]`));
      await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter');
      const provisional = await dateDialog.locator('[data-date][data-selected]').getAttribute('data-date');
      expect(provisional).not.toBe(selectedDate);
      await reach('calendar-cancel', dateDialog.getByRole('button', { name: 'انصراف', exact: true })); await page.keyboard.press('Enter');
      await expect(dateDialog).toHaveCount(0); await expect(calendar).toBeFocused();
      await expect(page.locator('[data-selected-outbound]')).toHaveAttribute('data-selected-outbound', selectedDate!);
      const search = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }); await expect(search).toBeEnabled();
      await reach('search-submit', search); const run = await runSearch(reviewer, () => page.keyboard.press('Enter')); expect(run.snapshot.status).toBe('complete');
      const card = priceCards(page).locator('xpath=self::*[@data-selected="true"]');
      await reach('selected-card', card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true })); await page.keyboard.press('Space');
      await expect(card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const details = card.getByRole('button', { name: 'جزئیات سفر', exact: true }); await reach('trip-details', details, true); await page.keyboard.press('Enter'); await expect(details).toHaveAttribute('aria-expanded', 'true'); await page.keyboard.press('Enter');
      const filters = page.getByRole('button', { name: /^فیلتر نتایج/ }); await reach('filters', filters, true); await page.keyboard.press('Space');
      const filterDialog = page.getByRole('dialog', { name: 'فیلتر پیشنهادهای سفر', exact: true }); await expect(filterDialog).toBeVisible(); await page.keyboard.press('Escape'); await expect(filterDialog).toHaveCount(0); await expect(filters).toBeFocused();
      const hotels = page.getByRole('button', { name: 'مقایسه اقامتگاه‌های مشهد', exact: true }); await reach('hotel-discovery', hotels, true); await page.keyboard.press('Enter');
      const hotelDialog = page.getByRole('dialog', { name: 'هتل‌های مشهد', exact: true }); await expect(hotelDialog).toBeVisible();
      await reach('hotel-close', hotelDialog.getByRole('button', { name: 'بستن', exact: true })); await page.keyboard.press('Enter'); await expect(hotelDialog).toHaveCount(0); await expect(hotels).toBeFocused();
      const seller = card.locator('[data-seller-link-quote-id]').first(); await reach('provider-link', seller);
      const popup = await expectPlaceholder(page, () => page.keyboard.press('Enter')); await popup.close();
      expect(attempts).toEqual(['https://zarei.xyz/']);
      await expect(resultRegion(page)).toHaveAttribute('data-search-id', run.snapshot.searchId);
    } finally {
      writeFileSync(info.outputPath('keyboard-traversal.json'), JSON.stringify({ tape, attempts, keyboardOnly: true, boundary: 'Native browser keyboard input and rendered focus geometry; seeded URL/owned fixture prerequisites. Placeholder navigation intercepted; no real provider or assistive-technology speech exercised.' }, null, 2) + '\n');
      await page.screenshot({ path: info.outputPath('keyboard-final.png') });
    }
  });
});
