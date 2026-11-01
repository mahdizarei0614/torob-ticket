import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CatalogSnapshot, SearchRecovery } from '@torob-ticket/contracts';

const out = resolve(process.env.ROUNDTRIP_CHART_EVIDENCE_DIR ?? 'docs/evidence/adjustments/roundtrip-chart-profile/native');
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-01', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'fastest' };
const results = (page: Page) => page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
const profile = (page: Page) => page.getByRole('dialog', { name: 'حساب کاربری', exact: true });
const record = (name: string, data: unknown) => writeFileSync(resolve(out, name + '.json'), JSON.stringify(data, null, 2) + '\n');
async function open(page: Page, value: unknown = query) {
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(value)));
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status', 'complete', { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
}
async function search(page: Page) {
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  await expect(results(page)).toHaveAttribute('data-status', 'complete', { timeout: 20000 });
}
test.beforeEach(async ({ page }) => {
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark'));
  expect((await page.request.post('/api/v1/demo/session', { data: { seed: 3333, anchorInstant: '2026-10-25T06:00:00Z', scenario: 'normal' } })).status()).toBe(201);
});
test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return;
  const capture = await page.evaluate(() => {
    const state = window as unknown as { roundTripFrames?: Record<string, string | undefined>[]; stopRoundTripCapture?: boolean };
    state.stopRoundTripCapture = true;
    return state.roundTripFrames;
  }).catch(() => null);
  if (capture !== undefined) record('frames-' + info.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 65), capture === null ? { kind: 'public-frame-capture-unavailable' } : { frames: capture });
  const response = await page.request.post('/api/v1/admin/reset', { data: {} });
  record('cleanup-' + info.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 65), { status: response.status() });
  expect(response.status()).toBe(201);
});

