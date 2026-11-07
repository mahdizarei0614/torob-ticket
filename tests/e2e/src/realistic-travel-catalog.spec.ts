import { expect, test, type Locator, type Page, type Request } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HotelSearchSnapshotSchema, SearchRecoverySchema, type CatalogSnapshot, type ComparisonGroup, type Itinerary, type SearchRecovery, type TransportSearchQuery } from '@torob-ticket/contracts';

const out = resolve(process.env.REALISTIC_CATALOG_EVIDENCE_DIR ?? '.local/evidence/adjustments/realistic-travel-catalog/native-catalog');
const query: TransportSearchQuery = { mode: 'flight', scope: 'international', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'los-angeles', departureDate: '2026-11-01', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
const results = (page: Page) => page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
const map = (page: Page) => page.getByRole('complementary', { name: 'نقشه سفر', exact: true });
const heading = (page: Page) => page.locator('[data-map-heading-key]:not([aria-hidden="true"])');
const fa = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
const wrap = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
const record = (name: string, data: unknown) => writeFileSync(resolve(out, name + '.json'), JSON.stringify(data, null, 2) + '\n');
const nameFor = (title: string) => title.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 95);
const pageErrors = new WeakMap<Page, string[]>();

async function open(page: Page, value: TransportSearchQuery = query) {
  await page.goto('/?q=' + encodeURIComponent(JSON.stringify(value)));
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
}
async function search(page: Page) {
  const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/searches'));
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(201);
  const initial = await response.json() as SearchRecovery;
  await expect(results(page)).toHaveAttribute('data-search-id', initial.snapshot.searchId);
  const deadline = Date.now() + 25_000;
  let captureAttempted = false;
  const captureTerminal = async () => {
    captureAttempted = true;
    try {
      const recovery = await page.request.get('/api/v1/searches/' + initial.snapshot.searchId, { timeout: 5_000 });
      expect(recovery.status()).toBe(200);
      const terminal = SearchRecoverySchema.parse(await recovery.json());
      const native = await page.evaluate(() => { const region = document.querySelector('[aria-label="نتایج مقایسه سفر"]'); return { searchId: region?.getAttribute('data-search-id'), status: region?.getAttribute('data-status'), sequence: region?.getAttribute('data-sequence'), connection: region?.getAttribute('data-connection-state') }; });
      record('terminal-' + nameFor(test.info().title) + '-' + initial.snapshot.searchId, { native, recovery: terminal });
      return terminal;
    } catch {
      record('terminal-' + nameFor(test.info().title) + '-' + initial.snapshot.searchId, { kind: 'owned-terminal-recovery-capture-failed' });
      throw new Error('Owned terminal search recovery could not be captured');
    }
  };
  let value: SearchRecovery;
  try {
    await expect(results(page)).toHaveAttribute('data-status', /^(complete|partial|empty|failed|cancelled|interrupted)$/, { timeout: 25_000 });
    value = await captureTerminal();
    // Preserve the strict complete requirement and original UI deadline. A
    // partial terminal is recorded before failing, never retried or accepted.
    expect(value.snapshot.status).toBe('complete');
    await expect(results(page)).toHaveAttribute('data-status', 'complete', { timeout: Math.max(1, deadline - Date.now()) });
  } catch (primary) {
    if (!captureAttempted) await captureTerminal().catch(() => undefined);
    throw primary;
  }
  for (const quote of value.snapshot.groups.flatMap(group => group.eligibleQuotes)) {
    expect(quote.fixtureVersion).toBe('showcase-v3'); expect(quote.sourceRevision).toBe('source-v5-schedule-tradeoffs-2026-10-30');
    expect(quote.provenance.every(source => source.fixtureVersion === 'showcase-v3' && source.sourceRevision === quote.sourceRevision)).toBe(true);
    expect(quote.breakdown.reduce((sum, item) => sum + item.amount.amountRial, 0)).toBe(quote.total.amountRial);
    expect(quote.party).toEqual({ adults: 1, children: 0, infants: 0 });
  }
  return value;
}
async function choose(page: Page, group: ComparisonGroup) {
  const quote = group.eligibleQuotes.find(item => item.quoteId === group.representativeQuoteId)!;
  expect(quote).toBeTruthy();
  const card = results(page).locator(`article[data-group-id="${group.groupId}"][data-amount-rial="${quote.total.amountRial}"]`);
  await expect(card).toHaveCount(1);
  const surface = card.getByRole('button', { name: 'انتخاب پیشنهاد', exact: true });
  await surface.focus(); await surface.press('Enter');
  await expect(card).toHaveAttribute('data-selected', 'true');
  const quoteId = await card.getAttribute('data-quote-id');
  expect(group.eligibleQuotes.some(item => item.quoteId === quoteId && item.total.amountRial === quote.total.amountRial)).toBe(true);
  await expect(map(page)).toHaveAttribute('data-map-itinerary', group.itinerary.itineraryId);
  await expect(page.locator('[data-route-presentation]')).toHaveAttribute('data-route-complete', 'true');
  await page.mouse.move(1439, 1);
  return { card, quote };
}
async function loadedMark(card: Locator, kind: 'airline' | 'ground-operator', brand: string, operator: string) {
  await expect(card.getByRole('heading', { level: 3 })).toHaveText(operator);
  const image = card.locator(`img[data-${kind}-brand="${brand}"]`);
  await expect(image).toHaveCount(1);
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
  const proof = await image.evaluate(node => { const image = node as HTMLImageElement, box = image.getBoundingClientRect(); return { src: image.currentSrc, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, width: box.width, height: box.height, decorative: image.getAttribute('aria-hidden') }; });
  expect(new URL(proof.src).pathname).toMatch(kind === 'airline' ? /\/airlines\/.*\.png$/ : /\/ground-operators\/.*\.png$/);
  expect(proof.width).toBe(40); expect(proof.height).toBe(40); expect(proof.naturalWidth).toBeGreaterThanOrEqual(64);
  expect(proof.decorative).toBe('true');
  return proof;
}

