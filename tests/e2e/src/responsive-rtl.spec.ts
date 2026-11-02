import type { Locator, Page } from '@playwright/test';
import { HotelSearchSnapshotSchema, type CatalogSnapshot, type JourneyLeg } from '@torob-ticket/contracts';
import { test, expect, loadQuery, priceCards, queryFor, runSearch, writeEvidence } from '../fixtures';
import { KeyboardTraversalFailure, scanAccessibility, tabTo } from './a11y-helpers';

let observations: unknown[] = [];
test.beforeEach(() => { observations = []; });
test.afterEach(({}, info) => { writeEvidence(info, 'responsive-observations', { observations, scope: 'Failure-safe public DOM geometry/contrast facts, no credentials or runtime private state.' }); });

const viewportMatrix = [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1119, height: 900 }, { width: 1120, height: 900 }];
const calendar = (page: Page) => page.getByRole('dialog', { name: 'انتخاب تاریخ سفر', exact: true });
const calendarTrigger = (page: Page) => page.getByRole('button', { name: 'تقویم جلالی و انتخاب تاریخ', exact: true });

async function layout(page: Page) {
  const value = await page.evaluate(() => {
    const controls = document.querySelector<HTMLElement>('[data-search-controls]')!;
    return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
      language: document.documentElement.lang, direction: getComputedStyle(document.documentElement).direction,
      localControls: { width: controls.clientWidth, scrollWidth: controls.scrollWidth, scrollLeft: controls.scrollLeft, overflowX: getComputedStyle(controls).overflowX },
      devicePixelRatio, visualViewportScale: visualViewport?.scale ?? null };
  });
  observations.push({ kind: 'layout', value }); return value;
}
async function hitTest(locator: Locator) {
  const value=await locator.evaluate(node=>{const r=node.getBoundingClientRect(),point={x:r.x+r.width/2,y:r.y+r.height/2},hit=document.elementFromPoint(point.x,point.y);return {point,hitTag:hit?.tagName??null,ownsHit:hit===node||!!hit&&node.contains(hit)};});
  observations.push({kind:'paint-hit',value}); expect(value.ownsHit).toBe(true); return value;
}
async function contained(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();
  const viewport = page.viewportSize()!; observations.push({ kind: 'contained', viewport, bounds });
  expect(bounds).not.toBeNull(); expect(bounds!.width).toBeGreaterThan(0); expect(bounds!.height).toBeGreaterThan(0);
  expect(bounds!.x).toBeGreaterThanOrEqual(-.5); expect(bounds!.y).toBeGreaterThanOrEqual(-.5);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + .5);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + .5);
  await hitTest(locator); return bounds!;
}
async function boundedCalendar(page: Page) {
  const inner = calendar(page), host = inner.locator('xpath=ancestor::*[@data-dialog-scroll][1]');
  await expect(host).toHaveCount(1);
  const facts = await host.evaluate(node => {
    const rect = (element: Element) => {const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    const css=getComputedStyle(node); return {host:rect(node),inner:rect(node.querySelector('[role="dialog"]')!),overflowY:css.overflowY,maxHeight:css.maxHeight,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,scrollTop:node.scrollTop};
  });
  observations.push({kind:'calendar-scroll-owner',facts});
  const bounds = await contained(page, host);
  expect(['auto','scroll']).toContain(facts.overflowY);
  const close=inner.getByRole('button',{name:'بستن',exact:true}); await close.focus(); const closeBounds=await contained(page,close);
  return {facts,bounds,closeBounds};
}

async function target(locator: Locator, name: string) {
  await expect(locator).toBeEnabled(); await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox(); observations.push({ kind: 'target', name, bounds }); expect(bounds, name).not.toBeNull();
  expect(bounds!.width, name + ' actual CSS-pixel hit width').toBeGreaterThanOrEqual(43.99);
  expect(bounds!.height, name + ' actual CSS-pixel hit height').toBeGreaterThanOrEqual(43.99);
  const hit=await hitTest(locator); return { name, ...bounds!,hit };
}
const routeIds = (leg: JourneyLeg) => [leg.segments[0]!.originPlaceId, ...leg.segments.map(segment => segment.destinationPlaceId)];

async function physicalCodes(codes: Locator) {
  const value = await codes.evaluateAll(nodes => nodes.map(node => {
    const text = node.firstChild!, value = node.textContent ?? '';
    const first = document.createRange(), last = document.createRange();
    first.setStart(text, 0); first.setEnd(text, 1); last.setStart(text, value.length - 1); last.setEnd(text, value.length);
    const a = first.getBoundingClientRect(), z = last.getBoundingClientRect(), rect = node.getBoundingClientRect();
    return { value, direction: getComputedStyle(node).direction, firstCharacterX: a.x, lastCharacterX: z.x, x: rect.x, y: rect.y, width: rect.width };
  }));
  observations.push({ kind: 'physical-codes', value }); return value;
}

/** Background-channel envelopes conservatively include every declared gradient
 * stop/alpha and ancestor paint. Opaque surfaces collapse the envelope. This is
 * computed CSS contrast evidence, not a claim to sample GPU pixels or certify AA. */
async function renderedContrast(page: Page) {
  return page.evaluate(() => {
    type RGBA = [number, number, number, number]; type RGB = [number, number, number];
    const color = (value: string): RGBA => {
      const probe = document.createElement('span'); probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none'; probe.style.color = value; document.body.append(probe);
      const resolved = getComputedStyle(probe).color; probe.remove();
      if (!/^rgba?\(/.test(resolved)) throw new Error('unsupported-computed-color:' + resolved);
      const parsed = resolved.match(/[\d.]+/g)!.map(Number);
      if (parsed.length < 3 || parsed.length > 4 || parsed.some(value => !Number.isFinite(value))) throw new Error('invalid-computed-color');
      return [parsed[0]!, parsed[1]!, parsed[2]!, parsed[3] ?? 1];
    };
    const over = (front: RGBA, back: RGB): RGB => [0, 1, 2].map(i => front[i]! * front[3] + back[i]! * (1 - front[3])) as RGB;
    const bounds = (values: RGB[]): RGB[] => {
      const low = [0, 1, 2].map(i => Math.min(...values.map(row => row[i]!))), high = [0, 1, 2].map(i => Math.max(...values.map(row => row[i]!)));
      return Array.from({ length: 8 }, (_, mask) => [0, 1, 2].map(i => mask & 1 << i ? high[i]! : low[i]!) as RGB);
    };
    const backgrounds = (node: Element) => {
      const ancestors: Element[] = []; for (let parent: Element | null = node; parent; parent = parent.parentElement) ancestors.unshift(parent);
      let candidates: RGB[] = [[255, 255, 255]]; const gradients: string[] = [], masks: string[] = []; let opacity = 1;
      for (const ancestor of ancestors) {
        const css = getComputedStyle(ancestor), bg = color(css.backgroundColor); opacity *= Number(css.opacity); if (css.maskImage !== 'none') masks.push(css.maskImage);
        candidates = candidates.map(back => over(bg, back));
        if (css.backgroundImage !== 'none') {
          gradients.push(css.backgroundImage);
          if (/color\(|oklch\(|lab\(|lch\(|hsl\(/.test(css.backgroundImage)) throw new Error('unsupported-gradient-color-space');
          for (const stop of css.backgroundImage.match(/rgba?\([^)]*\)/g) ?? []) candidates = bounds([...candidates, ...candidates.map(back => over(color(stop), back))]);
        }
      }
      return { candidates, gradients, masks, opacity };
    };
    const luminance = (rgb: RGB) => rgb.map(value => { const x = value / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i]!, 0);
    const ratio = (a: RGB, b: RGB) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
    const selectors = ['h1', 'input[role="combobox"]', 'button[type="submit"]', '[data-segment-option]', '[role="option"][aria-selected="true"] bdi', '[data-price-band]:not([data-price-band="unknown"])'];
    const rows = selectors.flatMap(selector => Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(node => {
      const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !node.closest('[inert],[aria-hidden="true"][data-segment-slot]') && (!('disabled' in node) || !node.disabled);
    }).map(node => {
      const css = getComputedStyle(node), fg = color(css.color), bg = backgrounds(node), size = parseFloat(css.fontSize), weight = parseFloat(css.fontWeight);
      const minimum = size >= 24 || size >= 18.666 && weight >= 700 ? 3 : 4.5;
      const lowest = Math.min(...bg.candidates.map(back => ratio(over(fg, back), back)));
      return { selector, text: (node.textContent || (node instanceof HTMLInputElement ? node.value : '')).trim().slice(0, 120), foreground: css.color,
        fontSize: size, fontWeight: css.fontWeight, opacity: css.opacity, groupOpacity: bg.opacity, maskAncestors: bg.masks, backgroundCandidates: bg.candidates, gradients: bg.gradients, minimum, ratio: lowest };
    }));
    const submit = document.querySelector<HTMLElement>('button[type="submit"]')!, css = getComputedStyle(submit), focusColor = color(css.outlineColor);
    const parent = backgrounds(submit.parentElement!), focusRatio = Math.min(...parent.candidates.map(back => ratio(over(focusColor, back), back)));
    const boundaries = Array.from(document.querySelectorAll<HTMLInputElement>('input[role="combobox"]')).map(node => {
      let surface: HTMLElement = node;
      while (surface.parentElement && (parseFloat(getComputedStyle(surface).borderTopWidth) === 0 || getComputedStyle(surface).borderTopStyle === 'none')) surface = surface.parentElement;
      const css = getComputedStyle(surface), bg = backgrounds(surface), outside = backgrounds(surface.parentElement!), edge = color(css.borderTopColor);
      return {name:node.getAttribute('aria-label')??node.id,surfaceTag:surface.tagName,surfaceClass:surface.className,width:parseFloat(css.borderTopWidth),style:css.borderTopStyle,ratio:Math.min(...[...bg.candidates,...outside.candidates].map(back=>ratio(over(edge,back),back)))};
    });
    return { rows, boundaries, focus: { color: css.outlineColor, width: parseFloat(css.outlineWidth), style: css.outlineStyle, ratio: focusRatio },
      mode: document.documentElement.dataset.mode, appearance: document.documentElement.dataset.appearance };
  });
}

test('@responsive viewport matrix retains readable RTL form, local controls and bounded calendar at map breakpoint', async ({ newReviewer, browser }, info) => {
  test.setTimeout(120_000); const reviewer = await newReviewer({ reducedMotion: 'reduce', viewport: viewportMatrix[0] }); const { page } = reviewer;
  await loadQuery(reviewer, queryFor('flight', 'domestic', 'round-trip')); await page.evaluate(() => document.fonts.ready);
  const rows = [];
  try {
    for (const size of viewportMatrix) {
      await page.setViewportSize(size);
      if (size.width >= 1120) await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveCount(1);
      else await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveCount(0);
      const value = await layout(page); expect(value.documentWidth).toBeLessThanOrEqual(value.width + 1); expect(value.language).toBe('fa'); expect(value.direction).toBe('rtl');
      await calendarTrigger(page).click(); const dialog = await boundedCalendar(page);
      const cancel=calendar(page).getByRole('button', { name: 'انصراف', exact: true }); await cancel.focus(); await contained(page,cancel); await cancel.press('Enter'); await expect(calendarTrigger(page)).toBeFocused();
      rows.push({ size, value, dialog });
    }
  } finally { writeEvidence(info, 'viewport-matrix', { browser: browser.version(), rows, method: 'Actual CSS viewports, no browser zoom or physical-device claim; horizontal form-track scroll is permitted without page overflow.' }); }
});

test('@responsive no-map mobile retains independent complete round-trip facts, physical LTR codes and 44px hit targets', async ({ newReviewer, browser }, info) => {
  test.setTimeout(120_000); const reviewer = await newReviewer({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } }); const { page } = reviewer;
  const query = queryFor('flight', 'international', 'round-trip', { destinationCityId: 'los-angeles' });
  await loadQuery(reviewer, query); const recovery = await runSearch(reviewer); expect(recovery.snapshot.status).toBe('complete');
  const catalog = await (await reviewer.context.request.get('/api/v1/catalog')).json() as CatalogSnapshot;
  const group = [...recovery.snapshot.groups].filter(group => group.eligibleQuotes.length && group.itinerary.return).sort((a, b) => b.itinerary.outbound.segments.length - a.itinerary.outbound.segments.length)[0]!;
  expect(group).toBeDefined(); expect(group.itinerary.outbound.segments.length).toBeGreaterThan(1);
  const quote = group.eligibleQuotes[0]!, card = priceCards(page).locator(`xpath=self::article[@data-quote-id="${quote.quoteId}"]`);
  await card.locator('[data-card-select]').press('Space'); await expect(card).toHaveAttribute('data-selected', 'true');
  const targets = [];
  for (const name of ['روز قبل', 'روز بعد', 'تقویم جلالی و انتخاب تاریخ', 'پاک کردن مبدا', 'پاک کردن مقصد', 'حساب کاربری']) targets.push(await target(page.getByRole('button', { name, exact: true }), name));
  targets.push(await target(card.getByRole('button', { name: 'جزئیات سفر', exact: true }), 'جزئیات سفر'));
  for (const button of await card.locator('[data-card-route-leg] button').all()) targets.push(await target(button, 'route-code-tooltip'));
  await page.setViewportSize({width:767,height:844});
  for (const name of ['روز قبل','روز بعد']) targets.push(await target(page.getByRole('button',{name,exact:true}), name+' at767px'));
  await page.setViewportSize({width:390,height:844});
  await card.getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
  const facts = [];
  for (const [direction, label, leg] of [['outbound', 'رفت', group.itinerary.outbound], ['return', 'برگشت', group.itinerary.return!]] as const) {
    const expectedCodes = routeIds(leg).map(id => catalog.places.find(place => place.id === id)!.code!);
    await expect(card.locator(`[data-card-route-leg="${direction}"] bdi`)).toHaveText(expectedCodes);
    const physical = await physicalCodes(card.locator(`[data-card-route-leg="${direction}"] bdi`));
    physical.forEach(code => { expect(code.direction).toBe('ltr'); expect(code.firstCharacterX).toBeLessThan(code.lastCharacterX); });
    for (let index = 1; index < physical.length; index++) { const before = physical[index - 1]!, after = physical[index]!; if (Math.abs(after.y - before.y) < 1) expect(after.x).toBeGreaterThan(before.x); else expect(after.y).toBeGreaterThan(before.y); }
    const timeline = card.getByRole('region', { name: 'جزئیات مسیر ' + label, exact: true });
    expect(await timeline.locator('[data-segment-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-segment-id')))).toEqual(leg.segments.map(segment => segment.segmentId));
    facts.push({ direction, expectedCodes, physical, segmentIds: leg.segments.map(segment => segment.segmentId) });
  }
  const mobile = page.getByRole('region', { name: 'جزئیات مسیر سفر', exact: true }); await expect(mobile).toBeVisible();
  await mobile.locator('summary').click(); await expect(mobile.locator('[data-segment-id]')).toHaveCount(group.itinerary.outbound.segments.length);
  await mobile.getByRole('radiogroup', { name: 'جهت مسیر روی نقشه و فهرست', exact: true }).getByText('مسیر برگشت', { exact: true }).click();
  await expect(mobile.locator('[data-segment-id]')).toHaveCount(group.itinerary.return!.segments.length);
  await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveCount(0);
  expect((await layout(page)).documentWidth).toBeLessThanOrEqual(391);
  const responsiveRows = [];
  for (const size of viewportMatrix.slice(0, 4)) {
    await page.setViewportSize(size);
    await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true })).toHaveCount(size.width >= 1120 ? 1 : 0);
    await expect(card).toHaveAttribute('data-selected', 'true'); await expect(card).toHaveAttribute('data-amount-rial', String(quote.total.amountRial));
    for (const [label, leg] of [['رفت', group.itinerary.outbound], ['برگشت', group.itinerary.return!]] as const) expect(await card.getByRole('region', { name: 'جزئیات مسیر ' + label, exact: true }).locator('[data-segment-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-segment-id')))).toEqual(leg.segments.map(segment => segment.segmentId));
    const value = await layout(page); expect(value.documentWidth).toBeLessThanOrEqual(value.width + 1);
    const wheel = await page.getByRole('listbox',{name:'روزهای نزدیک',exact:true}).boundingBox(), action = await calendarTrigger(page).boundingBox(), arrow = await page.getByRole('button',{name:'روز قبل',exact:true}).boundingBox();
    observations.push({kind:'wheel-alignment',size,wheel,action,arrow});
    expect(Math.abs(wheel!.width-action!.width)).toBeLessThan(1); expect(Math.abs(arrow!.width-(size.width<768?44:30))).toBeLessThan(.05);
    responsiveRows.push({size,value,wheel,action,arrow});
  }
  writeEvidence(info, 'mobile-route-targets', { browser: browser.version(), query, itinerary: group.itinerary, quote: { quoteId: quote.quoteId, total: quote.total }, targets, facts, responsiveRows, noMapMobile: true });
});