test('@roundtrip-chart-profile identity-only popover, danger logout and shared squircle controls', async ({ page }) => {
  await open(page); await search(page);
  const trigger = page.getByRole('button', { name: 'حساب کاربری', exact: true });
  // The comparison scrolls into view after searching. Finish returning to the toolbar
  // before opening a popover that correctly dismisses when its owner scrolls away.
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click(); await expect(profile(page)).toBeVisible();
  await expect(page.locator('[data-profile-popover]')).not.toHaveAttribute('data-entering',/.*/);
  await expect(profile(page)).not.toHaveAttribute('aria-modal', 'true');
  await profile(page).getByRole('button', { name: 'ادامه با ترب', exact: true }).click();
  const logout = profile(page).getByRole('button', { name: 'خروج از حساب', exact: true });
  await expect(logout).toBeEnabled(); await expect(logout.locator('svg')).toHaveCount(1);
  await expect(profile(page).getByRole('combobox')).toHaveCount(0);
  await expect(profile(page).getByRole('button', { name: /ذخیره|جست‌وجو/ })).toHaveCount(0);
  await expect(profile(page).getByRole('button')).toHaveCount(2);
  const danger = await logout.evaluate(node => {
    const style = getComputedStyle(node), token = style.getPropertyValue('--danger').trim();
    const probe = document.createElement('span'); probe.style.color = token; node.append(probe);
    const expected = getComputedStyle(probe).color; probe.remove();
    return { color: style.color, expected, display: style.display, direction: style.flexDirection, alignment: style.alignItems, background: style.backgroundColor };
  });
  expect(danger.color).toBe(danger.expected); expect(['inline-flex', 'flex']).toContain(danger.display); expect(danger.direction).toBe('row'); expect(danger.alignment).toBe('center');
  await page.screenshot({ path: resolve(out, 'identity-popover-desktop.png') });
  await page.keyboard.press('Escape'); await expect(profile(page)).toHaveCount(0); await expect(trigger).toBeFocused();
  const corners = await page.evaluate(() => {
    const selectors = ['form[aria-label="جست‌وجوی سفر"]', '[data-price-card-id]', '[data-segment-track]', '[data-segment-indicator]', '[data-card-select]', 'button[type="submit"]'];
    return { supported: CSS.supports('corner-shape', 'squircle'), boxes: selectors.map(selector => { const node = document.querySelector(selector)!; const style = getComputedStyle(node); return { selector, shape: style.getPropertyValue('corner-shape'), radius: style.borderTopLeftRadius }; }) };
  });
  expect(corners.supported).toBe(true); expect(corners.boxes.every(box => ['squircle', 'superellipse(2)'].includes(box.shape) && parseFloat(box.radius) > 0)).toBe(true);
  await trigger.click(); await expect(profile(page)).toBeVisible();
  await page.getByRole('button', { name: 'نمای روشن', exact: true }).click();
  await expect(profile(page)).toHaveCount(0); await expect(page.getByRole('button', { name: 'نمای تیره', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 }); await trigger.click(); await expect(logout).toBeVisible();
  const popover = await page.locator('[data-profile-popover]').boundingBox();
  expect(popover!.x).toBeGreaterThanOrEqual(0); expect(popover!.x + popover!.width).toBeLessThanOrEqual(390); expect(popover!.y + popover!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: resolve(out, 'identity-popover-mobile.png') });
  await logout.click(); await expect(profile(page).getByRole('button', { name: 'ادامه با ترب', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  record('profile-corners', { danger, corners, mobilePopover: popover });
});

test('@roundtrip-chart-profile changed city intent marks cards and blocks referral without routine banners', async ({ page }) => {
  await open(page); await search(page);
  const cards = results(page).locator('[data-price-card-id]'), count = await cards.count(); expect(count).toBeGreaterThan(0);
  const writes:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&(request.url().endsWith('/api/v1/searches')||request.url().includes('/api/v1/referrals/')))writes.push(new URL(request.url()).pathname);});
  await page.getByRole('button', { name: 'پاک کردن مقصد', exact: true }).click();
  await page.keyboard.press('Escape');
  const submit=page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true });await expect(submit).toBeEnabled();await expect(submit).toHaveAttribute('data-invalid','true');await submit.click();
  const destination=page.getByRole('combobox',{name:'مقصد',exact:true});await expect(destination).toBeFocused();await expect(destination).toHaveAttribute('aria-invalid','true');expect(writes).toEqual([]);
  // Invalid submit focuses its error and opens the real city menu. Dismiss
  // that nonmodal portal before inspecting the comparison outside it.
  await page.keyboard.press('Escape');
  await expect(cards).toHaveCount(count);
  for (const card of await cards.all()) {
    await expect(card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true })).toBeDisabled();
    await expect(card.getByText(/اعتبار قیمت پایان/)).toBeVisible();
    await expect(card.locator('[data-price-sellers]')).toHaveCount(0);
  }
  await expect(page.getByText(/فرم سفر تغییر کرده؛ این نتایج/)).toHaveCount(0);
  const origin = page.getByRole('combobox', { name: 'مبدا', exact: true });
  await origin.fill('مشهد'); await page.getByRole('option').filter({has:page.getByText('مشهد',{exact:true})}).click();
  await expect(page.getByText('مقصد با انتخاب تازه سازگار نبود؛ دوباره انتخاب کنید.', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: resolve(out, 'changed-intent-cards.png') });
  expect(writes).toEqual([]);record('changed-intent', { retainedCards: count, selectionBlocked: true, sellerActionsRemoved: true, invalidSubmitInvokable:true, focusedInvalidDestination:true, writes, verboseNotices: false });
});

