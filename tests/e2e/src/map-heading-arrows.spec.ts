import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const evidence = resolve(process.env.MAP_HEADING_EVIDENCE_DIR ?? 'docs/evidence/adjustments/map-heading-arrows/native');
const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-11-02', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
type Frame = { time: number; sameLabels: boolean; minimumLabelOpacity: number; labelTops: number[]; labelLefts: number[]; arrowOpacities: number[]; headings: number };
type Probe = { done: boolean; frames: Frame[] };

async function begin(page: Page, endpointsOnly: boolean) {
 await page.evaluate(endpointsOnly => {
  const root = document.querySelector('[data-map-heading]')!;
  const selectLabels = () => {
   const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-map-city-label]'));
   return endpointsOnly && nodes.length >= 2 ? [nodes[0]!, nodes.at(-1)!] : nodes;
  };
  const labels = selectLabels();
  if (labels.length !== 2) throw new Error('Expected two actual city-label nodes');
  const probe = { done: false, frames: [] as Frame[] };
  (window as unknown as { headingArrowProbe: Probe }).headingArrowProbe = probe;
  const opacity = (element: HTMLElement) => {
   let value = 1, node: HTMLElement | null = element;
   while (node && node !== root.parentElement) { value *= Number(getComputedStyle(node).opacity); node = node.parentElement; }
   return value;
  };
  root.ownerDocument.addEventListener('pointerdown', () => {
   const start = performance.now();
   const tick = () => {
    const current = selectLabels();
    const boxes = labels.map(label => label.getBoundingClientRect());
    probe.frames.push({ time: performance.now() - start, sameLabels: current.length === labels.length && current.every((label, index) => label === labels[index] && label.isConnected),
     minimumLabelOpacity: Math.min(...labels.map(opacity)), labelTops: boxes.map(box => box.top), labelLefts: boxes.map(box => box.left),
     arrowOpacities: Array.from(root.querySelectorAll<HTMLElement>('[data-map-heading-arrow]')).map(opacity), headings: root.querySelectorAll('h2').length });
    if (performance.now() - start < 650) requestAnimationFrame(tick); else probe.done = true;
   };
   tick();
  }, { once: true, capture: true });
 }, endpointsOnly);
}

async function toggle(page: Page, label: string, endpointsOnly = false) {
 await begin(page, endpointsOnly);
 await page.getByRole('radiogroup', { name: 'نوع سفر', exact: true }).getByText(label, { exact: true }).click();
 await expect.poll(() => page.evaluate(() => (window as unknown as { headingArrowProbe: Probe }).headingArrowProbe.done)).toBe(true);
 return page.evaluate(() => (window as unknown as { headingArrowProbe: Probe }).headingArrowProbe.frames);
}