test('@responsive all six palettes audit computed text, price, control-boundary and focus contrast', async ({ newReviewer, browser }, info) => {
  test.setTimeout(120_000); const reviewer = await newReviewer({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } }); const { page } = reviewer;
  await page.addInitScript(() => localStorage.setItem('torobticket.appearance', 'light')); await loadQuery(reviewer, queryFor());
  const rows = [];
  try {
    for (const [mode, label] of [['flight', 'پرواز'], ['train', 'قطار'], ['bus', 'اتوبوس']] as const) {
      await page.getByRole('radiogroup', { name: 'وسیله سفر', exact: true }).getByText(label, { exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-mode', mode); await expect(page.locator('html')).not.toHaveAttribute('data-palette-transition', 'morph');
      await expect(page.getByRole('region', { name: 'کاوش تاریخ سفر', exact: true })).toHaveAttribute('data-date-price-status', 'complete', { timeout: 30000 });
      await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
      for (const appearance of ['light', 'dark'] as const) {
        if (await page.locator('html').getAttribute('data-appearance') !== appearance) await page.getByRole('button', { name: /^نمای (روشن|تیره)$/ }).click();
        await expect(page.locator('html')).toHaveAttribute('data-appearance', appearance);
        await page.keyboard.press('Tab'); const submit=page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }); await submit.focus(); await expect(submit).toBeFocused(); await expect(submit).toHaveAttribute('data-focus-visible', /.*/);
        const proof = await renderedContrast(page); rows.push(proof);
        expect.soft(proof.rows.length).toBeGreaterThan(8);
        for (const row of proof.rows) { expect.soft(row.groupOpacity).toBe(1); expect.soft(row.ratio, `${mode}/${appearance} ${row.selector} ${row.text}`).toBeGreaterThanOrEqual(row.minimum); }
        expect.soft(proof.boundaries).toHaveLength(2); for (const edge of proof.boundaries) {expect.soft(edge.width).toBeGreaterThan(0); expect.soft(edge.style).not.toBe('none'); expect.soft(edge.ratio,`${mode}/${appearance} actual ${edge.surfaceClass} input boundary`).toBeGreaterThanOrEqual(3);}
        expect.soft(proof.focus.width).toBeGreaterThanOrEqual(2); expect.soft(proof.focus.style).not.toBe('none'); expect.soft(proof.focus.ratio,`${mode}/${appearance} submit focus`).toBeGreaterThanOrEqual(3);
        await page.screenshot({ path: info.outputPath(`palette-${mode}-${appearance}.png`) });
      }
    }
    expect(rows).toHaveLength(6);
  } finally { writeEvidence(info, 'six-palette-contrast', { browser: browser.version(), rows, method: 'Computed DOM text/control samples, including offscreen or clipped rows; alpha-composited ancestor colors and conservative gradient-channel envelopes. Ancestor opacity must1; mask edge alpha, sibling selection overlays and antialiasing require separate manual/axe review. Envelope failure is a diagnostic bound, not a proved painted contrast defect. Unsupported CSSColor4 forms reject rather than silently pass. No GPU pixel sampling or certification claim.' }); }
});

