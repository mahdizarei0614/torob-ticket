import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.env.BRAND_EVIDENCE_DIR ?? 'docs/evidence/adjustments/compact-loop-brand/browser');
const brand = (page: Page) => page.locator('a[aria-label="ترب تیکت، خانه"]');
async function palette(page: Page) {
  return page.locator('[data-brand-logo]').first().evaluate(svg => ({
    fills: Array.from(svg.querySelectorAll('path')).map(path => getComputedStyle(path).fill),
    leaves: svg.querySelectorAll('[data-brand-leaf]').length,
    width: svg.getBoundingClientRect().width,
    height: svg.getBoundingClientRect().height,
  }));
}
async function expectAppearance(page: Page, appearance: 'light' | 'dark', base = '/') {
  await expect(page.locator('html')).toHaveAttribute('data-appearance', appearance);
  await expect(page.locator('[data-brand-favicon]')).toHaveAttribute('href', `${base}brand/favicon-${appearance}.svg`);
  const colors = await palette(page);
  expect(colors.leaves).toBe(2);
  expect(colors.height).toBeGreaterThanOrEqual(32);
  if (appearance === 'dark') expect(new Set(colors.fills)).toEqual(new Set(['rgb(255, 255, 255)']));
  else expect(new Set(colors.fills)).toEqual(new Set(['rgb(243, 19, 43)', 'rgb(36, 156, 61)', 'rgb(37, 41, 43)']));
  const theme = await page.locator('[data-brand-theme-color]').getAttribute('content');
  expect(theme).toBe(appearance === 'dark' ? '#0c121e' : '#ffffff');
}
test.beforeEach(async ({ page }) => {
  mkdirSync(out, { recursive: true });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.addInitScript(() => { if (!localStorage.getItem('torobticket.appearance')) localStorage.setItem('torobticket.appearance', 'light'); });
  expect((await page.request.post('/api/v1/demo/session', { data: { seed: 5050, anchorInstant: '2026-10-29T06:00:00Z', scenario: 'normal' } })).status()).toBe(201);
});
test.afterEach(async ({ page }) => {
  expect((await page.request.post('/api/v1/admin/reset', { data: {} })).status()).toBe(201);
});
for (const width of [1366, 320]) test(`@brand consumer ${width}px: real theme/mode changes retain the double-leaf identity and home link`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await expect(brand(page)).toBeVisible();
  await expectAppearance(page, 'light'); // Saved light must win over OS dark.
  for (const mode of ['پرواز', 'قطار', 'اتوبوس']) {
    const radio = page.getByRole('radio', { name: mode, exact: true });
    await radio.focus(); await radio.press('Space'); await expect(radio).toBeChecked();
    await expectAppearance(page, 'light');
  }
  const bounds = await brand(page).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: resolve(out, `consumer-${width}-light.png`) });
  await page.getByRole('button', { name: 'نمای تیره', exact: true }).click();
  await expectAppearance(page, 'dark');
  for (const mode of ['پرواز', 'قطار', 'اتوبوس']) {
    const radio = page.getByRole('radio', { name: mode, exact: true });
    await radio.focus(); await radio.press('Space'); await expect(radio).toBeChecked();
    await expectAppearance(page, 'dark');
  }
  await page.reload(); await expect(brand(page)).toBeVisible(); await expectAppearance(page, 'dark');
  await page.screenshot({ path: resolve(out, `consumer-${width}-dark.png`) });
  await brand(page).focus(); await expect(brand(page)).toBeFocused();
  expect(await brand(page).evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
  await brand(page).press('Enter'); await expect(brand(page)).toBeVisible();
});
test('@brand admin: English lockup, stored/manual theme and deep-linked asset paths', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/admin/providers');
  await expect(page.getByRole('link', { name: 'TorobTicket Admin home', exact: true })).toBeVisible();
  await expect(page.locator('[data-brand-logo="en"]')).toBeVisible();
  await expectAppearance(page, 'light', '/admin/');
  await page.screenshot({ path: resolve(out, 'admin-light.png') });
  await page.getByRole('button', { name: 'Toggle appearance', exact: true }).click();
  await expectAppearance(page, 'dark', '/admin/');
  await page.setViewportSize({ width: 320, height: 844 });
  const bounds = await page.locator('[data-brand-logo="en"]').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: resolve(out, 'admin-dark-mobile.png') });
});
test('@brand built browser assets: HTTP types, scopes, transparent white art and maskable circle safety', async ({ page }) => {
  for (const base of ['/', '/admin/']) {
    await page.goto(base);
    for (const relation of ['icon', 'apple-touch-icon', 'mask-icon', 'manifest']) {
      const links = await page.locator(`link[rel="${relation}"]`).evaluateAll(nodes => nodes.map(node => (node as HTMLLinkElement).href));
      expect(links.length).toBeGreaterThan(0);
      for (const url of links) { const response = await page.request.get(url); expect(response.ok()).toBe(true); expect(response.headers()['content-type']).not.toContain('text/html'); }
    }
    const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await page.request.get(manifestUrl!)).json();
    expect(manifest.scope).toBe(base); expect(manifest.start_url).toBe(base);
    for (const icon of manifest.icons) expect((await page.request.get(new URL(icon.src, new URL(manifestUrl!, page.url())).href)).ok()).toBe(true);
    for (const missing of ['brand/missing-logo.svg', 'favicon-missing.png']) {
      expect((await page.request.get(base + missing)).status()).toBe(404);
    }
  }
  const pixels = await page.evaluate(async () => {
    async function decode(src: string) {
      const img = new Image(); img.src = src; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0); return { size: canvas.width, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
    }
    const white = await decode('/brand/symbol-white-256.png');
    let transparent = 0, opaqueWhite = 0, nonwhite = 0;
    for (let i = 0; i < white.data.length; i += 4) { if (!white.data[i + 3]) transparent++; if (white.data[i + 3] === 255) { if (white.data[i] === 255 && white.data[i + 1] === 255 && white.data[i + 2] === 255) opaqueWhite++; else nonwhite++; } }
    const mask = await decode('/brand/icon-maskable-512.png'); let outside = 0, alpha = 255;
    for (let y = 0; y < mask.size; y++) for (let x = 0; x < mask.size; x++) { const p = (y * mask.size + x) * 4; alpha = Math.min(alpha, mask.data[p + 3]!); if (Math.hypot(x - 255.5, y - 255.5) > 204.8 && (mask.data[p]! < 250 || mask.data[p + 1]! < 250 || mask.data[p + 2]! < 250)) outside++; }
    return { transparent, opaqueWhite, nonwhite, outside, alpha };
  });
  expect(pixels.transparent).toBeGreaterThan(30000); expect(pixels.opaqueWhite).toBeGreaterThan(10000); expect(pixels.nonwhite).toBe(0); expect(pixels.outside).toBe(0); expect(pixels.alpha).toBe(255);
  writeFileSync(resolve(out, 'asset-pixels.json'), JSON.stringify(pixels, null, 2));
});