/** Compare actual displayed camera and DOM anchors with all facilities supplied by recovery.
 * Derive the equirectangular meridian independently; importing the graphics barrel would load browser shaders in Node. */
async function routeFacts(page: Page, catalog: CatalogSnapshot, itinerary: Itinerary) {
  const legs = [itinerary.outbound, ...(itinerary.return ? [itinerary.return] : [])];
  const expectedStops = legs.flatMap((leg, index) => leg.stops.map(stop => ({ ...stop, direction: index ? 'return' : 'outbound' })));
  const stops = page.locator('[data-route-presentation] [data-route-stop]');
  await expect(stops).toHaveCount(expectedStops.length);
  const observedStops = [];
  for (const [index, stop] of expectedStops.entries()) {
    const node = stops.nth(index), place = catalog.places.find(item => item.id === stop.placeId)!;
    const city = catalog.cities.find(item => item.id === place.cityId)!;
    await expect(node).toHaveAttribute('data-route-stop', stop.placeId);
    await expect(node).toHaveAttribute('data-wait-minutes', String(stop.waitMinutes));
    if (itinerary.return) await expect(node).toHaveAttribute('data-stop-direction', stop.direction);
    await expect(node.locator('strong')).toHaveText(city.name);
    await expect(node.getByLabel(`توقف ${fa(stop.waitMinutes)} دقیقه`, { exact: true })).toBeVisible();
    observedStops.push({ placeId: stop.placeId, city: city.name, waitMinutes: stop.waitMinutes, direction: stop.direction, box: await node.locator('strong').boundingBox() });
  }
  const ids = [...new Set(legs.flatMap(leg => leg.segments.flatMap(segment => [segment.originPlaceId, segment.destinationPlaceId])))];
  const places = catalog.places.filter(place => ids.includes(place.id));
  expect(places).toHaveLength(ids.length);
  const firstLongitude = places[0]!.point.longitude;
  const longitudes = places.map(place => firstLongitude + wrap(place.point.longitude - firstLongitude));
  const meridian = wrap((Math.min(...longitudes) + Math.max(...longitudes)) / 2);
  const viewport = map(page).locator('[data-camera]');
  const frame = JSON.parse((await viewport.getAttribute('data-camera'))!) as { x: number; y: number; width: number; height: number; zoom: number };
  expect(Object.values(frame).every(Number.isFinite)).toBe(true); expect(frame.zoom).toBe(1);
  const box = (await viewport.boundingBox())!;
  const projected = places.map(place => ({ placeId: place.id, code: place.code, point: place.point, x: .5 + (wrap(place.point.longitude - meridian) - frame.x) / frame.width, y: .5 - (place.point.latitude - frame.y) / frame.height }));
  for (const point of projected) {
    expect(point.x, `${point.code ?? point.placeId} horizontal fit`).toBeGreaterThan(.06);
    expect(point.x, `${point.code ?? point.placeId} horizontal fit`).toBeLessThan(.94);
    expect(point.y, `${point.code ?? point.placeId} vertical fit`).toBeGreaterThan(.06);
    expect(point.y, `${point.code ?? point.placeId} vertical fit`).toBeLessThan(.94);
  }
  const anchors = await stops.evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { placeId: node.getAttribute('data-route-stop'), x: box.x, y: box.y }; }));
  for (const anchor of anchors) {
    const point = projected.find(point => point.placeId === anchor.placeId)!;
    expect(Math.abs(anchor.x - (box.x + box.width * point.x))).toBeLessThan(1.1);
    expect(Math.abs(anchor.y - (box.y + box.height * point.y))).toBeLessThan(1.1);
  }
  return { frame, viewport: box, meridian, projected, stops: observedStops, anchors };
}

