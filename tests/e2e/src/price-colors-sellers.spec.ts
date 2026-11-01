import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RecheckResultSchema, ReferralReceiptSchema, ReferralSelectionSchema, type DatePriceSnapshot, type QuoteSnapshot, type TransportSearchQuery } from '@torob-ticket/contracts';
import { test, expect, currentDatePrices, dateExplorer, loadQuery, readSearch, resultRegion, runSearch, type OwnedReviewer, type ReviewerOptions } from '../fixtures';
import { exactReceipt, expectPlaceholder, interceptPlaceholder, localDate, scenarioQuote } from './acceptance/journey-helpers';

test.use({ trace: 'off' });
const evidence = resolve(process.env.PRICE_SELLERS_EVIDENCE_DIR ?? 'docs/evidence/adjustments/price-colors-sellers/native');
const query: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const reviewerOptions = (scenario: ReviewerOptions['scenario'] = 'normal'): ReviewerOptions => ({ seed: 3333, scenario, anchorInstant: '2026-10-25T06:00:00Z', viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
const save = (name: string, value: unknown) => writeFileSync(resolve(evidence, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const nextDay = (date: string) => { const value = new Date(date + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); };
const dateLabel = (date: string) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(date + 'T12:00:00Z'));
type Band = 'low' | 'mid' | 'high' | 'unknown';
function bandFor(amount: number | undefined, values: number[]): Band {
  if (amount === undefined || !values.length) return 'unknown';
  const min = Math.min(...values), max = Math.max(...values);
  return min === max ? 'mid' : amount <= min + (max - min) * .25 ? 'low' : amount >= min + (max - min) * .75 ? 'high' : 'mid';
}
const datedAmounts = (snapshot: DatePriceSnapshot) => snapshot.cells.flatMap(cell => cell.status === 'priced' ? [cell.minimum.amountRial] : []);
const bucket = (page: Page, groupId: string, amount: number) => resultRegion(page).getByRole('article').locator(`xpath=self::article[@data-group-id="${groupId}" and @data-amount-rial="${amount}"]`);

async function initialize(reviewer: OwnedReviewer) {
  mkdirSync(evidence, { recursive: true });
  await reviewer.page.addInitScript(() => {
    localStorage.setItem('torobticket.appearance', 'dark');
    const programs: { linked: boolean; shadersCompiled: boolean; hasLog: boolean }[] = [], transitions: Promise<void>[] = [];
    Object.assign(window, { pricePrograms: programs, priceTransitions: transitions });
    const link = WebGL2RenderingContext.prototype.linkProgram;
    WebGL2RenderingContext.prototype.linkProgram = function (program) {
      link.call(this, program); const shaders = this.getAttachedShaders(program) ?? [];
      programs.push({ linked: Boolean(this.getProgramParameter(program, this.LINK_STATUS)), shadersCompiled: shaders.length > 0 && shaders.every(shader => Boolean(this.getShaderParameter(shader, this.COMPILE_STATUS))), hasLog: Boolean(this.getProgramInfoLog(program)) || shaders.some(shader => Boolean(this.getShaderInfoLog(shader))) });
    };
    const transition = document.startViewTransition?.bind(document);
    if (transition) document.startViewTransition = ((update: Parameters<Document['startViewTransition']>[0]) => { const value = transition(update); transitions.push(value.finished.catch(() => undefined)); return value; }) as Document['startViewTransition'];
  });
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  // Only the actual finite theme transactions observed in this owned page.
  await page.evaluate(async () => { await Promise.all((window as unknown as { priceTransitions: Promise<void>[] }).priceTransitions); });
  await page.screenshot({ path: resolve(evidence, name + '.png') });
}
async function open(reviewer: OwnedReviewer, input = query) {
  await initialize(reviewer); await loadQuery(reviewer, input); const recovery = await runSearch(reviewer);
  expect(recovery.snapshot.status).toBe('complete'); expect(recovery.snapshot.query).toEqual(input);
  await expect(resultRegion(reviewer.page).getByRole('article').locator('xpath=self::article[@data-selected="true"]')).toHaveCount(1);
  return recovery;
}
async function semanticColors(page: Page) {
  return page.evaluate(() => {
    const read = (name: string) => { const probe = document.createElement('span'); probe.style.color = `var(${name})`; document.body.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; };
    return { low: read('--price-low'), mid: read('--price-mid'), high: read('--price-high'), unknown: read('--text-muted') };
  });
}
async function assertDateBands(reviewer: OwnedReviewer, snapshot: DatePriceSnapshot, calendar = false) {
  const { page } = reviewer, amounts = datedAmounts(snapshot), colors = await semanticColors(page), dates = page.getByRole('listbox', { name: 'روزهای نزدیک', exact: true });
  expect(amounts.length).toBeGreaterThan(1); expect(Math.min(...amounts)).toBeLessThan(Math.max(...amounts));
  const wheelBands = await dates.getByRole('option').evaluateAll(nodes => nodes.map(node => ({ label: node.querySelector('bdi')!.textContent, band: node.querySelector('[data-price-band]')!.getAttribute('data-price-band'), color: getComputedStyle(node.querySelector('[data-price-band]')!).color, text: node.querySelector('[data-price-band]')!.textContent })));
  expect(wheelBands).toHaveLength(90);
  const minimum = localDate(reviewer.session.anchorInstant, 'Asia/Tehran'); let pricedRows = 0;
  for (const [index, row] of wheelBands.entries()) {
    const date = new Date(minimum + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + index); const wire = date.toISOString().slice(0, 10), cell = snapshot.cells.find(cell => cell.date === wire);
    expect(row.label).toBe(dateLabel(wire)); const expected = bandFor(cell?.status === 'priced' ? cell.minimum.amountRial : undefined, amounts);
    expect(row.band).toBe(expected); if (expected !== 'unknown') { expect(row.color).toBe(colors[expected]); pricedRows++; }
  }
  expect(pricedRows).toBeGreaterThan(1);
  const calendarBands = calendar ? await page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true }).locator('[data-date]:not([data-outside-month])').evaluateAll(nodes => nodes.map(node => ({ date: node.getAttribute('data-date')!, band: node.querySelector('[data-price-band]')!.getAttribute('data-price-band'), color: getComputedStyle(node.querySelector('[data-price-band]')!).color }))) : [];
  if (calendar) {
    expect(calendarBands.length).toBeGreaterThan(20);
    for (const row of calendarBands) {
      const cell = snapshot.cells.find(cell => cell.date === row.date), expected = bandFor(cell?.status === 'priced' ? cell.minimum.amountRial : undefined, amounts);
      expect(row.band).toBe(expected); if (expected !== 'unknown') expect(row.color).toBe(colors[expected]);
    }
    for (const band of ['low', 'high']) expect(calendarBands.some(row => row.band === band)).toBe(true);
  }
  return { snapshot, colors, wheelBands, calendarBands };
}
async function chooseExactSeller(reviewer: OwnedReviewer, groupId: string, quote: QuoteSnapshot) {
  const { page } = reviewer, card = bucket(page, groupId, quote.total.amountRial), choice = card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true });
  await expect(choice).toBeEnabled(); await choice.focus(); await choice.press('Space'); await expect(card).toHaveAttribute('data-selected', 'true');
  await expect(card).toHaveAttribute('data-quote-id', quote.quoteId);
  const seller = card.locator(`button[data-referral-source="transport"][role="link"][data-seller-link-quote-id="${quote.quoteId}"]`);
  await expect(seller).toBeFocused(); await expect(seller).toHaveAttribute('data-provider-id', quote.providerId);
  const amounts = await card.locator('[data-seller-amount-rial]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-seller-amount-rial'))));
  expect(amounts.length).toBeGreaterThan(0); expect(amounts.every(amount => amount === quote.total.amountRial)).toBe(true);
  return { card, seller, amounts };
}