test('@responsive 320 CSS-pixel reflow and short-landscape dialogs retain reachable actions with long Persian input', async ({ newReviewer, browser }, info) => {
  test.setTimeout(90_000); const reviewer = await newReviewer({ reducedMotion: 'reduce', viewport: { width: 320, height: 640 } }); const { page } = reviewer;
  await loadQuery(reviewer, queryFor('flight', 'domestic', 'round-trip'));
  const destination = page.getByRole('combobox', { name: 'مقصد', exact: true });
  const longText = 'فرودگاه بین‌المللی بسیار طولانی برای بررسی خوانایی و بازچینی متن فارسی';
  await destination.fill(longText); await expect(destination).toHaveValue(longText); const narrow = await layout(page); expect(narrow.documentWidth).toBeLessThanOrEqual(321);
  await destination.press('Escape');
  await page.getByRole('button', { name: 'پاک کردن مقصد', exact: true }).click(); await destination.fill('مشهد'); await destination.press('ArrowDown'); await destination.press('Enter');
  await expect(page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true })).toBeEnabled();
  await calendarTrigger(page).click(); const smallDialog = await boundedCalendar(page);
  const cancel=calendar(page).getByRole('button',{name:'انصراف',exact:true}); await cancel.focus(); await contained(page,cancel); await cancel.press('Enter'); await expect(calendarTrigger(page)).toBeFocused();
  await page.setViewportSize({ width: 844, height: 390 }); await calendarTrigger(page).click();
  const landscape = await boundedCalendar(page);
  const apply = calendar(page).getByRole('button', { name: 'اعمال تاریخ‌ها', exact: true }); await apply.focus(); await contained(page, apply);
  await page.keyboard.press('Escape'); await expect(calendar(page)).toHaveCount(0); await expect(calendarTrigger(page)).toBeFocused();
  writeEvidence(info, 'reflow-landscape', { browser: browser.version(), longText, narrow, smallDialog, landscape, method: '320CSSpx reflow and short-landscape viewport stress. Not browser zoom, CSSzoom or deviceScaleFactor emulation.' });
});