async function noOverflow(page: Page, selectors: string[]) {
  const proof = await page.evaluate(selectors => ({ width: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, boxes: selectors.flatMap(selector => Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0; }).map(node => { const box = node.getBoundingClientRect(), owner = node.matches('[data-segment-track]') ? node.closest<HTMLElement>('[data-search-controls]') : null, clip = owner?.getBoundingClientRect(); return { selector, text: node.textContent?.slice(0, 140), left: box.left, right: box.right, width: box.width, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, scrollOwner: owner && clip ? { left: clip.left, right: clip.right, overflowX: getComputedStyle(owner).overflowX, clientWidth: owner.clientWidth, scrollWidth: owner.scrollWidth } : null }; })), selectedCardChildren: Array.from(document.querySelectorAll<HTMLElement>('article[data-selected="true"] *')).map(node => { const box = node.getBoundingClientRect(), style = getComputedStyle(node); return { tag: node.tagName, class: node.className, text: node.textContent?.slice(0, 120), left: box.left, right: box.right, width: box.width, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, font: style.fontSize, display: style.display, whiteSpace: style.whiteSpace, overflow: style.overflow, minWidth: style.minWidth }; }).filter(box => box.width > 0 && box.clientWidth > 0 && box.scrollWidth > box.clientWidth + 1) }), selectors);
  record('layout-' + nameFor(test.info().title) + '-' + proof.width, proof);
  expect(proof.scrollWidth).toBeLessThanOrEqual(proof.clientWidth + 1);
  for (const box of proof.boxes) {
    if (box.scrollOwner) {
      // Decision0057 gives only the four-control row its own horizontal scroll.
      // Its unclipped track can extend beyond that actual viewport; page/card
      // bounds and each control's native reachability remain strict.
      expect(['auto', 'scroll']).toContain(box.scrollOwner.overflowX);
      expect(box.scrollOwner.left).toBeGreaterThanOrEqual(-1); expect(box.scrollOwner.right).toBeLessThanOrEqual(proof.width + 1);
      expect(box.left >= box.scrollOwner.left - 1 && box.right <= box.scrollOwner.right + 1 || box.scrollOwner.scrollWidth > box.scrollOwner.clientWidth).toBe(true);
    } else {
      expect(box.left, box.selector).toBeGreaterThanOrEqual(-1);
      expect(box.right, box.selector).toBeLessThanOrEqual(proof.width + 1);
    }
    expect(box.scrollWidth, box.selector).toBeLessThanOrEqual(box.clientWidth + 1);
  }
  return proof;
}