test('@price-sellers compact form and coherent price bands survive time, calendar and theme changes', async ({ newReviewer }) => {
  const reviewer = await newReviewer(reviewerOptions()), { page } = reviewer;
  const recovery = await open(reviewer, { ...query, filters: { providerIds: ['demo-provider-01'] } }); await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator('[data-date-evidence]')).toHaveCount(0);
  for (const text of ['روزهای بدون قیمت فاصله دارند؛ قیمت حرکت است، نه تاریخچه قیمت.', 'مقایسه قیمت و شرایط فروشندگان']) await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  const form = page.getByRole('form', { name: 'جست‌وجوی سفر', exact: true }), submit = page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true });
  const layout = await form.evaluate(node => { const style = getComputedStyle(node), button = node.querySelector<HTMLButtonElement>('button[type="submit"]')!, chart = node.querySelector('[aria-label="انتخاب روز از نمودار"]')!, box = node.getBoundingClientRect(); return { form: box.width, inner: box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth), button: button.getBoundingClientRect().width, bottom: button.getBoundingClientRect().bottom, chart: chart.getBoundingClientRect().height }; });
  expect(Math.abs(layout.inner - layout.button)).toBeLessThan(2); expect(layout.chart).toBeGreaterThanOrEqual(145); expect(layout.bottom).toBeLessThanOrEqual(768); await expect(submit).toBeEnabled();
  const amounts = recovery.snapshot.groups.flatMap(group => group.eligibleQuotes.map(quote => quote.total.amountRial)), colors = await semanticColors(page);
  const painted = await resultRegion(page).getByRole('article').evaluateAll(nodes => nodes.map(node => ({ amount: Number(node.getAttribute('data-amount-rial')), band: node.querySelector('[data-price-band]')!.getAttribute('data-price-band'), color: getComputedStyle(node.querySelector('[data-price-band]')!).color })));
  expect(painted.length).toBeGreaterThan(1); expect(painted.map(row => row.amount).sort((a, b) => a - b)).toEqual(amounts.sort((a, b) => a - b));
  for (const entry of painted) { const expected = bandFor(entry.amount, amounts); expect(entry.band).toBe(expected); expect(entry.color).toBe(colors[expected]); }
  const initialDates = await assertDateBands(reviewer, await currentDatePrices(reviewer)); await capture(page, 'desktop-dark');
  const previous = initialDates.snapshot.datePriceId; await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true }); await expect(dialog).toBeVisible(); await expect(dateExplorer(page)).not.toHaveAttribute('data-date-price-id', previous);
  await expect(dateExplorer(page)).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30_000 });
  const calendarBands = await assertDateBands(reviewer, await currentDatePrices(reviewer), true); await capture(page, 'calendar-dark');
  await dialog.getByRole('button', { name: 'انصراف', exact: true }).click();
  await page.getByRole('button', { name: 'نمای روشن', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-appearance', 'light');
  await capture(page, 'desktop-light'); const lightBands = await assertDateBands(reviewer, await currentDatePrices(reviewer));
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready', { timeout: 45_000 });
  const programs = await page.evaluate(() => (window as unknown as { pricePrograms: { linked: boolean; shadersCompiled: boolean; hasLog: boolean }[] }).pricePrograms);
  expect(programs.length).toBeGreaterThan(0); expect(programs.every(program => program.linked && program.shadersCompiled && !program.hasLog)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0)); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); await capture(page, 'mobile-light');
  const dates = page.getByRole('listbox', { name: 'روزهای نزدیک', exact: true }), before = await dates.locator('[data-price-band]:not([data-price-band="unknown"])').allTextContents(); expect(before.length).toBeGreaterThan(1);
  const current = await currentDatePrices(reviewer); await page.clock.install(); await page.clock.fastForward(70_000);
  expect(await dates.locator('[data-price-band]:not([data-price-band="unknown"])').allTextContents()).toEqual(before); await expect(dateExplorer(page)).toHaveAttribute('data-date-price-id', current.datePriceId);
  await expect(page.getByText(/قیمت‌های مشاهده‌شده دیگر تازه نیستند/)).toHaveCount(0); await expect(page.getByRole('button', { name: 'تلاش دوباره برای قیمت روزها', exact: true })).toHaveCount(0);
  save('price-presentation', { session: reviewer.session, query: recovery.snapshot.query, reducedMotion: true, layout, painted, initialDates, calendarBands, lightBands, retainedDatePrices: before, programs });
});