test('@responsive masked date-wheel neighbors retain composed text contrast and native keyboard focus', async ({ newReviewer, browser }, info) => {
  test.setTimeout(120_000); const reviewer=await newReviewer({reducedMotion:'reduce',viewport:{width:1440,height:900}}),{page}=reviewer;
  await page.addInitScript(()=>localStorage.setItem('torobticket.appearance','light'));await loadQuery(reviewer,{...queryFor(),departureDate:'2026-11-05'});
  const proofs:unknown[]=[];
  try {
    for (const [mode,label] of [['flight','پرواز'],['train','قطار'],['bus','اتوبوس']] as const) {
      await page.getByRole('radiogroup',{name:'وسیله سفر',exact:true}).getByText(label,{exact:true}).click();
      await expect(page.locator('html')).toHaveAttribute('data-mode',mode);await expect(page.locator('html')).not.toHaveAttribute('data-palette-transition','morph');
      await expect(page.getByRole('region',{name:'کاوش تاریخ سفر',exact:true})).toHaveAttribute('data-date-price-status','complete',{timeout:30000});
      for (const appearance of ['light','dark'] as const) {
        if(await page.locator('html').getAttribute('data-appearance')!==appearance)await page.getByRole('button',{name:/^نمای (روشن|تیره)$/}).click();
        await expect(page.locator('html')).toHaveAttribute('data-appearance',appearance);
        const wheel=page.getByRole('listbox',{name:'روزهای نزدیک',exact:true});await wheel.scrollIntoViewIfNeeded();
        const painted=await wheel.evaluate(element=>{
          type Color=[number,number,number,number];
          const color=(value:string):Color=>{if(!/^rgba?\(/.test(value))throw new Error('unsupported-mask-color:'+value);const numbers=value.match(/[\d.]+/g)!.map(Number);if(numbers.length<3||numbers.length>4)throw new Error('invalid-mask-color');return[numbers[0]!,numbers[1]!,numbers[2]!,numbers[3]??1];};
          const rect=(node:Element)=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom};};
          const css=getComputedStyle(element),wheel=rect(element),form=element.closest('form')!,formCss=getComputedStyle(form),background=color(formCss.backgroundColor);
          if(background[3]!==1||formCss.backgroundImage!=='none')throw new Error('mask-form-background-not-opaque');
          if(css.maskMode!=='match-source'&&css.maskMode!=='alpha')throw new Error('unsupported-mask-mode:'+css.maskMode);
          const raw=css.maskImage;if(!/^linear-gradient\(/.test(raw))throw new Error('unsupported-wheel-mask:'+raw);
          const stops=Array.from(raw.matchAll(/(rgba?\([^)]*\))(?:\s+([\d.]+)%)?/g),match=>({color:color(match[1]!),position:match[2]===undefined?undefined:Number(match[2])/100}));
          if(stops.length!==4)throw new Error('unsupported-wheel-mask-stops');stops[0]!.position??=0;stops[3]!.position??=1;
          if(stops.some(stop=>stop.position===undefined)||stops.some((stop,index)=>index>0&&stop.position!<stops[index-1]!.position!))throw new Error('unordered-wheel-mask-stops');
          const alphaAt=(y:number)=>{const position=(y-wheel.y)/wheel.height;if(position<0||position>1)return 0;for(let index=1;index<stops.length;index++){const before=stops[index-1]!,after=stops[index]!;if(position<=after.position!){const fraction=(position-before.position!)/(after.position!-before.position!);return before.color[3]+(after.color[3]-before.color[3])*fraction;}}return stops.at(-1)!.color[3];};
          const luminance=(rgb:number[])=>rgb.slice(0,3).map(value=>{const x=value/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index]!,0);
          const base=luminance(background),options=Array.from(element.querySelectorAll<HTMLElement>('[role="option"]')),selected=options.findIndex(node=>node.getAttribute('aria-selected')==='true');
          const neighbors=[options[selected-1],options[selected+1]].filter((node):node is HTMLElement=>!!node).flatMap(row=>{
            if(row.getAttribute('aria-disabled')==='true')throw new Error('mask-neighbor-disabled');
            return Array.from(row.querySelectorAll<HTMLElement>('bdi,small')).map(node=>{
              const nodeCss=getComputedStyle(node),foreground=color(nodeCss.color),range=document.createRange();range.selectNodeContents(node);const box=range.getBoundingClientRect();
              let groupOpacity=1;for(let parent:HTMLElement|null=node;parent&&parent!==form;parent=parent.parentElement){const style=getComputedStyle(parent);groupOpacity*=Number(style.opacity);if(color(style.backgroundColor)[3]!==0||style.backgroundImage!=='none')throw new Error('intervening-mask-surface');}
              const samples=[{name:'range-top',y:box.top+.5},{name:'range-center',y:box.y+box.height/2},{name:'range-bottom',y:box.bottom-.5}].map(sample=>{const maskAlpha=alphaAt(sample.y),alpha=foreground[3]*maskAlpha*groupOpacity,composed=foreground.slice(0,3).map((channel,index)=>channel*alpha+background[index]!*(1-alpha)),lit=luminance(composed);return{...sample,maskAlpha,composed,ratio:(Math.max(lit,base)+.05)/(Math.min(lit,base)+.05)};});
              return{text:node.textContent,kind:node.tagName,foreground:nodeCss.color,font:nodeCss.font,range:{x:box.x,y:box.y,width:box.width,height:box.height},row:rect(row),groupOpacity,samples};
            });
          });
          return{maskImage:raw,maskMode:css.maskMode,stops,wheel,formBackground:formCss.backgroundColor,form:rect(form),selectedIndex:selected,neighbors};
        });
        proofs.push({mode,appearance,painted});await wheel.screenshot({path:info.outputPath(`masked-wheel-${mode}-${appearance}.png`)});
        expect.soft(painted.neighbors).toHaveLength(4);for(const neighbor of painted.neighbors){expect.soft(neighbor.groupOpacity).toBe(1);for(const sample of neighbor.samples)expect.soft(sample.ratio,`${mode}/${appearance} ${neighbor.kind} ${sample.name} composed text`).toBeGreaterThanOrEqual(4.5);}
        const traversal=await tabTo(page,wheel);await expect(wheel).toBeFocused();const focus=await wheel.evaluate(node=>{const css=getComputedStyle(node);return{maskImage:css.maskImage,outlineWidth:css.outlineWidth,outlineStyle:css.outlineStyle,outlineOffset:css.outlineOffset,color:css.outlineColor,focusVisible:node.matches(':focus-visible')};});proofs.push({mode,appearance,focus,traversal});
        await page.screenshot({path:info.outputPath(`focused-wheel-${mode}-${appearance}.png`)});expect.soft(focus.focusVisible).toBe(true);expect.soft(focus.maskImage,`${mode}/${appearance} wheel focus outline must not be masked`).toBe('none');expect.soft(parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2);
      }
    }
    expect(proofs).toHaveLength(12);
  } finally {writeEvidence(info,'masked-wheel-paint',{browser:browser.version(),proofs,method:'Actual settled neighboring date/price DOMRange geometry, resolved vertical alpha-mask stops, foreground alpha and observed opaque form background. Samples compose these layers at text-range top/center/bottom; range edges are conservative layout bounds, not glyph-ink/antialiasing pixel measurements. Intervening paint, opacity changes, unsupported colors or mask modes reject. Native Tab focus screenshots and computed mask/outline facts are separate from pointer-neighbor contrast; no whole-app certification.'});}
});

