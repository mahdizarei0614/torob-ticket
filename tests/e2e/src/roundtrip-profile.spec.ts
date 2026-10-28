import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TransportSearchQuery, SearchRecovery } from '@torob-ticket/contracts';

const out = resolve(process.env.ROUNDTRIP_PROFILE_EVIDENCE_DIR ?? 'docs/evidence/adjustments/roundtrip-profile/native');
const base: TransportSearchQuery = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-29', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'fastest' };
const results = (page: Page) => page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
const profile = (page: Page) => page.getByRole('dialog', { name: 'حساب کاربری', exact: true });
const save = (name: string, value: unknown) => writeFileSync(resolve(out, name + '.json'), JSON.stringify(value, null, 2) + '\n');
async function open(page: Page, query = base) {
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status', 'complete', { timeout: 20000 });
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(out, name + '.png') });
}
test.beforeEach(async ({ page }) => {
  mkdirSync(out, { recursive: true }); await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark'));
  expect((await page.request.post('/api/v1/demo/session', { data: { seed: 3333, anchorInstant: '2026-10-25T06:00:00Z', scenario: 'normal' } })).status()).toBe(201);
});
test.afterEach(async ({ page }, info) => { const response = await page.request.post('/api/v1/admin/reset', { data: {} }); save('cleanup-' + info.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 65), { status: response.status() }); expect(response.status()).toBe(201); });

test('@roundtrip-profile compact intro, paired price bounds and anchored profile keep real saved actions', async ({ page }) => {
  await open(page);
  await expect(page.getByText('پرواز، قطار یا اتوبوس؛ شرایط سفر را کنار هم ببینید.', { exact: true })).toHaveCount(0);
  const title = page.getByRole('heading', { name: 'سفر بعدی از کجا شروع می‌شود؟', exact: true });
  const suggestions = page.getByRole('button', { name: 'سفرهای پیشنهادی', exact: true });
  const [a, b] = await Promise.all([title.boundingBox(), suggestions.boundingBox()]);
  expect(Math.abs(a!.y + a!.height / 2 - b!.y - b!.height / 2)).toBeLessThan(2);
  const bounds = await page.locator('[aria-label="بازه قیمت روزهای قابل مقایسه"]').evaluate(node => Array.from(node.children).map(pair => { const label = pair.firstElementChild!.getBoundingClientRect(), price = pair.querySelector('bdi')!.getBoundingClientRect(); return { text: pair.textContent, gap: Math.abs(label.left - price.right), label: { x: label.x, width: label.width }, price: { x: price.x, width: price.width } }; }));
  expect(bounds).toHaveLength(2); expect(bounds.every(pair => pair.gap <= 6)).toBe(true);
  const trigger = page.getByRole('button', { name: 'حساب کاربری', exact: true });
  await trigger.click(); await expect(profile(page)).toBeVisible();
  await expect(profile(page)).not.toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await profile(page).getByRole('button', { name: 'ادامه با ترب', exact: true }).click();
  await expect(profile(page).getByRole('button', { name: 'ذخیره جست‌وجوی فعلی', exact: true })).toBeEnabled();
  for (const text of ['جست‌وجوهای ذخیره‌شده', 'قصد سفر ذخیره می‌شود؛ هر بار باز کردن، قیمت تازه می‌گیرد و قیمت قبلی تضمین نمی‌شود.', 'هنوز جست‌وجویی ذخیره نکرده‌اید.']) await expect(profile(page).getByText(text, { exact: true })).toHaveCount(0);
  await profile(page).getByRole('button', { name: 'ذخیره جست‌وجوی فعلی', exact: true }).click();
  await profile(page).getByRole('textbox', { name: 'نام جست‌وجو', exact: true }).fill('سفر من');
  await profile(page).getByRole('button', { name: 'ذخیره این جست‌وجو', exact: true }).click();
  await expect(profile(page).locator('[data-saved-search-id]')).toHaveCount(1);
  await capture(page, 'profile-desktop');
  await page.keyboard.press('Escape'); await expect(profile(page)).toHaveCount(0); await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 }); await trigger.click(); await expect(profile(page)).toBeVisible();
  const popover = await page.locator('[data-profile-popover]').boundingBox();
  expect(popover!.x).toBeGreaterThanOrEqual(0); expect(popover!.x + popover!.width).toBeLessThanOrEqual(390); expect(popover!.y + popover!.height).toBeLessThanOrEqual(844);
  await capture(page, 'profile-mobile'); await page.keyboard.press('Escape'); await expect(profile(page)).toHaveCount(0);
  await trigger.click(); await expect(profile(page)).toBeVisible();
  await page.getByRole('button', {name:'نمای روشن',exact:true}).click(); await expect(profile(page)).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-appearance','light');
  save('layout-profile', { title: a, suggestions: b, bounds, mobilePopover: popover });
});

