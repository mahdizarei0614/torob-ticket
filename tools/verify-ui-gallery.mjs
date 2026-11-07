import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base = process.env.GALLERY_URL ?? 'http://127.0.0.1:4400';
const out = '.local/evidence/T12';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { browser: browser.version(), date: new Date().toISOString(), cases: [], interactions: [] };
const names = [
  'flight-light-persian',
  'flight-dark-persian',
  'train-light-persian',
  'train-dark-persian',
  'bus-light-persian',
  'bus-dark-persian',
  'flight-light-english',
  'flight-dark-english',
  'train-light-english',
  'train-dark-english',
  'bus-light-english',
  'bus-dark-english',
  'admin-light',
  'admin-dark',
];
try {
  for (const width of [390, 1440]) {
    for (const name of names) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const fonts = [];
      const remote = [];
      const errors = [];
      page.on('request', (request) => {
        if (/woff|ttf|fonts\./.test(request.url())) fonts.push(request.url());
        if (!request.url().startsWith(base) && /^https?:/.test(request.url())) remote.push(request.url());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}/iframe.html?id=foundation-all-states--${name}&viewMode=story`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const css = getComputedStyle(root);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const rgb = (token) => {
          ctx.fillStyle = css.getPropertyValue(token).trim();
          const hex = ctx.fillStyle;
          return [1, 3, 5]
            .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
            .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
        };
        const luminance = (token) => {
          const [r, g, b] = rgb(token);
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (a, b) => {
          const x = luminance(a),
            y = luminance(b);
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        };
        const pairs = [
          ['--text', '--surface', 4.5],
          ['--text-muted', '--surface', 4.5],
          ['--text-muted', '--canvas', 4.5],
          ['--accent', '--surface', 4.5],
          ['--on-accent', '--accent', 4.5],
          ['--success', '--success-bg', 4.5],
          ['--warning', '--warning-bg', 4.5],
          ['--danger', '--danger-bg', 4.5],
          ['--info', '--info-bg', 4.5],
          ['--focus', '--surface', 3],
          ['--focus', '--canvas', 3],
          ['--focus', '--accent-soft', 3],
          ['--border-strong', '--surface', 3],
          ['--icon', '--surface', 3],
        ];
        const controls = [...document.querySelectorAll('button, input:not([type=radio]), label[data-rac]')]
          .filter((el) => el.getBoundingClientRect().width > 2)
          .map((el) => ({
            name: el.getAttribute('aria-label') || el.textContent?.trim() || 'input',
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
          }));
        return {
          width: innerWidth,
          scrollWidth: root.scrollWidth,
          appearance: root.dataset.appearance,
          mode: root.dataset.mode,
          mainDirection: getComputedStyle(document.querySelector('main')).direction,
          mainFont: getComputedStyle(document.querySelector('main')).fontFamily,
          fontFaces: [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
          contrast: pairs.map(([a, b, min]) => ({ pair: `${a}/${b}`, ratio: ratio(a, b), minimum: min })),
          controls,
        };
      });
      assert.equal(metrics.scrollWidth, width, `${name} at${width}: horizontal overflow`);
      assert.equal(metrics.mainDirection, name.includes('persian') ? 'rtl' : 'ltr');
      assert.equal(errors.length, 0, errors.join('\n'));
      assert.equal(remote.length, 0, remote.join('\n'));
      for (const check of metrics.contrast)
        assert.ok(check.ratio >= check.minimum, `${name}: ${check.pair} ${check.ratio}`);
      for (const control of metrics.controls)
        assert.ok(
          control.height >= 43.9 && control.width >= 43.9,
          `${name}: undersized ${control.name}: ${control.width}x${control.height}`,
        );
      assert.ok(fonts.length >= 1, `${name}: no local font load`);
      await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
      report.cases.push({ name, ...metrics, fonts, remote, errors });
      if (name === 'flight-light-english') {
        await page.keyboard.press('Tab');
        assert.equal(
          await page
            .getByRole('button', { name: 'Dark mode' })
            .evaluate((el) => el.matches(':focus-visible')),
          true,
        );
        await page.screenshot({ path: `${out}/keyboard-focus-${width}.png`, fullPage: false });
        await page.getByRole('button', { name: 'Inspect sample total' }).click();
        const dialog = page.getByRole('dialog', { name: 'Whole-party total' });
        await dialog.waitFor();
        for (let i = 0; i < 6; i++) {
          await page.keyboard.press('Tab');
          assert.ok(await dialog.evaluate((el) => el.contains(document.activeElement)));
        }
        await page.screenshot({ path: `${out}/modal-${width}.png`, fullPage: false });
        if (width === 390) {
          const box = await dialog.locator('..').boundingBox();
          assert.equal(box.height, 1000);
        }
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.ok(
          await page
            .getByRole('button', { name: 'Inspect sample total' })
            .evaluate((el) => el === document.activeElement),
        );
        const source = page.getByRole('combobox', { name: 'From' });
        await source.fill('Shi');
        await source.press('ArrowDown');
        await source.press('Enter');
        assert.equal(await source.inputValue(), 'Shiraz');
        await page.getByRole('button', { name: 'Dark mode' }).click();
        await page.waitForFunction(() => document.documentElement.dataset.appearance === 'dark');
        assert.equal(await page.evaluate(() => localStorage.getItem('torobticket.appearance')), 'dark');
        report.interactions.push({
          width,
          focus: 'visible',
          modal: 'contains/restores/Escape',
          combobox: 'keyboard selected Shiraz',
          theme: 'dark persisted; flat reveal executed',
        });
      }
      await context.close();
    }
  }
  writeFileSync(`${out}/browser-audit.json`, JSON.stringify(report, null, 2));
  console.log(
    `PASS: ${report.cases.length} viewport/palette/language renders; contrast, 44px targets, no overflow, local fonts; keyboard/modal/theme checks at both widths. Chrome${report.browser}`,
  );
} finally {
  await browser.close();
}