async function reachableControls(page: Page) {
  const row = page.locator('[data-search-controls]'), originalURL = page.url(), selectedQuote = await page.locator('article[data-selected="true"]').getAttribute('data-quote-id'), facts = [];
  const writes: string[] = [], onRequest = (request: Request) => { if (request.method() === 'POST' && (request.url().endsWith('/api/v1/searches') || request.url().includes('/api/v1/referrals/'))) writes.push(new URL(request.url()).pathname); };
  const capture = (control: Locator) => control.evaluate(node => new Promise<{
    control: string | null; rectangle: ReturnType<DOMRect['toJSON']>; intersection: ReturnType<DOMRectReadOnly['toJSON']>; root: ReturnType<DOMRectReadOnly['toJSON']> | null; ratio: number; intersecting: boolean; clips: unknown[]; centerOwned: boolean; centerTag?: string; pageWidth: number; viewportWidth: number; scrollX: number; scrollY: number;
  }>((resolve, reject) => {
    const timer = setTimeout(() => { observer.disconnect(); reject(new Error('public-intersection-observation-timeout')); }, 1_000);
    const observer = new IntersectionObserver(entries => {
      clearTimeout(timer); observer.disconnect(); const entry = entries[0]!, box = node.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2), clips = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if ([style.overflowX, style.overflowY].some(value => /^(auto|scroll|hidden|clip)$/.test(value))) clips.push({ tag: parent.tagName, controlsOwner: parent.hasAttribute('data-search-controls'), segmentSlot: parent.getAttribute('data-segment-slot'), rectangle: parent.getBoundingClientRect().toJSON(), clientLeft: parent.clientLeft, clientTop: parent.clientTop, clientWidth: parent.clientWidth, clientHeight: parent.clientHeight, scrollWidth: parent.scrollWidth, scrollHeight: parent.scrollHeight, scrollLeft: parent.scrollLeft, overflowX: style.overflowX, overflowY: style.overflowY });
      }
      resolve({ control: node.getAttribute('data-segment-option') ?? node.getAttribute('aria-label') ?? node.getAttribute('placeholder'), rectangle: box.toJSON(), intersection: entry.intersectionRect.toJSON(), root: entry.rootBounds?.toJSON() ?? null, ratio: entry.intersectionRatio, intersecting: entry.isIntersecting, clips, centerOwned: hit === node || node.contains(hit), centerTag: hit?.tagName, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, scrollX, scrollY });
    });
    observer.observe(node);
  }));
  page.on('request', onRequest);
  const receipt = 'controls-' + nameFor(test.info().title) + '-' + page.viewportSize()!.width;
  try {
    for (const control of await row.locator('input[role="combobox"], [data-segment-option]').all()) {
      await control.scrollIntoViewIfNeeded(); const before = await capture(control);
      const fact = { before, after: undefined as Awaited<ReturnType<typeof capture>> | undefined, focused: false, urlAfter: page.url(), selectedAfter: selectedQuote };
      facts.push(fact); record(receipt, { originalURL, selectedQuote, facts, writes, stage: 'before-native-focus' });
      const radio = control.locator('input[type="radio"]'), native = await radio.count() ? radio : control;
      await native.focus(); fact.focused = await native.evaluate(node => node === document.activeElement); fact.after = await capture(control); fact.urlAfter = page.url(); fact.selectedAfter = await page.locator('article[data-selected="true"]').getAttribute('data-quote-id');
      record(receipt, { originalURL, selectedQuote, facts, writes, stage: 'before-strict-assertions' });
      await expect(native).toBeFocused(); await expect(control).toBeInViewport();
      // Native RTL scrolling rounds scrollLeft to pixels while labels retain
      // subpixels. Preserve the existing1px edge tolerance without ratio guesses.
      expect(fact.after.intersecting).toBe(true);
      expect(fact.after.intersection.width).toBeGreaterThanOrEqual(fact.after.rectangle.width - 1);
      expect(fact.after.intersection.height).toBeGreaterThanOrEqual(fact.after.rectangle.height - 1);
      expect(fact.after.centerOwned).toBe(true); expect(fact.urlAfter).toBe(originalURL); expect(fact.selectedAfter).toBe(selectedQuote); expect(writes).toEqual([]);
      const geometry = await control.evaluate(node => { const box = node.getBoundingClientRect(), clip = node.closest('[data-search-controls]')!.getBoundingClientRect(); return { left: box.left, right: box.right, height: box.height, clipLeft: clip.left, clipRight: clip.right, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }; });
      expect(geometry.left).toBeGreaterThanOrEqual(geometry.clipLeft - 1); expect(geometry.right).toBeLessThanOrEqual(geometry.clipRight + 1); expect(geometry.height).toBeGreaterThanOrEqual(44); expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    }
    expect(facts.length).toBeGreaterThanOrEqual(4); expect(page.url()).toBe(originalURL); await expect(page.locator('article[data-selected="true"]')).toHaveAttribute('data-quote-id', selectedQuote!);
  } finally { page.off('request', onRequest); record(receipt, { originalURL, selectedQuote, facts, writes, stage: 'finalized' }); }
  return facts;
}

