import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { browser: browser.version(), cases: [] };
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      'http://127.0.0.1:4400/iframe.html?id=foundation-all-states--flight-light-english&viewMode=story',
    );
    await page.getByRole('heading', { level: 1 }).waitFor();
    const result = await page.evaluate(async () => {
      const nativeStart = document.startViewTransition.bind(document);
      const transitions = [];
      const trace = [];
      document.startViewTransition = (update) => {
        trace.push('capture');
        const transition = nativeStart(async () => {
          trace.push('update-start');
          await update();
          trace.push(
            `update-end:${document.documentElement.dataset.appearance}:${document.documentElement.dataset.preference}`,
          );
        });
        transitions.push(transition);
        return transition;
      };
      // Same turn: the newer direct/system request precedes the old native callback.
      const buttons = [...document.querySelectorAll('button')];
      buttons.find((button) => button.textContent === 'Dark mode').click();
      buttons.find((button) => button.textContent === 'Follow system appearance').click();
      await Promise.all(transitions.map((transition) => transition.finished));
      return {
        trace,
        appearance: document.documentElement.dataset.appearance,
        preference: document.documentElement.dataset.preference,
        stored: localStorage.getItem('torobticket.appearance'),
        toggleLabel: buttons.find((button) => button.textContent === 'Dark mode')?.textContent,
      };
    });
    assert.deepEqual(result, {
      trace: ['capture', 'update-start', 'update-end:light:system'],
      appearance: 'light',
      preference: 'system',
      stored: 'system',
      toggleLabel: 'Dark mode',
    });
    assert.deepEqual(errors, []);
    report.cases.push({ width, ...result, errors });
    await context.close();
  }
  mkdirSync('.local/evidence/T12', { recursive: true });
  writeFileSync('.local/evidence/T12/fix-1-browser-race.json', JSON.stringify(report, null, 2));
  console.log(
    `PASS: reported native deferred/skipped-transition race keeps system/light/context label/storage at 390px and1440px; Chrome${report.browser}.`,
  );
} finally {
  await browser.close();
}