const trips: { mode: TransportSearchQuery['mode']; scope: TransportSearchQuery['scope']; destination: string; classCode: string }[] = [
  { mode: 'flight', scope: 'domestic', destination: 'mashhad', classCode: 'economy' },
  { mode: 'train', scope: 'domestic', destination: 'mashhad', classCode: 'seat' },
  { mode: 'bus', scope: 'domestic', destination: 'isfahan', classCode: 'standard' },
  { mode: 'flight', scope: 'international', destination: 'istanbul', classCode: 'economy' },
  { mode: 'train', scope: 'international', destination: 'van', classCode: 'seat' },
  { mode: 'bus', scope: 'international', destination: 'yerevan', classCode: 'standard' },
];
for (const trip of trips) test(`@roundtrip-profile ${trip.mode} ${trip.scope} toggle gets complete fares and animates its selected route`, async ({ page }) => {
  await open(page, { ...base, mode: trip.mode, scope: trip.scope, destinationCityId: trip.destination, classCode: trip.classCode });
  await page.getByRole('radiogroup', { name: 'نوع سفر', exact: true }).getByText('رفت‌وبرگشت', { exact: true }).click();
  await expect(page.locator('[data-selected-return]')).toHaveAttribute('data-selected-return', '2026-11-01');
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status', 'complete', { timeout: 20000 });
  const started = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'), { timeout: 15000 });
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  const recovery = await (await started).json() as SearchRecovery;
  expect(recovery.snapshot.query.tripType).toBe('round-trip'); expect(recovery.snapshot.query.returnDate).toBe('2026-11-01');
  await expect(results(page)).toHaveAttribute('data-status', 'complete', { timeout: 20000 });
  const final = await (await page.request.get('/api/v1/searches/' + recovery.snapshot.searchId)).json() as SearchRecovery;
  const eligible = final.snapshot.groups.filter(group => group.eligibleQuotes.length);
  expect(eligible.length).toBeGreaterThan(0); expect(eligible.every(group => Boolean(group.itinerary.return?.segments.length))).toBe(true);
  const selected = results(page).locator('article[data-selected="true"]'); await expect(selected).toHaveCount(1);
  const map = page.getByRole('complementary', { name: 'نقشه سفر', exact: true }); await expect(map).toHaveAttribute('data-map-itinerary', /.+/);
  const motion = page.locator('[data-route-presentation]'); await expect(motion).toHaveAttribute('data-motion-active', 'true');
  const before = await motion.getAttribute('data-route-travel'); await expect.poll(() => motion.getAttribute('data-route-travel'), { timeout: 8000 }).not.toBe(before);
  await expect(selected.getByText(/برگشت ·/)).toBeVisible();
  save(trip.mode + '-' + trip.scope, { query: final.snapshot.query, groups: eligible.map(group => ({ groupId: group.groupId, itinerary: group.itinerary, quotes: group.eligibleQuotes.map(quote => ({ quoteId: quote.quoteId, providerId: quote.providerId, total: quote.total })) })), selected: await selected.getAttribute('data-quote-id'), itinerary: await map.getAttribute('data-map-itinerary'), before, after: await motion.getAttribute('data-route-travel') });
  if (trip.mode === 'flight' && trip.scope === 'domestic') await capture(page, 'roundtrip-selected');
});