test.beforeEach(async ({ page, context }, info) => {
  mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'dark'));
  const errors: string[] = []; pageErrors.set(page, errors); page.on('pageerror', error => errors.push(error.message));
  // Passive native GPU observation only: retain every original call and context option.
  await page.addInitScript(() => {
    const proof = { draws: 0, linked: 0, failures: [] as string[], lost: 0 };
    Object.assign(window, { realisticCatalogGPU: proof });
    document.addEventListener('webglcontextlost', () => proof.lost++, true);
    const proto = WebGL2RenderingContext.prototype;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'] as const) {
      const original = proto[name];
      Object.defineProperty(proto, name, { configurable: true, value: function (this: WebGL2RenderingContext, ...args: unknown[]) { proof.draws++; return Reflect.apply(original, this, args); } });
    }
    const link = proto.linkProgram;
    proto.linkProgram = function (program) { link.call(this, program); if (this.getProgramParameter(program, this.LINK_STATUS)) proof.linked++; else proof.failures.push(this.getProgramInfoLog(program) ?? 'link failure'); };
  });
  const session = await context.request.post('/api/v1/demo/session', { data: { seed: 49, anchorInstant: '2026-10-29T00:00:00Z', scenario: 'normal' } });
  expect(session.status()).toBe(201);
  const identity = await session.json();
  expect(identity.fixtureVersion).toBe('showcase-v3'); expect(identity.catalogRevision).toBe('catalog-v3');
  record('session-' + nameFor(info.title), identity);
});
test.afterEach(async ({ page, context }, info) => {
  const gpu = page.isClosed() ? undefined : await page.evaluate(() => (window as unknown as { realisticCatalogGPU?: { draws: number; linked: number; failures: string[]; lost: number } }).realisticCatalogGPU);
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    record('failure-' + nameFor(info.title), { url: page.url(), failure: 'Native catalog assertion or operation failed; use the sanitized root reporter for error details.', body: await page.locator('body').innerText() });
    await page.screenshot({ path: resolve(out, 'failure-' + nameFor(info.title) + '.png') });
  }
  const reset = await context.request.post('/api/v1/admin/reset', { data: {} });
  record('cleanup-' + nameFor(info.title), { status: reset.status(), gpu, pageErrors: pageErrors.get(page) }); expect(reset.status()).toBe(201);
  if (info.status === info.expectedStatus) {
    expect(gpu?.draws).toBeGreaterThan(0); expect(gpu?.linked).toBeGreaterThan(0);
    expect(gpu?.failures).toEqual([]); expect(gpu?.lost).toBe(0); expect(pageErrors.get(page)).toEqual([]);
  }
});

