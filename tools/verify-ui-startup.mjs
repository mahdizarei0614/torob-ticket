import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const directory = pathname.startsWith('/admin/') ? 'dist/apps' : 'dist/apps/web';
  let file = resolve(directory, '.' + pathname);
  if (!file.startsWith(resolve(directory))) {
    response.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file += '/index.html';
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const cases = [];
try {
  for (const app of ['/', '/admin/'])
    for (const [stored, system, expected] of [
      ['dark', 'light', 'dark'],
      ['light', 'dark', 'light'],
      ['system', 'dark', 'dark'],
    ]) {
      const context = await browser.newContext({ colorScheme: system });
      await context.addInitScript((value) => localStorage.setItem('torobticket.appearance', value), stored);
      const page = await context.newPage();
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      await page.route('**/assets/index-*.js', async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto(base + app, { waitUntil: 'commit' });
      await page.waitForFunction(() => document.documentElement.dataset.appearance);
      const beforeReact = await page.evaluate(() => ({
        appearance: document.documentElement.dataset.appearance,
        content: document.getElementById('root')?.textContent || '',
      }));
      assert.equal(beforeReact.appearance, expected);
      assert.equal(beforeReact.content, '');
      release();
      await page.getByRole('heading', { level: 1 }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.appearance), expected);
      cases.push({ app, stored, system, expected, beforeReact });
      await context.close();
    }
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(
    'http://127.0.0.1:4400/iframe.html?id=foundation-all-states--flight-light-english&viewMode=story',
  );
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.evaluate(() => {
    window.__transitionCalls = 0;
    document.startViewTransition = () => {
      window.__transitionCalls++;
      throw new Error('Must not animate reduced motion');
    };
  });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  assert.equal(await page.evaluate(() => window.__transitionCalls), 0);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.appearance), 'dark');
  await context.close();
  await writeFile(
    'docs/evidence/T12/startup-audit.json',
    JSON.stringify(
      { browser: browser.version(), cases, reducedMotion: 'direct theme switch; zero transition calls' },
      null,
      2,
    ),
  );
  console.log(
    'PASS: 6 built-app stored/system appearance cases apply before React/visible content and persist after mount; browser reduced motion skips transition.',
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