test('@responsive reduced motion with unavailable WebGL retains calendar/chart semantics and complete route details', async ({ newReviewer, browser }, info) => {
  test.setTimeout(90_000); const reviewer = await newReviewer({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } }); const { page } = reviewer;
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) { return args[0] === 'webgl2' ? null : original.apply(this, args); } as typeof original; });
  await loadQuery(reviewer, queryFor('flight', 'domestic', 'round-trip'));
  await expect(page.locator('[data-chart-selected]')).toHaveAttribute('data-motion-policy', 'static');
  await expect(page.getByRole('slider', { name: 'انتخاب روز از نمودار', exact: true })).toBeEnabled();
  await expect(page.getByRole('complementary', { name: 'نقشه سفر', exact: true }).locator('svg[role="presentation"]')).toBeVisible();
  const recovery = await runSearch(reviewer); expect(recovery.snapshot.status).toBe('complete');
  const card = priceCards(page).locator('xpath=self::article[@data-selected="true"]'); await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'جزئیات سفر', exact: true }).click();
  await expect(card.getByRole('region', { name: 'جزئیات مسیر رفت', exact: true })).toBeVisible(); await expect(card.getByRole('region', { name: 'جزئیات مسیر برگشت', exact: true })).toBeVisible();
  await calendarTrigger(page).click(); await expect(calendar(page)).toBeVisible(); await calendar(page).getByRole('button', { name: 'انصراف', exact: true }).click(); await expect(calendarTrigger(page)).toBeFocused();
  writeEvidence(info, 'reduced-fallback', { browser: browser.version(), query: recovery.snapshot.query, selectedQuote: await card.getAttribute('data-quote-id'), reducedMotion: true, webgl2Unavailable: true, layout: await layout(page) });
});