test('@realistic-catalog actual two and three stop LAX cards retain airport headings, canonical waits and fitted date-line places', async ({ page, browser }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page); const recovery = await search(page);
  const response = await page.request.get('/api/v1/catalog'); expect(response.ok()).toBe(true);
  const catalog = await response.json() as CatalogSnapshot;
  await expect(page.locator('[data-graphics-status]')).toHaveAttribute('data-graphics-status', 'ready');
  const trials = [];
  for (const variant of [
    { index: 1, stops: 2, chain: ['ika', 'ist', 'fra', 'lax'], codes: ['IKA', 'IST', 'FRA', 'LAX'], operator: 'ترکیش ایرلاینز', brand: 'turkish-airlines' },
    // V3's dated service slot11 retains the actual HND→LAX local-date reversal;
    // slot2 now departs earlier and arrives on the same local calendar date.
    { index: 11, stops: 3, chain: ['ika', 'dxb', 'sin', 'hnd', 'lax'], codes: ['IKA', 'DXB', 'SIN', 'HND', 'LAX'], operator: 'امارات', brand: 'emirates' },
  ]) {
    const group = recovery.snapshot.groups.find(group => group.itinerary.outbound.segments.length === variant.chain.length - 1 && group.itinerary.outbound.segments[0]!.serviceId.includes(`-los-angeles-${variant.index}-`) && group.eligibleQuotes.length)!;
    expect(group).toBeTruthy();
    const leg = group.itinerary.outbound;
    expect(leg.segments[0]!.serviceId).toContain(`-los-angeles-${variant.index}-`);
    expect([leg.segments[0]!.originPlaceId, ...leg.segments.map(segment => segment.destinationPlaceId)]).toEqual(variant.chain);
    const { card, quote } = await choose(page, group);
    const mark = await loadedMark(card, 'airline', variant.brand, variant.operator);
    await expect(heading(page).locator('h2 bdi')).toHaveText(variant.codes.map(code => `(${code})`));
    const cities = variant.chain.map(id => catalog.cities.find(city => city.id === catalog.places.find(place => place.id === id)!.cityId)!.name);
    for (const [index, city] of cities.entries()) await expect(heading(page).locator('h2 > span').nth(index)).toContainText(city);
    const route = await routeFacts(page, catalog, group.itinerary);
    await expect(card).toHaveAttribute('data-amount-rial', String(quote.total.amountRial));
    expect(quote.fixtureVersion).toBe('showcase-v3'); expect(quote.completeness.status).toBe('complete');
    await card.getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
    const details = card.getByRole('region', { name: 'جزئیات مسیر رفت', exact: true });
    await expect(details.locator('[data-segment-id]')).toHaveCount(leg.segments.length);
    expect(await details.locator('[data-stop-place]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-stop-place')))).toEqual(leg.stops.map(stop => stop.placeId));
    if (variant.stops === 3) {
      const dateLine = leg.segments.find(segment => segment.originPlaceId === 'hnd' && segment.destinationPlaceId === 'lax')!;
      const date = (instant: string, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
      expect(Date.parse(dateLine.arrivalAt)).toBeGreaterThan(Date.parse(dateLine.departureAt));
      expect(date(dateLine.arrivalAt, dateLine.arrivalTimeZone) < date(dateLine.departureAt, dateLine.departureTimeZone)).toBe(true);
      const times = details.locator(`[data-segment-id="${dateLine.segmentId}"] time`);
      await expect(times).toHaveCount(2);
      for (const [index, instant, timeZone] of [[0, dateLine.departureAt, dateLine.departureTimeZone], [1, dateLine.arrivalAt, dateLine.arrivalTimeZone]] as const) {
        const time = new Intl.DateTimeFormat('fa-IR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
        const day = new Intl.DateTimeFormat('fa-IR', { timeZone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(instant));
        await expect(times.nth(index)).toHaveAttribute('datetime', instant); await expect(times.nth(index)).toHaveText(`${time} · ${day}`);
      }
    }
    const layout = await noOverflow(page, ['[data-map-heading]', '[data-map-heading-key]:not([aria-hidden="true"]) h2', 'article[data-selected="true"]']);
    await map(page).screenshot({ path: resolve(out, `lax-${variant.stops}-stops-map.png`) });
    const trial = { variant: variant.index, groupId: group.groupId, itinerary: group.itinerary, quote, mark, route, layout };
    record('lax-variant-' + variant.index, trial); trials.push(trial);
  }
  const last = trials.at(-1)!;
  const mobile = [];
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(map(page)).toHaveCount(0);
    const panel = page.getByRole('region', { name: 'جزئیات مسیر سفر', exact: true });
    await expect(panel).toHaveAttribute('data-mobile-itinerary', last.itinerary.itineraryId);
    const disclosure = panel.locator('details');
    if (!await disclosure.evaluate(node => (node as HTMLDetailsElement).open)) await disclosure.locator('summary').click();
    await expect(panel.locator('[data-segment-id]')).toHaveCount(4);
    const layout = await noOverflow(page, ['[data-mobile-itinerary]', 'article[data-selected="true"]', '[data-mobile-itinerary] h2']);
    await panel.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(out, `lax-three-stops-mobile-${width}.png`) }); mobile.push(layout);
  }
  expect(errors).toEqual([]);
  record('lax-one-way', { browser: browser.version(), query: recovery.snapshot.query, searchId: recovery.snapshot.searchId, networkInterception: false, reducedMotionForExactFacts: true, trials, mobile, errors });
});