test('@roundtrip-chart-profile chart eases through draw, reshape, exit and re-entry with actual GPU progress', async ({ page }) => {
  await page.addInitScript(() => {
    const proof = { frames: [] as { time: number; phase: string; reveal: number; opacity: number; morph: number; selected: string }[], gpu: [] as { name: string; value: number }[], running: true };
    Object.assign(window, { chartLifecycleProof: proof });
    const programs = new WeakSet<WebGLProgram>(), names = new WeakMap<WebGLUniformLocation, string>();
    const proto = WebGL2RenderingContext.prototype, link = proto.linkProgram, location = proto.getUniformLocation, upload = proto.uniform1f;
    proto.linkProgram = function (program) { link.call(this, program); const source = (this.getAttachedShaders(program) ?? []).map(shader => this.getShaderSource(shader) ?? '').join('\n'); if (source.includes('vChartX') && source.includes('curveOpacity')) programs.add(program); };
    proto.getUniformLocation = function (program, name) { const value = location.call(this, program, name); if (value && programs.has(program) && ['reveal', 'curveOpacity'].includes(name)) names.set(value, name); return value; };
    proto.uniform1f = function (at, value) { const name = at && names.get(at); if (name) { proof.gpu.push({ name, value }); if (proof.gpu.length > 4000) proof.gpu.shift(); } return upload.call(this, at, value); };
    const tick = () => {
      const node = document.querySelector<HTMLElement>('[data-chart-selected][data-chart-phase]');
      if (node) {
        const next = { time: performance.now(), phase: node.dataset['chartPhase']!, reveal: Number(node.dataset['chartReveal']), opacity: Number(node.dataset['chartOpacity']), morph: Number(node.dataset['chartMorphProgress']), selected: node.dataset['chartSelected']! };
        const last = proof.frames.at(-1);
        if (!last || next.phase !== last.phase || next.reveal !== last.reveal || next.opacity !== last.opacity || next.morph !== last.morph) proof.frames.push(next);
      }
      if (proof.running) requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  });
  await open(page); const chart = page.locator('[data-chart-selected]');
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready');
  await expect(chart).toHaveAttribute('data-chart-phase', 'settled', { timeout: 15000 });
  await expect(page.getByText('کمترین قیمت:', { exact: true })).toBeVisible(); await expect(page.getByText('بیشترین قیمت:', { exact: true })).toBeVisible();
  const slider = page.getByRole('slider', { name: 'انتخاب روز از نمودار', exact: true });
  await slider.focus(); await slider.press('ArrowRight');
  await expect(chart).not.toHaveAttribute('data-chart-selected', query.departureDate);
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status', 'complete', { timeout: 20000 });
  await expect(chart).toHaveAttribute('data-chart-phase', 'settled', { timeout: 10000 });
  await page.getByRole('button', { name: 'پاک کردن مقصد', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(chart).toHaveAttribute('data-chart-phase', 'empty', { timeout: 10000 }); await expect.poll(async () => Number(await chart.getAttribute('data-chart-opacity'))).toBe(0);
  const destination = page.getByRole('combobox', { name: 'مقصد', exact: true }); await destination.fill('مشهد'); await page.getByRole('option').filter({has:page.getByText('مشهد',{exact:true})}).click();
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status', 'complete', { timeout: 20000 });
  await expect(chart).toHaveAttribute('data-chart-phase', 'settled', { timeout: 10000 });
  const proof = await page.evaluate(() => (window as unknown as { chartLifecycleProof: { frames: { time: number; phase: string; reveal: number; opacity: number; morph: number; selected: string }[]; gpu: { name: string; value: number }[]; running: boolean } }).chartLifecycleProof);
  expect(proof.frames.some(frame => frame.phase === 'entering' && frame.reveal > 0 && frame.reveal < 1)).toBe(true);
  expect(proof.frames.some(frame => frame.phase === 'reshaping' && frame.morph > 0 && frame.morph < 1)).toBe(true);
  expect(proof.frames.some(frame => frame.phase === 'exiting' && frame.opacity > 0 && frame.opacity < 1)).toBe(true);
  expect(proof.frames.filter((frame, index) => frame.phase === 'entering' && proof.frames[index - 1]?.phase !== 'entering').length).toBeGreaterThanOrEqual(2);
  expect(proof.gpu.some(item => item.name === 'reveal' && item.value > 0 && item.value < 1)).toBe(true);
  expect(proof.gpu.some(item => item.name === 'curveOpacity' && item.value > 0 && item.value < 1)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(chart).toHaveAttribute('data-motion-policy', 'static'); await expect.poll(async () => Number(await chart.getAttribute('data-chart-reveal'))).toBe(1);
  await page.screenshot({ path: resolve(out, 'chart-settled.png') }); record('chart-lifecycle', proof);
  await page.evaluate(() => { (window as unknown as { chartLifecycleProof: { running: boolean } }).chartLifecycleProof.running = false; });
});

for (const trip of [
  { mode: 'flight', classCode: 'economy', destinationCityId: 'mashhad' },
  { mode: 'train', classCode: 'seat', destinationCityId: 'mashhad' },
  { mode: 'bus', classCode: 'standard', destinationCityId: 'isfahan' },
]) test(`@roundtrip-chart-profile ${trip.mode} returns, fades and loops while retaining its route facts`, async ({ page }) => {
  test.setTimeout(90000);
  await open(page, { ...query, ...trip, tripType: 'round-trip', returnDate: '2026-11-04' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => {
    const rows: Record<string, string | undefined>[] = [], started = performance.now();
    Object.assign(window, { roundTripFrames: rows });
    const tick = () => {
      const node = document.querySelector<HTMLElement>('[data-route-presentation][data-route-round-trip="true"]');
      if (node) rows.push({ at: performance.now().toFixed(3), itinerary: document.querySelector<HTMLElement>('[data-map-itinerary]')?.dataset['mapItinerary'], phase: node.dataset['journeyPhase'], direction: node.dataset['routeAnimationDirection'], turn: node.dataset['routeTurnProgress'], travel: node.dataset['routeTravel'], opacity: node.dataset['vehicleOpacity'], blur: node.dataset['vehicleBlur'], point: node.dataset['vehiclePoint'], complete: node.dataset['routeComplete'], reveal: node.dataset['routeReveal'] });
      if (performance.now() - started < 80000 && !(window as unknown as { stopRoundTripCapture?: boolean }).stopRoundTripCapture) requestAnimationFrame(tick);
    }; tick();
  });
  await search(page);
  const motion = page.locator('[data-route-presentation][data-route-round-trip="true"]');
  const selectedItinerary = await page.locator('[data-map-itinerary]').getAttribute('data-map-itinerary');
  expect(selectedItinerary).toBeTruthy();
  await expect(motion).toHaveAttribute('data-journey-phase', 'turn', { timeout: 20000 });
  await expect(motion).toHaveAttribute('data-route-turn-mode', trip.mode);
  await page.screenshot({ path: resolve(out, trip.mode + '-turnaround.png') });
  if (trip.mode === 'flight') {
    await page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true }).click();
    await expect(motion).toHaveAttribute('data-motion-active', 'false');
    const paused = await motion.getAttribute('data-route-travel');
    await page.waitForTimeout(350); expect(await motion.getAttribute('data-route-travel')).toBe(paused);
    await page.getByRole('button', { name: 'انصراف', exact: true }).click();
    await expect(motion).toHaveAttribute('data-motion-active', 'true');
  }
  await expect(motion).toHaveAttribute('data-route-animation-direction', 'return', { timeout: 10000 });
  // The exact invisible arrival is brief. Poll the actual rAF observations,
  // rather than missing that state between Playwright's attribute-poll samples.
  // Both original exact opacity/blur values must belong to the same first-pass
  // return-arrival frame of this actual selected itinerary.
  await expect.poll(() => page.evaluate(itinerary => {
    const rows = (window as unknown as { roundTripFrames: Record<string, string | undefined>[] }).roundTripFrames.filter(row => row.itinerary === itinerary);
    const completed = rows.findIndex(row => row.phase === 'complete');
    const firstPass = completed < 0 ? rows : rows.slice(0, completed);
    return firstPass.some(row => row.direction === 'return' && row.travel === '1.000' && row.opacity === '0.000' && row.blur === '1.000');
  }, selectedItinerary), { timeout: 20000 }).toBe(true);
  await expect(motion).toHaveAttribute('data-route-complete', 'true', { timeout: 20000 });
  await expect(motion).toHaveAttribute('data-route-reveal', '1.000');
  // Opacity rounds to zero slightly before exact arrival. Inspect the last
  // first-pass return hold, before completion starts its invisible restart.
  const firstPass = await page.evaluate(itinerary => {
    const rows=(window as unknown as { roundTripFrames: Record<string,string|undefined>[] }).roundTripFrames.filter(row=>row.itinerary===itinerary);
    const completed=rows.findIndex(row=>row.phase==='complete');return completed<0?rows:rows.slice(0,completed);
  }, selectedItinerary);
  const heldArrival=firstPass.filter(frame=>frame.direction==='return'&&frame.travel==='1.000'&&frame.opacity==='0.000'&&frame.blur==='1.000').at(-1);
  expect(heldArrival?.point).toBeTruthy();
  const final=heldArrival!.point!.split(',').map(Number);
  await expect(page.locator('[data-map-heading] h2 svg[data-map-heading-arrow]')).toHaveAttribute('data-map-heading-arrow', 'round-trip');
  if (trip.mode === 'flight') await expect(page.locator('[data-map-heading] h2 bdi').first()).toHaveText(/\([A-Z]{3}( \/ [A-Z]{3})?\)/);
  else await expect(page.locator('[data-map-heading] h2 bdi:not([hidden])')).toHaveCount(0);
  const id = await results(page).getAttribute('data-search-id');
  const evidence = await (await page.request.get('/api/v1/searches/' + id)).json() as SearchRecovery;
  const itineraryId = await page.locator('aside[aria-label="نقشه سفر"]').getAttribute('data-map-itinerary');
  const itinerary = evidence.snapshot.groups.find(group => group.itinerary.itineraryId === itineraryId)!.itinerary;
  expect(itinerary.return?.segments.length).toBeGreaterThan(0);
  const catalog = await (await page.request.get('/api/v1/catalog')).json() as CatalogSnapshot;
  const ids = [itinerary.outbound, itinerary.return!].flatMap(leg => leg.segments.flatMap(segment => [segment.originPlaceId, segment.destinationPlaceId]));
  const places = catalog.places.filter(place => ids.includes(place.id));
  const wrap = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
  const firstLongitude = places[0]!.point.longitude;
  const unwrapped = places.map(place => firstLongitude + wrap(place.point.longitude - firstLongitude));
  const center = wrap((Math.min(...unwrapped) + Math.max(...unwrapped)) / 2);
  const origin = catalog.places.find(place => place.id === itinerary.outbound.segments[0]!.originPlaceId)!;
  const arrival = catalog.places.find(place => place.id === itinerary.return!.segments.at(-1)!.destinationPlaceId)!;
  expect(arrival.cityId).toBe(origin.cityId);
  expect(final[0]).toBeCloseTo(wrap(arrival.point.longitude - center), 4); expect(final[1]).toBeCloseTo(arrival.point.latitude, 4);
  await expect(motion).toHaveAttribute('data-route-animation-direction', 'outbound', { timeout: 10000 });
  await expect.poll(async()=>Number(await motion.getAttribute('data-vehicle-opacity'))).toBeGreaterThan(.9);
  const loopStart=Number(await motion.getAttribute('data-route-travel'));
  expect(loopStart).toBeGreaterThan(0);expect(loopStart).toBeLessThan(.5);
  await expect(motion).toHaveAttribute('data-route-complete','true');
  await expect(motion).toHaveAttribute('data-route-reveal','1.000');
  await expect.poll(async()=>Number(await motion.getAttribute('data-route-turn-progress')), {timeout:25000}).toBeGreaterThan(.1);
  await expect(motion).toHaveAttribute('data-route-animation-direction','return',{timeout:10000});
  await expect(motion).toHaveAttribute('data-route-reveal','1.000');
  await page.evaluate(() => { (window as unknown as { stopRoundTripCapture?: boolean }).stopRoundTripCapture=true; });
  const frames = await page.evaluate(itinerary => (window as unknown as { roundTripFrames: Record<string, string | undefined>[] }).roundTripFrames.filter(row=>row.itinerary===itinerary), selectedItinerary);
  expect(frames.some(frame => frame.direction === 'outbound' && frame.phase === 'travel')).toBe(true);
  expect(frames.filter(frame => frame.phase === 'turn').some(frame => Number(frame.turn) > .1 && Number(frame.turn) < .9)).toBe(true);
  expect(frames.some(frame => frame.direction === 'return' && Number(frame.opacity) > 0 && Number(frame.opacity) < 1)).toBe(true);
  expect(errors).toEqual([]);
  record(trip.mode + '-roundtrip', { itinerary, origin: origin.point, expectedReturnArrival: arrival.point, finalProjectedPoint: final, projectionCenter: center, loopStart, repeatedTurnAndReturn:true, errors, frames });
});