test('@responsive arbitrary hotel reference has a native-keyboard coordinate equivalent with invalid, commit and cancel authority', async ({ newReviewer, browser }, info) => {
  test.setTimeout(120_000); const reviewer = await newReviewer({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } }); const { page } = reviewer;
  await loadQuery(reviewer, queryFor()); await runSearch(reviewer);
  const tape: unknown[] = [], posts: unknown[] = [];
  page.on('request', request => {if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/hotel-searches') posts.push(request.postDataJSON());});
  const reach = async (label: string, locator: Locator, reverse = false) => {try {const steps = await tabTo(page,locator,reverse); tape.push({label,steps});} catch(error) {if(error instanceof KeyboardTraversalFailure)tape.push({label,failedTraversal:error.steps});throw error;}};
  try {
    const trigger=page.getByRole('button',{name:'مقایسه اقامتگاه‌های مشهد',exact:true});
    await reach('hotel-entry',trigger,true); const initialResponse=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/v1/hotel-searches'); await page.keyboard.press('Enter');
    const initialHttp=await initialResponse;expect(initialHttp.status()).toBe(201);const initial=HotelSearchSnapshotSchema.parse(await initialHttp.json());
    const dialog=page.getByRole('dialog',{name:'هتل‌های مشهد',exact:true}),results=dialog.getByRole('region',{name:'نتایج مقایسه اقامتگاه‌ها',exact:true});
    await expect(results).toHaveAttribute('data-hotel-status','complete',{timeout:30000});
    const sort=dialog.getByRole('radiogroup',{name:'مرتب‌سازی اقامتگاه‌ها',exact:true});
    const cheapest=sort.getByRole('radio',{name:'ارزان‌ترین',exact:true});await reach('hotel-sort',cheapest);
    for (const label of ['ستاره بیشتر','نزدیک به فرودگاه']) {
      const before=await results.getAttribute('data-hotel-search-id');await page.keyboard.press('ArrowLeft');await expect(sort.getByRole('radio',{name:label,exact:true})).toBeChecked();
      await expect(results).not.toHaveAttribute('data-hotel-search-id',before!);await expect(results).toHaveAttribute('data-hotel-status','complete',{timeout:30000});
    }
    await page.keyboard.press('ArrowLeft');const reference=sort.getByRole('radio',{name:'نزدیک به نقطه دلخواه',exact:true});await expect(reference).toBeChecked();
    await expect(dialog.locator('[data-hotel-map]')).toHaveAttribute('data-picking-point','true');
    const scrollPane=dialog.getByRole('region',{name:'فهرست اقامتگاه‌ها',exact:true}),cards=scrollPane.locator('[data-hotel-card-select]');
    expect(await cards.count()).toBeGreaterThan(0);expect(await cards.evaluateAll(nodes=>nodes.every(node=>(node as HTMLButtonElement).disabled))).toBe(true);
    await reach('point-mode-hotel-scroll',scrollPane);await hitTest(scrollPane);
    const beforeScroll=await scrollPane.evaluate(node=>{const css=getComputedStyle(node);return{top:node.scrollTop,client:node.clientHeight,height:node.scrollHeight,focusVisible:node.matches(':focus-visible'),outlineWidth:css.outlineWidth,outlineStyle:css.outlineStyle,outlineOffset:css.outlineOffset};});tape.push({beforeScroll});
    expect(beforeScroll.height).toBeGreaterThan(beforeScroll.client);expect(beforeScroll.focusVisible).toBe(true);expect(parseFloat(beforeScroll.outlineWidth)).toBeGreaterThanOrEqual(2);expect(beforeScroll.outlineStyle).not.toBe('none');expect(parseFloat(beforeScroll.outlineOffset)).toBeLessThan(0);
    await page.keyboard.press('PageDown');await expect.poll(()=>scrollPane.evaluate(node=>node.scrollTop)).toBeGreaterThan(beforeScroll.top);await expect(scrollPane).toBeFocused();tape.push({afterPageDown:await scrollPane.evaluate(node=>({top:node.scrollTop,client:node.clientHeight,height:node.scrollHeight}))});await page.screenshot({path:info.outputPath('hotel-point-scroll-focus.png')});
    const details=dialog.locator('details').filter({has:page.locator('summary').filter({hasText:'انتخاب با مختصات'})});
    const summary=details.locator('summary');await reach('coordinate-disclosure',summary,true);await page.keyboard.press('Enter');await expect(details).toHaveAttribute('open','');
    const latitude=dialog.getByRole('spinbutton',{name:'عرض جغرافیایی نقطه مرجع',exact:true}),longitude=dialog.getByRole('spinbutton',{name:'طول جغرافیایی نقطه مرجع',exact:true});
    const beforeTyping=posts.length;
    await reach('latitude',latitude);await hitTest(latitude);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('91');
    await reach('longitude',longitude);await hitTest(longitude);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('181');
    expect(posts.length).toBe(beforeTyping);await page.keyboard.press('Enter');await expect(latitude).toBeFocused();await expect(latitude).toHaveAttribute('aria-invalid','true');await expect(longitude).toHaveAttribute('aria-invalid','true');expect(posts.length).toBe(beforeTyping);
    await scanAccessibility(page,info,'hotel-keyboard-coordinate-error');
    await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('35.123456');await reach('longitude-corrected',longitude);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('51.654321');expect(posts.length).toBe(beforeTyping);
    const committedResponse=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/v1/hotel-searches');await page.keyboard.press('Enter');const http=await committedResponse;expect(http.status()).toBe(201);const committed=HotelSearchSnapshotSchema.parse(await http.json());
    expect(committed.query.customPoint).toEqual({latitude:35.123456,longitude:51.654321});expect(committed.query.sort).toBe('location-distance');expect(committed.query.checkIn).toBe(initial.query.checkIn);expect(committed.query.checkOut).toBe(initial.query.checkOut);expect(committed.query.rooms).toBe(initial.query.rooms);expect(committed.query.party).toEqual(initial.query.party);expect(posts.length).toBe(beforeTyping+1);
    await expect(results).toHaveAttribute('data-hotel-search-id',committed.hotelSearchId);await expect(reference).toBeFocused();await expect(dialog.locator('[data-hotel-map]')).toHaveAttribute('data-picking-point','false');
    const originalQuery=await results.getAttribute('data-hotel-query');
    const change=dialog.getByRole('button',{name:'تغییر نقطه مرجع',exact:true});await reach('change-reference',change);await page.keyboard.press('Enter');
    await reach('replacement-coordinate-disclosure',summary,true);await page.keyboard.press('Enter');await reach('replacement-latitude',latitude);await expect(latitude).toHaveValue('35.123456');await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('10');await page.keyboard.press('Escape');
    await expect(dialog.locator('[data-hotel-map]')).toHaveAttribute('data-picking-point','false');await expect(reference).toBeFocused();expect(await results.getAttribute('data-hotel-query')).toBe(originalQuery);expect(posts.length).toBe(beforeTyping+1);
    await page.keyboard.press('Space');await expect(dialog.locator('[data-hotel-map]')).toHaveAttribute('data-picking-point','true');await reach('reopened-coordinate-disclosure',summary,true);await page.keyboard.press('Enter');await reach('reopened-latitude',latitude);await expect(latitude).toHaveValue('35.123456');
    await page.keyboard.press('Escape');await expect(reference).toBeFocused();
    await scanAccessibility(page,info,'hotel-keyboard-coordinate-restored');
    await reach('hotel-close',dialog.getByRole('button',{name:'بستن',exact:true}));await page.keyboard.press('Enter');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
    tape.push({initialQuery:initial.query,committedQuery:committed.query,committedSearchId:committed.hotelSearchId,originalQuery,hotelPosts:posts.length});
  } finally {writeEvidence(info,'keyboard-hotel-reference',{browser:browser.version(),tape,posts,method:'Native Tab/Shift+Tab, arrow radio navigation, key typing, Enter and Escape; no locator.focus or pointer input for reference selection. Actual hotel HTTP requests; only owned reviewer state.'});}
});