test('@realistic-catalog complete LAX round trip carries four outbound segments and an independent Doha return into new-city hotel discovery', async ({ page, browser }) => {
  test.setTimeout(90000);
  const input: TransportSearchQuery = { ...query, tripType: 'round-trip', returnDate: '2026-11-05' };
  await open(page, input); const recovery = await search(page);
  const catalog = await (await page.request.get('/api/v1/catalog')).json() as CatalogSnapshot;
  const group = recovery.snapshot.groups.find(group => group.itinerary.outbound.segments.length === 4 && group.itinerary.outbound.segments[0]!.serviceId.includes('-los-angeles-11-') && group.eligibleQuotes.length)!;
  expect(group).toBeTruthy(); expect(group.itinerary.return?.segments).toHaveLength(2);
  expect([group.itinerary.outbound.segments[0]!.originPlaceId, ...group.itinerary.outbound.segments.map(segment => segment.destinationPlaceId)]).toEqual(['ika', 'dxb', 'sin', 'hnd', 'lax']);
  expect([group.itinerary.return!.segments[0]!.originPlaceId, ...group.itinerary.return!.segments.map(segment => segment.destinationPlaceId)]).toEqual(['lax', 'doh', 'ika']);
  const { card, quote } = await choose(page, group);
  expect(quote.conditions.return).toBeDefined(); expect(quote.completeness.status).toBe('complete'); expect(quote.total.amountRial).toBeGreaterThan(0);
  await expect(heading(page).locator('h2 svg[data-map-heading-arrow]')).toHaveAttribute('data-map-heading-arrow', 'round-trip');
  await expect(heading(page).locator('h2 bdi')).toHaveText(['(IKA)', '(LAX)']);
  for (const [direction, leg] of [['outbound', group.itinerary.outbound], ['return', group.itinerary.return!]] as const) {
    const ids = [leg.segments[0]!.originPlaceId, ...leg.segments.map(segment => segment.destinationPlaceId)];
    const chain = ids.map(id => catalog.places.find(place => place.id === id)!.code!).join(' → ');
    await expect(heading(page).locator(`[data-map-leg-route="${direction}"] bdi`)).toHaveText(chain);
  }
  const route = await routeFacts(page, catalog, group.itinerary);
  await card.getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
  for (const [label, leg] of [['رفت', group.itinerary.outbound], ['برگشت', group.itinerary.return!]] as const) await expect(card.getByRole('region', { name: 'جزئیات مسیر ' + label, exact: true }).locator('[data-segment-id]')).toHaveCount(leg.segments.length);
  const layout = await noOverflow(page, ['[data-map-heading]', '[data-map-heading-key]:not([aria-hidden="true"]) h2', '[data-map-heading-key]:not([aria-hidden="true"]) p', 'article[data-selected="true"]']);
  const trigger = page.getByRole('button', { name: 'مقایسه اقامتگاه‌های لس‌آنجلس', exact: true });
  const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/hotel-searches'));
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'هتل‌های لس‌آنجلس', exact: true });
  await expect(dialog.locator('[data-hotel-context]')).toHaveAttribute('data-hotel-context', 'los-angeles');
  const response = await pending; expect(response.status()).toBe(201); const hotels = HotelSearchSnapshotSchema.parse(await response.json());
  await expect(dialog.locator('input:not([type=radio])')).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: 'ظرفیت اتاق', exact: true })).toHaveValue('1');
  expect(new Date(hotels.query.checkOut + 'T12:00:00Z').getTime() - new Date(hotels.query.checkIn + 'T12:00:00Z').getTime()).toBe(86400000);
  expect(hotels.query.destinationCityId).toBe('los-angeles'); expect(hotels.query.arrivalPlaceId).toBe('lax'); expect(hotels.status).toBe('complete');
  const directory = JSON.parse(readFileSync(resolve('libs/fixtures/src/catalog/real-hotel-directory.json'), 'utf8')) as { revision: string; hotels: { hotelId: string; destinationCityId: string }[] };
  const sourced = directory.hotels.filter(hotel => hotel.destinationCityId === 'los-angeles'); expect(sourced).toHaveLength(8); expect(hotels.sourceRevision).toBe(directory.revision);
  expect(hotels.hotels.map(hotel => hotel.hotelId).sort()).toEqual(sourced.map(hotel => hotel.hotelId).sort()); expect(hotels.hotels.every(hotel => hotel.destinationCityId === 'los-angeles')).toBe(true);
  expect(hotels.quotes.length).toBeGreaterThan(0);
  await expect(dialog.getByRole('region', { name: 'نتایج مقایسه اقامتگاه‌ها', exact: true })).toHaveAttribute('data-hotel-search-id', hotels.hotelSearchId);
  await page.screenshot({ path: resolve(out, 'lax-hotel-inventory.png') });
  await dialog.getByRole('button', { name: 'بستن', exact: true }).click();
  await expect(map(page)).toHaveAttribute('data-map-itinerary', group.itinerary.itineraryId);
  record('lax-round-trip-hotels', { browser: browser.version(), query: input, searchId: recovery.snapshot.searchId, itinerary: group.itinerary, quote, route, layout, hotels, networkInterception: false });
});