test('@roundtrip-profile geography drift renders initially and after scope morph, then settles for reduced motion and coverage', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { programs: 0, linked: true, amplitudes: [] as number[], times: [] as number[], landOpacity: [] as number[], morphProgress: [] as number[] };
    Object.assign(window, { livingMapProof: state });
    const programs = new WeakSet<WebGLProgram>(), names = new WeakMap<WebGLUniformLocation, string>();
    const proto = WebGL2RenderingContext.prototype, link = proto.linkProgram, location = proto.getUniformLocation, upload = proto.uniform1f;
    proto.linkProgram = function (program) { link.call(this, program); const source = (this.getAttachedShaders(program) ?? []).map(shader => this.getShaderSource(shader) ?? '').join('\n'); if (source.includes('livingDotOffset') && source.includes('dotDriftAmplitude')) { programs.add(program); state.programs++; state.linked &&= Boolean(this.getProgramParameter(program, this.LINK_STATUS)); } };
    proto.getUniformLocation = function (program, name) { const value = location.call(this, program, name); if (value && (programs.has(program) || name === 'morphProgress')) names.set(value, name); return value; };
    proto.uniform1f = function (at, value) {
      const name = at && names.get(at);
      if (name === 'time') { state.times.push(value); if (state.times.length > 100) state.times.shift(); }
      if (name === 'mapOpacity' && state.landOpacity.at(-1) !== value) state.landOpacity.push(value);
      if (name === 'morphProgress') { state.morphProgress.push(value); if (state.morphProgress.length > 200) state.morphProgress.shift(); }
      if (name === 'dotDriftAmplitude' && state.amplitudes.at(-1) !== value) state.amplitudes.push(value);
      return upload.call(this, at, value);
    };
  });
  const proof = () => page.evaluate(() => (window as unknown as { livingMapProof: { programs: number; linked: boolean; amplitudes: number[]; times: number[]; landOpacity: number[]; morphProgress: number[] } }).livingMapProof);
  await open(page); await expect.poll(async () => (await proof()).programs).toBeGreaterThan(0);
  await expect.poll(async () => (await proof()).amplitudes.at(-1)).toBe(1);
  const initial = await proof(); const start = initial.times.at(-1)!;
  await expect.poll(async () => (await proof()).times.at(-1) ?? 0).toBeGreaterThan(start + .4);
  await page.evaluate(() => { const proof=(window as unknown as {livingMapProof:{landOpacity:number[];morphProgress:number[]}}).livingMapProof; proof.landOpacity=[];proof.morphProgress=[]; });
  await page.getByRole('radiogroup', { name: 'محدوده سفر', exact: true }).getByText('بین‌المللی', { exact: true }).click();
  await expect.poll(async () => { const state=await proof(); return state.morphProgress.some(value=>value<.99) && state.landOpacity.at(-1)===1; }, {timeout:15000}).toBe(true);
  const settledTime=(await proof()).times.at(-1)!; await expect.poll(async () => (await proof()).times.at(-1)??0).toBeGreaterThan(settledTime+.3);
  const world = await proof();
  expect(world.linked).toBe(true); expect(world.amplitudes.at(-1)).toBe(1); expect(world.times.at(-1)!).toBeGreaterThan(start + 1);
  await capture(page, 'living-world');
  await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click(); await page.waitForTimeout(300);
  const covered = (await proof()).times.at(-1); await page.waitForTimeout(350); expect((await proof()).times.at(-1)).toBe(covered);
  await page.getByRole('button', { name: 'انصراف', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect.poll(async () => (await proof()).amplitudes.at(-1)).toBe(0);
  const reduced = await proof(); await page.waitForTimeout(350); expect((await proof()).times.at(-1)).toBe(reduced.times.at(-1));
  save('living-dots', { initial, world, coveredTime: covered, reduced });
});