test('@price-sellers exact nonrepresentative seller receives the displayed price and retains comparison without another write', async ({ newReviewer }) => {
  const reviewer = await newReviewer(reviewerOptions()), { page } = reviewer, recovery = await open(reviewer);
  const candidates = recovery.snapshot.groups.flatMap(group => group.eligibleQuotes.filter(quote => quote.quoteId !== group.representativeQuoteId && group.eligibleQuotes.filter(candidate => candidate.total.amountRial === quote.total.amountRial).length === 1).map(quote => ({ group, quote })));
  expect(candidates.length).toBeGreaterThan(0); const { group, quote } = candidates[0]!, { card, seller, amounts } = await chooseExactSeller(reviewer, group.groupId, quote);
  await expect(page.getByRole('button', { name: /^رفتن به / })).toHaveCount(0); await capture(page, 'selected-seller');
  const attempts = await interceptPlaceholder(reviewer), writes: string[] = []; page.on('request', request => { if (request.method() === 'POST' && /\/(searches|referrals)(\/|$)/.test(new URL(request.url()).pathname)) writes.push(new URL(request.url()).pathname); });
  const original = { url: page.url(), searchId: recovery.snapshot.searchId, itineraryId: await page.getByRole('complementary', { name: 'نقشه سفر', exact: true }).getAttribute('data-map-itinerary') };
  const prepared = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/referrals/prepare')), confirmed = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/referrals/confirm'));
  const popup = await expectPlaceholder(page, () => seller.press('Enter'));
  const prepareResponse = await prepared; expect(prepareResponse.status()).toBe(201); expect(ReferralSelectionSchema.parse(prepareResponse.request().postDataJSON())).toEqual({ kind: 'transport', quoteId: quote.quoteId, quoteVersion: quote.version });
  const recheck = RecheckResultSchema.parse(await prepareResponse.json()); expect(recheck.status).toBe('ready'); if (recheck.status === 'unavailable') throw new Error('Normal seller must recheck');
  const response = await confirmed; expect(response.status()).toBe(201); const receipt = ReferralReceiptSchema.parse(await response.json()); exactReceipt(receipt, recheck.intent);
  expect(receipt.payload.kind).toBe('transport'); if (receipt.payload.kind === 'transport') { expect(receipt.payload.quote.quoteId).toBe(quote.quoteId); expect(receipt.payload.quote.providerId).toBe(quote.providerId); expect(receipt.payload.quote.total).toEqual(quote.total); expect(receipt.payload.quote.breakdown).toEqual(quote.breakdown); expect(receipt.payload.quote.party).toEqual(quote.party); expect(receipt.payload.quote.conditions).toEqual(quote.conditions); expect(receipt.payload.itinerary).toEqual(group.itinerary); }
  expect(attempts).toEqual(['https://zarei.xyz/']); await popup.close(); await page.bringToFront();
  expect(page.url()).toBe(original.url); await expect(resultRegion(page)).toHaveAttribute('data-search-id', original.searchId); await expect(card).toHaveAttribute('data-selected', 'true'); await expect(card).toHaveAttribute('data-quote-id', quote.quoteId);
  await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-itinerary', original.itineraryId!);
  expect(await readSearch(reviewer, original.searchId)).toEqual(recovery); expect(writes).toEqual(['/api/v1/referrals/prepare', '/api/v1/referrals/confirm']);
  save('exact-seller-handoff', { session: reviewer.session, quote, amounts, recheck, receipt, original, attempts, writes, proofLimit: 'Only approved external placeholder navigation was intercepted. Original comparison and immutable local receipt remain authoritative; no live provider, booking or purchase is claimed.' });
});