for (const trip of [
  { mode: 'bus' as const, destinationCityId: 'isfahan', classCode: 'vip', label: 'ویژه', brand: 'hamsafar', operatorId: 'bus:hamsafar', operator: 'همسفر', terms: 'نوع صندلی مطابق کلاس انتخاب‌شده است.', minRial: 6000000, maxRial: 8000000 },
  { mode: 'train' as const, destinationCityId: 'mashhad', classCode: 'sleeper-6', label: 'کوپه شش تخته', brand: 'joopar', operatorId: 'rail:joopar', operator: 'جوپار', terms: 'نوع کوپه یا صندلی مطابق کلاس انتخاب‌شده است.', minRial: 10000000, maxRial: 14000000 },
]) test(`@realistic-catalog ${trip.mode} class selector retains real ground PNG, source type, unknown conditions and exact bounded price`, async ({ page }) => {
  await open(page, { ...query, mode: trip.mode, scope: 'domestic', destinationCityId: trip.destinationCityId, classCode: trip.mode === 'train' ? 'seat' : 'standard' });
  await page.getByRole('radiogroup', { name: 'کلاس سفر', exact: true }).getByText(trip.label, { exact: true }).click();
  const recovery = await search(page);
  expect(recovery.snapshot.query.classCode).toBe(trip.classCode);
  const group = recovery.snapshot.groups.find(group => group.itinerary.outbound.segments[0]!.operatorId === trip.operatorId && group.eligibleQuotes.length)!;
  expect(group).toBeTruthy();
  const { card, quote } = await choose(page, group), mark = await loadedMark(card, 'ground-operator', trip.brand, trip.operator);
  expect(quote.total.currency).toBe('IRR'); expect(quote.total.amountRial).toBeGreaterThanOrEqual(trip.minRial); expect(quote.total.amountRial).toBeLessThanOrEqual(trip.maxRial);
  await expect(card).toHaveAttribute('data-amount-rial', String(quote.total.amountRial));
  await expect(card.getByRole('group', { name: `مجموع ۱ مسافر: ${fa(quote.total.amountRial / 10)} تومان`, exact: true })).toBeVisible();
  await expect(heading(page).locator('h2 bdi:not([hidden])')).toHaveCount(0);
  await card.getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
  const offer = card.locator(`[data-offer-quote-id="${quote.quoteId}"]`);
  await expect(offer).toContainText(trip.label); await expect(offer).toContainText(trip.terms);
  expect(quote.conditions.outbound.seatOrBerth.status).toBe('unknown');
  await expect(offer).toContainText('صندلی / تخت: نامشخص'); await expect(offer).toContainText('جزئیات و جریمه لغو نامشخص است');
  const layouts = [];
  for (const width of [1366, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = await reachableControls(page); await card.scrollIntoViewIfNeeded(); layouts.push({ ...await noOverflow(page, ['form[aria-label="جست‌وجوی سفر"]', 'form[aria-label="جست‌وجوی سفر"] [data-segment-track]', 'article[data-selected="true"]', 'article[data-selected="true"] h3', 'article[data-selected="true"] [data-offer-quote-id]']), controls });
    await page.screenshot({ path: resolve(out, `${trip.mode}-details-${width}.png`) });
  }
  record(trip.mode + '-ground', { query: recovery.snapshot.query, searchId: recovery.snapshot.searchId, itinerary: group.itinerary, quote, mark, layouts, networkInterception: false });
});