test('@map-heading trip-type changes preserve city labels and animate only arrows before and after selecting a fare', async ({ page, context, browser }) => {
 test.setTimeout(60000);
 mkdirSync(evidence, { recursive: true });
 expect((await context.cookies()).length).toBe(0);
 expect((await context.request.post('/api/v1/demo/session', { data: { seed: 4529, anchorInstant: '2026-10-29T06:00:00Z' } })).status()).toBe(201);
 await page.setViewportSize({ width: 1366, height: 768 });
 await page.emulateMedia({ reducedMotion: 'no-preference' });
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto('/?q=' + encodeURIComponent(JSON.stringify(query)));
 await page.bringToFront();
 await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:20_000});
 const heading = page.locator('[data-map-heading]');
 await expect(heading.locator('[data-map-city-label]')).toHaveCount(2);
 await expect(heading).toContainText('تهران');
 await expect(heading).toContainText('مشهد');
 await page.evaluate(() => document.fonts.ready);
 await expect.poll(() => heading.locator('[data-map-city-label]').evaluateAll(nodes => Math.min(...nodes.map(node => {
  let opacity = 1, current: HTMLElement | null = node as HTMLElement;
  while (current && !current.hasAttribute('data-map-heading')) { opacity *= Number(getComputedStyle(current).opacity); current = current.parentElement; }
  return opacity;
 })))).toBeGreaterThan(.99);
 const runs: { phase: string; target: string; frames: Frame[] }[] = [];
 try {
  for (const target of ['رفت‌وبرگشت', 'یک‌طرفه', 'رفت‌وبرگشت', 'یک‌طرفه']) {
   const frames = await toggle(page, target); runs.push({ phase: 'form', target, frames });
   expect(frames.length).toBeGreaterThan(10);
   expect(frames.every(frame => frame.sameLabels && frame.minimumLabelOpacity > .99 && frame.headings === 1)).toBe(true);
   for (let index = 0; index < 2; index++) {
    expect(Math.max(...frames.map(frame => frame.labelLefts[index]!)) - Math.min(...frames.map(frame => frame.labelLefts[index]!))).toBeLessThan(1);
    expect(Math.max(...frames.map(frame => frame.labelTops[index]!)) - Math.min(...frames.map(frame => frame.labelTops[index]!))).toBeLessThan(1);
   }
   expect(frames.some(frame => frame.arrowOpacities.some(opacity => opacity > .01 && opacity < .99))).toBe(true);
   await expect(heading.locator('svg[data-map-heading-arrow]')).toHaveAttribute('data-map-heading-arrow', target === 'یک‌طرفه' ? 'one-way' : 'round-trip');
  }
  await expect(page.locator('[data-date-price-status]')).toHaveAttribute('data-date-price-status','complete',{timeout:20_000});
  const started=page.waitForResponse(response=>response.url().endsWith('/api/v1/searches')&&response.request().method()==='POST');
  await page.getByRole('button', { name: 'جست‌وجوی سفر', exact: true }).click();expect((await started).status()).toBe(201);
  const region = page.getByRole('region', { name: 'نتایج مقایسه سفر', exact: true });
  await expect(region).toHaveAttribute('data-status', 'complete', { timeout: 30000 });
  await expect(region.locator('article[data-selected="true"]')).toHaveCount(1);
  await expect(heading.locator('h2')).toHaveCount(1);
  await expect(heading.locator('bdi').first()).toBeVisible();
  await expect.poll(() => heading.locator('[data-map-city-label]').first().evaluate(node => {
   let opacity = 1, current: HTMLElement | null = node as HTMLElement;
   while (current && !current.hasAttribute('data-map-heading')) { opacity *= Number(getComputedStyle(current).opacity); current = current.parentElement; }
   return opacity;
  })).toBeGreaterThan(.99);
  const selectedLabelCount = await heading.locator('[data-map-city-label]').count();
  // A real cheapest service may have intermediate stops. Its two endpoints
  // persist; the revoked service's stop labels and facts must clear truthfully.
  const afterSelection = await toggle(page, 'رفت‌وبرگشت', true); runs.push({ phase: `selected-${selectedLabelCount}-cities-to-draft`, target: 'رفت‌وبرگشت', frames: afterSelection });
  expect(afterSelection.every(frame => frame.sameLabels && frame.minimumLabelOpacity > .99 && frame.headings === 1)).toBe(true);
  await expect(heading.locator('svg[data-map-heading-arrow]')).toHaveAttribute('data-map-heading-arrow', 'round-trip');
  // The new draft must not retain revoked selected-service facts merely to keep labels mounted.
  await expect(heading.locator('bdi:not([hidden])')).toHaveCount(0);
  expect(await heading.locator('bdi[hidden]').allTextContents()).toEqual(['', '']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await toggle(page, 'یک‌طرفه'); runs.push({ phase: 'reduced-motion', target: 'یک‌طرفه', frames: reduced });
  expect(reduced.every(frame => frame.sameLabels && frame.minimumLabelOpacity > .99 && frame.headings === 1)).toBe(true);
  await expect(heading.locator('svg[data-map-heading-arrow]')).toHaveAttribute('data-map-heading-arrow', 'one-way');
  expect(errors).toEqual([]);
  await page.screenshot({ path: resolve(evidence, 'arrows-only.png') });
 } finally {
  const lastProbe = await page.evaluate(() => (window as unknown as { headingArrowProbe?: Probe }).headingArrowProbe);
  writeFileSync(resolve(evidence, 'arrows-only.json'), JSON.stringify({ browser: browser.version(), viewport: { width: 1366, height: 768 }, runs, lastProbe, pageErrors: errors,
   cleanup: 'Fresh empty-cookie context only; no resets/deletions. Playwright closes the context; isolated evidence uses normal server expiry.' }, null, 2) + '\n');
 }
});
