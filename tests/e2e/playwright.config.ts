import { defineConfig, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const graphicsPort = process.env.GRAPHICS_E2E_PORT;
if (graphicsPort && (!/^\d+$/.test(graphicsPort) || Number(graphicsPort) < 1024 || Number(graphicsPort) > 65535 || ['4300', '4301', '4302'].includes(graphicsPort))) throw new Error('GRAPHICS_E2E_PORT must be an isolated port between 1024 and 65535');
const external = process.env.E2E_BASE_URL;
if (external) {
  const url = new URL(external);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535) throw new Error('E2E_BASE_URL must be an explicit loopback HTTP origin with a nonprivileged port');
  if (graphicsPort) throw new Error('Choose external Compose or the isolated graphics dev server, not both');
}
const webUrl = external ? new URL(external).origin : `http://127.0.0.1:${graphicsPort ?? '4300'}`;
const evidence = external ? resolve(process.env.E2E_EVIDENCE_DIR ?? 'docs/evidence/T30/implementation/e2e') : undefined;
if (evidence) {
  // Set before the test modules load; historical suites retain their own evidence contracts.
  for (const key of ['T15_EVIDENCE_DIR', 'T16_EVIDENCE_DIR', 'T16_CORRECTION_EVIDENCE_DIR', 'T17_EVIDENCE_DIR', 'T17_CORRECTION_EVIDENCE_DIR', 'T18_EVIDENCE_DIR', 'T19_EVIDENCE_DIR', 'M5_EVIDENCE_DIR', 'M6_EVIDENCE_DIR', 'GRAPHICS_EVIDENCE_DIR', 'HOTEL_E2E_EVIDENCE_DIR', 'REFERRAL_E2E_EVIDENCE_DIR']) {
    process.env[key] = resolve(evidence, key.toLowerCase());
    mkdirSync(process.env[key], { recursive: true });
  }
  process.env.ADMIN_E2E_URL = webUrl;
}
export default defineConfig({
  testDir: './src',
  fullyParallel: !external,
  workers: external ? 1 : undefined,
  timeout: 60000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  outputDir: evidence ? resolve(evidence, 'artifacts') : undefined,
  use: { baseURL: webUrl, trace: external ? 'off' : 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: external ? undefined : graphicsPort ? [{ command: `pnpm exec vite --config apps/web/vite.config.mts --port=${graphicsPort}`, url: webUrl, reuseExistingServer: false, cwd: '../..' }] : [
    { command: 'pnpm nx serve web', url: 'http://127.0.0.1:4300', reuseExistingServer: false, cwd: '../..' },
    { command: 'pnpm nx serve admin', url: 'http://127.0.0.1:4301/admin/', reuseExistingServer: false, cwd: '../..' },
    { command: 'pnpm nx serve api', url: 'http://127.0.0.1:4302/api/health/live', reuseExistingServer: false, cwd: '../..' }
  ]
});