test('@price-sellers changed seller price still requires explicit consent', async ({ newReviewer }) => {
  const reviewer = await newReviewer(reviewerOptions('price-change')), { page } = reviewer, recovery = await open(reviewer), quote = scenarioQuote(recovery.snapshot);
  const group = recovery.snapshot.groups.find(group => group.eligibleQuotes.some(candidate => candidate.quoteId === quote.quoteId))!;
  const { card, seller } = await chooseExactSeller(reviewer, group.groupId, quote), attempts = await interceptPlaceholder(reviewer), writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/referrals/confirm')) writes.push(new URL(request.url()).pathname); });
  const original = { url: page.url(), searchId: recovery.snapshot.searchId, itineraryId: group.itinerary.itineraryId };
  const prepared = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/referrals/prepare')); await seller.click();
  const prepareResponse = await prepared; expect(prepareResponse.status()).toBe(201); expect(ReferralSelectionSchema.parse(prepareResponse.request().postDataJSON())).toEqual({ kind: 'transport', quoteId: quote.quoteId, quoteVersion: quote.version });
  const recheck = RecheckResultSchema.parse(await prepareResponse.json()); expect(recheck.status).toBe('changed'); if (recheck.status !== 'changed') throw new Error('Authored service-zero seller must change');
  expect(recheck.previousQuote.kind).toBe('transport'); if (recheck.previousQuote.kind === 'transport') { expect(recheck.previousQuote.quote).toEqual(quote); expect(recheck.previousQuote.itinerary).toEqual(group.itinerary); }
  await expect(page.locator('[data-referral-phase]')).toHaveAttribute('data-referral-phase', 'changed'); expect(writes).toEqual([]); expect(attempts).toEqual([]); await capture(page, 'changed-price');
  const confirmed = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/referrals/confirm'));
  const popup = await expectPlaceholder(page, () => page.getByRole('button', { name: 'پذیرش نسخه تازه و ادامه', exact: true }).click());
  const response = await confirmed; expect(response.status()).toBe(201); const receipt = ReferralReceiptSchema.parse(await response.json()); exactReceipt(receipt, recheck.intent);
  expect(receipt.payload.kind).toBe('transport'); if (receipt.payload.kind === 'transport') { expect(receipt.payload.quote.quoteId).toBe(quote.quoteId); expect(receipt.payload.quote.providerId).toBe(quote.providerId); expect(receipt.payload.quote.version).toBeGreaterThan(quote.version); expect(receipt.payload.quote.total.amountRial).toBeGreaterThan(quote.total.amountRial); expect(receipt.payload.quote.party).toEqual(quote.party); expect(receipt.payload.itinerary).toEqual(group.itinerary); }
  expect(attempts).toEqual(['https://zarei.xyz/']); expect(writes).toEqual(['/api/v1/referrals/confirm']); await popup.close(); await page.bringToFront();
  expect(page.url()).toBe(original.url); await expect(resultRegion(page)).toHaveAttribute('data-search-id', original.searchId); await expect(card).toHaveAttribute('data-selected', 'true'); expect(await readSearch(reviewer, original.searchId)).toEqual(recovery);
  await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveAttribute('data-map-itinerary', original.itineraryId);
  save('changed-seller', { session: reviewer.session, original: quote, recheck, receipt, comparison: original, attempts, confirmations: writes.length, proofLimit: 'Real local changed-price recheck/explicit consent/confirm; only external placeholder navigation was intercepted.' });
});

test('@price-sellers SVG fallback retains the same colored chart and usable form', async ({ newReviewer }) => {
  const reviewer = await newReviewer(reviewerOptions()), { page } = reviewer;
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) { return args[0] === 'webgl2' ? null : original.apply(this, args); } as typeof original; });
  await open(reviewer); await page.evaluate(() => scrollTo(0, 0)); await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'unavailable', { timeout: 45_000 });
  const snapshot = await currentDatePrices(reviewer), amounts = datedAmounts(snapshot), colors = await semanticColors(page), chart = dateExplorer(page).locator('svg[data-price-chart="fallback"]');
  await expect(chart).toBeVisible(); await expect(chart.locator('[data-price-marker]')).toHaveCount(snapshot.cells.filter(cell => cell.status === 'priced').length);
  const bands = await chart.locator('[data-price-marker]').evaluateAll(nodes => nodes.map(node => ({ date: node.getAttribute('data-price-marker'), band: node.getAttribute('data-price-band'), color: getComputedStyle(node).color, stroke: getComputedStyle(node.querySelector('circle:last-child')!).stroke })));
  expect(bands.length).toBeGreaterThan(1);
  for (const cell of snapshot.cells) if (cell.status === 'priced') { const marker = bands.find(marker => marker.date === cell.date)!; expect(marker).toBeDefined(); const band = bandFor(cell.minimum.amountRial, amounts); expect(marker.band).toBe(band); expect(marker.color).toBe(colors[band]); expect(marker.stroke).toBe(colors[band]); }
  expect(bands.some(marker => marker.band === 'low')).toBe(true); expect(bands.some(marker => marker.band === 'high')).toBe(true);
  const gradient = await chart.locator('linearGradient stop').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).stopColor)); expect(gradient).toEqual([colors.low, colors.low, colors.mid, colors.mid, colors.high, colors.high]);
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled(); await capture(page, 'svg-fallback');
  const oldDate = (await dateExplorer(page).getAttribute('data-selected-outbound'))!, current = await runSearch(reviewer, () => page.getByRole('button', { name: 'روز بعد', exact: true }).click());
  expect(current.snapshot.query.departureDate).toBe(nextDay(oldDate)); await expect(chart.locator(`[data-price-marker="${nextDay(oldDate)}"][data-selected]`)).toBeVisible();
  save('svg-fallback', { session: reviewer.session, snapshot, bands, colors, gradient, current, fault: 'WebGL2 availability blocked only in this newly owned context; actual inventory, pricing and search HTTP/SSE remain untouched.' });
});
